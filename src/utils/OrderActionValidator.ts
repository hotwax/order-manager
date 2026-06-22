/**
 * OrderActionValidator (SALES order variant) — DRAFT v2
 * =================================================================
 * Adapted from the transfers app's `src/utils/OrderActionValidator.ts`, but
 * re-modeled for the SALES order reality of order-manager.
 *
 * ── How a SALES order's lifecycle is modeled here ───────────────────────────
 * Unlike the transfers app, a sales order has NO `statusFlowId` on its payload
 * (statusFlowId exists only on seed `StatusFlowTransition` rows, never on the
 * order). So decisions here key on THREE distinct layers:
 *
 *   1. STATUS LAYER (transition-table driven). Header status
 *      (ORDER_CREATED/APPROVED/HOLD/COMPLETED/CANCELLED) and item status
 *      (ITEM_CREATED/APPROVED/COMPLETED/CANCELLED/REJECTED/HOLD). The
 *      "what status can legally follow this status" question is OWNED BY THE
 *      SEED TRANSITION TABLE, not by this file. We accept an injected
 *      set per status level (from `seed.allowedTransitions(statusId)`) and
 *      INTERSECT it with lifecycle gating rather than hardcoding the graph.
 *      See `canTransitionTo()` and ctx.orderAllowedToStatusIds /
 *      ctx.itemAllowedToStatusIds.
 *
 *   2. FULFILLMENT-PHASE LAYER (derived here — the transition table CANNOT
 *      express it). Brokered / picked / packed / shipped are NOT order or item
 *      statuses. The current phase is derived from:
 *        - virtual-vs-physical facility on the ship group (brokering/parking),
 *        - the per-ship-group `timelineByShipGroup` entry
 *          (firstBrokeredDate / picklistDate / packedDate / shippedDate).
 *      IMPORTANT (product decision 2026-06-11): the engine does NOT hardcode
 *      "you can't cancel/pull back after stage X". Every business is
 *      different, so the cut-off is BUSINESS CONFIG — a per-store policy
 *      authored in the company app and passed in via `ctx.policy`
 *      (`cancelAllowedWhen` / `pullBackAllowedWhen`). These are REAL phase
 *      EXPRESSIONS — an operator + phase token like `"<PACKED"`, `"<=SHIPPED"`,
 *      `"=<PICKED"` — so there is no inclusive/exclusive guessing; the operator
 *      says exactly what it means. When no policy is set, cancel/pull-back are
 *      allowed at ANY phase and only terminal statuses gate them (today's
 *      behavior). See `phaseExprAllows()`.
 *
 *   3. SIDE-CONDITION LAYER. Hold tasks are INFORMATIONAL ONLY — product
 *      decision 2026-06-11: an open hold NEVER prevents a ship group from
 *      being brokered or items from being released. No action in this engine
 *      gates on holds.
 *
 * ── Remediation & lifecycle-restart actions (product decisions 2026-06-11) ──
 *   - RETURN becomes available as soon as the order has ≥1 item in
 *     ITEM_COMPLETED. Before that, the remediation actions are APPEASEMENT
 *     and RESHIP (these may have been dropped in the OFBiz→Moqui migration;
 *     surfacing them here so the UI exposes them — server wiring TBD).
 *   - CLONE is available at ALL times, including on cancelled/completed
 *     orders. It copies the order + items + logically related details into a
 *     NEW order at the start of its lifecycle, optionally posting to Shopify.
 *     Wire it to the create-order API: POST `oms/orders/shopify`
 *     (see CreateOrder.vue:1089).
 *
 * ── Zero imports on purpose ─────────────────────────────────────────────────
 * Drops in cleanly. `any` for payloads matches house style (the order-detail
 * view model is untyped — see OrderDetail.vue `order` computed).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ OPEN ASSUMPTIONS — CONFIRM DURING TWEAKING                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║ R1. APPEASEMENT/RESHIP stay available AFTER the first item completes too  ║
 * ║     (alongside RETURN), and are blocked only on ORDER_CANCELLED.          ║
 * ║ R2. The cancel/pull-back policy arrives as ProductStore settings authored ║
 * ║     in the company app — tracked in hotwax/company#158 (seed store        ║
 * ║     already loads productStoreSettingsByStoreId). settingTypeEnumId names ║
 * ║     TBD; this engine only consumes the mapped `ctx.policy` expressions.   ║
 * ║ R3. Phase cut-offs are REAL EXPRESSIONS (operator + phase, e.g.          ║
 * ║     `"<PACKED"`, `"<=SHIPPED"`); the operator is explicit so there is no  ║
 * ║     inclusive/exclusive ambiguity. A malformed expression FAILS CLOSED    ║
 * ║     (action disabled) so a config typo surfaces rather than silently      ║
 * ║     permitting the gated action.                                          ║
 * ║ R4. Reject quantity is hardcoded '1' in the current UI; this engine is    ║
 * ║     status/phase-only and does NOT compute partial-qty eligibility.       ║
 * ║ R5. allowedTransitions has no statusFlowId scoping; sales orders run the  ║
 * ║     implicit Default flow, so we pass the set in as-is.                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/* ── Action id unions, split by the three levels in OrderDetail.vue ───────── */

/** ORDER / footer level (renders only on the Items segment, OrderDetail.vue:724). */
export type OrderFooterActionId = 'CANCEL_ITEMS' | 'RETURN' | 'APPEASEMENT' | 'RESHIP' | 'CLONE';

