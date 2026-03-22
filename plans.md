# Meet Implementation Plan

## Purpose

This file breaks [guides.MD](/Users/stevejin/Desktop/idea/meet/guides.MD) into a manageable implementation plan for Codex.

This plan assumes:

- `/meet` remains the host application
- LiveKit remains the real-time media layer
- collaborative non-media state is synced through LiveKit data messages
- Phase 5 uses Option B: a streaming voice agent inspired by `/voice-sandwich-demo`

## Delivery Rules

Codex should follow these rules while executing this plan:

- keep phases small and testable
- do not combine gesture, document, and streaming voice work in one large change
- preserve existing `/meet` room join and LiveKit bootstrapping behavior unless a phase explicitly replaces it
- prefer additive modules over invasive edits
- use one shared scene patch model for local and remote updates
- treat streaming voice as a separate subsystem with a clear transport boundary

## High-Level Order

1. establish a custom room shell
2. add collaboration transport for app state
3. port the gesture engine
4. add local file intake UI and the annotation / AI interaction model
5. add document upload, chunking, and ingestion
6. sync shared-screen highlight state across participants
7. add gesture-based shared-screen highlighting
8. add streaming voice-agent transport and backend
9. connect gestures to voice-agent invocation
10. connect voice-agent outputs to uploaded-file and meeting state
11. harden performance, failure handling, and maintainability

## Phase 0: Baseline and Constraints

Status: completed on 2026-03-20

### Goal

Create the implementation scaffolding and architectural boundaries before feature work starts.

### Tasks

- review current room entry points:
  - [app/rooms/[roomName]/PageClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/rooms/[roomName]/PageClientImpl.tsx)
  - [app/custom/VideoConferenceClientImpl.tsx](/Users/stevejin/Desktop/idea/meet/app/custom/VideoConferenceClientImpl.tsx)
- create top-level folders if missing:
  - `components/room`
  - `components/document`
  - `components/ai`
  - `components/gesture`
  - `lib/collab`
  - `lib/document`
  - `lib/gesture`
  - `lib/ai`
- define naming conventions for:
  - scene patches
  - live collaboration events
  - voice streaming events
  - local UI state vs shared room state

### Deliverables

- folder structure created
- a small shared type layer for room app events

### Acceptance Criteria

- no behavior change in `/meet`
- project builds after scaffolding

### Completed Work

- created the planned top-level feature folders under `components/*` and `lib/*`
- added a baseline shared event type layer in `lib/collab/types.ts`
- kept the work additive so no room flow behavior changed during phase 0

### Notes

- phase 0 scaffolding is in place
- build verification for the whole app still depends on the broader repository state at execution time

## Phase 1: Custom Room Shell

Status: completed on 2026-03-20

### Goal

Stop relying entirely on the `VideoConference` prefab layout so `/meet` can host a file panel, gesture status, and AI panels.

### Tasks

- create a custom room shell component:
  - `components/room/MeetRoomShell.tsx`
- keep LiveKit room context and core conference functionality
- embed existing LiveKit conference pieces inside a custom layout instead of only rendering the prefab
- reserve layout regions for:
  - video area
  - file upload / staging panel
  - transcript / voice panel
  - gesture / mode status

### Suggested File Targets

- `components/room/MeetRoomShell.tsx`
- `app/rooms/[roomName]/PageClientImpl.tsx`
- optionally `app/custom/VideoConferenceClientImpl.tsx`

### Dependencies

- none

### Deliverables

- room shell renders successfully
- existing call join flow still works
- sidebar areas exist for file intake, AI, and gesture status

### Acceptance Criteria

- users can still join rooms
- audio and video publishing still work
- custom layout exists without breaking LiveKit controls

### Completed Work

- added `components/room/MeetRoomShell.tsx`
- updated room entry points to render through the custom shell while preserving LiveKit room context
- kept the existing room bootstrap and connection logic in place
- added sidebar areas for file intake, voice agent, and gesture status

### Notes

- the room shell is now the owned layout surface for future file, gesture, and AI features
- the sidebar regions are intentionally simple until later phases attach real state

