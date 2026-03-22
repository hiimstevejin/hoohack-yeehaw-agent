export function createVoiceEvent(context, event) {
    return {
        ...event,
        roomName: context.roomName,
        sessionId: context.sessionId,
        ts: Date.now(),
    };
}