/** SHIP-GROUP level (action row, OrderDetail.vue:603-609). */
export type ShipGroupActionId =
  | 'BROKER'
  | 'PARK_ITEMS'
  | 'PULL_BACK'
  | 'RELEASE'
  | 'ADD_TASK'
  | 'ADD_ITEMS'
  | 'EDIT_CARRIER_METHOD'
  | 'EDIT_ADDRESS';

/** ITEM level (per-row, OrderDetail.vue:215-231). */
export type OrderItemActionId = 'CANCEL_ITEM' | 'REJECT_AND_RELEASE' | 'VIEW_ATTRIBUTES';

export type AnyActionId = OrderFooterActionId | ShipGroupActionId | OrderItemActionId;

/* ── Result + descriptor shapes (mirror the transfers structure) ──────────── */

export interface ActionValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface OrderAction<TId extends string = AnyActionId> {
  id: TId;
  label: string;
  color?: string;
  icon?: string;
  validation: ActionValidationResult;
}

export type OrderFooterAction = OrderAction<OrderFooterActionId>;
export type ShipGroupAction = OrderAction<ShipGroupActionId>;
export type OrderItemAction = OrderAction<OrderItemActionId>;

/**
 * An order-level STATUS-CHANGE action, derived from the seed transition table —
 * NOT a fixed union. Its id IS the destination statusId (e.g. 'ORDER_APPROVED'),
 * because which statuses can follow the current one is owned by the table, not
 * this file. These are the "next logical transition" buttons (Approve, etc.).
 */
export interface OrderStatusAction {
  /** Destination statusId — doubles as the action id. */
  id: string;
  toStatusId: string;
  label: string;
  color?: string;
  /** The seed row's transitionName, kept for traceability / tooltips. */
  transitionName?: string;
  validation: ActionValidationResult;
}

/**
 * A single footer button as the view renders it — the UNIFIED shape across
 * table-driven status transitions (`kind: 'status'`) and the lifecycle/bulk
 * footer actions (`kind: 'footer'`). The footer is built from one list of these
 * (see getOrderFooterActions); only VALID actions are included, so a button
 * that shouldn't apply to the order simply isn't present.
 */
export interface FooterActionView {
  /** Dispatch key: a destination statusId for `status`, else the footer action id. */
  id: string;
  kind: 'status' | 'footer';
  label: string;
  color?: string;
  fill: 'solid' | 'outline';
  /** Present for `kind: 'status'` — the target status to transition to. */
  toStatusId?: string;
}

/* ── Fulfillment phase model ──────────────────────────────────────────────── */

/**
 * The ordered fulfillment phases of a ship group, derived (not stored).
 * Used as the vocabulary for per-store cancel/pull-back policy.
 */
export type FulfillmentPhase = 'UNBROKERED' | 'BROKERED' | 'PICKED' | 'PACKED' | 'SHIPPED';

const PHASE_RANK: Record<FulfillmentPhase, number> = {
  UNBROKERED: 0,
  BROKERED: 1,
  PICKED: 2,
  PACKED: 3,
  SHIPPED: 4
};

/**
 * A phase comparison expression: a comparison operator followed by a
 * FulfillmentPhase token, e.g. `"<PACKED"`, `"<=SHIPPED"`, `"=<PICKED"`,
 * `">=BROKERED"`, `"=PACKED"`. Evaluated against the ship group's current
 * phase by `phaseExprAllows`. Supported operators: `<  <=  =<  >  >=  =>  =  ==`
 * (`=<`/`=>` are accepted as aliases for `<=`/`>=`). Using an explicit operator
 * — rather than a bare phase + an implied "till" — removes any
 * inclusive/exclusive guesswork.
 */
export type PhaseExpression = string;

/**
 * Per-store lifecycle policy, authored in the company app (R2) and mapped by
 * the caller into this shape. Each field is a phase EXPRESSION naming WHEN the
 * action is still allowed (evaluated against the ship group's current phase).
 * Unset field = no phase restriction — the action is gated by terminal
 * statuses only, which is today's behavior.
 */
export interface OrderLifecyclePolicy {
  /** When cancel is allowed, e.g. `"<PACKED"` (block once packed). */
  cancelAllowedWhen?: PhaseExpression;
  /** When pull-back / reject is allowed, e.g. `"<=PICKED"`. */
  pullBackAllowedWhen?: PhaseExpression;
}

export interface ShipGroupTimeline {
  firstBrokeredDate?: string | number | null;
  firstReleasedDate?: string | number | null;
  picklistDate?: string | number | null;
  packedDate?: string | number | null;
  shippedDate?: string | number | null;
}

/**
 * Lifecycle context — the signals the raw `current` payload does NOT natively
 * carry, supplied by the caller (OrderDetail.vue) from the stores it already
 * reads. ALL fields optional so the engine degrades gracefully (no ctx ≈
 * today's terminal-status-only behavior).
 */