## Phase 2: Collaboration Transport Layer

Status: completed on 2026-03-20

### Goal

Add a clean app-state synchronization layer on top of LiveKit data channels before document or gesture features depend on it.

### Tasks

- define shared collaboration event types
- create a LiveKit data channel wrapper for:
  - sending scene patches
  - receiving scene patches
  - sending AI events
  - receiving AI events
- separate reliable events from high-frequency events
- decide payload versioning strategy

### Suggested File Targets

- `lib/collab/types.ts`
- `lib/collab/channel.ts`
- `lib/collab/useCollabChannel.ts`
- `lib/collab/serialization.ts`

### Important Design Decisions

- use LiveKit data messages, not raw component props, for shared room state
- only semantic events should be shared
- local transient gesture frames stay local

### Deliverables

- a reusable hook or service for app-level room messages
- test message round-trip between participants

### Acceptance Criteria

- one participant can send a typed message
- another participant can receive and parse it
- invalid payloads fail safely

### Completed Work

- added `lib/collab/serialization.ts` for event encoding, decoding, and validation
- added `lib/collab/channel.ts` as a LiveKit data message wrapper for room app events
- added `lib/collab/useCollabChannel.ts` for React consumers inside room-scoped UI
- expanded `lib/collab/types.ts` with transport-level helpers and send options

### Notes

- the transport layer is implemented but not yet attached to document or AI features
- invalid messages are rejected during decode and surfaced through the hook state

## Phase 3: Port the Gesture Engine

Status: completed on 2026-03-20

### Goal

Reuse the gesture core from `/video-call-app` as a `/meet`-native local interaction subsystem.

### Source References

- [classifier.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/classifier.ts)
- [state-machine.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/state-machine.ts)
- [config.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/config.ts)
- [use-gesture-sandbox.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/use-gesture-sandbox.ts)

### Tasks

- port pure gesture modules first:
  - classifier
  - config
  - normalization
  - state machine
  - types
- create a `/meet` hook:
  - `lib/gesture/useGestureEngine.ts`
- remove sandbox-specific debug dependencies
- support attaching the detector to the local participant preview video
- expose:
  - current frame
  - mode
  - subscription API
  - engine status
  - error state

### Dependencies

- custom room shell from phase 1

### Deliverables

- local gesture engine running for local participant only
- visible local gesture status in the room shell

### Acceptance Criteria

- local camera feed can drive gesture detection
- gestures stabilize via hold windows and cooldowns
- no remote-state sync is required yet

### Completed Work

- ported the gesture core into `lib/gesture/*`
- added `useGestureEngine.ts` as the `/meet` local gesture hook
- kept the first pass local-only and independent from room synchronization
- added a visible gesture status panel to the custom room shell

### Notes

- the current phase uses the local camera feed directly
- later phases can attach the engine to the room's local preview element and document actions

## Phase 4: Local File Intake and Interaction Mode Model

### Goal

Establish the local file intake flow and simplify `/meet` interaction state around screen highlighting and AI listening.

### Source References

- [use-document-sandbox.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/document-viewer/use-document-sandbox.ts)
- [state-machine.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/gesture-engine/state-machine.ts)

### Tasks

- replace the document-rendering panel with a file upload / staging form
- store local file selection metadata in `/meet`
- make `ANNOTATION_MODE` the default resting mode for local gesture work
- keep only the interaction states needed for the current product direction:
  - annotation / highlight
  - erase
  - AI listening
- remove any requirement that a local rendered document stage exist before gesture work starts

### Suggested File Targets

- `components/document/DocumentUploadForm.tsx`
- `components/room/MeetRoomShell.tsx`
- `lib/gesture/state-machine.ts`
- `components/gesture/GestureStatusPanel.tsx`

### Dependencies

- phase 1 room shell

### Deliverables

- sidebar file intake form renders in-room
- local interaction modes reflect the highlight / erase / AI workflow
- no document-rendering dependency remains in the room shell

### Acceptance Criteria

- a user can select a file locally from the room shell
- gesture status reflects annotation mode as the default state
- the room remains usable without a rendered local document stage

