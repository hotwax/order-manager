import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('task and ship-group card layout', () => {
  it('keeps new card radii within the Ionic card rules', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');
    const orderDetail = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(taskShell).toContain('border-radius: 8px;');
    expect(orderDetail).toContain('.ship-group-card {\n  border-radius: 8px;\n}');
    expect(taskShell).not.toContain('border-radius: 16px;');
    expect(orderDetail).not.toContain('.ship-group-card {\n  border-radius: 16px;\n}');
  });
});
