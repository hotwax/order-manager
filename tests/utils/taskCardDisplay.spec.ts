import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  formatTaskAmount,
  formatTaskDate,
  taskAgeLabel,
  taskCreatedTimestampLabel,
  taskOrderSubtitle,
  taskOrderTitle,
} from '@/utils/taskCardDisplay';

describe('taskCardDisplay', () => {
  it('falls back to order id when a task has no order name', () => {
    expect(taskOrderTitle({ orderName: '', orderId: 'RISKTEST_CANCEL_MANUAL', workEffortId: 'M100001' }))
      .toBe('RISKTEST_CANCEL_MANUAL');
  });

  it('formats millisecond order dates for task card subtitles', () => {
    expect(formatTaskDate(1780588920000)).toBe('Jun 4, 2026');
  });

  it('builds the shared ordered-date subtitle', () => {
    expect(taskOrderSubtitle(1780588920000, 'Ordered')).toBe('Ordered Jun 4, 2026');
    expect(taskOrderSubtitle(null, 'Ordered')).toBe('');
  });

  it('formats valid task amounts and hides missing totals', () => {
    expect(formatTaskAmount(63)).toBe('$63.00');
    expect(formatTaskAmount(null)).toBe('');
    expect(formatTaskAmount('not-a-number')).toBe('');
  });

  it('formats task age using the BOPIS relative-time pattern', () => {
    const base = DateTime.fromISO('2026-07-14T12:00:00Z');

    expect(taskAgeLabel('2026-07-12T12:00:00Z', 'Created', base)).toBe('Created 2 days ago');
    expect(taskAgeLabel(null, 'Created', base)).toBe('');
  });

  it('provides an exact task-created timestamp for the age badge', () => {
    expect(taskCreatedTimestampLabel('2026-07-12T12:00:00Z', 'Task created'))
      .toContain('Task created: Jul 12, 2026');
  });
});