## Phase 5: Document Upload, Chunking, and Ingestion

### Goal

Port the document ingestion pipeline from `/video-call-app` so `/meet` can support grounded retrieval and document-aware voice-agent logic.

### Source References

- [chunking.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/chunking.ts)
- [ingestion.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/ingestion.ts)
- [types.ts](/Users/stevejin/Desktop/idea/video-call-app/lib/ai/types.ts)

### Tasks

- add a document upload flow suitable for `/meet`
- port PDF text extraction with `pdf-parse`
- port overlapping chunk generation
- port deterministic embedding generation as the initial embedding strategy
- preserve chunk metadata:
  - page
  - start offset
  - end offset
  - token count
- preserve ingestion statuses:
  - `pending`
  - `processing`
  - `ready`
  - `failed`
  - `unsupported`
- define where `/meet` stores:
  - raw document file metadata
  - chunk records
  - embeddings
  - ingestion status
- add an ingestion route or service trigger
- support PDF-first ingestion and explicitly mark images unsupported until implemented
- keep document rendering out of scope unless a later phase explicitly adds it back

### Suggested File Targets

- `lib/ai/types.ts`
- `lib/ai/chunking.ts`
- `lib/ai/ingestion.ts`
- `lib/document/upload.ts`
- `app/api/documents/[documentId]/ingest/route.ts`
- `app/api/documents/[documentId]/upload/route.ts` or equivalent

### Dependencies

- phase 1 room shell for upload UI placement
- storage choice decided for `/meet`

### Deliverables

- a document can be uploaded or registered in `/meet`
- server ingestion can extract text and produce chunks
- ingestion state is queryable

### Acceptance Criteria

- PDF ingestion produces chunk records with page metadata
- empty or non-extractable PDFs fail with a clear status
- unsupported file types are reported cleanly
- chunk records are usable by retrieval code

## Phase 6: Shared-Screen Highlight Synchronization Across Participants

Status: completed on 2026-03-20

### Goal

Make shared-screen highlighting collaborative across participants using the phase 2 transport layer.

### Tasks

- broadcast highlight actions from local participant gestures
- apply remote highlight events deterministically
- add host/presenter guardrails if only one participant should control highlights initially
- define conflict behavior for simultaneous edits
- sync:
  - highlight strokes
  - erase events
  - screen-focus metadata if needed
  - mode changes only if needed for collaboration

### Suggested File Targets

- `lib/collab/*`
- `lib/gesture/*`
- `components/gesture/*`

### Dependencies

- phase 2 transport
- phase 4 local interaction model

### Deliverables

- multi-participant synchronized shared-screen highlights

### Acceptance Criteria

- participant A highlights the shared screen and participant B sees it
- participant A erases highlights and participant B sees the same result
- late joiners can receive current highlight state through a sync mechanism

### Completed Work

- added a shared highlight scene store with deterministic add, clear, and snapshot merge behavior
- added `scene.patch` usage for screen highlight strokes and clear events
- added `scene.sync_request` and `scene.sync_snapshot` handling for late joiners
- wrapped screen-share tiles in a collaborative overlay that supports manual local highlight creation and clear actions
- added reducer tests for stroke ordering, clear semantics, and snapshot merge behavior

### Notes

- phase 6 intentionally uses manual pointer-driven highlight input on top of shared screens
- gesture-to-highlight mapping remains phase 7 work and can reuse the same synced scene layer

## Phase 7: Gesture-Based Shared-Screen Highlighting

Status: completed on 2026-03-20

### Goal

Map gesture engine output into shared-screen highlighting and erase actions.

### Gesture Scope

- `PINCH` in annotation mode for highlight
- `THREE_FINGERS` for erase
- `FIST` hold for AI listening mode entry
- `OPEN_PALM` hold for AI stop and return to annotation mode

### Tasks

- connect gesture frame stream to shared-screen highlight actions
- add smoothing and deadzones
- preserve the simplified mode transitions used by `/meet`
- convert gesture actions into highlight events or app events
- keep raw gesture frames local
- sync only resulting semantic state changes

