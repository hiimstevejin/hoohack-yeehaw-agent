# Meet Migration Guide

## Purpose

This guide documents:

- what exists today in `/meet`
- what logic exists in `/video-call-app` and `/voice-sandwich-demo`
- how to maintain `/meet` while extending it
- how to implement gesture-based document manipulation in `/meet`
- how to implement voice-agent invocation in `/meet`
- whether the migration is feasible

The short answer is yes: the migration is feasible, but it is not a copy-paste migration. Gesture logic is portable with moderate refactoring. The document scene model is portable with moderate refactoring. The voice-agent logic is feasible, but the current `/voice-sandwich-demo` pipeline and `/video-call-app` voice flow solve different problems, so you need to choose one voice architecture for `/meet` instead of merging both blindly.

## Current State of `/meet`

`/meet` is a relatively thin Next.js + LiveKit application.

Relevant files:

- [app/rooms/[roomName]/PageClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/rooms/[roomName]/PageClientImpl.tsx)
- [app/custom/VideoConferenceClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/custom/VideoConferenceClientImpl.tsx)
- [app/api/connection-details/route.ts](/Users/stevejin/Desktop/idea/meet/app/api/connection-details/route.ts)
- [app/layout.tsx](/Users/stevejin/Desktop/idea/meet/app/layout.tsx)

What `/meet` already does well:

- handles room join flow
- provisions LiveKit connection details and participant tokens
- enables camera and microphone
- renders the default `VideoConference` prefab from `@livekit/components-react`
- allows `canPublishData`, which is important for syncing non-media state

What `/meet` does not currently have:

- document viewer or document scene model
- shared whiteboard / annotation state
- gesture detection
- any AI route handlers
- any transcription or TTS backend
- any custom room-level side panels for document state, transcript state, or agent state

That matters because you are not porting features into an existing collaboration model. You are adding a new application layer around LiveKit.

## What Exists in `/video-call-app`

The relevant source areas are:

- gesture engine:
  - [lib/gesture-engine/classifier.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/classifier.ts)
  - [lib/gesture-engine/state-machine.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/state-machine.ts)
  - [lib/gesture-engine/config.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/config.ts)
  - [lib/gesture-engine/use-gesture-sandbox.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/use-gesture-sandbox.ts)
- document interaction:
  - [lib/document-viewer/use-document-sandbox.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/document-viewer/use-document-sandbox.ts)
  - [lib/document-viewer/annotation-utils.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/document-viewer/annotation-utils.ts)
  - [lib/scene-engine/index.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/scene-engine/index.ts)
- voice trigger and browser recording:
  - [lib/ai/use-voice-agent.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/use-voice-agent.ts)
- AI backend routes:
  - [app/api/rooms/[roomId]/ai/transcribe/route.ts](/Users/stevejin/Desktop/idea/video-call-app/app/api/rooms/[roomId]/ai/transcribe/route.ts)
  - [app/api/rooms/[roomId]/ai/query/route.ts](/Users/stevejin/Desktop/idea/video-call-app/app/api/rooms/[roomId]/ai/query/route.ts)
- document ingestion and chunking:
  - [lib/ai/chunking.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/chunking.ts)
  - [lib/ai/ingestion.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/ingestion.ts)

### Gesture Engine Summary

The gesture engine in `/video-call-app` is local and browser-side. That is good. It means it is mostly independent from Supabase and can be reused.

Key behaviors:

- MediaPipe hand landmark detection runs in the browser.
- gestures are classified from landmarks, not from server data
- a state machine turns raw poses into stable gestures and mode transitions
- hold durations and cooldowns are already implemented
- output is a stream of semantic events such as:
  - `ENTER_ANNOTATION_MODE`
  - `ACTIVATE_AI_LISTENING`
  - `EXIT_MODE`

Detected gestures include:

- `OPEN_PALM`
- `FIST`
- `PINCH`
- `PEACE_SIGN`
- `THREE_FINGERS`
- `INDEX_ONLY`
- `THUMBS_UP`

