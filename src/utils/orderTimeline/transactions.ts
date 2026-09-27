import { isBrokeringMove, moveKind, type MoveKind, type OrderEvent, type OrderEventLink, type OrderEventOf, type OrderEventRecord } from '@/utils/orderEvents';

export interface TimelineContext {
  translate: (key: string, params?: Record<string, unknown>) => string;
  facilityName: (facilityId: string) => string;
  statusDescription: (statusId: string) => string;
  /** Describes an enum id, or returns free text as it is. */
  describe: (value: string) => string;
  enumDescription: (enumId: string) => string;
  isVirtualFacility: (facilityId: string) => boolean;
  /** Every item on the order, for "1 of 2 items". */
  itemTotal: number;
  /** The ship group each item is in; status rows do not say. */
  shipGroupOfItem: Record<string, string>;
  /** Counter-sale ship groups: their completed items were sold in store. */
  posShipGroupIds: Set<string>;
  /** Where a counter sale took place. */
  originFacilityId?: string;
  /** An order's name for an exchange line, when it has loaded. */
  orderLabel: (orderId: string) => string;
  /** How the page names an order item: its product's primary identifier. '' when unknown. */
  itemLabel: (orderItemSeqId: string) => string;
}

export type TransactionKind =
  | 'placed' | 'imported' | 'approved' | 'status' | 'cancelled' | 'shipped' | 'packed' | 'picked'
  | 'completed' | 'sold' | 'brokered' | 'released' | 'rejected' | 'moved' | 'parked' | 'unfillable'
  | 'return' | 'exchange' | 'items' | 'run';

export interface TimelineRecordView {
  id: string;
  title: string;
  lines: string[];
  at?: number;
}

/** One business transaction: the rows one action wrote, read as one line of the order's story. */
export interface TimelineTransaction {
  id: string;
  kind: TransactionKind;
  at?: number;
  /** The last moment the transaction covers; later than `at` only for a folded run. */
  endAt?: number;
  atKind?: 'recorded';
  headline: string;
  /** What moved: item counts and facilities, one line each. */
  details: string[];
  /** Other things the same action did, e.g. "Approved for fulfillment". */
  notes: string[];
  reason: string;
  /** Who acted: a login or the system that wrote the rows. */
  actor: string;
  link?: OrderEventLink;
  events: OrderEvent[];
  records: TimelineRecordView[];
  /** Transactions of one family by one actor fold together when they repeat back to back. */
  foldFamily?: 'rebroker' | 'location';
  /** The transactions a folded run holds. */
  children?: TimelineTransaction[];
}

// Rows written by one action land within a second of each other; in a sample of 63 orders,
// separate actions were never closer than 3 s. The span cap and the actor check keep a busy
// moment from merging two people's work.
export const CHAIN_GAP_MS = 2_000;
const MAX_SPAN_MS = 10_000;

const SHOPIFY_CANCELLATION = 'SHOPIFY_CANCELLATION';

function userOf(event: OrderEvent) {
  return event.actor?.kind === 'user' ? event.actor.login : '';
}

/** Split the events, oldest first, into the groups one action wrote. */
export function chainEvents(events: OrderEvent[]): OrderEvent[][] {
  const groups: OrderEvent[][] = [];
  let current: OrderEvent[] | null = null;
  let lastAt = 0;

  events.forEach((event) => {
    // Returns and exchanges are their own records with their own links; undated events have no
    // neighbours to join. The open chain stays open: an import that writes a return in the same
    // moment is still one import either side of it.
    if (event.at === undefined || event.link) {
      groups.push([event]);
      return;
    }
    const login = userOf(event);
    const fits = current
      && event.at - lastAt <= CHAIN_GAP_MS
      && event.at - (current[0].at as number) <= MAX_SPAN_MS
      && !(login && current.some((other) => userOf(other) && userOf(other) !== login));
    if (fits) {
      current!.push(event);
    } else {
      current = [event];
      groups.push(current);
    }
    lastAt = event.at;
  });

  return groups;
}

/* ── Wording ─────────────────────────────────────────────────────────────── */

const itemIds = (events: OrderEvent[]) => [...new Set(events.flatMap((event) => event.orderItemSeqIds))];

function countPhrase(count: number, ctx: TimelineContext, total?: number): string {
  if (total && total > count) return ctx.translate('{shown} of {count} items', { shown: count, count: total });
  return ctx.translate('{count} items', { count });
}

