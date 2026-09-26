/**
 * OrderActionValidator (SALES order variant) — DRAFT v2
 * =================================================================
 * Adapted from the transfers app's `src/utils/OrderActionValidator.ts`, but
 * re-modeled for the SALES order reality of order-manager.
 *
 * ── How a SALES order's lifecycle is modeled here ───────────────────────────
 * Unlike the transfers app, a sales order has NO `statusFlowId` on its payload
 * (statusFlowId exists only on seed `StatusFlowTransition` rows, never on the
 * order). So decisions here key on TWO layers:
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
 *   2. SIDE-CONDITION LAYER. Hold tasks are INFORMATIONAL ONLY — product
 *      decision 2026-06-11: an open hold NEVER prevents a ship group from
 *      being brokered or items from being released. No action in this engine
 *      gates on holds.
 *
 * Fulfillment phase (brokered / picked / packed / shipped) is NOT a gate here.
 * Cancel and pull-back are gated by terminal status and the transition table
 * only. A per-store phase cut-off was drafted against company-app config
 * (hotwax/company#158) that no caller ever supplied, so every phase check was
 * unreachable; it was removed rather than left in place looking live. If that
 * config lands, reintroduce it together with the caller that populates it.
 *
 * ── Footer scope ────────────────────────────────────────────────────────────
 * The footer offers the seed table's status transitions plus the bulk
 * "Cancel items" (hidden while cancels do not reach Shopify). Return,
 * Appeasement, Reship and Clone were modelled here without a reachable
 * handler and were removed: returns are hotwax/order-manager#6, the rest
 * #554 (Appeasement), #555 (Reship) and #556 (Clone).
 *
 * `any` for payloads matches house style.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ OPEN ASSUMPTIONS — CONFIRM DURING TWEAKING                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║ R1. Reject quantity is hardcoded '1' in the current UI; this engine is    ║
 * ║     status-only and does NOT compute partial-qty eligibility.             ║
 * ║ R2. allowedTransitions has no statusFlowId scoping; sales orders run the  ║
 * ║     implicit Default flow, so we pass the set in as-is.                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { HIDE_SHOPIFY_UNSYNCED_ACTIONS } from '@/config/featureFlags';

/* ── Action id unions, split by the three levels in OrderDetail.vue ───────── */

/** ORDER / footer level (the Order Detail footer, shown on the Items segment). */
export type OrderFooterActionId = 'CANCEL_ITEMS';

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

/** ITEM level: the facility chip on each item row, and which items the footer's bulk cancel includes. */
export type OrderItemActionId = 'CANCEL_ITEM' | 'REJECT_AND_RELEASE';

/* ── Result + descriptor shapes ──────────────────────────────────────────── */

export interface ActionValidationResult {
  allowed: boolean;
  reason?: string;
}

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
 * table-driven status transitions (`kind: 'status'`) and the cancel button
 * on the end (`kind: 'footer'`). The footer is built from one list of these
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

/**
 * Lifecycle context — the signals the raw `current` payload does NOT natively
 * carry, supplied by the caller (OrderDetail.vue) from the stores it already
 * reads. ALL fields optional so the engine degrades gracefully (no ctx ≈
 * today's terminal-status-only behavior).
 */
export interface OrderLifecycleContext {
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
}

/* ── Lifecycle constants (kept local; mirror seed/ground-truth) ───────────── */

