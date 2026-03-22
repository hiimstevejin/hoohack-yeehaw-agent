export const iife = <T>(fn: () => T) => fn();

export type WritableIterator<T> = AsyncIterableIterator<T> & {
  push(value: T): void;
  cancel(): void;
};

export function writableIterator<T>(): WritableIterator<T> {
  const deferred: IteratorResult<T>[] = [];
  let signalResolver: ((value: void) => void) | null = null;

  const stream: WritableIterator<T> = {
    push(value: T) {
      deferred.push({ value, done: false });
      signalResolver?.();
      signalResolver = null;
    },
    cancel() {
      deferred.push({ value: undefined, done: true });
      signalResolver?.();
      signalResolver = null;
    },
    async next(): Promise<IteratorResult<T>> {
      while (true) {
        if (deferred.length > 0) {
          return deferred.shift()!;
        }

        await new Promise<void>((resolve) => {
          signalResolver = resolve;
        });
      }
    },
    async return(): Promise<IteratorResult<T>> {
      return { value: undefined, done: true };
    },
    async throw(error): Promise<IteratorResult<T>> {
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  return stream;
}
