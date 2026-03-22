import WebSocket from 'ws';
import { writableIterator } from '../utils.js';
import { createVoiceEvent } from '../types.js';
export class AssemblyAISTT {
    apiKey;
    sampleRate;
    formatTurns;
    context;
    bufferIterator = writableIterator();
    connectionPromise = null;
    get connection() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        this.connectionPromise = new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                sample_rate: this.sampleRate.toString(),
                format_turns: String(this.formatTurns),
            });
            console.log('[meet/voice-agent-server] assemblyai connect', {
                roomName: this.context.roomName,
                sessionId: this.context.sessionId,
                sampleRate: this.sampleRate,
                formatTurns: this.formatTurns,
            });
            const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params.toString()}`, {
                headers: {
                    Authorization: this.apiKey,
                },
            });
            ws.on('open', () => {
                console.log('[meet/voice-agent-server] assemblyai open', {
                    roomName: this.context.roomName,
                    sessionId: this.context.sessionId,
                });
                resolve(ws);
            });
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'Turn') {
                        console.log('[meet/voice-agent-server] assemblyai turn', {
                            roomName: this.context.roomName,
                            sessionId: this.context.sessionId,
                            endOfTurn: message.end_of_turn,
                            turnIsFormatted: message.turn_is_formatted,
                            endOfTurnConfidence: message.end_of_turn_confidence,
                            transcript: message.transcript.slice(0, 120),
                        });
                        if (message.end_of_turn && message.transcript) {
                            this.bufferIterator.push(createVoiceEvent(this.context, {
                                type: 'stt_output',
                                transcript: message.transcript,
                            }));
                        }
                        else if (message.transcript) {
                            this.bufferIterator.push(createVoiceEvent(this.context, {
                                type: 'stt_chunk',
                                transcript: message.transcript,
                            }));
                        }
                    }
                    if (message.type === 'Error') {
                        throw new Error(message.error);
                    }
                }
                catch (error) {
                    console.error('[meet/voice-agent-server] assemblyai message error', error);
                }
            });
            ws.on('error', (error) => {
                console.error('[meet/voice-agent-server] assemblyai error', {
                    roomName: this.context.roomName,
                    sessionId: this.context.sessionId,
                    error,
                });
                this.bufferIterator.cancel();
                reject(error);
            });
            ws.on('close', () => {
                console.log('[meet/voice-agent-server] assemblyai close', {
                    roomName: this.context.roomName,
                    sessionId: this.context.sessionId,
                });
                this.connectionPromise = null;
            });
        });
        return this.connectionPromise;
    }
    constructor(options) {
        this.apiKey = options.apiKey ?? process.env.ASSEMBLYAI_API_KEY ?? '';
        this.sampleRate = options.sampleRate ?? 16000;
        this.formatTurns = options.formatTurns ?? true;
        this.context = {
            roomName: options.roomName,
            sessionId: options.sessionId,
        };
        if (!this.apiKey) {
            throw new Error('AssemblyAI API key is required.');
        }
    }
    async sendAudio(buffer) {
        if (buffer.byteLength > 0) {
            console.log('[meet/voice-agent-server] assemblyai sendAudio', {
                roomName: this.context.roomName,
                sessionId: this.context.sessionId,
                bytes: buffer.byteLength,
            });
        }
        const conn = await this.connection;
        conn.send(buffer);
    }
    async *receiveEvents() {
        yield* this.bufferIterator;
    }
    async close() {
        if (!this.connectionPromise) {
            return;
        }
        const ws = await this.connectionPromise;
        ws.close();
    }
}
