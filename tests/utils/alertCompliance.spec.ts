import { readdirSync, readFileSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(process.cwd(), 'src');

function walkFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = resolve(dir, entry);
      return statSync(path).isDirectory() ? walkFiles(path) : [path];
    });
}

function rel(path: string) {
  return relative(process.cwd(), path);
}

function roleUsesGenericCopy(source: string, role: string, copy: string) {
  const copyPattern = copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const copyBeforeRole = new RegExp(`text:\\s*translate\\(['"]${copyPattern}['"]\\)[\\s\\S]{0,120}role:\\s*['"]${role}['"]`);
  const roleBeforeCopy = new RegExp(`role:\\s*['"]${role}['"][\\s\\S]{0,120}text:\\s*translate\\(['"]${copyPattern}['"]\\)`);

  return copyBeforeRole.test(source) || roleBeforeCopy.test(source);
}

describe('alert compliance', () => {
  it('does not label cancel-role alert buttons as No', () => {
    const matches = walkFiles(srcRoot)
      .filter((path) => path.endsWith('.vue') || path.endsWith('.ts'))
      .filter((path) => roleUsesGenericCopy(readFileSync(path, 'utf8'), 'cancel', 'No'))
      .map(rel);

    expect(matches).toEqual([]);
  });

  it('does not label confirm-role alert buttons as Yes', () => {
    const matches = walkFiles(srcRoot)
      .filter((path) => path.endsWith('.vue') || path.endsWith('.ts'))
      .filter((path) => roleUsesGenericCopy(readFileSync(path, 'utf8'), 'confirm', 'Yes'))
      .map(rel);

    expect(matches).toEqual([]);
  });
});