export interface OrderLifecycleContext {
  /**
   * Per-ship-group timeline entry: { firstBrokeredDate?, picklistDate?,
   * packedDate?, shippedDate? }. Keyed by shipGroupSeqId in the store; pass the
   * entry for the relevant group (orderDetailStore.timelineByShipGroup[id]).
   * For item-level calls, pass the timeline of the ITEM's ship group.
   */
  timeline?: ShipGroupTimeline;
  /**
   * Seed transition table results, split by status level — a single FROM
   * status only ever yields ORDER_* or ITEM_* targets, never both, so one
   * shared set would make one of the two checks always fail.
   * - orderAllowedToStatusIds: `seed.allowedTransitions(order.statusId)`
   * - itemAllowedToStatusIds:  `seed.allowedTransitions(item.statusId)` — for
   *   the SPECIFIC item being validated; items in different statuses need
   *   their own per-item ctx (same as timeline is per-ship-group).
   * When provided, these are authoritative for the STATUS step (see
   * canTransitionTo).
   */
  orderAllowedToStatusIds?: Set<string>;
  itemAllowedToStatusIds?: Set<string>;
  /**
   * Optional explicit virtual-facility flag for the ship group, matching
   * OrderDetail.vue isVirtualFacility(). If omitted we recompute from the
   * shipGroup fields. Pass it through to keep ONE source of truth — and pass
   * it on item-level calls, where no shipGroup object is in scope.
   */
  isVirtual?: boolean;
  /**
   * Flattened item pool WITH statusId for order-level gates (e.g. RETURN's
   * "≥1 completed item" check). The mapped view-model ship-group items do NOT
   * carry statusId, so pass the FLATTENED grouped item rows —
   * `groupedItems.flatMap(g => g.items)` — NOT the group rows (a group's own
   * statusId is just its first item's and can hide a completed item inside a
   * mixed group). Without this, the fallback scan finds no statusId and only
   * an ORDER_COMPLETED header keeps RETURN available.
   */
  allItems?: any[];
  /** Per-store cancel/pull-back phase policy (company app config, R2). */
  policy?: OrderLifecyclePolicy;
}

/* ── Lifecycle constants (kept local; mirror seed/ground-truth) ───────────── */

const TERMINAL_ITEM_STATUSES = ['ITEM_CANCELLED', 'ITEM_COMPLETED'];
// Product decision 2026-06-11: ORDER_REJECTED / ORDER_EXPIRED have no known
// use case today and are intentionally NOT treated as terminal.
const TERMINAL_ORDER_STATUSES = ['ORDER_CANCELLED', 'ORDER_COMPLETED'];
/**
 * Display metadata for known order status-change destinations. Anything not
 * listed falls back to the seed row's transitionName / toStatusDescription, so
 * a newly-seeded transition still renders a (less-polished) button rather than
 * disappearing.
 */
const ORDER_STATUS_ACTION_META: Record<string, { label: string; color?: string }> = {
  ORDER_APPROVED: { label: 'Approve order' },
  ORDER_HOLD: { label: 'Hold order', color: 'warning' },
  ORDER_CANCELLED: { label: 'Cancel order', color: 'danger' },
  ORDER_COMPLETED: { label: 'Complete order' }
};
/** Item statuses from which the item is still in-flight enough to broker/park/release. */
const PRE_FULFILL_ITEM_STATUSES = ['ITEM_CREATED', 'ITEM_APPROVED', 'ITEM_HOLD', 'ITEM_REJECTED'];

