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

function cancelRoleUsesNo(source: string) {
  const noBeforeRole = /text:\s*translate\(['"]No['"]\)[\s\S]{0,120}role:\s*['"]cancel['"]/;
  const roleBeforeNo = /role:\s*['"]cancel['"][\s\S]{0,120}text:\s*translate\(['"]No['"]\)/;

  return noBeforeRole.test(source) || roleBeforeNo.test(source);
}

describe('alert compliance', () => {
  it('does not label cancel-role alert buttons as No', () => {
    const matches = walkFiles(srcRoot)
      .filter((path) => path.endsWith('.vue') || path.endsWith('.ts'))
      .filter((path) => cancelRoleUsesNo(readFileSync(path, 'utf8')))
      .map(rel);

    expect(matches).toEqual([]);
  });
});
