export const iife = (fn) => fn();
export function writableIterator() {
    const deferred = [];
    let signalResolver = null;
    const stream = {
        push(value) {
            deferred.push({ value, done: false });
            signalResolver?.();
            signalResolver = null;
        },
        cancel() {
            deferred.push({ value: undefined, done: true });
            signalResolver?.();
            signalResolver = null;
        },
        async next() {
            while (true) {
                if (deferred.length > 0) {
                    return deferred.shift();
                }
                await new Promise((resolve) => {
                    signalResolver = resolve;
                });
            }
        },
        async return() {
            return { value: undefined, done: true };
        },
        async throw(error) {
            throw error;
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
    return stream;
}
