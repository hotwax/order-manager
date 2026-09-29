import { describe, expect, it } from 'vitest';
import { rollUpItemStatuses } from '@/utils/itemStatusBadges';

const item = (statusId: string, status: string, quantity: number, statusColor = 'medium') =>
  ({ statusId, status, statusColor, quantity });

describe('rollUpItemStatuses', () => {
  it('reports one badge per distinct status with the units in it', () => {
    expect(rollUpItemStatuses([
      item('ITEM_APPROVED', 'Approved', 1, 'primary'),
      item('ITEM_APPROVED', 'Approved', 1, 'primary'),
      item('ITEM_COMPLETED', 'Completed', 1, 'success')
    ])).toEqual([
      { label: 'Approved', color: 'primary', count: 2 },
      { label: 'Completed', color: 'success', count: 1 }
    ]);
  });

  it('counts quantities, not lines, so the badges add up to the row total qty', () => {
    const badges = rollUpItemStatuses([
      item('ITEM_APPROVED', 'Approved', 3),
      item('ITEM_CANCELLED', 'Cancelled', 2)
    ]);

    expect(badges.map((badge) => badge.count)).toEqual([3, 2]);
    expect(badges.reduce((total, badge) => total + Number(badge.count), 0)).toBe(5);
  });

  it('keeps a terminal item state visible next to an in-flight one', () => {
    expect(rollUpItemStatuses([
      item('ITEM_APPROVED', 'Approved', 1, 'primary'),
      item('ITEM_CANCELLED', 'Cancelled', 1, 'danger')
    ]).map((badge) => [badge.label, badge.color])).toEqual([
      ['Approved', 'primary'],
      ['Cancelled', 'danger']
    ]);
  });

  it('keeps item order so the badges read in the order the child rows list', () => {
    expect(rollUpItemStatuses([
      item('ITEM_COMPLETED', 'Completed', 1),
      item('ITEM_APPROVED', 'Approved', 1),
      item('ITEM_COMPLETED', 'Completed', 1)
    ]).map((badge) => badge.label)).toEqual(['Completed', 'Approved']);
  });

  it('leaves out an item whose status has no description to name', () => {
    expect(rollUpItemStatuses([
      item('', '', 1),
      item('ITEM_APPROVED', 'Approved', 2)
    ])).toEqual([{ label: 'Approved', color: 'medium', count: 2 }]);
  });

  it('has nothing to report for an empty group', () => {
    expect(rollUpItemStatuses([])).toEqual([]);
  });
});
