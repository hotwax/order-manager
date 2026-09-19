export interface LatestRequestHandlers<T> {
  onStart?: () => void;
  onSuccess: (value: T) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

export function createLatestRequestScope() {
  let generation = 0;

  return {
    invalidate() {
      generation += 1;
    },
    async run<T>(request: () => Promise<T>, handlers: LatestRequestHandlers<T>) {
      const requestId = ++generation;
      handlers.onStart?.();

      try {
        const value = await request();
        if (requestId !== generation) return false;
        handlers.onSuccess(value);
      } catch (error) {
        if (requestId !== generation) return false;
        handlers.onError?.(error);
      }

      handlers.onSettled?.();
      return true;
    }
  };
}
