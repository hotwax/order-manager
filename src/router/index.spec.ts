import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('router', () => {
  it('registers settings as an authenticated shell route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8');

    expect(source).toContain("path: '/settings'");
    expect(source).toContain("name: 'Settings'");
    expect(source).toContain('beforeEnter: authGuard');
  });

  it('registers unfillable as a real authenticated route before the catch-all', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8');

    expect(source).toContain("import UnfillableOrders from '@/views/UnfillableOrders.vue';");
    expect(source).toContain("path: '/unfillable'");
    expect(source).toContain("name: 'UnfillableOrders'");
    expect(source).toContain('component: UnfillableOrders');
    expect(source).toContain('permissionId: SWAP_ORDER_PERMISSION');
    expect(source.indexOf("path: '/unfillable'")).toBeLessThan(source.indexOf("path: '/:pathMatch(.*)*'"));
  });
});
