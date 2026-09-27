import { beforeAll, describe, expect, it } from 'vitest';
import { Settings } from 'luxon';
import { buildOrderEvents, type OrderEvent } from '@/utils/orderEvents';
import { chainEvents, elapsedParts, formatElapsed, groupTransactions, MIN_RUN, timelineDays } from '@/utils/orderTimeline';
import { englishTranslate, fixtureContext, fixtureEvents, fixtureIsVirtual } from '../support/orderTimelineFixture';

const headlines = (orderId: string) => groupTransactions(fixtureEvents(orderId), fixtureContext(orderId)).map((tx) => tx.headline);
const transactions = (orderId: string) => groupTransactions(fixtureEvents(orderId), fixtureContext(orderId));

beforeAll(() => {
  // The fixture's days and times are asserted as a Los Angeles viewer sees them.
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('groupTransactions on rails-uat orders', () => {
  it.each([
    ['158647', ['Order placed in Shopify', 'Imported, already cancelled in Shopify']],
    ['104494', ['Order placed in Shopify', 'Imported and brokered', 'Item cancelled in Shopify', 'Order cancelled in Shopify']],
    ['157579', ['Order placed in Shopify', 'Imported from Shopify', 'First brokered']],
    ['101934', ['Order placed in Shopify', 'Imported and brokered', 'Fulfilled in Shopify']],
    ['107038', ['Order placed in Shopify', 'Imported and brokered', 'Item completed', 'Item cancelled in Shopify']],
    ['115548', ['Placed and completed in Shopify', 'Return created', 'Imported from Shopify']],
    ['161352', ['Order placed in Shopify', 'Imported and approved', 'Shipped']],
    ['162079', ['Order placed in Shopify', 'Sold in store']],
    ['104821', ['Order placed in Shopify', 'Imported and brokered']],
    ['158477', ['Order placed in Shopify', 'Imported and approved', 'Location changed in Shopify']],
  ])('tells %s as %j', (orderId, expected) => {
    expect(headlines(orderId)).toEqual(expected);
  });

  it('reads a Shopify cancellation as one cancellation, never a rejection', () => {
    // 158647 wrote six rows at import: approval, a move into Rejected Item Parking, and the cancellations.
    const [, imported] = transactions('158647');

    expect(imported.details).toEqual(['861B-398E-12130:XL']);
    expect(imported.notes).toEqual([]);
    expect(imported.records.map((record) => record.title)).toEqual(['Created in HotWax', 'Approved', 'Approved', 'Moved to parking', 'Cancelled', 'Cancelled']);
  });

  it('names the one item an action touched, and counts several', () => {
    const [, , partial, last] = transactions('104494');

    expect(partial.details).toEqual(['848C-357C-001001:XS']);
    expect(last.details).toEqual(['848C-357C-0027617:XS']);
    expect(transactions('107038')[1].details).toEqual(['2 items to 2301 E. 51st St.']);
  });

  it('names each record by what happened and the item it happened to', () => {
    const [, imported] = transactions('104494');

    expect(imported.records.map((record) => [record.title, ...record.lines])).toEqual([
      ['Approved', '848C-357C-001001:XS'],
      ['Created in HotWax'],
      ['Approved', 'Order'],
      ['Approved', '848C-357C-0027617:XS'],
      ['Assigned', '848C-357C-001001:XS', 'Austin'],
    ]);
    // A rejection keeps its reason under the title; a release says it all in the title.
    const [rejected, released] = transactions('123768').find((tx) => tx.kind === 'run')!.children!;
    expect([rejected.records[0].title, ...rejected.records[0].lines]).toEqual(['Rejected', '201085-124H-5076:M', 'UK Ecomm to Rejected Item Parking', 'No variance', 'By user.2']);
    expect([released.records[0].title, ...released.records[0].lines]).toEqual(['Released', '201085-124H-5076:M', 'Rejected Item Parking to UK Ecomm', 'By user.2']);
  });

  it('keeps First brokered, with the facility and the approval that came with it', () => {
    const first = transactions('157579')[2];

    expect(first.details).toEqual(['2 items to CAN WH - Ponyride']);
    expect(first.notes).toEqual(['Approved for fulfillment']);
  });

  it('says where an import placed the items', () => {
    expect(transactions('104494')[1].details).toEqual(['848C-357C-001001:XS to Austin']);
  });

  it('names the Shopify sync that fulfilled or moved an order', () => {
    expect(transactions('101934')[2]).toMatchObject({ details: ['730A-255D-8419:25 from 2301 E. 51st St.'], actor: 'Shopify fulfillment sync' });
    expect(transactions('116143')[2]).toMatchObject({ headline: 'Location changed in Shopify', actor: 'Shopify inbound location sync' });
  });

  it('notes that the last item\'s cancellation completed the order', () => {
    expect(transactions('107038')[3]).toMatchObject({ details: ['546-282D-7977:2'], notes: ['Order completed'] });
  });

  it('shows a counter sale as sold at the store it was sold in', () => {
    expect(transactions('162079')[1].details).toEqual(['RM-860D-942F-8984:XL at Fashion Island']);
  });

  it('folds a store\'s reject and release churn into one run that keeps every step', () => {
    const txs = transactions('123768');
    const run = txs.find((tx) => tx.kind === 'run')!;

    expect(txs.map((tx) => tx.headline)).toEqual(['Order placed in Shopify', 'Imported and approved', 'First brokered', 'Rejected and re-brokered', 'Released']);
    expect(run.details).toEqual(['3 rejections and 2 releases']);
    expect(run.children!.map((tx) => tx.headline)).toEqual(['Rejected', 'Released', 'Rejected', 'Released', 'Rejected']);
    expect(run.children!.map((tx) => tx.reason)).toEqual(['No variance', '', 'Not in Stock', '', 'Not in Stock']);
    // The first brokering is never folded away, and each step names the item it moved.
    expect(txs[2].details).toEqual(['201085-124H-5076:M released to UK Ecomm']);
    expect(run.children![0].details).toEqual(['201085-124H-5076:M from UK Ecomm']);
  });

  it('tells the 11 reference orders in 34 lines', () => {
    const ids = ['158647', '104494', '157579', '101934', '107038', '115548', '161352', '162079', '104821', '123768', '158477'];
    expect(ids.reduce((sum, id) => sum + transactions(id).length, 0)).toBe(34);
  });
});

describe('chainEvents', () => {
  const T = (seconds: number) => 1_790_000_000_000 + seconds * 1_000;
  const move = (at: number, login?: string): OrderEvent => ({
    id: `m${at}`, kind: 'move', move: 'rejected', at, actor: login ? { kind: 'user', login } : undefined,
    shipGroupSeqIds: [], orderItemSeqIds: ['01'], records: [],
  });

  it('chains events less than 2 seconds apart and splits at a longer gap', () => {
    expect(chainEvents([move(T(0)), move(T(1)), move(T(2.5)), move(T(6))]).map((group) => group.length)).toEqual([3, 1]);
  });

  it('never merges two people\'s actions, however close', () => {
    expect(chainEvents([move(T(0), 'amy'), move(T(0.5), 'raj')]).map((group) => group.length)).toEqual([1, 1]);
  });

  it('caps a transaction at 10 seconds', () => {
    const steady = Array.from({ length: 12 }, (_, index) => move(T(index * 1.5)));
    expect(chainEvents(steady).map((group) => group.length)).toEqual([7, 5]);
  });

  it('keeps linked returns and exchanges on their own line', () => {
    const events = buildOrderEvents({
      order: { orderId: 'O1', orderDate: T(0), entryDate: T(0.2), statuses: [], shipGroups: [], returnItems: [{ returnId: 'R1', returnQuantity: 1, createdStamp: T(0.4) }] },
      facilityChanges: [], facilityChangesLoaded: true, unfillable: null, fulfillment: [],
      returnHeadersById: { R1: null }, exchangeChildren: [], isVirtualFacility: fixtureIsVirtual,
    });

    expect(chainEvents(events).map((group) => group.map((event) => event.kind))).toEqual([['placed', 'imported'], ['return']]);
  });
});

describe('foldRuns', () => {
  it(`folds only runs of ${MIN_RUN} or more`, () => {
    // 160638 has one rejection on its own: nothing to fold.
    expect(transactions('160638').some((tx) => tx.kind === 'run')).toBe(false);
  });
});

describe('timelineDays', () => {
  it('puts each transaction under its day with the time since the one before', () => {
    const ctx = fixtureContext('104494');
    const days = timelineDays(transactions('104494'), ctx);

    expect(days.map((day) => day.label)).toEqual(['Tuesday, Sep 1, 2026', 'Thursday, Sep 3, 2026', 'Thursday, Sep 10, 2026', 'Wednesday, Sep 16, 2026']);
    expect(days.map((day) => day.entries[0].elapsed)).toEqual(['', '1 day 19 hours later', '7 days 1 hour later', '5 days 21 hours later']);
    expect(days[0].entries[0].time).toBe('8:34 AM');
  });

  it('gives a folded run the span it covers', () => {
    const ctx = fixtureContext('123768');
    const run = timelineDays(transactions('123768'), ctx).flatMap((day) => day.entries).find((entry) => entry.kind === 'run')!;

    expect(run.time).toBe('12:32 PM');
    expect(run.details).toEqual(['3 rejections and 2 releases', '12:32 PM to 12:41 PM']);
  });
});

describe('formatElapsed', () => {
  const T0 = Date.UTC(2026, 8, 1, 10, 0, 0);
  const minutes = (count: number) => count * 60_000;

  it.each([
    [20_000, ''],
    [minutes(1), '1 minute'],
    [minutes(59) + 40_000, '59 minutes'],
    [minutes(60), '1 hour'],
    [minutes(179) + 45_000, '3 hours'],
    [minutes(25 * 60), '1 day 1 hour'],
    [minutes(42 * 60 + 57), '1 day 19 hours'],
    [minutes(47 * 60 + 45), '2 days'],
    [-minutes(3), ''],
  ])('reads %d ms as "%s"', (span, expected) => {
    expect(formatElapsed(T0, T0 + span, englishTranslate)).toBe(expected);
  });

  it('is empty when either date is missing', () => {
    expect(elapsedParts(undefined, T0)).toEqual([]);
    expect(elapsedParts(T0, undefined)).toEqual([]);
  });
});
