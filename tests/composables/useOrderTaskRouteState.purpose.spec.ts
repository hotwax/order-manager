import { nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderTaskRouteState } from '@/composables/useOrderTaskRouteState';
import { defaultOrderTaskFilters, type OrderTaskFilters } from '@/types/orderTaskFilters';

const mocks = vi.hoisted(() => ({
  currentQuery: {} as Record<string, string>,
  replace: vi.fn(),
}));

vi.mock('@/router', () => ({
  default: {
    currentRoute: {
      get value() {
        return { query: mocks.currentQuery };
      },
    },
    replace: mocks.replace,
  },
}));

function bind(queue: 'hold' | 'swap', query: Record<string, string>) {
  mocks.currentQuery = query;
  const filters = ref<OrderTaskFilters>(defaultOrderTaskFilters());
  useOrderTaskRouteState(filters, queue);
  return filters;
}

describe('order task route state — hold purpose', () => {
  beforeEach(() => {
    mocks.replace.mockReset().mockResolvedValue(undefined);
  });

  it('seeds the purpose filter from ?purpose= on the Hold queue', () => {
    expect(bind('hold', { purpose: 'SHPFY_SYNC_ERR' }).value.workEffortPurposeTypeId).toBe('SHPFY_SYNC_ERR');
  });

  it('defaults to All when the Hold route carries no purpose', () => {
    expect(bind('hold', {}).value.workEffortPurposeTypeId).toBe('All');
  });

  it.each(['INVALID_ADDRESS', 'NEG_RES_REVIEW', 'REVIEW_RISK_ORDER'])(
    'refuses %s, which belongs to its own queue page, so Hold never lists another queue\'s tasks',
    (purpose) => {
      expect(bind('hold', { purpose }).value.workEffortPurposeTypeId).toBe('All');
    },
  );

  it('ignores a purpose on queues that do not have one', () => {
    expect(bind('swap', { purpose: 'SHPFY_SYNC_ERR' }).value.workEffortPurposeTypeId).toBe('All');
  });

  it('writes the selected purpose back to the route', async () => {
    const filters = bind('hold', {});

    filters.value = { ...filters.value, workEffortPurposeTypeId: 'SHPFY_SYNC_ERR' };
    await nextTick();

    expect(mocks.replace).toHaveBeenCalledWith({ query: { purpose: 'SHPFY_SYNC_ERR' } });
  });

  it('drops the purpose from the route when it goes back to All', async () => {
    const filters = bind('hold', { purpose: 'SHPFY_SYNC_ERR' });

    filters.value = { ...filters.value, workEffortPurposeTypeId: 'All' };
    await nextTick();

    expect(mocks.replace).toHaveBeenCalledWith({ query: {} });
  });
});
