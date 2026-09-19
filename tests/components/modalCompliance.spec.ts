import { readdirSync, readFileSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(process.cwd(), 'src');

// These files belong to the intentionally dormant Create Order prototype retained
// for future work in PR #464. They are not reachable from the shipped application,
// so modal policy checks should not make the active suite fail on them.
const dormantCreateOrderFiles = new Set([
  'src/components/AddCustomLineModal.vue',
  'src/components/AddCustomerModal.vue',
  'src/components/AddProductModal.vue',
  'src/components/AddressModal.vue',
  'src/views/CreateOrder.vue',
]);

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
  // Radio-only pickers may intentionally dismiss on row selection. Form fields
  // that collect text, dates, or select values require an explicit save action.
  return /<ion-(?:input|textarea|datetime|select)(?:\s|\/?>)/.test(source);
}

const vueFiles = walkFiles(srcRoot).filter((path) => path.endsWith('.vue'));
const shippedVueFiles = vueFiles.filter((path) => !dormantCreateOrderFiles.has(rel(path)));
const modalComponentFiles = shippedVueFiles.filter((path) => path.endsWith('Modal.vue'));
const inlineModalBlocks = shippedVueFiles.flatMap((path) =>
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
