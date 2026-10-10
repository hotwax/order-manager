<template>
  <div ref="rootEl" class="ion-padding order-routing">
    <ion-item v-if="status === 'error'" color="danger" lines="none">
      <ion-icon slot="start" :icon="warningOutline" />
      <ion-label>{{ translate('Routing history could not be loaded.') }}</ion-label>
      <ion-button slot="end" fill="outline" color="light" size="small" @click="emit('retry')">
        {{ translate('Retry') }}
      </ion-button>
    </ion-item>

    <OrderRoutingFlow
      v-if="flow && status === 'loaded'"
      :flow="flow"
      :items="entries.map((entry) => entry.item)"
      :short-stock="shortStock || {}"
      @select-items="focusItems"
    />

    <ion-card
      v-for="entry in entries"
      :key="entry.item.orderItemSeqId"
      :ref="(el) => setCardRef(entry.item.orderItemSeqId, el)"
      class="routing-item"
      :class="{ highlighted: highlighted.includes(entry.item.orderItemSeqId) }"
    >
      <ion-item lines="full">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :key="itemImage(entry.item)" :src="itemImage(entry.item)" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ primaryIdentifier(entry.item.productId) || entry.item.name }}
          <p>{{ translate('Item {id}', { id: entry.item.orderItemSeqId }) }} · {{ secondaryIdentifier(entry.item.productId) || entry.item.sku }}</p>
        </ion-label>
        <ion-chip v-if="entry.item.facilityId" slot="end" :outline="!isShort(entry)" :class="{ 'facility-warning': isShort(entry) }">
          <ion-icon :icon="isShort(entry) ? warningOutline : businessOutline" />
          <ion-label>{{ locationLabel(entry) }}</ion-label>
        </ion-chip>
        <!-- The full stock picture for this product at this location lives in Order Routing. -->
        <ion-button v-if="inventoryFacilityId(entry)" slot="end" fill="clear" size="small" @click="openInventoryDetails(entry)">
          {{ translate('Inventory details') }}
          <ion-icon slot="end" :icon="openOutline" />
        </ion-button>
      </ion-item>

      <!-- When the item cannot ship from where it is, the fix sits on its card: reject it back to routing,
           or move it to a location that has stock. Both open the same dialogs as elsewhere on the order. -->
      <ion-item v-if="isShort(entry)" color="warning" lines="none">
        <ion-icon slot="start" :icon="warningOutline" />
        <ion-label class="ion-text-wrap">
          {{ translate('Short here. Reject the item to send it back to routing, or move it to a location with stock.') }}
        </ion-label>
        <ion-button slot="end" fill="solid" color="dark" size="small" @click="emit('reject-item', entry.item)">
          {{ translate('Reject item') }}
        </ion-button>
        <ion-button slot="end" fill="outline" color="dark" size="small" @click="emit('move-item', entry.item)">
          {{ translate('Move item') }}
        </ion-button>
      </ion-item>

      <!-- The timeline opens on demand. Collapsed, the header still answers "can it ship from here?" with the
           stock now; open, it lists changes oldest first, ten at a time. -->
      <ion-accordion-group v-if="entry.rows.length || entry.history.since">
        <ion-accordion :value="entry.item.orderItemSeqId">
          <ion-item slot="header">
            <ion-icon slot="start" :icon="timeOutline" />
            <ion-label class="ion-text-wrap">
              {{ translate('Inventory timeline') }}
              <p>{{ translate('{count} changes', { count: entry.rows.length }) }}</p>
            </ion-label>
            <InventoryDeltaPills
              v-if="entry.history.since"
              slot="end"
              :atp="{ balance: entry.history.since.availableNow }"
              :qoh="{ balance: entry.history.since.onHandNow }"
            />
          </ion-item>
          <ion-list slot="content" lines="full">
            <ion-item v-for="(row, index) in visibleRows(entry)" :key="row.id" :lines="isLastRow(entry, index) ? 'none' : undefined">
              <ion-icon slot="start" :icon="row.icon" :color="row.color" />
              <ion-label>
                <p v-if="row.overline" class="overline">
                  {{ row.overline }}
                </p>
                <h3 v-if="row.type === 'routing'">
                  {{ row.title }}
                </h3>
                <template v-else>
                  {{ row.title }}
                </template>
                <p>{{ formatDateTime(row.at, { year: false }) }}</p>
                <p v-if="row.detail">
                  {{ row.detail }}
                </p>
              </ion-label>
              <InventoryDeltaPills v-if="row.atp || row.qoh" slot="end" :atp="row.atp || {}" :qoh="row.qoh || {}" />
            </ion-item>
            <ion-item v-if="remainingCount(entry) || canShowLess(entry)" lines="none">
              <ion-button v-if="remainingCount(entry)" fill="clear" size="small" @click="showMore(entry)">
                {{ translate('View more ({count})', { count: remainingCount(entry) }) }}
              </ion-button>
              <ion-button v-if="canShowLess(entry)" fill="clear" size="small" color="medium" @click="showLess(entry)">
                {{ translate('View less') }}
              </ion-button>
            </ion-item>
            <ion-item v-if="!remainingCount(entry) && entry.history.since?.truncated" lines="none">
              <ion-label color="medium">
                {{ translate('Older stock changes are not shown.') }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>
      </ion-accordion-group>

      <ion-item v-else-if="status === 'loaded'" lines="none">
        <ion-label color="medium">
          {{ translate('No routing changes recorded for this item.') }}
        </ion-label>
      </ion-item>
      <ion-item v-else-if="status === 'loading'" lines="none">
        <ion-label color="medium">
          {{ translate('Loading routing history...') }}
        </ion-label>
      </ion-item>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { DxpShopifyImg, translate, useFastTravel } from "@common";
import { useSeedData } from "@common/db";
import { IonAccordion, IonAccordionGroup, IonButton, IonCard, IonChip, IonIcon, IonItem, IonLabel, IonList, IonThumbnail } from "@ionic/vue";
import {
  arrowRedoOutline, arrowUndoOutline, banOutline, businessOutline, closeCircleOutline, compassOutline, openOutline,
  pauseCircleOutline, returnDownBackOutline, swapHorizontalOutline, timeOutline, warningOutline,
} from "ionicons/icons";
import { type ComponentPublicInstance, computed, nextTick, reactive, ref } from "vue";
import InventoryDeltaPills from "@/components/orders/InventoryDeltaPills.vue";
import OrderRoutingFlow from "@/components/orders/OrderRoutingFlow.vue";
import { useProductIdentity } from "@/composables/useProductIdentity";
import type { EnrichedOrder, EnrichedOrderItem } from "@/types/orderDetail";
import { formatDateTime, formatNumber } from "@/utils/format";
import { classifyMovement } from "@/utils/inventoryMovement";
import type { RoutingFlow } from "@/utils/routingFlow";
import { type ItemRoutingHistory, type RoutingEvent, type RoutingEventKind, isStockLocation, ruleName } from "@/utils/routingHistory";

const props = defineProps<{
  order: EnrichedOrder;
  history: ItemRoutingHistory[];
  status?: "loading" | "loaded" | "error";
  /** The order's routing as a graph of ship group states, shown above the per-item history. */
  flow?: RoutingFlow;
  /** Available to promise at the item's location, for items whose location is short. */
  shortStock?: Record<string, number>;
}>();

const emit = defineEmits<{ retry: []; "reject-item": [item: EnrichedOrderItem]; "move-item": [item: EnrichedOrderItem] }>();

const seed = useSeedData();
const { openApp } = useFastTravel();
const { getProduct, primaryIdentifier, secondaryIdentifier } = useProductIdentity();

/** How many rows each item's timeline shows; "View more" adds a page. */
const PAGE_SIZE = 10;
const shownByItem = reactive(new Map<string, number>());
/** Items picked in the graph; their sections are outlined. */
const highlighted = ref<string[]>([]);
const rootEl = ref<HTMLElement | null>(null);
const cardEls = new Map<string, HTMLElement>();

/** The ion-content methods used to scroll it. */
type ScrollableContent = HTMLElement & {
  getScrollElement(): Promise<HTMLElement>;
  scrollByPoint(x: number, y: number, duration: number): Promise<void>;
};
/** Space between the pinned graph and the card scrolled under it. */
const CARD_GAP = 12;
const SCROLL_MS = 300;

function setCardRef(orderItemSeqId: string, el: Element | ComponentPublicInstance | null) {
  const element = el && "$el" in el ? el.$el as HTMLElement : el as HTMLElement | null;
  if(element) {cardEls.set(orderItemSeqId, element);} else {cardEls.delete(orderItemSeqId);}
}

/**
 * A card or move picked in the graph: outline its items and scroll the first one up to sit just under
 * the pinned graph, so both stay in view. Their timelines stay as the user left them.
 */
async function focusItems(orderItemSeqIds: string[]) {
  highlighted.value = orderItemSeqIds;
  if(!orderItemSeqIds.length) {return;}
  await nextTick();
  const card = cardEls.get(orderItemSeqIds[0]);
  if(!card) {return;}
  const graphHeight = rootEl.value?.querySelector<HTMLElement>(".routing-flow")?.offsetHeight ?? 0;
  const content = card.closest("ion-content") as ScrollableContent | null;
  if(!content) {return;}
  // Once scrolled, the graph is pinned at the top of the content area, so the card goes just below it.
  const contentTop = (await content.getScrollElement()).getBoundingClientRect().top;
  const target = contentTop + graphHeight + CARD_GAP;
  await content.scrollByPoint(0, card.getBoundingClientRect().top - target, SCROLL_MS);
}

const EVENT_ICONS: Record<RoutingEventKind, string> = {
  brokered: compassOutline,
  released: arrowRedoOutline,
  allocated: arrowRedoOutline,
  moved: swapHorizontalOutline,
  rejected: returnDownBackOutline,
  parked: pauseCircleOutline,
  requeued: arrowUndoOutline,
  unfillable: banOutline,
  cancelled: closeCircleOutline,
};

type Row = {
  id: string;
  at: number;
  type: "routing" | "stock";
  /** Ionic color for the row's icon. */
  color: string;
  icon: string;
  /** The movement type above the title, e.g. "Sales order", as in Order Routing's inventory history. */
  overline?: string;
  title: string;
  detail: string;
  /** Available to promise and on hand after the change, with the change itself where it is known. */
  atp?: { balance: number | null; change?: number | null };
  qoh?: { balance: number | null; change?: number | null };
};

const entries = computed(() => {
  const items = props.order.shipGroups.flatMap((group) => group.items);
  const byItem = new Map(props.history.map((history) => [history.orderItemSeqId, history]));

  return items.map((item: EnrichedOrderItem) => {
    const history = byItem.get(item.orderItemSeqId) || { orderItemSeqId: item.orderItemSeqId, productId: item.productId, facilityId: item.facilityId, events: [], since: null };

    return { item, history, rows: rowsFor(history) };
  });
});

type Entry = (typeof entries.value)[number];

const facility = (facilityId: string) => seed.facilityName(facilityId) || facilityId;

function itemImage(item: EnrichedOrderItem) {
  return getProduct(item.productId)?.mainImageUrl || item.imageUrl;
}

/** The location whose stock explains the item: where it is, or the last real location it was at when it now sits in a queue or parking. */
function inventoryFacilityId(entry: Entry): string | undefined {
  return isStockLocation(entry.item.facilityId)
    ? entry.item.facilityId
    : [...entry.history.events].reverse().find((event) => event.stock)?.stock?.facilityId;
}

/** This product's inventory at that location in Order Routing, in a new tab, through Fast Travel's deep links. */
function openInventoryDetails(entry: Entry) {
  const facilityId = inventoryFacilityId(entry);
  if(facilityId) {openApp("order-routing", { path: `/inventory/${encodeURIComponent(entry.item.productId)}`, query: { facilityId }, newTab: true });}
}

/** Short at its location, as the page decided for the item and ship group tabs too. */
function isShort(entry: Entry) {
  return props.shortStock?.[entry.item.orderItemSeqId] !== undefined;
}

function locationLabel(entry: Entry) {
  const name = entry.item.facilityName || facility(entry.item.facilityId);

  const available = props.shortStock?.[entry.item.orderItemSeqId];

  return available === undefined ? name : translate("{facility} ({available})", { facility: name, available: formatNumber(available) });
}

function eventTitle(event: RoutingEvent) {
  switch (event.kind) {
    case "brokered": return translate("Brokered to {facility}", { facility: facility(event.toFacilityId) });
    case "released": return translate("Released to {facility}", { facility: facility(event.toFacilityId) });
    case "allocated": return translate("Allocated to {facility}", { facility: facility(event.toFacilityId) });
    case "moved": return translate("{from} to {to}", { from: facility(event.fromFacilityId), to: facility(event.toFacilityId) });
    case "rejected": return translate("Rejected from {facility}", { facility: facility(event.fromFacilityId) });
    case "parked": return translate("Parked in {facility}", { facility: facility(event.toFacilityId) });
    case "requeued": return translate("Back to queue");
    case "cancelled": return translate("Cancelled at {facility}", { facility: facility(event.fromFacilityId) });
    default: return event.attempts > 1
      ? translate("No location had stock ({count} attempts)", { count: event.attempts })
      : translate("No location had stock");
  }
}

/** Labelled details: the routing rule, the reason for a rejection, and the user or system that moved it. */
function eventDetail(event: RoutingEvent) {
  const parts: string[] = [];
  if(event.rule) {parts.push(translate("Routing rule: {rule}", { rule: ruleName(event.rule) }));}
  if(["rejected", "cancelled", "moved"].includes(event.kind) && event.reasonEnumId) {
    parts.push(translate("Reason: {reason}", { reason: seed.enumDescription(event.reasonEnumId) || event.reasonEnumId }));
  }
  if(event.user) {parts.push(translate("User: {user}", { user: event.user }));} else if(!event.rule && event.actor) {parts.push(translate("Source: {source}", { source: event.actor }));}

  return parts.join(" · ");
}

function rowsFor(history: ItemRoutingHistory): Row[] {
  const routing: Row[] = history.events.map((event) => ({
    id: `e-${event.id}`,
    at: event.at,
    type: "routing",
    color: event.kind === "rejected" || event.kind === "unfillable" ? "warning" : "primary",
    icon: EVENT_ICONS[event.kind],
    title: eventTitle(event),
    detail: eventDetail(event),
    atp: event.stock ? {
      balance: event.stock.after,
      change: event.stock.exact && event.stock.before !== null && event.stock.after !== null ? event.stock.after - event.stock.before : null,
    } : undefined,
    qoh: event.stock ? { balance: event.stock.onHand } : undefined,
  }));
  // Stock movements read exactly as in Order Routing's inventory history: type, reference, balance and change.
  const stock: Row[] = (history.since?.movements || []).map((movement) => {
    const movementType = classifyMovement(movement.raw, (enumId) => seed.enumDescription(enumId));

    return {
      id: `m-${movement.id}`,
      at: movement.at,
      type: "stock",
      color: movementType.color,
      icon: movementType.icon,
      overline: translate(movementType.label),
      title: movementType.referenceLabel,
      detail: "",
      atp: { balance: movement.atpAfter, change: movement.atpDiff },
      qoh: { balance: movement.qohAfter, change: movement.qohDiff },
    };
  });

  return [...routing, ...stock].sort((a, b) => a.at - b.at);
}

/** Oldest first, a page at a time. */
function visibleRows(entry: Entry) {
  return entry.rows.slice(0, shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE);
}

/** The final row, with no "View more" or note after it, needs no divider below. */
function isLastRow(entry: Entry, index: number) {
  const hasFooter = remainingCount(entry) > 0 || canShowLess(entry) || Boolean(entry.history.since?.truncated);

  return !hasFooter && index === visibleRows(entry).length - 1;
}

function remainingCount(entry: Entry) {
  return Math.max(entry.rows.length - (shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE), 0);
}

function canShowLess(entry: Entry) {
  return (shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE) > PAGE_SIZE;
}

function showMore(entry: Entry) {
  shownByItem.set(entry.item.orderItemSeqId, (shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE) + PAGE_SIZE);
}

function showLess(entry: Entry) {
  shownByItem.delete(entry.item.orderItemSeqId);
}
</script>

<style scoped>
.order-routing {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-sm, 12px);
}

.routing-item {
  margin: 0;
}

.routing-item.highlighted {
  outline: 2px solid var(--ion-color-primary);
}

.facility-warning {
  --background: var(--ion-color-warning);
  --color: var(--ion-color-warning-contrast);
}
</style>