const TERMINAL_ITEM_STATUSES = ['ITEM_CANCELLED', 'ITEM_COMPLETED'];
// Ship-group actions a settled group must not offer. Every one of them acts on a shipment
// that is still going to happen: moving the group through fulfillment, changing how it ships,
// or adding work to it. Nothing is exempt — a group whose items have all stopped takes no
// further input, including new tasks.
const SETTLED_BLOCKED_ACTIONS = [
  'BROKER', 'PARK_ITEMS', 'PULL_BACK', 'RELEASE', 'ADD_TASK', 'ADD_ITEMS',
  'EDIT_CARRIER_METHOD', 'EDIT_ADDRESS'
];
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

  /** Item is in a terminal status (cancelled/completed). Matches OrderDetail.vue:215,228. */
  isItemTerminal(item: any): boolean {
    return TERMINAL_ITEM_STATUSES.includes(item?.statusId);
  },

  /**
   * Every item in the ship group has stopped, so the group itself will not move again.
   *
   * The order-level `isOrderTerminal` check is not enough: a ship group can be fully
   * cancelled inside an order that is still open, and until now nothing asked. Items
   * without a `statusId` are ignored so a group whose statuses have not loaded reads as
   * still moving rather than briefly locking itself.
   */
  isShipGroupSettled(shipGroup: any): boolean {
    const known = (shipGroup?.items || []).filter((item: any) => item?.statusId);
    return known.length > 0 && known.every((item: any) => this.isItemTerminal(item));
  },

  /** Item is still early enough in its lifecycle to be brokered/parked/released. */
  isItemPreFulfill(item: any): boolean {
    return PRE_FULFILL_ITEM_STATUSES.includes(item?.statusId);
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
   * flat list the view can render directly: the table-driven status
   * transitions (Approve, …) plus one cancel button. INVALID actions are
   * omitted entirely — the footer shows only what is currently doable (no
   * disabled-but-visible buttons).
   */
  getOrderFooterActions(order: any, allowedTransitions: any[], selectedItems: any[], ctx?: OrderLifecycleContext): FooterActionView[] {
    const actions: FooterActionView[] = [];
    const statusActions = this.getOrderStatusActions(order, allowedTransitions);

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

    // ONE cancel button that morphs with the item selection: with cancellable items selected it is the bulk
    // "Cancel N items" (the view supplies the count); otherwise, if the order
    // itself can be cancelled, it is the whole-order "Cancel order". The two
    // never coexist. Placed on the right (kind 'footer').
    // Hidden while cancel does not reach Shopify; the button then falls through to
    // the whole-order "Cancel order" below, which is unaffected.
    const bulkCancelValid = !HIDE_SHOPIFY_UNSYNCED_ACTIONS &&
      this.validateFooterAction(order, 'CANCEL_ITEMS', selectedItems, ctx).allowed;
    const orderCancelValid = statusActions.some((transition) => transition.id === 'ORDER_CANCELLED');
    if (bulkCancelValid) {
      actions.push({ id: 'CANCEL_ITEMS', kind: 'footer', label: 'Cancel items', color: 'danger', fill: 'outline' });
    } else if (orderCancelValid) {
      const orderCancel = statusActions.find((transition) => transition.id === 'ORDER_CANCELLED')!;
      actions.push({ id: 'ORDER_CANCELLED', kind: 'footer', toStatusId: 'ORDER_CANCELLED', label: orderCancel.label, color: 'danger', fill: 'outline' });
    }

    return actions;
  },

  /* ════════════════════════════════════════════════════════════════════════
   * VALIDATION MODE — ORDER / FOOTER level
   * The footer renders only on the Items segment.
   * ════════════════════════════════════════════════════════════════════════ */

  validateFooterAction(
    order: any,
    actionId: OrderFooterActionId,
    selectedItems: any[],
    ctx?: OrderLifecycleContext
  ): ActionValidationResult {
    switch (actionId) {
      /**
       * CANCEL_ITEMS — footer "Cancel N items". Offered while the order can still be cancelled
       * and at least one selected item can (CANCEL_ITEM below).
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
   *
   * Item selection is a NARROWING filter, not a precondition: the view passes
   * every item in the ship group when nothing is checked (product decision
   * 2026-08-16), so an empty array here means the ship group itself has no
   * items — hence the "no items" reasons rather than "select some items".
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

    // A settled ship group is read-only. Everything it can offer either moves the group
    // through fulfillment, changes how it ships, or adds work to it, and none of that means
    // anything once every item has stopped — a cancelled group offering a carrier change is
    // the card contradicting itself.
    if (SETTLED_BLOCKED_ACTIONS.includes(actionId) && this.isShipGroupSettled(shipGroup)) {
      return { allowed: false, reason: 'Every item in this ship group has been cancelled or completed.' };
    }

    switch (actionId) {
      /**
       * BROKER — the "Broker" ship-group button.
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
       * PARK_ITEMS — the "Park" face of the dual ship-group button (shown when
       * virtual). Moves selected not-yet-brokered items to a parking facility.
       */
      case 'PARK_ITEMS': {
        if (!virtual) return { allowed: false, reason: 'Items can only be parked from a virtual/brokering facility.' };
        if (!hasSelection) return { allowed: false, reason: 'This ship group has no items to park.' };
        const anyParkable = selectedItems.some((it) => !this.isItemTerminal(it));
        if (!anyParkable) return { allowed: false, reason: 'The items to park are already cancelled or completed.' };
        return { allowed: true };
      }

      /**
       * PULL_BACK — the "Pull back" face of the dual button (OrderDetail.vue:605,
       * shown when PHYSICAL). Rejects items back from a physical facility.
       * Gated by terminal statuses only.
       */
      case 'PULL_BACK': {
        if (virtual) return { allowed: false, reason: 'Pull back only applies to items at a physical facility.' };
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Order is already cancelled or completed.' };
        if (!hasSelection) return { allowed: false, reason: 'This ship group has no items to pull back.' };
        const anyPullable = selectedItems.some((it) => !this.isItemTerminal(it));
        if (!anyPullable) return { allowed: false, reason: 'The items to pull back are already cancelled or completed.' };
        return { allowed: true };
      }

      /**
       * RELEASE — "Release" (OrderDetail.vue:606, v-if virtual + selection).
       * Allocates parked/unassigned items to a real facility. Holds
       * intentionally do NOT gate this (product decision 2026-06-11).
       */
      case 'RELEASE': {
        if (!virtual) return { allowed: false, reason: 'Release only applies to items on a virtual/brokering facility.' };
        if (!hasSelection) return { allowed: false, reason: 'This ship group has no items to release.' };
        if (this.isOrderTerminal(order)) return { allowed: false, reason: 'Cannot release items on a cancelled/completed order.' };
        if (!this.isOrderApproved(order)) return { allowed: false, reason: 'Order must be approved before releasing items to a facility.' };
        const anyReleasable = selectedItems.some((it) => this.isItemPreFulfill(it));
        if (!anyReleasable) return { allowed: false, reason: 'No items in a releasable status.' };
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
   * VALIDATION MODE — ITEM level
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
       * CANCEL_ITEM — whether the footer's bulk cancel may include this item.
       * Gated by terminal statuses and the seed transition table.
       */
      case 'CANCEL_ITEM': {
        if (this.isItemTerminal(item)) {
          return { allowed: false, reason: 'Item is already cancelled or completed.' };
        }
        if (this.isOrderTerminal(order)) {
          return { allowed: false, reason: 'Order is already cancelled or completed.' };
        }
        const tableSays = this.canTransitionTo('ITEM_CANCELLED', ctx?.itemAllowedToStatusIds);
        if (tableSays === false) {
          return { allowed: false, reason: 'The status flow does not allow cancelling from the current item status.' };
        }
        return { allowed: true };
      }

      /**
       * REJECT_AND_RELEASE — facility chip on the item row. Combined
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
        return { allowed: true };
      }

      default:
        return { allowed: false, reason: 'Unknown item action.' };
    }
  }
};
