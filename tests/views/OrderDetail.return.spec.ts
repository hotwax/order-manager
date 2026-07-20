import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OrderDetail return action', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('routes the action to the order-specific create-return page', () => {
    expect(source).toContain('await router.push(`/orders/${encodeURIComponent(orderId)}/return`)');
    expect(source).not.toContain("router.push({ path: '/returns', query: { q: orderId } })");
  });

  it('requires return permission before rendering or dispatching the action', () => {
    expect(source).toContain("import { ORDER_RETURN_PERMISSION } from '@/authorization/permissions'");
    expect(source).toContain('userStore.hasPermission(ORDER_RETURN_PERMISSION)');
    expect(source).toContain("action.id !== 'RETURN' || canCreateReturn.value");
    expect(source).toContain('if (!orderId || !canCreateReturn.value || !hasReturnableItems.value) return;');
  });

  it('loads authoritative return quantities from the merged order-return API', () => {
    expect(source).toContain("import { getOrderForReturn } from '@/services/returns'");
    expect(source).toContain('const returnableOrder = await getOrderForReturn(orderId)');
    expect(source).toContain('returnableQuantity: item.returnableQty');
    expect(source).toContain('!hasReturnableItems.value');
  });
});