The state machine is already the right abstraction. Do not migrate the sandbox UI as-is; migrate the engine and the state machine.

### Document Interaction Summary

`/video-call-app` has more than a viewer. It has a local scene model for document transforms and annotations.

Current gesture mapping in practice:

- one-hand pinch moves the document
- two-hand pinch zooms the document
- peace sign hold enters annotation mode
- pinch in annotation mode starts or continues drawing
- three fingers acts as eraser mode
- open palm hold exits mode
- fist hold enters AI listening mode

Important implementation detail:

The document manipulation logic depends on a local scene store, not directly on React component state. That is the right shape for `/meet` too.

### Voice Logic Summary in `/video-call-app`

The current browser voice flow in `/video-call-app` is simpler than `/voice-sandwich-demo`.

What it does:

- waits for either a gesture or button to begin listening
- records microphone audio with `MediaRecorder`
- submits one recorded blob to `/api/rooms/[roomId]/ai/transcribe`
- gets a text transcript back
- sends the transcript into `/api/rooms/[roomId]/ai/query`
- receives a structured action / grounded answer

This is a turn-based voice command system, not a full duplex streaming voice agent.

That distinction matters. This logic is much easier to add to `/meet` first.

### Document Chunking and Ingestion Summary

`/video-call-app` already has the core document ingestion logic that `/meet` should reuse.

What it does:

- extracts PDF text with `pdf-parse`
- groups text by page
- creates overlapping chunks from normalized page text
- computes lightweight deterministic embeddings
- records chunk metadata such as page number, offsets, and token count
- detects special document kinds such as 13F filings
- parses structured 13F holdings when applicable
- returns ingestion status and status message

Why this matters:

- grounded document Q&A depends on it
- document-aware voice-agent tools depend on it
- it is mostly server-side and portable even though the rest of `/meet` is LiveKit-based

What should migrate:

- PDF extraction flow from [ingestion.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/ingestion.ts)
- chunk creation and tokenization from [chunking.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/chunking.ts)
- ingestion status lifecycle and related types

What should be adapted:

- storage and persistence model
- room/document authorization model
- where chunk records and embeddings are stored
- how retrieval reads the chunk index

## What Exists in `/voice-sandwich-demo`

The relevant source areas are:

- server pipeline:
  - [components/typescript/src/index.ts](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/typescript/src/index.ts)
  - [components/typescript/src/types.ts](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/typescript/src/types.ts)
- browser websocket client:
  - [components/web/src/lib/websocket.ts](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/web/src/lib/websocket.ts)

### Voice Pipeline Summary

`/voice-sandwich-demo` is a real-time event pipeline:

1. client streams raw audio over WebSocket
2. STT emits partial and final transcript events
3. agent emits streaming text, tool calls, and tool results
4. TTS emits audio chunks back to the client

Its strengths:

- low-latency streaming architecture
- explicit event model
- better observability for voice turns
- clean stage boundaries: STT, agent, TTS

Its limitations for direct reuse in `/meet`:

- it is a separate server architecture, not a Next.js route pattern
- it expects a dedicated WebSocket endpoint
- its agent is demo-specific
- its current tools are sandwich-order tools, not document-meeting tools
- it does not integrate with LiveKit room state or document state

This means the demo is useful as an architecture reference, not as a drop-in module.

## Feasibility Assessment

## Verdict

Migration to `/meet` is feasible.

Feasibility by area:

- gesture detection: high feasibility
- gesture-based document manipulation: high feasibility
- browser-side voice invocation: high feasibility
- full streaming voice agent from `/voice-sandwich-demo`: medium feasibility
- one-shot document-grounded voice Q&A from `/video-call-app`: high feasibility
- complete Supabase-backed room/document model from `/video-call-app`: medium feasibility

## Why It Is Feasible

Three facts make this practical:

1. `/meet` already has a stable real-time transport layer through LiveKit.
2. gesture recognition in `/video-call-app` is already local and modular.
3. LiveKit tokens in `/meet` already allow `canPublishData`, so scene patches and agent events can be synchronized through LiveKit data channels.

