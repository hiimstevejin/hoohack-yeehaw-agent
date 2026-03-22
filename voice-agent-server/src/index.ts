import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent, AIMessage } from 'langchain';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import type { WSContext } from 'hono/ws';
import type WebSocket from 'ws';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { AssemblyAISTT } from './assemblyai/index.js';
import { ELEVENLABS_TTS_SYSTEM_PROMPT, ElevenLabsTTS } from './elevenlabs/index.js';
import { readLatestReadyDocument } from './document-store.js';
import { loadVoiceAgentEnv } from './env.js';
import { lookupStockProjection, lookupStockQuote, lookupStockTimeSeries } from './finance.js';
import { lookupNewsArticle } from './news.js';
import { rankDocumentChunks } from './retrieval.js';
import type { MeetVoiceAgentEvent, VoiceSessionContext } from './types.js';
import { createVoiceEvent } from './types.js';
import { iife, writableIterator } from './utils.js';

loadVoiceAgentEnv();

const PORT = Number.parseInt(process.env.PORT ?? process.env.VOICE_AGENT_PORT ?? '8787', 10);

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('/*', cors());

const getStockQuote = tool(
  async ({ symbol, companyName }) => {
    const quote = await lookupStockQuote({ symbol, companyName });
    return JSON.stringify(quote);
  },
  {
    name: 'get_stock_quote',
    description:
      'Fetch the latest stock quote from Alpha Vantage for a ticker symbol or company name when the user asks for live stock data.',
    schema: z.object({
      symbol: z.string().trim().min(1).optional(),
      companyName: z.string().trim().min(1).optional(),
    }),
  },
);

const getStockTimeSeries = tool(
  async ({ symbol, companyName, window }) => {
    const series = await lookupStockTimeSeries({ symbol, companyName, window });
    return JSON.stringify(series);
  },
  {
    name: 'get_stock_time_series',
    description:
      'Fetch a recent stock price time series from Alpha Vantage for a ticker symbol or company name. Use this for trend, chart, day-vs-week-vs-month, or performance-over-time questions.',
    schema: z.object({
      symbol: z.string().trim().min(1).optional(),
      companyName: z.string().trim().min(1).optional(),
      window: z.enum(['1d', '5d', '1m']).default('5d'),
    }),
  },
);

const getNewsArticle = tool(
  async ({ symbol, companyName, query }) => {
    const article = await lookupNewsArticle({ symbol, companyName, query });
    return JSON.stringify(article);
  },
  {
    name: 'get_news_article',
    description:
      'Fetch a recent article from NewsData.io when the user asks for the latest news, headlines, or an article about a company, ticker, or topic.',
    schema: z.object({
      symbol: z.string().trim().min(1).optional(),
      companyName: z.string().trim().min(1).optional(),
      query: z.string().trim().min(1).optional(),
    }),
  },
);

const systemPrompt = `
You are the voice copilot for /meet.
Be concise, direct, and conversational.
Stay scoped to the current room.
You analyze uploaded financial documents and can fetch live stock data.
When the user asks about the uploaded report, use search_uploaded_document before answering.
When the user asks for current stock data, stock price, quote movement, or similar live market information, use get_stock_quote.
When the user asks for stock trend, chart, time series, recent performance, intraday movement, five-day movement, or monthly movement, use get_stock_time_series.
When the user asks for a projection, outlook, or expected stock move grounded in the latest earnings call, use project_stock_from_earnings_call.
When the user asks for recent news, headlines, or an article about a company, ticker, or topic, use get_news_article.
If the user says something like "give me the stock data", infer the relevant ticker from conversation context or the uploaded report when possible.
Ground document answers in the retrieved excerpts and mention page numbers when useful.
For projections, explicitly say the price projection is a simple trend projection, not a guarantee, and cite the earnings-call evidence you used.
Do not claim to have completed actions that are not wired yet.
When live stock data is fetched, present the answer so the UI can also show it in an on-screen overlay.

${ELEVENLABS_TTS_SYSTEM_PROMPT}
`;

