import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('router', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8');

  it('registers settings as an authenticated shell route', () => {
    expect(source).toMatch(/path: '\/settings',[\s\S]*?name: 'Settings',[\s\S]*?beforeEnter: authGuard/);
  });

  it('protects the order-specific create-return route with return permission', () => {
    expect(source).toContain('ORDER_RETURN_PERMISSION');
    expect(source).toMatch(
      /path: '\/orders\/:orderId\/return',[\s\S]*?name: 'CreateReturn',[\s\S]*?beforeEnter: authGuard,[\s\S]*?permissionId: ORDER_RETURN_PERMISSION/
    );
  });
});