## What Is Not Directly Portable

These parts should not be copied into `/meet` without redesign:

- Supabase room access checks
- Supabase storage upload assumptions
- Supabase-backed scene persistence
- sandwich demo tool definitions and prompts
- standalone WebSocket pipeline server shape from `/voice-sandwich-demo`

## Recommended Migration Strategy

Do this in phases. Do not try to port everything in one pass.

### Phase 1: Extend `/meet` with a Custom Room Shell

Problem:

`VideoConference` is currently rendered as a prefab, which leaves little room for a synchronized document stage and custom side panels.

Recommendation:

- keep LiveKit for room, tracks, and device state
- wrap or replace the default layout with a room shell that includes:
  - video area
  - document stage
  - transcript / AI panel
  - gesture / mode indicator

Suggested new structure:

- `components/room/MeetRoomShell.tsx`
- `components/document/DocumentStage.tsx`
- `components/ai/VoiceAgentPanel.tsx`
- `lib/collab/*`
- `lib/gesture/*`
- `lib/document/*`

You do not need to rewrite LiveKit internals. You need to own more of the page layout.

### Phase 2: Port the Gesture Engine

Port these modules first:

- `classifier.ts`
- `config.ts`
- `normalization.ts`
- `state-machine.ts`
- `types.ts`

Then build a `/meet`-specific hook:

- `lib/gesture/useGestureEngine.ts`

What to change during the port:

- remove sandbox-specific debug UI assumptions
- expose a clean subscription API for gesture frames
- allow attaching to a selected video source:
  - local webcam
  - a dedicated local preview element

Important design rule:

Run gesture detection only for the local participant. Do not try to infer remote participants' gestures from subscribed video tracks in the first milestone.

### Phase 3: Rebuild Document State for `/meet`

Do not start with file persistence. Start with in-room document interaction.

Port or adapt:

- scene engine types and patch semantics
- annotation utils
- transform logic for drag and zoom
- annotation stroke model

Recommended `/meet` modules:

- `lib/document/types.ts`
- `lib/document/scene-store.ts`
- `lib/document/patches.ts`
- `lib/document/useDocumentScene.ts`
- `lib/document/annotation-utils.ts`

Recommended synchronization model:

- local participant applies scene patches optimistically
- scene patches are broadcast through LiveKit data messages
- remote participants apply the same patches deterministically

This replaces the Supabase realtime dependency for live collaboration.

Persistence can come later through database or object storage if needed.

### Phase 4: Implement Gesture-Based Document Manipulation

Start with the narrowest useful set:

- `PINCH` drag for panning document
- two-hand `PINCH` distance for zoom
- `PEACE_SIGN` hold for annotation mode
- `PINCH` in annotation mode for pen down
- `THREE_FINGERS` for erase
- `OPEN_PALM` hold for exit mode

This set is already validated by the `/video-call-app` design and keeps the interaction model coherent.

Implementation guidance:

- use the existing state-machine concept unchanged
- translate gesture frames into document scene patches
- keep deadzones and smoothing
- preserve cooldowns and hold windows
- treat low-confidence frames as no-op

Do not bind gestures directly to DOM mutations inside components. Convert gestures into scene actions, then apply scene patches.

### Phase 5: Add Voice-Agent Invocation

You have two viable options.

For this `/meet` migration, if you have decided to build a live conversational copilot, treat Option B as the selected implementation path and treat Option A as a simpler fallback architecture.

#### Option A: Port the `/video-call-app` turn-based voice flow first

This is the recommended starting point.

Flow:

1. gesture or button enters listening mode
2. browser records microphone audio
3. `/meet` uploads the audio blob to a Next.js route
4. server transcribes it
5. server answers question or emits structured action
6. client updates transcript panel and scene
7. optional text response is shown in UI

Why this should come first:

- simpler operational model
- easier to secure in Next.js
- integrates directly with gesture trigger semantics already implemented in `/video-call-app`
- no WebSocket agent backend required on day one

