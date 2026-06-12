import { describe, expect, it } from 'vitest';
import { formatTaskDate, taskOrderTitle } from '@/utils/taskCardDisplay';

describe('taskCardDisplay', () => {
  it('falls back to order id when a task has no order name', () => {
    expect(taskOrderTitle({ orderName: '', orderId: 'RISKTEST_CANCEL_MANUAL', workEffortId: 'M100001' }))
      .toBe('RISKTEST_CANCEL_MANUAL');
  });

  it('formats millisecond order dates for task card subtitles', () => {
    expect(formatTaskDate(1780588920000)).toBe('Jun 4, 2026');
  });
});
