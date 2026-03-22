## Inspiration

I was inspired by the problem I was personally facing and problems financial analysts are facing. Which is that there is limited time to read through document, summarize, and present them in a meaningful way during an online meeting so we created YeeHaw Agent that can do all of that during the meeting

## What it does

Yeehaw Agent has 3 core features

1. Yeehaw Agent can use the ingested pdf documents that are chunked into vector embeddings to answer questions about the document and summarize the document
2. Yeehaw Agent can look up live stock and display it as overlay on user's face
3. Yeehaw Agent can look up news for user and summarize relevant news
   AND HE CAN DO IT WITH VOICE!
   User can invoke Yeehaw with gestures and ask with their own voice which will be answered very quickly through STT agent, Yeehaw and TTS agent working together with tools in the backend.

YeeHaw lives inside a videocall where user can use gestures to highlight their shared screen, erase them too and user actions are detected with Google's Mediapipe (opensource vision model)!

## How we built it

We built a backend server where agent lives, and created tools for the agent to use such as

- getRoomContext and SearchUploadedDocument: to get room context and document chunks from database with room id
- getStockQuote and getStockTimeSeries: to get live stock data with time range from Alphavantage
  -getNewsArticle: to get newsArticle from newdata.io
  -projectStockFromEarningsCall: to reason about future of stock based on document info + stock trend + news data

The agent communicates with the interface via websocket to minimize latency.

As for the storage, we used Supabase to store chunks and room sessions and more

and for the online video-call, we used an api called LiveKit that uses websocket and gRPC our main goal was to get the agent in the voice call so we abstracted away this part for fast development

## Challenges we ran into

Setting good system prompts to route the agent to correct function was challenging as it is indeterministic, we had to ensure consistent behavior through guard railing logic

Managing WebSocket and using procedural pipeline of Speech to Text Agent -> Agent -> Text to Speech Agent was challenging and required us to watch tutorials or ask AI about it.

Deploying the project and connecting them was challenging our frontend is deployed on Vercel but to save cost we decided to expose our backend with cloudflare. Setting this up and ensuring secure connection was a great challenge and required careful monitoring of logs to debug.

Creating UI animation for YeeHaw was fun and challenging as we looked up variety of ai voice animation design.

## Accomplishments that we're proud of

We are proud that we have a demonstratable AI agent living inside a video-call that can ingest big documents that are 20+ pages, use external data and combine it with the provided document, and fun interactions through gestures and voice. And using Google Mediapipe to capture user gesture to trigger events.

## What we learned

We learned to use agents by giving them tools and routing them to correct functions, and we also learned to plan our architecture thoroughly to gain value out of coding with AI.

## What's next for Yeehaw Agent

The next feature we see suitable for Yeehaw is to make it reusable across different platforms like phone calls and adding more features and more power through allowing users to configure what it can do.
