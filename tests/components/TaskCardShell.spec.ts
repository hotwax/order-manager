import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('task and ship-group card layout', () => {
  it('keeps new card radii within the Ionic card rules', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');
    const workCardStyles = readFileSync(resolve(process.cwd(), 'src/theme/work-card.css'), 'utf8');

    expect(taskShell).toContain('class="ship-group-card"');
    expect(workCardStyles).toContain('.ship-group-card {\n  border-radius: 8px;\n}');
    expect(workCardStyles).not.toContain('border-radius: 16px;');
  });

  it('renders the shared order summary with Ionic card header components', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');

    expect(taskShell).toContain('<ion-card-header>');
    expect(taskShell).toContain('<ion-card-title>{{ title }}</ion-card-title>');
    expect(taskShell).toContain('<ion-card-subtitle v-if="subtitle">{{ subtitle }}</ion-card-subtitle>');
    expect(taskShell).toContain('<ion-card-subtitle v-if="amount">{{ amount }}</ion-card-subtitle>');
    expect(taskShell).toContain('<ion-badge');
    expect(taskShell).toContain('v-if="taskAge"');
    expect(taskShell).toContain('color="dark"');
    expect(taskShell).toContain(':aria-label="taskCreatedTitle"');
    expect(taskShell).toContain("taskAgeLabel(props.taskCreatedDate, translate('Created'))");
    expect(taskShell).not.toContain('chipLabel');
    expect(taskShell).not.toContain('<ion-chip');
    expect(taskShell).not.toContain('<slot name="heading-end"');
  });

  it('orders and renders semantic card actions before the shared view-order action', () => {
    const taskShell = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskCardShell.vue'), 'utf8');

    expect(taskShell).toContain('const orderedActions = computed(() => {');
    expect(taskShell).toContain('primary: 0');
    expect(taskShell).toContain('neutral: 1');
    expect(taskShell).toContain('danger: 2');
    expect(taskShell).toContain('v-for="action in orderedActions"');
    expect(taskShell).toContain("return kind === 'neutral' ? 'medium' : kind;");
    expect(taskShell).toContain('v-if="viewOrderLink" slot="end"');
    expect(taskShell).not.toContain('<slot name="actions"');
    expect(taskShell).not.toContain('<slot name="actions-end"');
  });

  it('uses the same order summary contract on every hold-task card', () => {
    const cardNames = ['BadAddressTaskCard', 'SwapTaskCard', 'FraudTaskCard', 'HoldTaskCard'];

    cardNames.forEach((cardName) => {
      const source = readFileSync(resolve(process.cwd(), `src/components/tasks/${cardName}.vue`), 'utf8');
      expect(source).toContain(':title="taskOrderTitle(task)"');
      expect(source).toContain(':subtitle="taskOrderSubtitle(task.orderDate, translate(\'Ordered\'))"');
      expect(source).toContain(':amount="formatTaskAmount(task.grandTotal)"');
      expect(source).toContain(':task-created-date="task.workEffortCreatedDate"');
      expect(source).toContain(':actions="cardActions"');
      expect(source).toContain(':view-order-link="showViewOrderAction && task.orderId');
      expect(source).not.toContain(':chip-label=');
      expect(source).not.toContain('<template #actions>');
    });
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