function createRoomScopedAgent(roomName: string) {
  const getRoomContext = tool(
    async () => {
      return `The active /meet room is ${roomName}. The product focus is financial-document analysis with grounded retrieval over the latest uploaded report plus live stock lookups when the user asks for current market data.`;
    },
    {
      name: 'get_room_context',
      description: 'Return the current room scope and Phase 8 capabilities.',
      schema: z.object({}),
    },
  );

  const searchUploadedDocument = tool(
    async ({ query }) => {
      const latestDocument = await readLatestReadyDocument(roomName);

      if (!latestDocument) {
        return JSON.stringify({
          kind: 'document_search',
          error: `No ready uploaded document is available yet for room "${roomName}".`,
          results: [],
        });
      }

      const rankedChunks = rankDocumentChunks(latestDocument.chunks, query);

      return JSON.stringify({
        kind: 'document_search',
        documentId: latestDocument.record.id,
        fileName: latestDocument.record.fileName,
        results: rankedChunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          page: chunk.metadata.page,
          score: chunk.score,
          text: chunk.text,
        })),
      });
    },
    {
      name: 'search_uploaded_document',
      description:
        'Search the latest ingested uploaded financial document for the active room and return the most relevant chunks for a user question.',
      schema: z.object({
        query: z.string().min(3),
      }),
    },
  );

  const projectStockFromEarningsCall = tool(
    async ({ symbol, companyName, queryContext }) => {
      const latestDocument = await readLatestReadyDocument(roomName);

      if (!latestDocument) {
        return JSON.stringify({
          kind: 'earnings_call_projection',
          error: `No ready uploaded earnings-call document is available yet for room "${roomName}".`,
          evidence: [],
        });
      }

      const projection = await lookupStockProjection({ symbol, companyName });
      const evidenceQuery = [
        projection.companyName,
        projection.symbol,
        'earnings call outlook guidance demand revenue margin risk forecast projection',
        queryContext,
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ');
      const evidence = rankDocumentChunks(latestDocument.chunks, evidenceQuery, 4).map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        page: chunk.metadata.page,
        score: chunk.score,
        text: chunk.text,
      }));

      return JSON.stringify({
        kind: 'earnings_call_projection',
        symbol: projection.symbol,
        companyName: projection.companyName,
        latestPrice: projection.latestPrice,
        latestTradingDay: projection.latestTradingDay,
        currency: projection.currency,
        oneMonthTrend: {
          absoluteChange: projection.absoluteChange,
          percentChange: projection.percentChange,
        },
        projection: projection.projection,
        source: `${projection.source} + uploaded earnings call`,
        summary: `${projection.summary} Earnings-call evidence is attached so the final answer can cite management commentary.`,
        evidence,
        documentId: latestDocument.record.id,
        fileName: latestDocument.record.fileName,
      });
    },
    {
      name: 'project_stock_from_earnings_call',
      description:
        'Use the latest uploaded earnings-call PDF plus a 1-month stock time series to produce a grounded stock projection with supporting evidence excerpts.',
      schema: z.object({
        symbol: z.string().trim().min(1).optional(),
        companyName: z.string().trim().min(1).optional(),
        queryContext: z.string().trim().min(3).optional(),
      }),
    },
  );

  return createAgent({
    model: 'openai:gpt-4.1-mini',
    tools: [
      getRoomContext,
      searchUploadedDocument,
      getStockQuote,
      getStockTimeSeries,
      getNewsArticle,
      projectStockFromEarningsCall,
    ],
    checkpointer: new MemorySaver(),
    systemPrompt,
  });
}

function inferStockToolHint(transcript: string) {
  const normalized = transcript.toLowerCase();
  const wantsProjection =
    /\b(projection|project|forecast|outlook|guidance|expected move)\b/.test(normalized) &&
    /\b(stock|shares?|price|earnings call|earnings)\b/.test(normalized);

  if (wantsProjection) {
    return 'Routing hint: this request asks for a stock projection grounded in the latest earnings call. Prefer project_stock_from_earnings_call.';
  }

  const wantsTimeSeries =
    /\b(chart|time series|trend|trending|intraday|historical|history|performance|series)\b/.test(
      normalized,
    ) ||
    /\b(1 day|one day|today|intraday|5 day|five day|5 days|five days|1 month|one month|month)\b/.test(
      normalized,
    );

  if (!wantsTimeSeries) {
    return null;
  }

  let window: '1d' | '5d' | '1m' = '5d';

  if (/\b(1 day|one day|today|intraday)\b/.test(normalized)) {
    window = '1d';
  } else if (/\b(1 month|one month|month)\b/.test(normalized)) {
    window = '1m';
  }

  return `Routing hint: this request explicitly asks for stock time-series or chart data. Prefer get_stock_time_series with window="${window}" unless the user clearly asked only for a single current quote.`;
}

