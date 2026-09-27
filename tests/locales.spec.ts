import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n, translate } from '@common/core/i18n';
import enUS from '@/locales/en-US.json';
import esES from '@/locales/es-ES.json';

const PLACEHOLDER = /\{([A-Za-z_][\w$-]*)\}/g;
const placeholders = (message: string) => [...new Set([...message.matchAll(PLACEHOLDER)].map((match) => match[1]))].sort();

/** Every compile error vue-i18n reports while translating these keys in this language. */
function compileErrors(locale: string, messages: Record<string, string>) {
  const errors: string[] = [];
  const collect = (...args: unknown[]) => { if (/compil/i.test(args.join(' '))) errors.push(args.join(' ')); };
  const spies = [vi.spyOn(console, 'error').mockImplementation(collect), vi.spyOn(console, 'warn').mockImplementation(collect)];
  i18n.global.setLocaleMessage(locale, messages);
  i18n.global.locale.value = locale;
  Object.keys(messages).forEach((key) => translate(key, { count: 2 }));
  spies.forEach((spy) => spy.mockRestore());
  return errors;
}

afterEach(() => {
  i18n.global.locale.value = 'en-US';
});

describe('locale messages', () => {
  it('compile in every language', () => {
    expect(compileErrors('x-broken', { 'Write to support@hotwax.co': 'Write to support@hotwax.co' })).not.toEqual([]);
    expect(compileErrors('en-US', enUS)).toEqual([]);
    expect(compileErrors('es-ES', esES)).toEqual([]);
  });

  it('use the same placeholders in Spanish as in English', () => {
    const mismatched = Object.keys(esES).filter((key) => key in enUS
      && placeholders((esES as Record<string, string>)[key]).join() !== placeholders((enUS as Record<string, string>)[key]).join());
    expect(mismatched).toEqual([]);
  });

  it('resolve links, plurals through links, and escaped parameters', () => {
    expect(translate('Top 10 facilities by {metric}', { metric: 'Order Volume' })).toBe('Top 10 facilities by order volume');
    expect(translate('{count} items by order date', { count: 1 })).toBe('1 item by order date');
    expect(translate('Shopify Error: {message}', { message: '<b>x</b>' }, { escapeParameter: true })).toBe('Shopify Error: &lt;b&gt;x&lt;/b&gt;');
  });
});
