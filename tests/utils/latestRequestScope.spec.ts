import { describe, expect, it, vi } from 'vitest';
import { createLatestRequestScope } from '@/utils/latestRequestScope';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('latest request scope for view-owned loaders', () => {
  it('publishes and settles only the newest out-of-order success', async () => {
    const older = deferred<number>();
    const newer = deferred<number>();
    const publish = vi.fn();
    const settle = vi.fn();
    const scope = createLatestRequestScope();

    const olderLoad = scope.run(() => older.promise, { onSuccess: publish, onSettled: settle });
    const newerLoad = scope.run(() => newer.promise, { onSuccess: publish, onSettled: settle });

    newer.resolve(22);
    await newerLoad;
    older.resolve(11);
    await olderLoad;

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(22);
    expect(settle).toHaveBeenCalledOnce();
  });

  it('ignores an older failure after the newest request succeeds', async () => {
    const older = deferred<number>();
    const newer = deferred<number>();
    const publish = vi.fn();
    const fail = vi.fn();
    const scope = createLatestRequestScope();

    const olderLoad = scope.run(() => older.promise, { onSuccess: publish, onError: fail });
    const newerLoad = scope.run(() => newer.promise, { onSuccess: publish, onError: fail });

    newer.resolve(22);
    await newerLoad;
    older.reject(new Error('STORE_A failed late'));
    await olderLoad;

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(22);
    expect(fail).not.toHaveBeenCalled();
  });

  it('invalidates pending work when the view scope is cleared', async () => {
    const pending = deferred<number>();
    const publish = vi.fn();
    const settle = vi.fn();
    const scope = createLatestRequestScope();

    const load = scope.run(() => pending.promise, { onSuccess: publish, onSettled: settle });
    scope.invalidate();
    pending.resolve(11);
    await load;

    expect(publish).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });
});
