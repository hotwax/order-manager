export interface BulkTaskCard {
  task: {
    workEffortId: string;
    orderId: string;
    shipGroupSeqId?: string | null;
  };
}

export function orderTaskTarget(card: BulkTaskCard) {
  return card.task.orderId;
}

export function shipGroupTaskTarget(card: BulkTaskCard) {
  return `${card.task.orderId}|${card.task.shipGroupSeqId}`;
}

export function groupTaskCardsByTarget<T>(cards: T[], target: (card: T) => string): T[][] {
  const groups = new Map<string, T[]>();

  cards.forEach((card) => {
    const key = target(card);
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  });

  return [...groups.values()];
}

export function countTaskTargets<T>(cards: T[], target: (card: T) => string): number {
  return groupTaskCardsByTarget(cards, target).length;
}

export function selectedTaskCardsById<TTask extends { workEffortId: string }, TCard>(
  tasks: TTask[],
  selected: Record<string, boolean>,
  cardRefs: Record<string, TCard | undefined>,
): TCard[] {
  return tasks.flatMap((task) => {
    if (!selected[task.workEffortId]) return [];
    const card = cardRefs[task.workEffortId];
    return card ? [card] : [];
  });
}

export async function runGroupedTaskMutation<T>(
  cards: T[],
  target: (card: T) => string,
  mutateTarget: (representative: T) => Promise<unknown>,
  transitionTask: (card: T) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]> {
  const groupResults = await Promise.all(groupTaskCardsByTarget(cards, target).map(async (group) => {
    try {
      await mutateTarget(group[0]);
    } catch (reason) {
      return group.map(() => ({ status: 'rejected', reason } as PromiseRejectedResult));
    }

    // The business mutation is target-scoped, while lifecycle state belongs to
    // each selected WorkEffort. Keep those phases separate so a task-status
    // failure cannot make a successful order mutation look safe to repeat.
    return Promise.allSettled(group.map((card) => transitionTask(card)));
  }));

  return groupResults.flat();
}