### Suggested File Targets

- `lib/gesture/useGestureEngine.ts`
- `lib/gesture/useScreenHighlightController.ts`
- `components/gesture/GestureStatusPanel.tsx`
- `components/room/MeetRoomShell.tsx`

### Dependencies

- phase 3 gesture engine
- phase 4 local interaction model
- phase 6 synchronization

### Deliverables

- gestures control shared-screen highlighting locally
- resulting highlight changes sync to remote participants

### Acceptance Criteria

- pinch highlighting works reliably
- three-finger erase works reliably
- fist entry into AI listening and open-palm return to annotation mode work reliably
- accidental gesture false positives are limited by thresholds and cooldowns

### Completed Work

- hoisted the gesture engine into the room shell so one local tracker now drives both UI status and shared-screen interactions
- added `useScreenHighlightController.ts` to convert stable gesture frames into synced highlight and erase actions
- mapped `PINCH` in drawing mode to sampled highlight rectangles on the active shared screen
- mapped `THREE_FINGERS` in erasing mode to synced clear actions with cooldown and latching
- preserved the existing `FIST` and `OPEN_PALM` mode transitions through the phase 3 state machine
- updated the gesture status panel to report controller targeting and controller state from the shared engine
- added controller helper tests for smoothing, deadzones, and highlight sampling thresholds

### Notes

- phase 7 currently targets the first active shared screen as the gesture-controlled surface
- manual pointer-based highlighting from phase 6 remains available and uses the same sync layer

## Phase 8: Streaming Voice Agent Infrastructure

### Goal

Implement Option B: a streaming voice-agent subsystem inspired by `/voice-sandwich-demo`, adapted for `/meet`.

### Important Note

This is not a direct port. It is a redesign using the same stage model:

- streaming audio input
- streaming STT
- streaming agent events
- streaming TTS output

### Source References

- [voice-sandwich-demo pipeline](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/typescript/src/index.ts)
- [voice-sandwich-demo event types](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/typescript/src/types.ts)
- [voice-sandwich-demo websocket client](/Users/stevejin/Desktop/idea/voice-sandwich-demo/components/web/src/lib/websocket.ts)

### Architecture Tasks

- define a new `/meet` voice event schema
- define a transport choice:
  - WebSocket route or equivalent streaming endpoint
- define server stages:
  - audio ingest
  - STT stream
  - agent stream
  - optional tool execution
  - TTS stream
- define client stages:
  - microphone capture
  - stream upload
  - transcript rendering
  - optional response playback

### Suggested File Targets

- `lib/ai/types.ts`
- `lib/ai/client/voiceSession.ts`
- `lib/ai/client/audioCapture.ts`
- `lib/ai/client/audioPlayback.ts`
- `components/ai/VoiceAgentPanel.tsx`
- `app/api/ai/voice/...` or an equivalent streaming endpoint

### Operational Tasks

- choose STT provider
- choose LLM agent orchestration
- choose TTS provider or defer TTS until later
- handle auth and room scoping for the voice session

### Dependencies

- phase 1 room shell
- phase 2 collaboration transport for agent outputs that need room visibility
- phase 5 ingestion if the voice agent needs grounded uploaded-file retrieval

### Deliverables

- streaming voice session can connect
- partial transcript events appear live
- agent response events stream back live

### Acceptance Criteria

- a user can start and stop a streaming voice session in-room
- partial STT events render before final answer
- final answer streams back without blocking the UI

## Phase 9: Gesture-Triggered Voice Invocation

Status: completed on 2026-03-21

### Goal

Use the gesture engine to enter AI listening mode and start the streaming voice session.

### Tasks

- map `FIST` hold from annotation mode to a local app event that requests AI listening
- define how AI listening coexists with room microphone state
- add a clear listening indicator
- map `OPEN_PALM` hold or explicit UI action to stop / cancel the AI flow and return to annotation mode
- prevent repeated trigger loops with cooldowns

### Suggested File Targets

- `lib/gesture/useGestureEngine.ts`
- `lib/ai/useGestureVoiceInvocation.ts`
- `components/ai/VoiceAgentPanel.tsx`
- `components/gesture/GestureStatusPanel.tsx`