/** The items an operation touched: the item itself when there is one, otherwise how many. */
function itemsPhrase(ids: string[], ctx: TimelineContext, total?: number): string {
  const label = ids.length === 1 ? ctx.itemLabel(ids[0]) : '';
  return label || countPhrase(ids.length, ctx, total);
}

function remainingPhrase(ids: string[], ctx: TimelineContext): string {
  const label = ids.length === 1 ? ctx.itemLabel(ids[0]) : '';
  return label || ctx.translate('{count} remaining items', { count: ids.length });
}

function facilityLine(key: '{items} to {facility}' | '{items} from {facility}' | '{items} at {facility}', items: string, facilityId: string | undefined, ctx: TimelineContext): string {
  return facilityId ? ctx.translate(key, { items, facility: ctx.facilityName(facilityId) }) : items;
}

function moveLine(move: OrderEventOf<'move'>, ctx: TimelineContext, released = false): string {
  const items = itemsPhrase(move.orderItemSeqIds, ctx);
  if (move.move === 'rejected') return facilityLine('{items} from {facility}', items, move.fromFacilityId, ctx);
  if (move.move === 'parked' || (move.move === 'assigned' && move.toFacilityId && ctx.isVirtualFacility(move.toFacilityId))) {
    return facilityLine('{items} at {facility}', items, move.toFacilityId, ctx);
  }
  if (move.move === 'moved' && move.fromFacilityId && move.toFacilityId) {
    return ctx.translate('{items} from {from} to {to}', { items, from: ctx.facilityName(move.fromFacilityId), to: ctx.facilityName(move.toFacilityId) });
  }
  if (released && move.toFacilityId) return ctx.translate('{items} released to {facility}', { items, facility: ctx.facilityName(move.toFacilityId) });
  return facilityLine('{items} to {facility}', items, move.toFacilityId, ctx);
}

/**
 * One line per place: moves that land in the same facility (a BROKERED row and an import
 * assignment, say) read once, with their items together.
 */
function moveLines(moves: OrderEventOf<'move'>[], ctx: TimelineContext, released: (group: OrderEventOf<'move'>[]) => boolean = () => false): string[] {
  const groups = new Map<string, OrderEventOf<'move'>[]>();
  moves.forEach((move) => {
    const key = move.move === 'rejected' ? `from|${move.fromFacilityId}` : `${move.move === 'moved' ? move.fromFacilityId : ''}|${move.toFacilityId}`;
    groups.set(key, [...(groups.get(key) || []), move]);
  });
  return [...groups.values()].map((group) => moveLine({ ...group[0], orderItemSeqIds: itemIds(group) }, ctx, released(group)));
}

const describeReason = (reason: string | undefined, ctx: TimelineContext) => (reason ? ctx.describe(reason) : '');

const isShopifyCancellation = (event: OrderEvent) =>
  (event.kind === 'orderStatus' || event.kind === 'itemStatus') ? event.reason === SHOPIFY_CANCELLATION
    : event.kind === 'move' ? event.reasonEnumId === SHOPIFY_CANCELLATION : false;

const isLocationSync = (event: OrderEvent) =>
  event.kind === 'move' && event.move === 'allocated' && event.actor?.kind === 'system' && /location/i.test(event.actor.name);

const isFulfillmentSync = (event: OrderEvent) =>
  event.kind === 'move' && event.move === 'allocated' && event.actor?.kind === 'system' && /fulfil/i.test(event.actor.name);

const ORDER_NOTES: Record<string, string> = { ORDER_APPROVED: 'Approved for fulfillment', ORDER_ACCEPTED: 'Approved for fulfillment', ORDER_COMPLETED: 'Order completed' };
const STEP_TITLES = { picked: 'Picked', packed: 'Packed', shipped: 'Shipped' } as const;

