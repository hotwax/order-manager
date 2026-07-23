import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('add relationship modal party picker', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/AddRelationshipModal.vue'), 'utf8');

  it('single-selects a party with a radio group instead of a tap-to-checkmark item', () => {
    expect(source).toContain('<ion-radio-group v-else-if="results.length" v-model="selectedPartyId">');
    expect(source).toContain('<ion-radio label-placement="end" justify="start" :value="party.partyId">');
    expect(source).toContain('const selectedPartyId = computed(');
    // the old ad-hoc single-select pattern is gone
    expect(source).not.toContain("@click=\"selectParty(party)\"");
    expect(source).not.toContain("'party-selected'");
    expect(source).not.toContain(':icon="checkmarkCircle"\n          color="primary"');
  });

  it('drives the relationship config off the selected party object', () => {
    expect(source).toContain('v-if="selectedParty"');
    expect(source).toContain('selectedParty.value = results.value.find');
  });
});
