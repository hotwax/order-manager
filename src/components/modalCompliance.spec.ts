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

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function rel(path: string) {
  return relative(process.cwd(), path);
}

function extractIonModalBlocks(source: string) {
  return source.match(/<ion-modal\b[\s\S]*?<\/ion-modal>/g) ?? [];
}

function hasStartSlotCloseButton(source: string) {
  const header = source.match(/<ion-header\b[\s\S]*?<\/ion-header>/)?.[0] ?? '';
  const closeIcon = /<ion-icon\b(?=[^>]*\bslot=["']icon-only["'])(?=[^>]*:icon=["']closeOutline["'])[^>]*\/?>/;

  return /<ion-buttons\b(?=[^>]*\bslot=["']start["'])[^>]*>/.test(header) && closeIcon.test(header);
}

function hasFixedEndFab(source: string) {
  const fixedEndFab = /<ion-fab\b(?=[^>]*\bvertical=["']bottom["'])(?=[^>]*\bhorizontal=["']end["'])(?=[^>]*\bslot=["']fixed["'])[^>]*>/;
  return fixedEndFab.test(source) && /<ion-fab-button\b/.test(source);
}

function hasEditableModalControl(source: string) {
  return /<ion-(input|textarea|datetime|select|radio)\b/.test(source);
}

const vueFiles = walkFiles(srcRoot).filter((path) => path.endsWith('.vue'));
const modalComponentFiles = vueFiles.filter((path) => path.endsWith('Modal.vue'));
const inlineModalBlocks = vueFiles.flatMap((path) =>
  extractIonModalBlocks(readSource(path)).map((block, index) => ({
    name: `${rel(path)} ion-modal #${index + 1}`,
    source: block
  }))
);

describe('modal compliance', () => {
  it.each(modalComponentFiles.map((path) => [rel(path), readSource(path)]))(
    '%s uses a start-slot icon-only close button',
    (_name, source) => {
      expect(hasStartSlotCloseButton(source)).toBe(true);
    }
  );

  it.each(inlineModalBlocks.map((block) => [block.name, block.source]))(
    '%s uses a start-slot icon-only close button',
    (_name, source) => {
      expect(hasStartSlotCloseButton(source)).toBe(true);
    }
  );

  it.each([
    ...modalComponentFiles.map((path) => ({ name: rel(path), source: readSource(path) })),
    ...inlineModalBlocks
  ].filter(({ source }) => hasEditableModalControl(source)))(
    '$name keeps the editable modal action in a fixed bottom-end FAB',
    ({ source }) => {
      expect(hasFixedEndFab(source)).toBe(true);
    }
  );
});