/** A leftover event, said in a few words under the headline. '' for rows that only restate it. */
function notePhrase(event: OrderEvent, all: OrderEvent[], ctx: TimelineContext): string {
  const { translate } = ctx;
  switch (event.kind) {
    case 'placed': return translate('Order placed');
    case 'imported': return translate('Imported');
    case 'orderStatus': return ORDER_NOTES[event.statusId] ? translate(ORDER_NOTES[event.statusId]) : ctx.statusDescription(event.statusId);
    case 'itemStatus':
      // Item approvals only restate the order's approval or the import.
      if (event.statusId === 'ITEM_APPROVED' && all.some((other) => other.kind === 'imported' || (other.kind === 'orderStatus' && other.statusId === 'ORDER_APPROVED'))) return '';
      return translate('{status}: {items}', { status: ctx.statusDescription(event.statusId), items: itemsPhrase(event.orderItemSeqIds, ctx) });
    case 'move':
      return event.move === 'cancelled' ? '' : translate('{status}: {items}', { status: translate(MOVE_RECORD_TITLES[event.move]), items: moveLine(event, ctx) });
    case 'fulfillment': return translate(STEP_TITLES[event.step]);
    case 'unfillable': return translate('Brokering could not fill');
    default: return '';
  }
}

/* ── Records ─────────────────────────────────────────────────────────────── */

// A record names what its row says happened, not the field it came from.
const DATE_RECORD_TITLES: Record<string, string> = {
  entryDate: 'Created in HotWax',
  picklistDate: 'Picklist created',
  packedDate: 'Shipment packed',
  shippedDate: 'Shipment shipped',
  firstBrokeredDate: 'Brokered',
  firstReleasedDate: 'Released',
};

const MOVE_RECORD_TITLES: Record<MoveKind, string> = {
  assigned: 'Assigned',
  brokered: 'Brokered',
  released: 'Released',
  allocated: 'Allocated',
  parked: 'Parked',
  rejected: 'Rejected',
  cancelled: 'Moved to parking',
  moved: 'Moved',
};

function recordTitle(record: OrderEventRecord, event: OrderEvent, ctx: TimelineContext): string {
  const { translate } = ctx;
  switch (record.source) {
    case 'order':
      if (record.type === 'orderDate') return translate(event.kind === 'placed' && event.isShopify ? 'Placed in Shopify' : 'Order placed');
      return translate(DATE_RECORD_TITLES[record.type] || record.type);
    case 'fulfillment': return translate(DATE_RECORD_TITLES[record.type] || record.type);
    case 'status': return ctx.statusDescription(record.type);
    case 'facilityChange': return translate(MOVE_RECORD_TITLES[recordMove(record)]);
    case 'unfillable': return translate('Brokering could not fill');
    case 'return': return translate('Return {id}', { id: record.refId });
    case 'exchange': return translate('Exchange with {id}', { id: ctx.orderLabel(record.refId || '') });
    default: return '';
  }
}

const recordMove = (record: OrderEventRecord) =>
  moveKind({ changeReasonEnumId: record.type, fromFacilityId: record.fromFacilityId, facilityId: record.facilityId });

/** What a transaction's row already shows, so its records need not repeat it on every line. */
interface RowFacts {
  actor: string;
  reason: string;
  /** Moves that are how a cancellation happened. */
  cancelMoves: OrderEvent[];
}

function recordView(record: OrderEventRecord, event: OrderEvent, index: number, ctx: TimelineContext, row: RowFacts): TimelineRecordView {
  const { translate } = ctx;
  const item = record.orderItemSeqId
    ? ctx.itemLabel(record.orderItemSeqId) || translate('Item {id}', { id: record.orderItemSeqId })
    : record.source === 'status' ? translate('Order') : '';
  const place = record.fromFacilityId && record.facilityId && record.fromFacilityId !== record.facilityId
    ? translate('{from} to {to}', { from: ctx.facilityName(record.fromFacilityId), to: ctx.facilityName(record.facilityId) })
    : record.facilityId ? ctx.facilityName(record.facilityId) : '';
  // Brokered, released, allocated and parked say it in the title; a rejection's reason does not.
  const move = record.source === 'facilityChange' ? recordMove(record) : undefined;
  const reason = record.source === 'status' && record.reason ? ctx.describe(record.reason)
    : move && record.type && ['rejected', 'cancelled', 'moved', 'assigned'].includes(move) ? ctx.enumDescription(record.type) : '';

  return {
    id: `${record.source}-${record.type}-${index}`,
    title: row.cancelMoves.includes(event) ? translate('Moved to parking') : recordTitle(record, event, ctx),
    lines: [
      item,
      place,
      reason === row.reason ? '' : reason,
      record.userLogin && record.userLogin !== row.actor ? translate('By {actor}', { actor: record.userLogin }) : '',
      record.comments || '',
    ].filter(Boolean),
    at: record.at,
  };
}

/* ── Headlines ───────────────────────────────────────────────────────────── */

