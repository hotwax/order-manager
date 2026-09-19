import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The rules themselves are covered for real in tests/utils/shipGroupItemStates.spec.ts and
 * tests/utils/OrderActionValidator.spec.ts, which call the code and assert on its answers.
 *
 * What is left here is the one thing those cannot reach: the ship group view model is built
 * inside the SFC, so nothing but the source proves it still carries item status through. That
 * single line is the whole reason the card can see status at all, and dropping it again would
 * be silent — every rule below it would keep passing against items that no longer have a
 * statusId. Assertions that merely restated the logic used to live here; they only locked the
 * implementation's wording in place and broke on correct refactors, so they are gone.
 */
describe('order detail ship group view model', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('carries each item status into the ship group view model', () => {
    expect(source).toContain('statusId: item.statusId');
  });
});
