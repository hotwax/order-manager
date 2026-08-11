import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Create Order route', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8');

  it('keeps the Create Order page unregistered', () => {
    expect(source).not.toContain("import CreateOrder from '@/views/CreateOrder.vue'");
    expect(source).not.toContain("path: '/create-order'");
    expect(source).toContain("path: '/:pathMatch(.*)*'");
    expect(source).toContain("redirect: '/funnel'");
  });
});
