import { describe, expect, it } from 'vitest';
import { shipGroupItemStates } from '@/utils/shipGroupItemStates';

const completed = { statusId: 'ITEM_COMPLETED' };
const cancelled = { statusId: 'ITEM_CANCELLED' };
const approved = { statusId: 'ITEM_APPROVED' };

describe('shipGroupItemStates', () => {
  it('calls a group finished when every item completed', () => {
    const states = shipGroupItemStates([completed, completed]);

    expect(states.allFulfilled).toBe(true);
    expect(states.settled).toBe(true);
    expect(states.allCancelled).toBe(false);
    expect(states.partiallyFulfilled).toBe(false);
  });

  it('calls a group cancelled when every item stopped without finishing', () => {
    const states = shipGroupItemStates([cancelled, cancelled]);

    expect(states.allCancelled).toBe(true);
    expect(states.settled).toBe(true);
    expect(states.allFulfilled).toBe(false);
    expect(states.partiallyFulfilled).toBe(false);
  });

  it('calls a stopped group partially complete when some finished and some did not', () => {
    // The case that reads as "Partially complete" on the card.
    const states = shipGroupItemStates([completed, cancelled]);

    expect(states.partiallyFulfilled).toBe(true);
    expect(states.settled).toBe(true);
    expect(states.allFulfilled).toBe(false);
    expect(states.allCancelled).toBe(false);
    expect(states.fulfilled).toBe(1);
    expect(states.total).toBe(2);
  });

  it('reports the fulfilled fraction so the bar can show how much of the group landed', () => {
    const states = shipGroupItemStates([completed, cancelled, cancelled, completed]);

    expect(states.fulfilled / states.total).toBe(0.5);
  });

  it('leaves a still-moving group unsettled, so the timeline keeps describing it', () => {
    const states = shipGroupItemStates([completed, approved]);

    expect(states.settled).toBe(false);
    expect(states.allFulfilled).toBe(false);
    expect(states.partiallyFulfilled).toBe(false);
    expect(states.allCancelled).toBe(false);
  });

  it('treats an empty group as nothing to conclude, not as finished', () => {
    // An empty ship group (a parked one, say) must not claim to be complete or cancelled.
    const states = shipGroupItemStates([]);

    expect(states.settled).toBe(false);
    expect(states.allFulfilled).toBe(false);
    expect(states.allCancelled).toBe(false);
    expect(states.total).toBe(0);
  });

  it('ignores items whose status has not loaded rather than counting them as unfinished', () => {
    // Mid-load a group would otherwise flip to "in progress" and then back, or worse, to
    // "cancelled" because an unknown status is not ITEM_COMPLETED.
    const states = shipGroupItemStates([completed, { statusId: undefined }, {}]);

    expect(states.total).toBe(1);
    expect(states.allFulfilled).toBe(true);
    expect(states.settled).toBe(true);
  });

  it('survives a missing item list', () => {
    expect(shipGroupItemStates(undefined).settled).toBe(false);
    expect(shipGroupItemStates(null).total).toBe(0);
  });
});