export const OrderActionValidator = {
  /* ════════════════════════════════════════════════════════════════════════
   * CATEGORY HELPERS — centralized lifecycle predicates (phase layer).
   * ════════════════════════════════════════════════════════════════════════ */

  /**
   * Mirrors OrderDetail.vue isVirtualFacility(): a ship group is "virtual"
   * (i.e. NOT brokered — sitting on a brokering/parking facility) when it has
   * no facilityId, or its facility (parent) type is VIRTUAL_FACILITY.
   * Product decision 2026-06-11: parking sub-types (UNFILLABLE_PARKING / _NA_
   * / REJECTED_PARKING) are NOT differentiated — any virtual parking has the
   * same next available actions.
   */
  isVirtualFacility(shipGroup: any, ctx?: OrderLifecycleContext): boolean {
    if (ctx && typeof ctx.isVirtual === 'boolean') return ctx.isVirtual;
    if (!shipGroup?.facilityId) return true;
    return (
      shipGroup.facilityParentTypeId === 'VIRTUAL_FACILITY' ||
      shipGroup.facilityTypeId === 'VIRTUAL_FACILITY'
    );
  },

  /** Brokered == assigned to a real (physical) facility OR timeline shows a brokered date. */
  isShipGroupBrokered(shipGroup: any, ctx?: OrderLifecycleContext): boolean {
    if (ctx?.timeline?.firstBrokeredDate || ctx?.timeline?.firstReleasedDate) return true;
    return !this.isVirtualFacility(shipGroup, ctx);
  },

  isShipGroupPicked(ctx?: OrderLifecycleContext): boolean {
    return !!ctx?.timeline?.picklistDate;
  },

  isShipGroupPacked(ctx?: OrderLifecycleContext): boolean {
    return !!ctx?.timeline?.packedDate;
  },

  isShipGroupShipped(ctx?: OrderLifecycleContext): boolean {
    return !!ctx?.timeline?.shippedDate;
  },

  /**
   * The highest fulfillment phase the ship group has reached, derived from the
   * timeline dates + facility virtuality. For item-level calls pass `null` as
   * shipGroup and supply ctx.isVirtual/ctx.timeline for the item's group —
   * with neither present this degrades to UNBROKERED (permissive).
   */
  getShipGroupPhase(shipGroup: any, ctx?: OrderLifecycleContext): FulfillmentPhase {
    if (this.isShipGroupShipped(ctx)) return 'SHIPPED';
    if (this.isShipGroupPacked(ctx)) return 'PACKED';
    if (this.isShipGroupPicked(ctx)) return 'PICKED';
    if (this.isShipGroupBrokered(shipGroup, ctx)) return 'BROKERED';
    return 'UNBROKERED';
  },

  /**
   * BUSINESS-CONFIG GATE (product decision 2026-06-11). Evaluate a phase
   * EXPRESSION (operator + phase, e.g. `"<PACKED"`) against a current phase.
   * - empty / undefined expression → true (no restriction; today's behavior).
   * - malformed expression or unknown phase → false (FAILS CLOSED so a config
   *   typo surfaces as a disabled action rather than silently permitting it).
   * Returned separately from the call sites so the reason string can quote
   * both the configured expression and the current phase.
   */
  phaseExprAllows(expr: PhaseExpression | undefined, currentPhase: FulfillmentPhase): boolean {
    if (!expr || !expr.trim()) return true;
    const match = expr.trim().match(/^(<=|=<|>=|=>|==|=|<|>)\s*([A-Za-z_]+)$/);
    if (!match) return false;
    const op = match[1];
    const target = match[2].toUpperCase();
    if (!(target in PHASE_RANK)) return false;
    const cur = PHASE_RANK[currentPhase];
    const tgt = PHASE_RANK[target as FulfillmentPhase];
    switch (op) {
      case '<': return cur < tgt;
      case '<=': case '=<': return cur <= tgt;
      case '>': return cur > tgt;
      case '>=': case '=>': return cur >= tgt;
      case '=': case '==': return cur === tgt;
      default: return false;
    }
  },

  /** Item is in a terminal status (cancelled/completed). Matches OrderDetail.vue:215,228. */
  isItemTerminal(item: any): boolean {
    return TERMINAL_ITEM_STATUSES.includes(item?.statusId);
  },

  /** Item has been fulfilled (terminal completed). */
  isItemFulfilled(item: any): boolean {
    return item?.statusId === 'ITEM_COMPLETED';
  },

  /** Order header is terminal (cancelled/completed only — see D4 note above). */
  isOrderTerminal(order: any): boolean {
    return TERMINAL_ORDER_STATUSES.includes(order?.statusId);
  },

  isOrderApproved(order: any): boolean {
    return order?.statusId === 'ORDER_APPROVED';
  },

  /**
   * RETURN eligibility driver: the order has at least one completed item.
   * An ORDER_COMPLETED header short-circuits true (all items completed).
   * Otherwise prefers ctx.allItems (rows that carry statusId); the fallback
   * scan of order.shipGroups[].items only works on payloads whose item rows
   * carry statusId — the mapped view model's do NOT, so pass ctx.allItems.
   */
  hasAnyCompletedItem(order: any, ctx?: OrderLifecycleContext): boolean {
    if (order?.statusId === 'ORDER_COMPLETED') return true;
    const pool = ctx?.allItems ?? (order?.shipGroups || []).flatMap((sg: any) => sg.items || []);
    return pool.some((item: any) => this.isItemFulfilled(item));
  },

  /**
   * STATUS-TABLE BRIDGE. Returns whether `toStatusId` is a legal next status
   * for the given FROM status. Consults the injected seed transition set when
   * present (authoritative); otherwise returns `undefined` to signal "table
   * not available — caller should fall back to its own conservative check".
   *
   * This is the explicit seam where the engine DEFERS to seed.allowedTransitions
   * rather than hardcoding the ORDER_x / ITEM_x graph. Pass the level-specific
   * set (ctx.orderAllowedToStatusIds or ctx.itemAllowedToStatusIds).
   */
  canTransitionTo(toStatusId: string, allowedToStatusIds?: Set<string>): boolean | undefined {
    if (!allowedToStatusIds) return undefined;
    return allowedToStatusIds.has(toStatusId);
  },

  /* ════════════════════════════════════════════════════════════════════════
   * ORDER STATUS TRANSITIONS — table-driven "next logical transition" buttons.
   * ════════════════════════════════════════════════════════════════════════ */

  /**
   * Whether a seed transition row is available to a USER-INITIATED (direct)
   * status change. The Default flow marks system-only edges with
   * `conditionExpression="directStatusChange == false"` (e.g. CREATED → HOLD /
   * REJECTED / AUTHORIZED) — those are driven by the OMS, not by an operator
   * clicking a button. A user click IS a direct status change, so:
   *   - no conditionExpression           → user-driven (e.g. CREATED → APPROVED)
   *   - "directStatusChange == false"    → NOT user-driven
   *   - any other/unrecognized condition → conservatively NOT user-driven (we
   *     never surface a button we can't prove is honorable; extend this as the
   *     engine learns to evaluate more conditions).
   * This is the "conditioned on the overall lifecycle, not just one status
   * field" gate — expressed by the transition table itself.
   */
  isUserDrivenTransition(transition: any): boolean {
    const expr = String(transition?.conditionExpression || '').trim();
    if (!expr) return true;
    if (/directStatusChange\s*==\s*false/.test(expr)) return false;
    return false;
  },

  /**
   * DISCOVERY — the order-level status-change actions for the order's CURRENT
   * status, derived entirely from the seed transition table. Pass the enriched
   * rows from `seed.allowedTransitions(order.statusId)`. A button exists for a
   * destination iff the table has that (user-drivable) transition — there is NO
   * app-side hardcoding of which status may follow which. A created order shows
   * "Approve order" purely because the Default flow seeds CREATED → APPROVED.
   * Terminal orders yield none.
   */
  getOrderStatusActions(order: any, allowedTransitions: any[]): OrderStatusAction[] {
    if (this.isOrderTerminal(order)) return [];
    return (allowedTransitions || [])
      .filter((transition: any) => this.isUserDrivenTransition(transition))
      .map((transition: any) => {
        const meta = ORDER_STATUS_ACTION_META[transition.toStatusId];
        return {
          id: transition.toStatusId,
          toStatusId: transition.toStatusId,
          label: meta?.label || transition.transitionName || transition.toStatusDescription || transition.toStatusId,
          color: meta?.color,
          transitionName: transition.transitionName,
          validation: { allowed: true }
        };
      });
  },

  /**
   * DISCOVERY — the COMPLETE, valid-only footer action set for an order, in one
   * flat list the view can render directly. It unifies:
   *   - table-driven status transitions (Approve, Cancel order, …), and
   *   - the lifecycle/bulk footer actions (Return, Clone, Cancel items,
   *     Appeasement, Reship).
   * INVALID actions are omitted entirely — the footer shows only what is
   * currently doable (no disabled-but-visible buttons). The engine reports
   * validity; the VIEW still decides which ids it has a handler wired for and
   * skips the rest (e.g. Appeasement/Reship until their backend lands).
   */
  getOrderFooterActions(order: any, allowedTransitions: any[], selectedItems: any[], ctx?: OrderLifecycleContext): FooterActionView[] {
    const actions: FooterActionView[] = [];
    const statusActions = this.getOrderStatusActions(order, allowedTransitions);
    const footer = this.getFooterActions(order, selectedItems, ctx);

    // Status transitions on the start — EXCEPT order-cancel, which is folded
    // into the single morphing cancel button below.
    for (const transition of statusActions) {
      if (transition.id === 'ORDER_CANCELLED') continue;
      actions.push({
        id: transition.id,
        kind: 'status',
        toStatusId: transition.toStatusId,
        label: transition.label,
        color: transition.color,
        fill: transition.id === 'ORDER_APPROVED' ? 'solid' : 'outline'
      });
    }

    // ONE cancel button that morphs with the item selection (kept on the start
    // so it converts in place): with cancellable items selected it is the bulk
    // "Cancel N items" (the view supplies the count); otherwise, if the order
    // itself can be cancelled, it is the whole-order "Cancel order". The two
    // never coexist.
    const bulkCancelValid = footer.some((action) => action.id === 'CANCEL_ITEMS' && action.validation.allowed);
    const orderCancelValid = statusActions.some((transition) => transition.id === 'ORDER_CANCELLED');
    if (bulkCancelValid) {
      actions.push({ id: 'CANCEL_ITEMS', kind: 'status', label: 'Cancel items', color: 'danger', fill: 'outline' });
    } else if (orderCancelValid) {
      const orderCancel = statusActions.find((transition) => transition.id === 'ORDER_CANCELLED')!;
      actions.push({ id: 'ORDER_CANCELLED', kind: 'status', toStatusId: 'ORDER_CANCELLED', label: orderCancel.label, color: 'danger', fill: 'outline' });
    }

    // Remaining lifecycle actions on the end (cancel handled above).
    for (const action of footer) {
      if (action.id === 'CANCEL_ITEMS') continue;
      if (!action.validation.allowed) continue;
      actions.push({
        id: action.id,
        kind: 'footer',
        label: action.label,
        color: action.color,
        fill: 'outline'
      });
    }

    return actions;
  },

  /* ════════════════════════════════════════════════════════════════════════
   * VALIDATION MODE — ORDER / FOOTER level
   * Footer renders only on the Items segment (OrderDetail.vue:724).
   * ════════════════════════════════════════════════════════════════════════ */

  validateFooterAction(
    order: any,
    actionId: OrderFooterActionId,
    selectedItems: any[],
    ctx?: OrderLifecycleContext
  ): ActionValidationResult {
    switch (actionId) {
      /**
       * CANCEL_ITEMS — footer "Cancel" (OrderDetail.vue:727).
       * Terminal statuses always gate; the PHASE cut-off comes from store
       * policy (ctx.policy.cancelAllowedWhen) — see validateItemAction.
       * NOTE: items may span ship groups in different phases; for precise
       * phase gating the caller should evaluate per item with that item's
       * group timeline in ctx.
       */
      case 'CANCEL_ITEMS': {
        if (this.isOrderTerminal(order)) {
          return { allowed: false, reason: 'Order is already cancelled or completed.' };
        }
        // Defer to the seed transition table when available (R5): can the header
        // even move to ORDER_CANCELLED from its current status?
        const tableSaysCancellable = this.canTransitionTo('ORDER_CANCELLED', ctx?.orderAllowedToStatusIds);
        if (tableSaysCancellable === false) {
          return { allowed: false, reason: 'The status flow does not allow cancelling from the current order status.' };
        }
        const cancellable = (selectedItems || []).filter((it) => this.validateItemAction(order, it, 'CANCEL_ITEM', ctx).allowed);
        if (!cancellable.length) {
          return { allowed: false, reason: 'Select at least one item that can still be cancelled.' };
        }
        return { allowed: true };
      }

      /**
       * RETURN — footer "Return" (OrderDetail.vue:730).
       * Product decision 2026-06-11: returns open up as soon as the order has
       * at least one ITEM_COMPLETED item. Before that, remediation happens via
       * APPEASEMENT / RESHIP instead.
       */
      case 'RETURN': {
        if (order?.statusId === 'ORDER_CANCELLED') {
          return { allowed: false, reason: 'Returns are not available for a cancelled order.' };
        }
        if (!this.hasAnyCompletedItem(order, ctx)) {
          return { allowed: false, reason: 'Returns become available once at least one item is completed. Until then, issue an appeasement or reship.' };
        }
        return { allowed: true };
      }

      /**
       * APPEASEMENT / RESHIP — remediation actions (product decision
       * 2026-06-11). Confirmed both backend-gaps in src/services/orderActions.ts
       * (legacy AddOrderAppeasement.ftl / ReShipOrderItems.ftl, dropped in the
       * OFBiz→Moqui migration — server wiring still needed). Available on any
       * non-cancelled order, including AFTER items complete (confirmed
       * 2026-06-11) — they coexist with RETURN, not just precede it.
       */
      case 'APPEASEMENT':
      case 'RESHIP': {
        if (order?.statusId === 'ORDER_CANCELLED') {
          return { allowed: false, reason: 'Not available for a cancelled order.' };
        }
        return { allowed: true };
      }

      /**
       * CLONE — available at ALL times, including terminal orders (product
       * decision 2026-06-11). Creates a NEW order AS IF placed again from an
       * external system: it carries the order + items + logically related
       * details, but NOT holds, payment capture, fulfillment/shipment records,
       * inventory reservations, status history, or the order number/dates —
       * the OMS re-adds holds and re-captures payment after the fact. Whether
       * unit prices / taxes / discounts are carried verbatim or recomputed may
       * become a user-confirmation modal (design pending clone research). Wire
       * to POST `oms/orders/shopify` (CreateOrder.vue:1089). No lifecycle gate.
       */
      case 'CLONE': {
        return { allowed: true };
      }

      default:
        return { allowed: false, reason: 'Unknown footer action.' };
    }
  },

  /* ════════════════════════════════════════════════════════════════════════
   * VALIDATION MODE — SHIP-GROUP level (OrderDetail.vue:603-609)
   * The whole action set hinges on isVirtualFacility + selection + phase.
   *
   * `selectedItems` must be ITEM OBJECTS carrying statusId — NOT id strings.
   * The view's selectedItemsForShipGroup() returns string ids, so map them to
   * the ship group's item rows (with statusId joined in) before calling, or
   * the status checks silently misfire (strings have no .statusId).
   * ════════════════════════════════════════════════════════════════════════ */

  validateShipGroupAction(
    order: any,
    shipGroup: any,
    actionId: ShipGroupActionId,
    selectedItems: any[],
    ctx?: OrderLifecycleContext
  ): ActionValidationResult {
    const virtual = this.isVirtualFacility(shipGroup, ctx);
    const hasSelection = (selectedItems || []).length > 0;

    switch (actionId) {
      /**
       * BROKER — "Broker ship group" (OrderDetail.vue:604).
       * Holds intentionally do NOT gate this (product decision 2026-06-11:
       * hold tasks never prevent a ship group from being brokered).
       */
      case 'BROKER': {
        if (!virtual) return { allowed: false, reason: 'Ship group is already brokered to a facility.' };
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot broker a cancelled/completed order.' };
        if (!this.isOrderApproved(order)) return { allowed: false, reason: 'Order must be approved before brokering.' };
        return { allowed: true };
      }

      /**
       * PARK_ITEMS — the "Park Items" face of the dual button (OrderDetail.vue:605,
       * shown when virtual). Moves selected not-yet-brokered items to a parking
       * facility.
       */
      case 'PARK_ITEMS': {
        if (!virtual) return { allowed: false, reason: 'Items can only be parked from a virtual/brokering facility.' };
        if (!hasSelection) return { allowed: false, reason: 'Select one or more items to park.' };
        const anyParkable = selectedItems.some((it) => !this.isItemTerminal(it));
        if (!anyParkable) return { allowed: false, reason: 'Selected items are already cancelled or completed.' };
        return { allowed: true };
      }

      /**
       * PULL_BACK — the "Pull back" face of the dual button (OrderDetail.vue:605,
       * shown when PHYSICAL). Rejects items back from a physical facility.
       * Phase cut-off is BUSINESS CONFIG (ctx.policy.pullBackAllowedWhen, a
       * phase expression); unset = allowed at any phase, terminal statuses only.
       */
      case 'PULL_BACK': {
        if (virtual) return { allowed: false, reason: 'Pull back only applies to items at a physical facility.' };
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Order is already cancelled or completed.' };
        if (!hasSelection) return { allowed: false, reason: 'Select one or more items to pull back.' };
        if (ctx?.policy?.pullBackAllowedWhen) {
          const phase = this.getShipGroupPhase(shipGroup, ctx);
          if (!this.phaseExprAllows(ctx.policy.pullBackAllowedWhen, phase)) {
            return { allowed: false, reason: `Store policy restricts pull back to phase ${ctx.policy.pullBackAllowedWhen}; this ship group is currently ${phase}.` };
          }
        }
        const anyPullable = selectedItems.some((it) => !this.isItemTerminal(it));
        if (!anyPullable) return { allowed: false, reason: 'Selected items are already cancelled or completed.' };
        return { allowed: true };
      }

      /**
       * RELEASE — "Release" (OrderDetail.vue:606, v-if virtual + selection).
       * Allocates parked/unassigned items to a real facility. Holds
       * intentionally do NOT gate this (product decision 2026-06-11).
       */
      case 'RELEASE': {
        if (!virtual) return { allowed: false, reason: 'Release only applies to items on a virtual/brokering facility.' };
        if (!hasSelection) return { allowed: false, reason: 'Select one or more items to release.' };
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot release items on a cancelled/completed order.' };
        if (!this.isOrderApproved(order)) return { allowed: false, reason: 'Order must be approved before releasing items to a facility.' };
        const anyReleasable = selectedItems.some((it) => PRE_FULFILL_ITEM_STATUSES.includes(it?.statusId));
        if (!anyReleasable) return { allowed: false, reason: 'Selected items are not in a releasable status.' };
        return { allowed: true };
      }

      /** ADD_TASK — "Add Task" (OrderDetail.vue:607). Terminal-only gate. */
      case 'ADD_TASK': {
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot add tasks to a cancelled/completed order.' };
        return { allowed: true };
      }

      /**
       * ADD_ITEMS — "Add Items" (OrderDetail.vue:608). Terminal-only gate —
       * consistent with the permissive-by-default policy model; a phase
       * cut-off can become store policy later if a business needs it.
       */
      case 'ADD_ITEMS': {
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot add items to a cancelled/completed order.' };
        return { allowed: true };
      }

      /**
       * EDIT_CARRIER_METHOD — carrier + shipment-method selects (OrderDetail.vue:496,504).
       * EDIT_ADDRESS — edit shipping address (OrderDetail.vue:528).
       * Terminal-only for now (permissive-by-default); a shipped-lock could
       * become store policy later.
       */
      case 'EDIT_CARRIER_METHOD':
      case 'EDIT_ADDRESS': {
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot edit a cancelled/completed order.' };
        return { allowed: true };
      }

      default:
        return { allowed: false, reason: 'Unknown ship-group action.' };
    }
  },

  /* ════════════════════════════════════════════════════════════════════════
   * VALIDATION MODE — ITEM level (OrderDetail.vue:215-231)
   * For phase gating, supply ctx.timeline / ctx.isVirtual for the ITEM's
   * ship group (no shipGroup object is in scope at this level).
   * ════════════════════════════════════════════════════════════════════════ */

  validateItemAction(
    order: any,
    item: any,
    actionId: OrderItemActionId,
    ctx?: OrderLifecycleContext
  ): ActionValidationResult {
    switch (actionId) {
      /**
       * CANCEL_ITEM — per-row "Cancel" (OrderDetail.vue:228).
       * Terminal statuses always gate. The phase cut-off is BUSINESS CONFIG
       * (ctx.policy.cancelAllowedWhen, a phase expression); unset = cancellable
       * at any phase before terminal, which is today's behavior.
       */
      case 'CANCEL_ITEM': {
        if (this.isItemTerminal(item)) {
          return { allowed: false, reason: 'Item is already cancelled or completed.' };
        }
        if (this.isOrderTerminal(order)) {
          return { allowed: false, reason: 'Order is already cancelled or completed.' };
        }
        if (ctx?.policy?.cancelAllowedWhen) {
          const phase = this.getShipGroupPhase(null, ctx);
          if (!this.phaseExprAllows(ctx.policy.cancelAllowedWhen, phase)) {
            return { allowed: false, reason: `Store policy restricts cancellation to phase ${ctx.policy.cancelAllowedWhen}; this item's ship group is currently ${phase}.` };
          }
        }
        const tableSays = this.canTransitionTo('ITEM_CANCELLED', ctx?.itemAllowedToStatusIds);
        if (tableSays === false) {
          return { allowed: false, reason: 'The status flow does not allow cancelling from the current item status.' };
        }
        return { allowed: true };
      }

      /**
       * REJECT_AND_RELEASE — facility chip (OrderDetail.vue:215). Combined
       * reject-from-current-facility + release-to-another. A pull-back
       * variant, so it follows the pull-back phase policy and (when the
       * caller tells us via ctx.isVirtual) requires a PHYSICAL facility —
       * there is nothing to reject from a parking/brokering facility. We only
       * gate on an EXPLICIT ctx.isVirtual === true; with no signal we stay
       * permissive, matching the current chip behavior.
       */
      case 'REJECT_AND_RELEASE': {
        if (this.isItemTerminal(item)) {
          return { allowed: false, reason: 'Item is already cancelled or completed.' };
        }
        if (this.isOrderTerminal(order)) {
          return { allowed: false, reason: 'Order is already cancelled or completed.' };
        }
        if (!this.isOrderApproved(order)) {
          return { allowed: false, reason: 'Order must be approved before releasing items to a facility.' };
        }
        if (ctx?.isVirtual === true) {
          return { allowed: false, reason: 'Reject only applies to items at a physical facility — release the item instead.' };
        }
        if (ctx?.policy?.pullBackAllowedWhen) {
          const phase = this.getShipGroupPhase(null, ctx);
          if (!this.phaseExprAllows(ctx.policy.pullBackAllowedWhen, phase)) {
            return { allowed: false, reason: `Store policy restricts rejection to phase ${ctx.policy.pullBackAllowedWhen}; this item's ship group is currently ${phase}.` };
          }
        }
        return { allowed: true };
      }

      /**
       * VIEW_ATTRIBUTES — attribute chip (OrderDetail.vue:220). Read-only modal,
       * shown only when item.attributeCount > 0. No lifecycle guard needed.
       */
      case 'VIEW_ATTRIBUTES': {
        if (!Number(item?.attributeCount || 0)) {
          return { allowed: false, reason: 'This item has no attributes to view.' };
        }
        return { allowed: true };
      }

      default:
        return { allowed: false, reason: 'Unknown item action.' };
    }
  },

  /* ════════════════════════════════════════════════════════════════════════
   * DISCOVERY MODE — each method returns actions carrying their validation.
   * (Footer/ship-group keep disabled-but-visible items, like the transfers app;
   *  item-level filters to allowed, matching how the chips/buttons render.)
   * ════════════════════════════════════════════════════════════════════════ */

  getFooterActions(order: any, selectedItems: any[], ctx?: OrderLifecycleContext): OrderFooterAction[] {
    return [
      {
        id: 'CANCEL_ITEMS',
        label: 'Cancel items',
        color: 'danger',
        validation: this.validateFooterAction(order, 'CANCEL_ITEMS', selectedItems, ctx)
      },
      {
        id: 'RETURN',
        label: 'Return',
        color: 'warning',
        validation: this.validateFooterAction(order, 'RETURN', selectedItems, ctx)
      },
      {
        id: 'APPEASEMENT',
        label: 'Appeasement',
        validation: this.validateFooterAction(order, 'APPEASEMENT', selectedItems, ctx)
      },
      {
        id: 'RESHIP',
        label: 'Reship',
        validation: this.validateFooterAction(order, 'RESHIP', selectedItems, ctx)
      },
      {
        id: 'CLONE',
        label: 'Clone order',
        validation: this.validateFooterAction(order, 'CLONE', selectedItems, ctx)
      }
    ];
  },

  getShipGroupActions(order: any, shipGroup: any, selectedItems: any[], ctx?: OrderLifecycleContext): ShipGroupAction[] {
    const virtual = this.isVirtualFacility(shipGroup, ctx);
    const actions: ShipGroupAction[] = [];

    if (virtual) {
      actions.push({ id: 'BROKER', label: 'Broker ship group', validation: this.validateShipGroupAction(order, shipGroup, 'BROKER', selectedItems, ctx) });
      actions.push({ id: 'PARK_ITEMS', label: 'Park Items', validation: this.validateShipGroupAction(order, shipGroup, 'PARK_ITEMS', selectedItems, ctx) });
      actions.push({ id: 'RELEASE', label: 'Release', validation: this.validateShipGroupAction(order, shipGroup, 'RELEASE', selectedItems, ctx) });
    } else {
      // Physical facility: the dual button shows "Pull back" instead of "Park Items".
      actions.push({ id: 'PULL_BACK', label: 'Pull back', validation: this.validateShipGroupAction(order, shipGroup, 'PULL_BACK', selectedItems, ctx) });
    }

    actions.push({ id: 'ADD_TASK', label: 'Add Task', validation: this.validateShipGroupAction(order, shipGroup, 'ADD_TASK', selectedItems, ctx) });
    actions.push({ id: 'ADD_ITEMS', label: 'Add Items', validation: this.validateShipGroupAction(order, shipGroup, 'ADD_ITEMS', selectedItems, ctx) });
    actions.push({ id: 'EDIT_CARRIER_METHOD', label: 'Edit carrier & method', validation: this.validateShipGroupAction(order, shipGroup, 'EDIT_CARRIER_METHOD', selectedItems, ctx) });
    actions.push({ id: 'EDIT_ADDRESS', label: 'Edit shipping address', validation: this.validateShipGroupAction(order, shipGroup, 'EDIT_ADDRESS', selectedItems, ctx) });

    return actions;
  },

  getItemActions(order: any, item: any, ctx?: OrderLifecycleContext): OrderItemAction[] {
    // Returns ALL actions with their validation (disabled-but-visible),
    // consistent with the footer/ship-group levels. The view decides hide vs
    // disable per affordance — note the REJECT_AND_RELEASE chip doubles as the
    // item's facility-name display (OrderDetail.vue:215-218) and must stay
    // visible-but-disabled, never hidden.
    return [
      { id: 'REJECT_AND_RELEASE', label: 'Reject & release', validation: this.validateItemAction(order, item, 'REJECT_AND_RELEASE', ctx) },
      { id: 'CANCEL_ITEM', label: 'Cancel', color: 'danger', validation: this.validateItemAction(order, item, 'CANCEL_ITEM', ctx) },
      { id: 'VIEW_ATTRIBUTES', label: 'View attributes', validation: this.validateItemAction(order, item, 'VIEW_ATTRIBUTES', ctx) }
    ];
  },

  /* ════════════════════════════════════════════════════════════════════════
   * BULK HELPERS — which items can participate in a selection-driven action.
   * ════════════════════════════════════════════════════════════════════════ */

  /** Items eligible for the footer Cancel (drives selectable checkboxes). */
  getBulkSelectableItems(order: any, items: any[], ctx?: OrderLifecycleContext): any[] {
    return (items || []).filter((it) => this.isItemSelectable(order, it, ctx));
  },

  /** An item is selectable for a bulk action if any selection-driven action is valid for it. */
  isItemSelectable(order: any, item: any, ctx?: OrderLifecycleContext): boolean {
    return (
      this.validateItemAction(order, item, 'CANCEL_ITEM', ctx).allowed ||
      this.validateItemAction(order, item, 'REJECT_AND_RELEASE', ctx).allowed
    );
  }
};