function extractEmbeddedTimeSeriesResult(result: string) {
  try {
    const parsed = JSON.parse(result) as {
      kind?: string;
      timeSeries?: unknown;
    };

    if (parsed.kind !== 'earnings_call_projection' || !parsed.timeSeries) {
      return null;
    }

    const timeSeries = parsed.timeSeries as {
      kind?: string;
      window?: string;
      points?: unknown[];
    };

    if (
      timeSeries.kind !== 'stock_time_series' ||
      timeSeries.window !== '1m' ||
      !Array.isArray(timeSeries.points) ||
      timeSeries.points.length < 2
    ) {
      return null;
    }

    return JSON.stringify(timeSeries);
  } catch {
    return null;
  }
}

async function* sttStream(
  context: VoiceSessionContext,
  audioStream: AsyncIterable<Uint8Array>,
): AsyncGenerator<MeetVoiceAgentEvent> {
  let stt: AssemblyAISTT;

  try {
    stt = new AssemblyAISTT({
      ...context,
      sampleRate: 16000,
    });
  } catch (error) {
    console.error('[meet/voice-agent-server] stt init error', {
      roomName: context.roomName,
      sessionId: context.sessionId,
      error,
    });
    yield createVoiceEvent<'error'>(context, {
      type: 'error',
      stage: 'stream',
      message: error instanceof Error ? error.message : 'STT init failed.',
    });
    return;
  }

  const passthrough = writableIterator<MeetVoiceAgentEvent>();

  const producer = iife(async () => {
    try {
      let audioChunkCount = 0;
      for await (const audioChunk of audioStream) {
        audioChunkCount += 1;
        if (audioChunkCount <= 3) {
          console.log('[meet/voice-agent-server] audio chunk', {
            roomName: context.roomName,
            sessionId: context.sessionId,
            bytes: audioChunk.byteLength,
            audioChunkCount,
          });
        }
        await stt.sendAudio(audioChunk);
      }
    } catch (error) {
      console.error('[meet/voice-agent-server] stt producer error', {
        roomName: context.roomName,
        sessionId: context.sessionId,
        error,
      });
      passthrough.push(
        createVoiceEvent<'error'>(context, {
          type: 'error',
          stage: 'stream',
          message: error instanceof Error ? error.message : 'STT producer failed.',
        }),
      );
    } finally {
      await stt.close();
    }
  });

  const consumer = iife(async () => {
    try {
      for await (const event of stt.receiveEvents()) {
        console.log('[meet/voice-agent-server] stt event', {
          roomName: context.roomName,
          sessionId: context.sessionId,
          type: event.type,
          transcript:
            event.type === 'stt_chunk' || event.type === 'stt_output'
              ? event.transcript.slice(0, 80)
              : undefined,
        });
        passthrough.push(event);
      }
    } catch (error) {
      console.error('[meet/voice-agent-server] stt consumer error', {
        roomName: context.roomName,
        sessionId: context.sessionId,
        error,
      });
      passthrough.push(
        createVoiceEvent<'error'>(context, {
          type: 'error',
          stage: 'stream',
          message: error instanceof Error ? error.message : 'STT consumer failed.',
        }),
      );
    }
  });

  try {
    yield* passthrough;
  } finally {
    passthrough.cancel();
    await Promise.allSettled([producer, consumer]);
  }
}

