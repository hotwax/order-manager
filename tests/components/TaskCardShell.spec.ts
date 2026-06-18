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

  it('keeps the task identifier chip centered apart from heading end content', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');

    expect(taskShell).toContain(":class=\"{ 'task-card-heading-has-chip': chipLabel }\"");
    expect(taskShell).toContain('class="task-card-heading-chip"');
    expect(taskShell).toContain('button');
    expect(taskShell).toContain('@click="copyChipLabel"');
    expect(taskShell).toContain('copyOutline');
    expect(taskShell).toContain('await copyContact(props.chipLabel);');
    expect(taskShell).not.toContain('slot="end" outline color="medium"');
    expect(taskShell).toContain('.task-card-heading-has-chip .task-card-heading-title');
    expect(taskShell).toContain('position: absolute;');
    expect(taskShell).toContain('inset-inline-start: 50%;');
    expect(taskShell).toContain('transform: translateX(-50%);');
    expect(taskShell).toContain('position: static;');
  });

  it('renders the mapped linear progress component only when a progress value exists', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');

    expect(taskShell).toContain('IonProgressBar');
    expect(taskShell).toContain('<ion-progress-bar');
    expect(taskShell).toContain('v-if="normalizedProgressValue !== undefined"');
    expect(taskShell).toContain(':value="normalizedProgressValue"');
    expect(taskShell).toContain(':color="progressColor || undefined"');
    expect(taskShell).toContain('const normalizedValue = value > 1 ? value / 100 : value;');
    expect(taskShell).toContain('return Math.max(0, Math.min(1, normalizedValue));');
  });
});