interface Draft {
  kind: TransactionKind;
  headline: string;
  details: string[];
  reason?: string;
  foldFamily?: TimelineTransaction['foldFamily'];
}

/**
 * Name one group of events by its most significant event, fold in the rows that only restate
 * it, and keep what is left as notes. The order of the checks is the headline priority.
 */
export function buildTransaction(events: OrderEvent[], ctx: TimelineContext): TimelineTransaction {
  const { translate } = ctx;
  const pool = new Set(events);
  const consume = (...used: Array<OrderEvent | undefined>) => used.forEach((event) => event && pool.delete(event));
  const find = <K extends OrderEvent['kind']>(kind: K, test: (event: OrderEventOf<K>) => boolean = () => true) =>
    events.filter((event): event is OrderEventOf<K> => event.kind === kind && test(event as OrderEventOf<K>));
  const orderStatus = (...ids: string[]) => find('orderStatus', (event) => ids.includes(event.statusId))[0];
  const itemStatuses = (id: string) => find('itemStatus', (event) => event.statusId === id);

  const placed = find('placed')[0];
  const imported = find('imported')[0];
  const approved = orderStatus('ORDER_APPROVED', 'ORDER_ACCEPTED');
  const moves = find('move');
  const assignedAtImport = imported ? moves.filter((move) => move.move === 'assigned') : [];
  // The routine rows an import writes alongside whatever the headline is.
  const consumeImport = () => {
    consume(imported, placed, approved, ...itemStatuses('ITEM_APPROVED'), ...assignedAtImport);
  };

  let draft: Draft;

  const orderCancelled = orderStatus('ORDER_CANCELLED');
  const itemCancels = itemStatuses('ITEM_CANCELLED');

  // Cancelling items at a facility first moves them into parking: under the Shopify reason for a
  // Shopify cancellation, under the cancellation's own reason (NO_VARIANCE_LOG, say) otherwise.
  // That move is how the cancellation happened, not a rejection by the store.
  const isCancellation = !!orderCancelled || itemCancels.length > 0;
  const cancelMoves = moves.filter((move) => move.move === 'cancelled'
    || (isCancellation && move.move === 'rejected' && !!move.toFacilityId && ctx.isVirtualFacility(move.toFacilityId)));
  const cancelledFrom = [...new Set(cancelMoves.map((move) => move.fromFacilityId)
    .filter((facilityId): facilityId is string => !!facilityId && !ctx.isVirtualFacility(facilityId)))];
  const fromFacility = (items: string) => facilityLine('{items} from {facility}', items, cancelledFrom.length === 1 ? cancelledFrom[0] : undefined, ctx);
  const shipped = find('fulfillment', (event) => event.step === 'shipped');
  const completed = orderStatus('ORDER_COMPLETED');
  const completedItems = itemStatuses('ITEM_COMPLETED');
  const brokering = moves.filter((move) => isBrokeringMove(move, ctx.isVirtualFacility));
  const rejections = moves.filter((move) => move.move === 'rejected' && !cancelMoves.includes(move));
  const otherStatus = find('orderStatus', (event) => !['ORDER_APPROVED', 'ORDER_ACCEPTED'].includes(event.statusId))[0];

  if (isCancellation) {
    const inShopify = [orderCancelled, ...itemCancels, ...cancelMoves].some((event) => event && isShopifyCancellation(event));
    const ids = itemIds(itemCancels);
    const headline = orderCancelled
      ? (inShopify ? (imported ? 'Imported, already cancelled in Shopify' : 'Order cancelled in Shopify') : 'Order cancelled')
      : inShopify ? 'Items cancelled in Shopify' : 'Items cancelled';
    const items = !orderCancelled ? itemsPhrase(ids, ctx, ctx.itemTotal) : ids.length < ctx.itemTotal && !imported ? remainingPhrase(ids, ctx) : itemsPhrase(ids, ctx);
    draft = {
      kind: 'cancelled',
      headline: translate(headline, { count: ids.length }),
      details: ids.length ? [fromFacility(items)] : [],
      reason: inShopify ? '' : describeReason(orderCancelled?.reason || itemCancels[0]?.reason, ctx),
    };
    consume(orderCancelled, ...itemCancels, ...cancelMoves);
    if (orderCancelled && imported) consumeImport();
  } else if (shipped.length) {
    const viaShopify = moves.filter(isFulfillmentSync);
    draft = {
      kind: 'shipped',
      headline: translate(viaShopify.length
        ? (imported ? 'Imported, already fulfilled in Shopify' : 'Fulfilled in Shopify')
        : (imported ? 'Imported, already shipped' : 'Shipped')),
      details: shipped.map((event) => {
        const sgId = event.shipGroupSeqIds[0];
        const done = completedItems.flatMap((status) => status.orderItemSeqIds).filter((id) => ctx.shipGroupOfItem[id] === sgId);
        const facilityId = viaShopify[0]?.toFacilityId || event.facilityId;
        return facilityLine('{items} from {facility}', itemsPhrase(done.length ? done : event.orderItemSeqIds, ctx), facilityId, ctx);
      }),
    };
    consume(...shipped, ...completedItems, ...viaShopify);
    if (imported) consumeImport();
  } else if (completed) {
    const soldItems = completedItems.flatMap((status) => status.orderItemSeqIds);
    const isCounterSale = ctx.posShipGroupIds.size > 0 && (soldItems.length
      ? soldItems.every((id) => ctx.posShipGroupIds.has(ctx.shipGroupOfItem[id]))
      : Object.values(ctx.shipGroupOfItem).every((sgId) => ctx.posShipGroupIds.has(sgId)));
    const ids = itemIds(completedItems);
    if (isCounterSale) {
      draft = {
        kind: 'sold',
        headline: translate('Sold in store'),
        details: ids.length ? [facilityLine('{items} at {facility}', itemsPhrase(ids, ctx), ctx.originFacilityId, ctx)] : [],
      };
      consumeImport();
    } else if (placed && !imported) {
      draft = { kind: 'completed', headline: translate(placed.isShopify ? 'Placed and completed in Shopify' : 'Placed and completed'), details: [] };
      consume(placed);
    } else {
      draft = { kind: 'completed', headline: translate('Order completed'), details: ids.length ? [itemsPhrase(ids, ctx)] : [] };
    }
    consume(completed, ...completedItems);
  } else if (find('fulfillment').length) {
    const step = find('fulfillment').some((event) => event.step === 'packed') ? 'packed' : 'picked';
    const steps = find('fulfillment', (event) => event.step === step);
    draft = {
      kind: step,
      headline: translate(STEP_TITLES[step]),
      details: steps.map((event) => facilityLine('{items} at {facility}', itemsPhrase(event.orderItemSeqIds, ctx), event.facilityId, ctx)),
    };
    consume(...steps);
  } else if (brokering.length) {
    const first = brokering.find((move) => move.isFirst);
    const atImport = !!imported && brokering.some((move) => move.move === 'assigned');
    const released = brokering.every((move) => move.move === 'released');
    draft = {
      kind: released && !first ? 'released' : 'brokered',
      headline: translate(atImport ? 'Imported and brokered' : first ? 'First brokered' : released ? 'Released' : 'Brokered'),
      details: moveLines(brokering, ctx, (group) => !!first && !atImport && group.every((move) => move.move === 'released')),
      foldFamily: first || atImport ? undefined : 'rebroker',
    };
    consume(...brokering);
    if (imported) consumeImport();
  } else if (rejections.length) {
    draft = {
      kind: 'rejected',
      headline: translate('Rejected'),
      details: moveLines(rejections, ctx),
      reason: [...new Set(rejections.map((move) => move.reasonEnumId).filter(Boolean) as string[])].map(ctx.enumDescription).join(', '),
      foldFamily: 'rebroker',
    };
    consume(...rejections);
  } else if (moves.some((move) => move.move !== 'cancelled' && !assignedAtImport.includes(move))) {
    const other = moves.filter((move) => move.move !== 'cancelled' && !assignedAtImport.includes(move));
    const locationSync = other.every(isLocationSync);
    draft = {
      kind: other[0].move === 'parked' ? 'parked' : 'moved',
      headline: translate(locationSync ? 'Location changed in Shopify' : MOVE_RECORD_TITLES[other[0].move]),
      details: moveLines(other, ctx),
      foldFamily: locationSync ? 'location' : undefined,
    };
    consume(...other);
  } else if (find('unfillable').length) {
    const attempt = find('unfillable')[0];
    draft = {
      kind: 'unfillable',
      headline: translate('Brokering could not fill'),
      details: [translate(attempt.atLeast ? 'At least {count} attempts' : '{count} attempts', { count: attempt.attempts })],
    };
    consume(attempt);
  } else if (find('return').length) {
    const ret = find('return')[0];
    const items = ret.itemCount === 1 ? itemsPhrase(ret.orderItemSeqIds, ctx) : countPhrase(ret.itemCount, ctx);
    draft = {
      kind: 'return',
      headline: translate('Return created'),
      details: [ret.facilityId ? translate('{items} returned at {facility}', { items, facility: ctx.facilityName(ret.facilityId) }) : translate('{items} returned', { items })],
    };
    consume(ret);
  } else if (find('exchange').length) {
    const exchange = find('exchange')[0];
    if (exchange.direction === 'from') {
      draft = { kind: 'exchange', headline: translate('Exchanged from'), details: [ctx.orderLabel(exchange.orderId)] };
    } else {
      const items = countPhrase(exchange.itemCount || 0, ctx);
      draft = {
        kind: 'exchange',
        headline: translate('Exchange order created'),
        details: [
          ctx.orderLabel(exchange.orderId),
          exchange.facilityId
            ? translate('{items} purchased in exchange at {facility}', { items, facility: ctx.facilityName(exchange.facilityId) })
            : translate('{items} purchased in exchange', { items }),
        ],
      };
    }
    consume(exchange);
  } else if (otherStatus) {
    const status = otherStatus;
    draft = { kind: 'status', headline: ctx.statusDescription(status.statusId), details: [], reason: describeReason(status.reason, ctx) };
    consume(status);
  } else if (approved) {
    draft = {
      kind: 'approved',
      headline: translate(imported ? 'Imported and approved' : 'Approved for fulfillment'),
      details: assignedAtImport.map((move) => moveLine(move, ctx)),
    };
    consume(approved, ...itemStatuses('ITEM_APPROVED'));
    if (imported) consumeImport();
  } else if (find('itemStatus').length) {
    const status = find('itemStatus')[0];
    const same = itemStatuses(status.statusId);
    const ids = itemIds(same);
    const headlines: Record<string, string> = { ITEM_CREATED: 'Items added', ITEM_COMPLETED: 'Items completed' };
    draft = {
      kind: 'items',
      headline: headlines[status.statusId] ? translate(headlines[status.statusId], { count: ids.length }) : ctx.statusDescription(status.statusId),
      details: [itemsPhrase(ids, ctx, ctx.itemTotal)],
      reason: describeReason(status.reason, ctx),
    };
    consume(...same);
  } else if (imported) {
    draft = { kind: 'imported', headline: translate(imported.isShopify ? 'Imported from Shopify' : 'Imported'), details: assignedAtImport.map((move) => moveLine(move, ctx)) };
    consumeImport();
  } else if (placed) {
    draft = {
      kind: 'placed',
      headline: translate(placed.isShopify ? 'Order placed in Shopify' : 'Order placed'),
      details: placed.channelEnumId ? [ctx.enumDescription(placed.channelEnumId)] : [],
    };
    consume(placed);
  } else {
    // Only moves into parking after a cancellation are left: a cancellation row we did not see.
    draft = { kind: 'moved', headline: translate('Moved'), details: moves.map((move) => moveLine(move, ctx)) };
    consume(...moves);
  }

  const notes = [...new Set(events.filter((event) => pool.has(event)).map((event) => notePhrase(event, events, ctx)).filter(Boolean))];
  const actors = [...new Set(events.map((event) => event.actor?.kind === 'user' ? event.actor.login : event.actor?.name || '').filter(Boolean))];
  const dated = events.filter((event) => event.at !== undefined);
  const records = events.flatMap((event) => event.records.map((record) => ({ record, event })))
    .sort((left, right) => (left.record.at ?? Infinity) - (right.record.at ?? Infinity))
    .map(({ record, event }, index) => recordView(record, event, index, ctx, { actor: actors.length === 1 ? actors[0] : '', reason: draft.reason || '', cancelMoves }));

  return {
    id: events.map((event) => event.id).join('+'),
    kind: draft.kind,
    at: dated[0]?.at,
    endAt: dated[dated.length - 1]?.at,
    atKind: events.every((event) => event.atKind === 'recorded') ? 'recorded' : undefined,
    headline: draft.headline,
    details: draft.details.filter(Boolean),
    notes,
    reason: draft.reason || '',
    actor: actors.join(', '),
    link: events.find((event) => event.link)?.link,
    events,
    records,
    foldFamily: draft.foldFamily,
  };
}
