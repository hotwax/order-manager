import { describe, expect, it, vi } from 'vitest';
import {
  countTaskTargets,
  orderTaskTarget,
  runGroupedTaskMutation,
  selectedTaskCardsById,
  shipGroupTaskTarget,
} from '@/utils/orderTaskBulk';

function taskCard(workEffortId: string, orderId: string, shipGroupSeqId?: string) {
  return {
    task: { workEffortId, orderId, shipGroupSeqId },
    mutate: vi.fn().mockResolvedValue(undefined),
  };
}

describe('grouped task mutations', () => {
  it('runs one fraud cancellation per order and transitions every selected task separately', async () => {
    const first = taskCard('TASK_1', 'ORDER_1');
    const duplicate = taskCard('TASK_2', 'ORDER_1');
    const otherOrder = taskCard('TASK_3', 'ORDER_2');
    const changeTaskStatus = vi.fn().mockResolvedValue(undefined);

    const results = await runGroupedTaskMutation(
      [first, duplicate, otherOrder],
      orderTaskTarget,
      (card) => card.mutate(),
      (card) => changeTaskStatus(card.task.workEffortId, 'TASK_CANCELLED'),
    );

    expect(first.mutate).toHaveBeenCalledOnce();
    expect(duplicate.mutate).not.toHaveBeenCalled();
    expect(otherOrder.mutate).toHaveBeenCalledOnce();
    expect(changeTaskStatus).toHaveBeenCalledTimes(3);
    expect(changeTaskStatus).toHaveBeenNthCalledWith(1, 'TASK_1', 'TASK_CANCELLED');
    expect(changeTaskStatus).toHaveBeenNthCalledWith(2, 'TASK_2', 'TASK_CANCELLED');
    expect(changeTaskStatus).toHaveBeenNthCalledWith(3, 'TASK_3', 'TASK_CANCELLED');
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
  });

  it('groups Bad Address and Swap mutations by order and ship group', async () => {
    const first = taskCard('TASK_1', 'ORDER_1', '00001');
    const duplicate = taskCard('TASK_2', 'ORDER_1', '00001');
    const otherShipGroup = taskCard('TASK_3', 'ORDER_1', '00002');
    const changeTaskStatus = vi.fn().mockResolvedValue(undefined);

    const results = await runGroupedTaskMutation(
      [first, duplicate, otherShipGroup],
      shipGroupTaskTarget,
      (card) => card.mutate(),
      (card) => changeTaskStatus(card.task.workEffortId, 'TASK_COMPLETED'),
    );

    expect(first.mutate).toHaveBeenCalledOnce();
    expect(duplicate.mutate).not.toHaveBeenCalled();
    expect(otherShipGroup.mutate).toHaveBeenCalledOnce();
    expect(changeTaskStatus).toHaveBeenCalledTimes(3);
    expect(changeTaskStatus).toHaveBeenCalledWith('TASK_1', 'TASK_COMPLETED');
    expect(changeTaskStatus).toHaveBeenCalledWith('TASK_2', 'TASK_COMPLETED');
    expect(changeTaskStatus).toHaveBeenCalledWith('TASK_3', 'TASK_COMPLETED');
    expect(results).toHaveLength(3);
  });

  it('reports a representative failure once for every selected task in that target', async () => {
    const first = taskCard('TASK_1', 'ORDER_1');
    const duplicate = taskCard('TASK_2', 'ORDER_1');
    const failure = new Error('mutation failed');
    first.mutate.mockRejectedValueOnce(failure);
    const completeDuplicate = vi.fn();

    const results = await runGroupedTaskMutation(
      [first, duplicate],
      orderTaskTarget,
      (card) => card.mutate(),
      completeDuplicate,
    );

    expect(duplicate.mutate).not.toHaveBeenCalled();
    expect(completeDuplicate).not.toHaveBeenCalled();
    expect(results).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ]);
  });

  it('does not repeat a successful business mutation when one task transition fails', async () => {
    const first = taskCard('TASK_1', 'ORDER_1');
    const duplicate = taskCard('TASK_2', 'ORDER_1');
    const statusFailure = new Error('status failed');
    const changeTaskStatus = vi.fn()
      .mockRejectedValueOnce(statusFailure)
      .mockResolvedValueOnce(undefined);

    const results = await runGroupedTaskMutation(
      [first, duplicate],
      orderTaskTarget,
      (card) => card.mutate(),
      (card) => changeTaskStatus(card.task.workEffortId, 'TASK_CANCELLED'),
    );

    expect(first.mutate).toHaveBeenCalledOnce();
    expect(duplicate.mutate).not.toHaveBeenCalled();
    expect(changeTaskStatus).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { status: 'rejected', reason: statusFailure },
      { status: 'fulfilled', value: undefined },
    ]);
  });

  it('keeps selected card refs attached to WorkEffort ids when task order changes', () => {
    const firstCard = taskCard('TASK_1', 'ORDER_1');
    const secondCard = taskCard('TASK_2', 'ORDER_2');
    const refs = { TASK_1: firstCard, TASK_2: secondCard };
    const reorderedTasks = [secondCard.task, firstCard.task];

    expect(selectedTaskCardsById(reorderedTasks, { TASK_1: true }, refs)).toEqual([firstCard]);
  });

  it('counts unique business targets independently from selected task count', () => {
    const cards = [
      taskCard('TASK_1', 'ORDER_1', '00001'),
      taskCard('TASK_2', 'ORDER_1', '00001'),
      taskCard('TASK_3', 'ORDER_1', '00002'),
    ];

    expect(countTaskTargets(cards, orderTaskTarget)).toBe(1);
    expect(countTaskTargets(cards, shipGroupTaskTarget)).toBe(2);
  });
});
