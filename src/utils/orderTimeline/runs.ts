import type { TimelineContext, TimelineTransaction } from './transactions';

/** How many back-to-back transactions of one family make a run worth folding. */
export const MIN_RUN = 3;

const RUN_COUNT_KEYS: Partial<Record<TimelineTransaction['kind'], string>> = {
  rejected: '{count} rejections',
  released: '{count} releases',
  brokered: '{count} brokerings',
  moved: '{count} location changes',
};

function runHeadline(run: TimelineTransaction[], ctx: TimelineContext): string {
  const family = run[0].foldFamily;
  if (family === 'location') return ctx.translate('Location changed in Shopify');
  const rejected = run.some((tx) => tx.kind === 'rejected');
  const rebrokered = run.some((tx) => tx.kind !== 'rejected');
  if (rejected && rebrokered) return ctx.translate('Rejected and re-brokered');
  return ctx.translate(rejected ? 'Rejected' : 'Re-brokered');
}

/** "3 rejections and 2 releases". */
function runCounts(run: TimelineTransaction[], ctx: TimelineContext): string {
  const counts = new Map<TimelineTransaction['kind'], number>();
  run.forEach((tx) => counts.set(tx.kind, (counts.get(tx.kind) || 0) + 1));
  const parts = [...counts.entries()].map(([kind, count]) => {
    const key = RUN_COUNT_KEYS[kind];
    return key ? ctx.translate(key, { count }) : `${count}`;
  });
  if (parts.length < 2) return parts[0] || '';
  return ctx.translate('{first} and {last}', { first: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] });
}

/**
 * Fold back-to-back transactions of one family by one actor — a store rejecting and releasing
 * the same item, or Shopify moving an order between locations — into one row that opens onto
 * each of them. Nothing is dropped: the folded row holds every transaction it replaces.
 */
export function foldRuns(transactions: TimelineTransaction[], ctx: TimelineContext): TimelineTransaction[] {
  const folded: TimelineTransaction[] = [];
  let run: TimelineTransaction[] = [];

  const flush = () => {
    if (run.length >= MIN_RUN) {
      const first = run[0];
      const last = run[run.length - 1];
      folded.push({
        id: `run-${first.id}`,
        kind: 'run',
        at: first.at,
        endAt: last.endAt ?? last.at,
        headline: runHeadline(run, ctx),
        details: [runCounts(run, ctx)],
        notes: [],
        reason: '',
        actor: first.actor,
        events: run.flatMap((tx) => tx.events),
        records: [],
        children: run,
      });
    } else {
      folded.push(...run);
    }
    run = [];
  };

  transactions.forEach((tx) => {
    const joins = tx.foldFamily && run.length && run[0].foldFamily === tx.foldFamily && run[0].actor === tx.actor;
    if (joins) {
      run.push(tx);
      return;
    }
    flush();
    if (tx.foldFamily) run = [tx];
    else folded.push(tx);
  });
  flush();

  return folded;
}
