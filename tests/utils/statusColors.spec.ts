import { describe, expect, it, vi } from 'vitest';

vi.mock('@common', () => ({
  commonUtil: { getStatusColor: (statusId: string) => ({ ORDER_CANCELLED: 'danger', ORDER_COMPLETED: 'success', ORDER_CREATED: 'medium' } as Record<string, string>)[statusId] || 'medium' },
}));

import { returnStatusColor, shopifyReturnStatusColor } from '@/utils/statusColors';

describe('return status colors', () => {
  it('borrow the color of the order status each return status reads like', () => {
    expect(returnStatusColor('RETURN_CANCELLED')).toBe('danger');
    expect(returnStatusColor('RETURN_COMPLETED')).toBe('success');
  });

  it('read Shopify return statuses, falling back to the return map', () => {
    expect(shopifyReturnStatusColor('CANCELED')).toBe('danger');
    expect(shopifyReturnStatusColor('RETURN_COMPLETED')).toBe('success');
  });
});