### Dependencies

- phase 3 gesture engine
- phase 8 streaming voice infrastructure

### Deliverables

- gesture can start voice-agent listening
- voice state is visible and controllable

### Acceptance Criteria

- `FIST` hold reliably starts listening from annotation mode
- duplicate starts are prevented
- open palm or UI stop action ends listening cleanly and restores annotation mode

### Completed Work

- added `lib/ai/useVoiceAgentSession.ts` to move voice session ownership to the room shell
- added `lib/ai/useGestureVoiceInvocation.ts` to map gesture action events into guarded voice start and stop requests
- wired `MeetRoomShell` so `FIST` and `OPEN_PALM` drive the same voice session used by the manual panel controls
- updated the voice and gesture panels to show trigger source, cooldown visibility, and meeting-mic coexistence messaging
- added a helper test for gesture-triggered voice invocation cooldown and duplicate prevention

### Notes

- phase 9 keeps room microphone publishing unchanged while the voice agent captures a separate local mic stream
- gesture invocation now shares one voice-session controller with button controls so start and stop logic stays consistent

## Phase 10: Voice-Agent Logic for Meeting and Uploaded-File Actions

Status: completed on 2026-03-21

### Goal

Make the streaming voice agent useful for financial-document analysis in `/meet`, not just connected.

### Tasks

- define financial-document and market-data tools / intents
- connect retrieval over ingested chunk records so the agent can answer questions about uploaded report content
- add live stock-data lookup through Alpha Vantage for voice requests such as "give me the stock data"
- support intents such as:
  - summarize the uploaded financial document
  - answer grounded questions over uploaded report content
  - derive meaningful metrics or conclusions from the uploaded document
  - fetch current stock data related to the company or ticker under discussion
  - show a market-data result as an overlay on top of the shared screen
- define a shared-screen overlay model for agent-driven financial data cards
- allow the local user to dismiss an overlay with an `X` button in the top-right corner
- make agent outputs structured before they affect UI
- convert approved agent actions into:
  - transcript items
  - financial insight cards
  - shared-screen overlay state
  - optional highlight or follow-up suggestions

### Suggested File Targets

- `lib/ai/types.ts`
- `lib/ai/agent.ts`
- `lib/ai/tools/*`
- `lib/document/applyVoiceAction.ts`
- `lib/finance/*`
- `lib/overlay/*`
- `components/ai/VoiceAgentPanel.tsx`
- `components/room/*`

### Dependencies

- phase 4 local interaction model
- phase 5 chunking and ingestion
- phase 8 streaming voice infrastructure

### Deliverables

- voice agent can answer questions about uploaded financial documents using ingested content
- voice agent can fetch live stock data from Alpha Vantage when the request calls for current market information
- voice agent can render a dismissible financial-data overlay on top of the shared screen

### Acceptance Criteria

- grounded document questions are answered from ingested chunk data instead of unsupported freeform guesses
- a request such as "give me the stock data" can resolve to a live Alpha Vantage lookup and visible shared-screen overlay output
- the shared-screen overlay can be closed by the user with an `X` control
- unsupported actions fail safely with explanation

### Completed Work

- added a document-retrieval tool in the voice-agent server that searches the latest ready ingested upload and returns the most relevant chunks for grounded answers
- added an Alpha Vantage stock-quote tool in the voice-agent server for live market-data requests
- updated the voice-agent prompt and tool wiring so financial-document questions prefer retrieval and live market questions prefer the stock tool
- added client-side parsing for structured stock tool results and mapped them into shared-screen overlay cards
- added dismissible financial-data overlays on top of shared-screen tiles with a top-right `X` control
- kept the current implementation on the local `.data/documents` store for the latest-document lookup, with production persistence deferred to phase 11

### Notes

- the current document grounding path reads from the latest ready ingested document available to the current `/meet` instance
- stock overlays render on the active shared screen when a live quote result is returned
- Alpha Vantage access depends on `ALPHA_VANTAGE_API_KEY` being present for the voice-agent server

