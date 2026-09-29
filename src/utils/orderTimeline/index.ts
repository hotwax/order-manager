import type { OrderEvent } from '@/utils/orderEvents';
import { dayKey, formatDate, formatDateTime, formatElapsed, formatTime } from '@/utils/format';
import { foldRuns } from './runs';
import { buildTransaction, chainEvents, type TimelineContext, type TimelineTransaction } from './transactions';

export * from './transactions';
export { foldRuns, MIN_RUN } from './runs';

export interface TimelineEntry extends TimelineTransaction {
  /** When it started, as the row shows it. */
  time: string;
  /** Time since the previous entry, e.g. "40 minutes later". */
  elapsed: string;
}

export interface TimelineDay {
  key: string;
  /** "Tuesday, Sep 22, 2026", or "Date unknown". */
  label: string;
  entries: TimelineEntry[];
}

/** The order's events as business transactions, repeated runs folded. Oldest first. */
export function groupTransactions(events: OrderEvent[], ctx: TimelineContext): TimelineTransaction[] {
  return foldRuns(chainEvents(events).map((group) => buildTransaction(group, ctx)), ctx);
}

/** "12:32 PM to 12:41 PM" for a folded run, the end dated when it falls on another day. */
function runSpan(tx: TimelineTransaction, ctx: TimelineContext): string {
  if (!tx.children || tx.at === undefined || tx.endAt === undefined || tx.endAt === tx.at) return '';
  const end = dayKey(tx.at) === dayKey(tx.endAt) ? formatTime(tx.endAt) : formatDateTime(tx.endAt);
  return ctx.translate('{start} to {end}', { start: formatTime(tx.at), end });
}

/** The transactions under a divider per calendar day, in the viewer's time zone. */
export function timelineDays(transactions: TimelineTransaction[], ctx: TimelineContext): TimelineDay[] {
  const days: TimelineDay[] = [];
  let previousEnd: number | undefined;

  transactions.forEach((tx) => {
    const key = tx.at === undefined ? 'undated' : dayKey(tx.at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: tx.at === undefined ? ctx.translate('Date unknown') : formatDate(tx.at, { weekday: true }), entries: [] };
      days.push(day);
    }
    const elapsed = formatElapsed(previousEnd, tx.at);
    const span = runSpan(tx, ctx);
    day.entries.push({
      ...tx,
      details: span ? [...tx.details, span] : tx.details,
      time: formatTime(tx.at),
      elapsed: elapsed ? ctx.translate('{duration} later', { duration: elapsed }) : '',
    });
    if (tx.at !== undefined) previousEnd = tx.endAt ?? tx.at;
  });

  return days;
}
