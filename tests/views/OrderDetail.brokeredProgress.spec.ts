import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * A ship group is brokered when its items sit at a physical facility. The backend
 * timeline only dates brokering from OrderFacilityChange rows carrying a BROKERED or
 * RELEASED reason — written by the routing engine — so a group allocated once at order
 * creation and never re-brokered comes back with no date, and the card used to read
 * 0% with the word "Brokered" as its zero-progress label.
 */
describe('order detail ship-group brokered progress', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('counts the brokered quarter from the facility, not from a timeline date', () => {
    expect(source).toContain('function isShipGroupBrokered(shipGroup: any): boolean {');
    expect(source).toContain('return !isVirtualFacility(shipGroup) || !!shipGroupBrokeredDate(shipGroup);');
    expect(source).toContain('if (isShipGroupBrokered(shipGroup)) progress += 0.25;');
    // The old rule gated the first quarter on the endpoint's dates alone.
    expect(source).not.toContain('if (tl.firstBrokeredDate || tl.firstReleasedDate) progress += 0.25;');
  });

  it('keeps measuring the later steps from the timeline endpoint', () => {
    expect(source).toContain('if (tl?.picklistDate) progress += 0.25;');
    expect(source).toContain('if (tl?.packedDate) progress += 0.25;');
    expect(source).toContain('if (tl?.shippedDate) progress += 0.25;');
    // A missing timeline row must not short-circuit the facility-based brokered quarter.
    expect(source).not.toContain('if (!tl) return 0;');
  });

  it('dates brokering from the earliest facility change when the endpoint has none', () => {
    expect(source).toContain('const facilityChangeDateByShipGroup = computed<Record<string, number>>');
    expect(source).toContain('orderDetailStore.facilityChangesByOrderId[props.orderId]');
    expect(source).toContain('if (current == undefined || millis < current) earliest[change.shipGroupSeqId] = millis;');
    expect(source).toContain('const brokered = tl?.firstBrokeredDate || tl?.firstReleasedDate;');
  });

  it('never lets a parked or rejected group inherit a date from its own facility changes', () => {
    // Those rows exist on virtual groups too (PARKED / rejection reasons / cancellations),
    // and none of them is a brokering — only a BROKERED/RELEASED timeline date counts there.
    expect(source).toContain('return isVirtualFacility(shipGroup) ? undefined : facilityChangeDateByShipGroup.value[shipGroup.id];');
  });

  it('separates the lifecycle view model from the endpoint contract', () => {
    // The action engine and the item status chips keep reading the raw endpoint dates.
    expect(source).toContain('const lifecycleByShipGroup = computed<Record<string, any>>');
    expect(source).toContain('firstBrokeredDate: shipGroupBrokeredDate(shipGroup)');
    expect(source).toContain('timeline: timelineByShipGroup.value[shipGroup.id],');
    expect(source).toContain('fulfillmentLineStatus(timelineByShipGroup.value[sg.id])');
  });

  it('distinguishes a brokered step with no recorded time from one still pending', () => {
    expect(source).toContain("|| (isShipGroupBrokered(shipGroup) ? translate('No date') : translate('Pending'));");
    expect(source).toContain('<ion-note slot="end">{{ brokeredStepNote(shipGroup) }}</ion-note>');
  });

  it('drops the zero-progress label that collided with the Brokered step name', () => {
    expect(source).toContain("return `${Math.round(shipGroupProgress(shipGroup) * 100)}% ${translate('Complete')}`;");
    expect(source).not.toContain("progress > 0 ? `${progress}% ${translate('Complete')}` : translate('Brokered')");
    // A virtual facility still reads as not brokered at all.
    expect(source).toContain("if (isVirtualFacility(shipGroup)) return translate('Not Brokered');");
  });
});
