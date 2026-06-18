import { describe, expect, it } from 'vitest';
import { isSwapItemUnavailable } from '@/utils/swapItems';

describe('isSwapItemUnavailable', () => {
  it('uses the backend quantityNotAvailable shortage contract', () => {
    expect(isSwapItemUnavailable({ quantityNotAvailable: -1 })).toBe(true);
    expect(isSwapItemUnavailable({ quantityNotAvailable: '-2.5' })).toBe(true);
  });

  it('does not mark items unavailable without an explicit shortage', () => {
    expect(isSwapItemUnavailable({ quantityNotAvailable: 0 })).toBe(false);
    expect(isSwapItemUnavailable({ quantityNotAvailable: 2 })).toBe(false);
    expect(isSwapItemUnavailable({})).toBe(false);
    expect(isSwapItemUnavailable(null)).toBe(false);
  });
});