async function* agentStream(
  context: VoiceSessionContext,
  eventStream: AsyncIterable<MeetVoiceAgentEvent>,
): AsyncGenerator<MeetVoiceAgentEvent> {
  const agent = createRoomScopedAgent(context.roomName);
  const threadId = uuidv4();
  let turnInFlight = false;

  for await (const event of eventStream) {
    if (event.type !== 'stt_output') {
      yield event;
      continue;
    }

    if (turnInFlight) {
      console.log('[meet/voice-agent-server] ignoring extra stt_output while turn active', {
        roomName: context.roomName,
        sessionId: context.sessionId,
        transcript: event.transcript.slice(0, 80),
      });
      continue;
    }

    turnInFlight = true;
    yield event;

    try {
      let accumulatedText = '';
      const emittedToolCallIds = new Set<string>();
      const toolHint = inferStockToolHint(event.transcript);
      const stream = await agent.stream(
        {
          messages: [
            ...(toolHint ? [new HumanMessage(toolHint)] : []),
            new HumanMessage(event.transcript),
          ],
        },
        {
          configurable: {
            thread_id: threadId,
          },
          context: {
            roomName: context.roomName,
          },
          streamMode: 'messages',
        } as never,
      );

      for await (const chunk of stream as AsyncIterable<[unknown, unknown]>) {
        const [message] = chunk;

        if (AIMessage.isInstance(message)) {
          if (message.text) {
            const nextText = message.text;
            const deltaText = nextText.startsWith(accumulatedText)
              ? nextText.slice(accumulatedText.length)
              : nextText;

            accumulatedText = nextText;

            if (deltaText) {
              yield createVoiceEvent<'agent_chunk'>(context, {
                type: 'agent_chunk',
                text: deltaText,
              });
            }
          }

          if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              const toolCallId = toolCall.id ?? uuidv4();

              if (emittedToolCallIds.has(toolCallId)) {
                continue;
              }

              emittedToolCallIds.add(toolCallId);
              yield createVoiceEvent<'tool_call'>(context, {
                type: 'tool_call',
                id: toolCallId,
                name: toolCall.name,
                args: toolCall.args,
              });
            }
          }
        }

        if (ToolMessage.isInstance(message)) {
          const normalizedResult =
            typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

          if (message.name === 'project_stock_from_earnings_call') {
            const embeddedTimeSeriesResult = extractEmbeddedTimeSeriesResult(normalizedResult);

            if (embeddedTimeSeriesResult) {
              yield createVoiceEvent<'tool_result'>(context, {
                type: 'tool_result',
                toolCallId: message.tool_call_id ?? '',
                name: 'get_stock_time_series',
                result: embeddedTimeSeriesResult,
              });
            }
          }

          yield createVoiceEvent<'tool_result'>(context, {
            type: 'tool_result',
            toolCallId: message.tool_call_id ?? '',
            name: message.name ?? 'unknown',
            result: normalizedResult,
          });
        }
      }
    } catch (error) {
      console.error('[meet/voice-agent-server] agent error', {
        roomName: context.roomName,
        sessionId: context.sessionId,
        error,
      });
      turnInFlight = false;
      yield createVoiceEvent<'error'>(context, {
        type: 'error',
        stage: 'agent',
        message: error instanceof Error ? error.message : 'Agent stage failed.',
      });
      continue;
    }

    yield createVoiceEvent<'agent_end'>(context, {
      type: 'agent_end',
    });
    turnInFlight = false;
  }
}

async function* ttsStream(
  context: VoiceSessionContext,
  eventStream: AsyncIterable<MeetVoiceAgentEvent>,
): AsyncGenerator<MeetVoiceAgentEvent> {
  const passthrough = writableIterator<MeetVoiceAgentEvent>();
  let tts: ElevenLabsTTS | null = null;
  let ttsUnavailableMessage: string | null = null;
  let ttsConsumerPromise: Promise<void> | null = null;

  const ensureTTSConsumer = () => {
    if (!tts || ttsConsumerPromise) {
      return;
    }

    ttsConsumerPromise = iife(async () => {
      for await (const ttsEvent of tts!.receiveEvents()) {
        passthrough.push(ttsEvent);
      }
    });
  };

  const producer = iife(async () => {
    try {
      const buffer: string[] = [];

      for await (const event of eventStream) {
        passthrough.push(event);

        if (event.type === 'agent_chunk') {
          buffer.push(event.text);
        }

        if (event.type === 'agent_end') {
          if (!tts && !ttsUnavailableMessage) {
            try {
              tts = new ElevenLabsTTS(context);
            } catch (error) {
              ttsUnavailableMessage = error instanceof Error ? error.message : 'TTS init failed.';
              console.error('[meet/voice-agent-server] tts init error', {
                roomName: context.roomName,
                sessionId: context.sessionId,
                error,
              });
              passthrough.push(
                createVoiceEvent<'error'>(context, {
                  type: 'error',
                  stage: 'tts',
                  message: ttsUnavailableMessage,
                }),
              );
            }
          }

          if (tts) {
            ensureTTSConsumer();
            await tts.sendText(buffer.join(''));
          }
          buffer.length = 0;
        }
      }
    } finally {
      await tts?.close();
      await ttsConsumerPromise;
    }
  });

  try {
    yield* passthrough;
  } finally {
    passthrough.cancel();
    await Promise.allSettled([producer, ttsConsumerPromise]);
  }
}

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'meet-voice-agent-server',
  });
});