Recommended new routes in `/meet`:

- `app/api/ai/transcribe/route.ts`
- `app/api/ai/query/route.ts`

#### Option B: Build a streaming voice agent inspired by `/voice-sandwich-demo`

Do this only after Option A works.

Flow:

1. browser streams audio frames
2. backend streams partial STT
3. backend streams agent tokens and tool events
4. backend optionally streams TTS audio
5. client renders live transcript and optionally plays agent speech

Why this is second:

- more moving parts
- needs a streaming transport
- needs interruption handling
- needs turn management with LiveKit room UX
- needs careful microphone ownership if the user is already in a live call

This path is good if you want a true conversational in-meeting copilot. It is not the cheapest first implementation.

### Phase 5.5: Add Document Ingestion and Chunking

This should be an explicit migration phase for `/meet`.

Goal:

- port the document extraction, chunking, and ingestion pipeline from `/video-call-app`
- make document content available for retrieval and voice-agent tools

Recommended scope:

- PDF-only first
- page text extraction with `pdf-parse`
- overlapping chunk generation
- deterministic embeddings first, replaceable embedding adapter later
- ingestion statuses:
  - `pending`
  - `processing`
  - `ready`
  - `failed`
  - `unsupported`

Recommended `/meet` modules:

- `lib/ai/chunking.ts`
- `lib/ai/ingestion.ts`
- `lib/ai/types.ts`
- `app/api/documents/[documentId]/ingest/route.ts`

Recommended data flow:

1. user uploads or selects a document
2. `/meet` stores the document bytes
3. server runs ingestion
4. server extracts page text
5. server creates chunks and embeddings
6. server stores ingestion output and status
7. retrieval and voice-agent tools query the chunk index

Important design rule:

- ingestion stays server-side
- retrieval reads structured chunk records
- chunking and ingestion should not be coupled to gesture transport

## Recommended Architecture Inside `/meet`

Use four layers.

### 1. LiveKit Layer

Owns:

- media transport
- participant lifecycle
- data channel transport for scene and agent events

Use LiveKit data packets for:

- scene patches
- annotation events
- agent transcript updates
- agent action messages
- mode changes when relevant

### 2. Local Interaction Layer

Owns:

- gesture engine
- gesture state machine
- local document input interpretation
- UI-only mode indicators

This logic remains client-side.

### 3. Shared Scene Layer

Owns:

- document transform state
- current page
- annotations
- selection / active tool
- maybe transcript history references

This layer must be deterministic and serializable.

### 4. AI Service Layer

Owns:

- transcription
- document extraction and chunking
- ingestion lifecycle and status
- embeddings or embedding adapter
- retrieval
- intent classification
- structured actions
- optional TTS

Do not let the AI layer mutate React state directly. It should return structured actions or patches.

## Maintenance Guide for `/meet`

As `/meet` grows, keep these rules.

### Rule 1: Keep LiveKit Separate From App Features

Do not put gesture logic, document logic, and AI orchestration directly into:

- [app/rooms/[roomName]/PageClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/rooms/[roomName]/PageClientImpl.tsx)
- [app/custom/VideoConferenceClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/custom/VideoConferenceClientImpl.tsx)

Those files should remain room bootstrap and layout entry points.

Use them to mount feature modules, not to contain feature logic.

### Rule 2: Keep Gesture Interpretation Local

Only sync the resulting semantic actions or scene patches.

Do not sync:

- raw landmarks
- raw camera frames
- unstable frame-by-frame gesture guesses

Sync:

- `ENTER_ANNOTATION_MODE`
- `EXIT_MODE`
- document move patch
- document resize patch
- annotation stroke events

That keeps bandwidth and complexity under control.

### Rule 3: Make Scene Patches the Source of Truth

If the document moves because of gesture, mouse, or voice command, it should still become the same scene patch type.

This avoids branching logic by input source.

### Rule 4: Treat Voice as Structured Intent, Not Freeform UI Mutation

The server should return:

- transcript
- intent
- confidence
- parameters
- optional display text

Example:

```json
{
  "intent": "FOCUS_DOCUMENT_SECTION",
  "confidence": 0.88,
  "parameters": {
    "page": 3,
    "region": "top-right"
  },
  "responseText": "Focusing the highlighted section on page 3."
}
```

The client then decides how to apply that safely.

### Rule 5: Add Persistence Only After Real-Time Behavior Is Stable

For first implementation in `/meet`:

- in-memory local scene
- synchronized through LiveKit data messages

Only later add:

- uploaded file persistence
- scene snapshots
- transcript history persistence
- ingestion job tracking
- persisted chunk index and retrieval data

This keeps the first milestone focused on real behavior instead of storage plumbing.

## Concrete Migration Map

### Move With Minimal Changes

These are strong candidates to port almost directly:

- gesture classifier logic
- gesture normalization logic
- gesture state-machine logic
- annotation math utilities
- document transform math
- browser `MediaRecorder`-based voice trigger flow

### Port But Refactor

These should be ported with adaptation:

- `use-gesture-sandbox.ts` into a generic hook
- `use-document-sandbox.ts` into smaller hooks and store modules
- AI event types to fit `/meet` naming and transport
- document chunking and ingestion to fit `/meet` storage and auth model

### Rebuild for `/meet`

These should be redesigned rather than copied:

- Supabase document upload flow
- room access checks
- scene persistence
- voice query backend contract
- streaming agent server

## Biggest Risks

### 1. UI Composition Risk

The default `VideoConference` prefab may be too opinionated for your target meeting UX.

Mitigation:

- own the room shell sooner
- keep LiveKit hooks/components for media, but not necessarily the full prefab layout

### 2. Performance Risk

Gesture detection, live video conferencing, document rendering, and annotation can compete for CPU.

Mitigation:

- run gesture detection only for the local user
- throttle UI publication like `/video-call-app` already does
- avoid rendering debug overlays in production
- lazy-load MediaPipe and document viewer code

### 3. Voice Input Ownership Risk

If the user is already publishing microphone audio into LiveKit, your voice agent recording path must not create confusing UX.

Mitigation:

- make voice invocation explicit
- use push-to-talk or hold-to-listen semantics
- visually separate room mic state from AI listening state

### 4. State Divergence Risk

If local gesture effects mutate the UI directly while remote updates use a different code path, state will drift.

Mitigation:

- one scene patch model
- one reducer/store
- same patch application for local and remote events

## Recommended Implementation Order

1. create a custom room shell in `/meet`
2. port gesture engine into `/meet/lib/gesture`
3. implement local-only document stage and scene store
4. add gesture-based drag and zoom
5. add annotation mode and scene patch synchronization through LiveKit data
6. add turn-based voice invocation using Next.js API routes
7. add document upload and ingestion if needed
8. add streaming voice agent only if the turn-based flow proves too limiting

## Final Recommendation

If your real goal is "gesture-controlled collaborative document handling inside a LiveKit meeting with optional AI assistance", the best path is:

- use `/video-call-app` as the source of truth for gesture and document interaction patterns
- use `/video-call-app` as the source of truth for document chunking and ingestion patterns
- use `/voice-sandwich-demo` only as a reference for future streaming voice architecture
- if you want a live in-meeting copilot, implement voice in `/meet` using the streaming architecture inspired by `/voice-sandwich-demo`
- use LiveKit data channels as the collaboration transport instead of reintroducing Supabase realtime for the first version

## Bottom Line

Yes, it is feasible to migrate these ideas into `/meet`.

More specifically:

- gesture detection can be migrated with moderate effort
- gesture-based document manipulation can be migrated with moderate effort
- voice-agent invocation can be migrated with moderate effort
- document chunking and ingestion can be migrated with moderate effort
- a full streaming conversational voice agent is feasible, but it should be built on top of a stable room shell, scene model, and ingestion pipeline

If you keep the migration modular and avoid copying backend assumptions from the other apps, `/meet` is a strong host for these features.
