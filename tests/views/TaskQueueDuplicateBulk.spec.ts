import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

function viewSource(file: string) {
  return readFileSync(resolve(process.cwd(), 'src/views', file), 'utf8');
}

describe('duplicate task bulk orchestration', () => {
  it('keys Fraud card refs by WorkEffort and separates order cancellation from every task transition', () => {
    const source = viewSource('FraudOrders.vue');

    expect(source).toContain(':ref="(element) => setCardRef(task.workEffortId, element)"');
    expect(source).toContain('selectedTaskCardsById(fraudTasks.value, selectedOrders.value, cardRefs.value)');
    expect(source).toContain('runGroupedTaskMutation(');
    expect(source).toContain('orderTaskTarget');
    expect(source).toContain('card.submitCancelDomain()');
    expect(source).toContain("card.submitTaskStatus('TASK_CANCELLED')");
    expect(source).toContain('countTaskTargets(cards, orderTaskTarget)');
  });

  it('uses shared ship-group targets and separate lifecycle transitions for Bad Address and Swap', () => {
    const badAddress = viewSource('BadAddressOrders.vue');
    const swap = viewSource('SwapOrders.vue');

    expect(badAddress).toContain('groupTaskCardsByTarget(cards, shipGroupTaskTarget)');
    expect(badAddress).toContain('runGroupedTaskMutation(');
    expect(badAddress).toContain("'TASK_COMPLETED' | 'TASK_CANCELLED'");
    expect(badAddress).toContain('card.submitTaskStatus(duplicateStatusId)');
    expect(badAddress).toContain('countTaskTargets(cards, shipGroupTaskTarget)');
    expect(swap).toContain('runGroupedTaskMutation(');
    expect(swap).toContain('shipGroupTaskTarget');
    expect(swap).toContain("action === 'submitPark' ? card.submitParkDomain(facilityId) : card.submitCancelDomain()");
    expect(swap).toContain('card.submitTaskStatus(taskStatusId)');
    expect(swap).toContain('countTaskTargets(cards, shipGroupTaskTarget)');
  });
});
