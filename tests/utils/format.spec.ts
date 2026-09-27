import { beforeAll, describe, expect, it } from 'vitest';
import { Settings } from 'luxon';
import { translate } from '@common/core/i18n';
import { currencySymbol, formatDate, formatDateTime, formatMoney, formatTime } from '@/utils/format';

// 2:33 PM on Tuesday, Sep 22, 2026 in Los Angeles.
const AT = Date.UTC(2026, 8, 22, 21, 33, 14);

beforeAll(() => {
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('format', () => {
  it.each([
    [1234.5, 'USD', '$1,234.50'],
    [361, 'CAD', 'CA$361.00'],
    [1200, 'JPY', '¥1,200'],
    [12, undefined, '$12.00'],
    [12, 'NOPE', '12.00 NOPE'],
    ['not a number', 'USD', '$0.00'],
  ])('shows %j %s as %s', (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });

  it('leads a money input with the currency symbol', () => {
    expect(['USD', 'CAD', 'NOPE'].map((currency) => currencySymbol(currency))).toEqual(['$', 'CA$', 'NOPE']);
  });

  it('reads the date shapes OMS mixes in the user\'s time zone', () => {
    expect(formatDate(AT)).toBe('Sep 22, 2026');
    expect(formatDate('2026-09-22 14:33:14.000', { weekday: true })).toBe('Tuesday, Sep 22, 2026');
    expect(formatTime(Math.floor(AT / 1000))).toBe('2:33 PM');
    expect(formatTime(AT, { seconds: true })).toBe('2:33:14 PM');
    expect(formatDateTime(AT, { year: false })).toBe('Sep 22, 2:33 PM');
    expect(formatDateTime('')).toBe('');
  });

  it('picks the plural form from the count', () => {
    expect([0, 1, 2].map((count) => translate('{count} items', { count }))).toEqual(['0 items', '1 item', '2 items']);
  });
});