## Phase 11: Persistence and Retrieval Hardening

Status: completed on 2026-03-21

### Goal

Stabilize persisted document and retrieval state after the first interactive milestones work.

### Tasks

- choose document storage strategy
- choose transcript persistence strategy
- add optional scene snapshot persistence
- harden chunk storage and lookup
- harden ingestion retry behavior
- add retrieval indexing maintenance if needed
- add ingestion observability and status inspection

### Dependencies

- phases 4 through 9 stable

### Deliverables

- persisted documents and optional scene history
- persisted chunk index and reliable ingestion status

### Acceptance Criteria

- document session can survive refresh or rejoin if that is a product requirement
- retrieval still works after rejoin or server restart

### Completed Work

- replaced the local `.data/documents` metadata and chunk store with Supabase-backed document metadata, chunk rows, and raw-file storage
- added room-scoped latest-document hydration so the upload panel survives refresh and rejoin with persisted ingestion status
- updated the voice-agent retrieval path to read the latest ready document from Supabase instead of local process state
- added ingestion attempt tracking and a latest-status inspection route for retry visibility
- persisted room voice turns to Supabase for transcript history and debugging
- added optional persisted screen-highlight snapshots and room rehydration for shared scene state

### Notes

- LiveKit data messages remain the real-time collaboration transport; Supabase is used for durable persistence and restart-safe retrieval
- the Supabase schema and environment setup live in `supabase/schema.sql` and `.env.example`

## Phase 12: Hardening and Performance

### Goal

Prevent the combined system from collapsing under CPU, state, and UX complexity.

### Tasks

- lazy-load MediaPipe and voice modules
- profile local CPU impact during active call + gesture detection + document rendering
- minimize high-frequency re-renders
- add reconnect handling for voice transport
- add failure states for:
  - no mic permission
  - no camera permission
  - STT provider unavailable
  - TTS provider unavailable
  - invalid room state
- add logging for:
  - gesture mode transitions
  - scene patch flow
  - voice pipeline stages

### Dependencies

- earlier phases implemented

### Deliverables

- resilient system behavior under realistic call conditions

### Acceptance Criteria

- application remains usable during live call with active gesture tracking
- voice subsystem failures do not break the meeting

## Recommended Codex Execution Slices

Codex should not attempt the whole plan at once. Use these slices.

### Slice A

- phase 1 only

### Slice B

- phase 2 only

### Slice C

- phase 3 only

### Slice D

- phase 4 only

### Slice E

- phase 5 only

### Slice F

- phase 6 and only the minimum needed sync path

### Slice G

- phase 7 gesture-to-document mapping

### Slice H

- phase 8 voice transport and live transcript only

### Slice I

- phase 9 gesture-triggered voice invocation

### Slice J

- phase 10 structured agent actions

### Slice K

- phases 11 and 12

## First Recommended Build Order for Codex

If you want the fastest path to visible progress:

1. phase 1
2. phase 2
3. phase 4
4. phase 5
5. phase 3
6. phase 7
7. phase 6
8. phase 8
9. phase 9
10. phase 10
11. phase 11

Reason:

- room shell and local interaction model need to exist before complex behaviors can attach to them
- chunking and ingestion need to exist before grounded voice-agent uploaded-file actions
- streaming voice should come after the UI and shared-state architecture is stable

## Explicit Non-Goals for Early Milestones

Do not include these in the first working milestones:

- remote gesture inference
- fully autonomous AI state mutation without structured actions
- advanced storage work before basic upload and ingestion work
- complex multi-controller conflict resolution
- TTS polish before transcript and agent streaming are stable

## Definition of Done for the Project

The project is in a strong first-release state when all of the following are true:

- users can join a `/meet` room in the custom shell
- a file upload / staging panel exists in the room shell
- uploaded documents can be ingested into chunk records
- shared-screen highlights sync across participants
- the local user can control highlighting with gestures
- the local user can invoke a streaming voice agent
- the voice agent can answer grounded uploaded-file questions or trigger structured meeting actions
- failures in gesture or voice subsystems do not break the room