app.get(
  '/ws',
  upgradeWebSocket((c) => {
    const roomName = c.req.query('roomName') ?? 'meet-room';
    const sessionId = c.req.query('sessionId') ?? uuidv4();
    const context: VoiceSessionContext = {
      roomName,
      sessionId,
    };

    let currentSocket: WSContext<WebSocket> | undefined;
    const inputStream = writableIterator<Uint8Array>();
    let flushPromise: Promise<void> | null = null;

    return {
      onOpen(_, ws) {
        console.log('[meet/voice-agent-server] websocket open', {
          roomName,
          sessionId,
        });
        currentSocket = ws;

        flushPromise = iife(async () => {
          try {
            const transcriptEventStream = sttStream(context, inputStream);
            const agentEventStream = agentStream(context, transcriptEventStream);
            const outputEventStream = ttsStream(context, agentEventStream);

            for await (const event of outputEventStream) {
              currentSocket?.send(JSON.stringify(event));
            }
          } catch (error) {
            console.error('[meet/voice-agent-server] pipeline error', {
              roomName,
              sessionId,
              error,
            });
            currentSocket?.send(
              JSON.stringify(
                createVoiceEvent<'error'>(context, {
                  type: 'error',
                  stage: 'stream',
                  message: error instanceof Error ? error.message : 'Voice pipeline failed.',
                }),
              ),
            );
          }
        });
      },
      onMessage(event) {
        const data = event.data;

        if (Buffer.isBuffer(data)) {
          console.log('[meet/voice-agent-server] websocket message buffer', {
            roomName,
            sessionId,
            bytes: data.byteLength,
          });
          inputStream.push(new Uint8Array(data));
          return;
        }

        if (data instanceof ArrayBuffer) {
          console.log('[meet/voice-agent-server] websocket message arraybuffer', {
            roomName,
            sessionId,
            bytes: data.byteLength,
          });
          inputStream.push(new Uint8Array(data));
          return;
        }

        if (Array.isArray(data)) {
          console.log('[meet/voice-agent-server] websocket message array', {
            roomName,
            sessionId,
            chunks: data.length,
          });
          inputStream.push(new Uint8Array(Buffer.concat(data.map((item) => Buffer.from(item)))));
          return;
        }

        console.log('[meet/voice-agent-server] websocket message unhandled', {
          roomName,
          sessionId,
          dataType: typeof data,
          constructorName:
            typeof data === 'object' && data !== null && 'constructor' in data
              ? (data as { constructor?: { name?: string } }).constructor?.name
              : undefined,
        });
      },
      async onClose() {
        console.log('[meet/voice-agent-server] websocket close', {
          roomName,
          sessionId,
        });
        inputStream.cancel();
        await flushPromise;
      },
      async onError(error, ws) {
        console.error('[meet/voice-agent-server] websocket error', {
          roomName,
          sessionId,
          error,
        });
        ws.send(
          JSON.stringify(
            createVoiceEvent<'error'>(context, {
              type: 'error',
              stage: 'stream',
              message: error instanceof Error ? error.message : 'WebSocket error.',
            }),
          ),
        );
      },
    };
  }),
);

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

injectWebSocket(server);

console.log(`[meet/voice-agent-server] listening on http://localhost:${PORT}`);
