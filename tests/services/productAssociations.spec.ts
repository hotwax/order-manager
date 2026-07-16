import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  createSubstituteAssociation,
  expireSubstituteAssociation,
  fetchActiveSubstitutes,
} from '@/services/productAssociations';

vi.mock('@common', () => ({ api: vi.fn() }));

describe('product substitute associations', () => {
  beforeEach(() => vi.mocked(api).mockReset());

  it('returns active outgoing substitute relationships', async () => {
    vi.mocked(api).mockResolvedValue({ data: [{
      productId: 'SOURCE',
      productIdTo: 'SUB_1',
      productAssocTypeId: 'PRODUCT_SUBSTITUTE',
      fromDate: '2025-01-01T00:00:00Z',
    }, {
      productId: 'SOURCE',
      productIdTo: 'COMPONENT',
      productAssocTypeId: 'PRODUCT_COMPONENT',
    }] });
    await expect(fetchActiveSubstitutes('SOURCE')).resolves.toEqual([expect.objectContaining({ productIdTo: 'SUB_1' })]);
  });

  it('creates and expires relationships through the existing association endpoint', async () => {
    vi.mocked(api).mockResolvedValue({ data: {} });
    await createSubstituteAssociation('SOURCE', 'SUB_1');
    await expireSubstituteAssociation('SOURCE', {
      productId: 'SOURCE',
      productIdTo: 'SUB_1',
      productAssocTypeId: 'PRODUCT_SUBSTITUTE',
      fromDate: '2025-01-01T00:00:00Z',
    });
    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/products/SOURCE/assocs',
      method: 'POST',
      data: { productId: 'SOURCE', productIdTo: 'SUB_1', productAssocTypeId: 'PRODUCT_SUBSTITUTE' },
    });
    expect(api).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: 'oms/products/SOURCE/assocs',
      method: 'POST',
      data: expect.objectContaining({ productIdTo: 'SUB_1', thruDate: expect.any(Number) }),
    }));
  });
});
