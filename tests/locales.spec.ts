import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
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

  it('translate every key the app and common use, in both languages', () => {
    // A key missing from en-US still shows its English text, so nothing looks wrong until a
    // translator never sees it. Common's components read their text from this app's messages too.
    const sources = [resolve(process.cwd(), 'src'), resolve(process.cwd(), '../../common')];
    const files = sources.flatMap((dir) => readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(ts|vue)$/.test(file) && !/(^|\/)(tests|locales)\/|\.spec\.ts$/.test(file))
      .map((file) => resolve(dir, file)));
    const keys = new Set<string>();
    const literal = `(["'])((?:(?!\\1)[^\\\\\\n]|\\\\.)*)\\1`;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(new RegExp(`(?:translate|requiredLabel)\\(\\s*${literal}`, 'g'))) keys.add(match[2].replace(/\\'/g, "'"));
    }
    expect(keys.size).toBeGreaterThan(800);
    expect([...keys].filter((key) => !(key in enUS))).toEqual([]);
    // Both files list the same keys in the same case-insensitive order, so a change lines up in review.
    const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const sorted = Object.keys(enUS).sort((a, b) => byCode(a.toLowerCase(), b.toLowerCase()) || byCode(a, b));
    expect(Object.keys(enUS)).toEqual(sorted);
    expect(Object.keys(esES)).toEqual(sorted);
  });

  it('give every message its own Spanish text', () => {
    // Words that read the same in both languages; anything else rendering identically is untranslated.
    const sameInBoth = new Set(['Error', 'ID', 'Launchpad', 'OMS', 'Shopify', 'SKU', 'Subtotal', 'Total', '{count} min']);
    const params = { count: 2, shown: 1, total: 3, metric: 'Order Volume', query: 'q' };
    const render = (locale: string) => {
      i18n.global.setLocaleMessage('es-ES', esES);
      i18n.global.locale.value = locale;
      return Object.fromEntries(Object.keys(enUS).map((key) => [key, translate(key, params)]));
    };
    const english = render('en-US');
    const spanish = render('es-ES');
    const untranslated = Object.keys(enUS).filter((key) => !sameInBoth.has(key)
      && spanish[key] === english[key] && /[a-z]{3}/.test(english[key].replace(/\{[^}]*\}/g, '')));
    expect(untranslated).toEqual([]);
  });

  it('link only to keys that exist and have no period, which would render empty', () => {
    const broken = [enUS, esES].flatMap((messages: Record<string, string>) => Object.values(messages)
      .flatMap((message) => [...message.matchAll(/@(?:\.\w+)?:\{'([^']+)'\}/g)].map((match) => match[1]))
      .filter((key) => !(key in messages) || key.includes('.')));
    expect(broken).toEqual([]);
  });

  it('resolve links, plurals through links, and escaped parameters', () => {
    expect(translate('Top 10 facilities by {metric}', { metric: 'Order Volume' })).toBe('Top 10 facilities by order volume');
    expect(translate('{count} items by order date', { count: 1 })).toBe('1 item by order date');
    expect(translate('Shopify Error: {message}', { message: '<b>x</b>' }, { escapeParameter: true })).toBe('Shopify Error: &lt;b&gt;x&lt;/b&gt;');
  });
});
