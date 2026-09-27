/**
 * An order's history as typed events: one per operation per source, carrying ids and facts but
 * no display text. buildOrderEvents makes them from the raw rows the order store loads; the
 * timeline groups them into business transactions (utils/orderTimeline) and the ship-group cards
 * read their milestones from them (shipGroupMilestones).
 */

export type OrderEventActor = { kind: 'user'; login: string } | { kind: 'system'; name: string };

export type OrderEventSource = 'order' | 'status' | 'facilityChange' | 'unfillable' | 'fulfillment' | 'return' | 'exchange';

/** One database row behind an event, listed when the operator opens a transaction's records. */
export interface OrderEventRecord {
  source: OrderEventSource;
  /** What the row records: a status id, a facility-change reason, or a date field name. */
  type: string;
  at?: number;
  orderItemSeqId?: string;
  shipGroupSeqId?: string;
  fromFacilityId?: string;
  facilityId?: string;
  userLogin?: string;
  reason?: string;
  comments?: string;
  /** The return or order the row points at. */
  refId?: string;
}

/**
 * What a facility change did. `assigned` is the reason-less row an import writes with the same
 * facility on both sides; `cancelled` is the move of cancelled items into parking that a Shopify
 * cancellation writes. Every other reason is a rejection.
 */
export type MoveKind = 'assigned' | 'brokered' | 'released' | 'allocated' | 'parked' | 'rejected' | 'cancelled' | 'moved';

export type FulfillmentStep = 'picked' | 'packed' | 'shipped';

export interface OrderEventLink {
  kind: 'exchangeSource' | 'exchangeChild' | 'return';
  id: string;
}

interface OrderEventBase {
  id: string;
  /** The business time. A source that has none leaves it empty; nothing stands in for it. */
  at?: number;
  /** Set when only the time the row was written is known. */
  atKind?: 'recorded';
  actor?: OrderEventActor;
  shipGroupSeqIds: string[];
  orderItemSeqIds: string[];
  records: OrderEventRecord[];
  link?: OrderEventLink;
}

export type OrderEvent = OrderEventBase & (
  | { kind: 'placed'; channelEnumId?: string; isShopify: boolean }
  | { kind: 'imported'; isShopify: boolean }
  | { kind: 'orderStatus'; statusId: string; reason?: string }
  | { kind: 'itemStatus'; statusId: string; reason?: string }
  | {
    kind: 'move';
    move: MoveKind;
    fromFacilityId?: string;
    toFacilityId?: string;
    reasonEnumId?: string;
    comments?: string;
    /** The order's first brokering: the earliest brokered or released move, or import assignment. */
    isFirst?: boolean;
  }
  | { kind: 'fulfillment'; step: FulfillmentStep; facilityId?: string }
  | { kind: 'unfillable'; attempts: number; atLeast: boolean }
  | { kind: 'return'; returnId: string; itemCount: number; facilityId?: string }
  | { kind: 'exchange'; direction: 'from' | 'to'; orderId: string; itemCount?: number; facilityId?: string }
);

export type OrderEventKind = OrderEvent['kind'];
export type OrderEventOf<K extends OrderEventKind> = Extract<OrderEvent, { kind: K }>;

export interface UnfillableSummary {
  /** Brokering runs that failed, not rows: one run writes a row per unfillable item. */
  count: number;
  /** True when `count` is a floor — the sample filled its page, so older runs are unseen. */
  atLeast: boolean;
  lastAttemptDate: string;
}

export interface ExchangeChild {
  orderId: string;
  itemCount: number;
  /** Where the exchange order was placed; empty when the order names no real facility. */
  facilityId: string;
  value: number;
}

/** The raw sources the order store holds for one order. */
export interface OrderEventSources {
  order: any;
  /** OrderFacilityChange rows other than UNFILLABLE. */
  facilityChanges: any[];
  /** False while the facility changes are loading or after they failed. */
  facilityChangesLoaded: boolean;
  /** The facility changes filled their page: only the newest moves are here. */
  facilityChangesTruncated?: boolean;
  unfillable: UnfillableSummary | null;
  /** `get#OrderFulfillmentTimeline` entries, one per ship group. */
  fulfillment: any[];
  /** Return headers by returnId; null when a header could not be loaded. */
  returnHeadersById: Record<string, any | null>;
  exchangeChildren: ExchangeChild[];
  /** Parking and queue facilities, where an item waits rather than being fulfilled. */
  isVirtualFacility: (facilityId: string) => boolean;
}
