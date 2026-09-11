import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail ship group reflects item status', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('carries each item status into the ship group view model', () => {
    // Without this the card literally cannot see item status — the mapping used to drop it,
    // which is why a finished group read "25% Complete" forever.
    expect(source).toContain('statusId: item.statusId');
  });

  it('lets item status override the timeline for a group that has stopped', () => {
    expect(source).toContain('if (states.allFulfilled) return 1;');
    expect(source).toContain('if (states.allCancelled) return 0;');
    expect(source).toContain('if (states.partiallyFulfilled) return states.fulfilled / states.total;');
  });

  it('still measures a moving group from the fulfillment timeline', () => {
    expect(source).toContain("if (tl?.picklistDate) progress += 0.25;");
    expect(source).toContain("if (tl?.packedDate) progress += 0.25;");
    expect(source).toContain("if (tl?.shippedDate) progress += 0.25;");
  });

  it('labels a stopped group instead of quoting it a percentage', () => {
    expect(source).toContain("if (states.allCancelled) return translate('Cancelled');");
    expect(source).toContain("if (states.partiallyFulfilled) return translate('Partially complete');");
  });

  it('stops claiming later steps are Pending once the group has stopped', () => {
    expect(source).toContain('function lifecycleStepNote(shipGroup: any, date: any): string {');
    expect(source).toContain("shipGroupItemStates(shipGroup).settled ? translate('No date') : translate('Pending')");
    ['picklistDate', 'packedDate', 'shippedDate'].forEach((field) => {
      expect(source).toContain(`lifecycleStepNote(shipGroup, lifecycleByShipGroup[shipGroup.id]?.${field})`);
    });
  });
});
