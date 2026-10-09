<template>
  <div class="ion-padding order-routing">
    <ion-item v-if="status === 'error'" color="danger" lines="none" class="order-routing-message">
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
      @select-items="highlighted = $event"
    />

    <ion-card
      v-for="entry in entries"
      :key="entry.item.orderItemSeqId"
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
      </ion-item>

      <!-- The timeline opens on demand. Collapsed, the header still answers "can it ship from here?" with the
           stock now; open, it lists changes newest first, ten at a time. -->
      <ion-accordion-group v-if="entry.rows.length || entry.history.since">
        <ion-accordion :value="entry.item.orderItemSeqId">
          <ion-item slot="header" :color="isShort(entry) ? 'warning' : undefined">
            <ion-icon slot="start" :icon="isShort(entry) ? warningOutline : timeOutline" />
            <ion-label class="ion-text-wrap">
              {{ translate('Inventory timeline') }}
              <p>
                {{ isShort(entry) ? translate('Short here. Reject the item to send it back to routing.') : translate('{count} changes', { count: entry.rows.length }) }}
              </p>
            </ion-label>
            <ion-label v-if="entry.history.since" slot="end" class="ion-text-end routing-stock">
              {{ translate('{available} available', { available: signed(entry.history.since.availableNow) }) }}
              <p>{{ translate('{onHand} on hand', { onHand: signed(entry.history.since.onHandNow) }) }}</p>
            </ion-label>
          </ion-item>
          <ion-list slot="content" lines="full">
            <ion-item v-for="row in visibleRows(entry)" :key="row.id">
              <ion-icon slot="start" :icon="row.icon" :color="row.color" />
              <ion-label>
                <h3 v-if="row.type === 'routing'">
                  {{ row.title }}
                </h3>
                <template v-else>
                  {{ row.title }}
                </template>
                <p>{{ row.detail ? `${formatDateTime(row.at, { year: false })} · ${row.detail}` : formatDateTime(row.at, { year: false }) }}</p>
              </ion-label>
              <ion-label v-if="row.available" slot="end" class="ion-text-end routing-stock">
                {{ row.available }}
                <p v-if="row.onHand">
                  {{ row.onHand }}
                </p>
              </ion-label>
            </ion-item>
            <ion-item v-if="remainingCount(entry)" button :detail="false" lines="none" @click="showMore(entry)">
              <ion-label color="primary">
                {{ translate('View more ({count})', { count: remainingCount(entry) }) }}
              </ion-label>
            </ion-item>
            <ion-item v-else-if="entry.history.since?.truncated" lines="none">
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
import { DxpShopifyImg, translate } from "@common";
import { useSeedData } from "@common/db";
import { IonAccordion, IonAccordionGroup, IonButton, IonCard, IonChip, IonIcon, IonItem, IonLabel, IonList, IonThumbnail } from "@ionic/vue";
import {
  arrowRedoOutline, banOutline, businessOutline, closeCircleOutline, compassOutline, cubeOutline, pauseCircleOutline,
  refreshOutline, returnDownBackOutline, swapHorizontalOutline, timeOutline, warningOutline,
} from "ionicons/icons";
import { computed, reactive, ref } from "vue";
import OrderRoutingFlow from "@/components/orders/OrderRoutingFlow.vue";
import { useProductIdentity } from "@/composables/useProductIdentity";
import type { EnrichedOrder, EnrichedOrderItem } from "@/types/orderDetail";
import { formatDateTime, formatNumber } from "@/utils/format";
import type { RoutingFlow } from "@/utils/routingFlow";
import type { ItemRoutingHistory, MovementKind, RoutingEvent, RoutingEventKind, StockMovement } from "@/utils/routingHistory";

const props = defineProps<{
  order: EnrichedOrder;
  history: ItemRoutingHistory[];
  status?: "loading" | "loaded" | "error";
  /** The order's routing as a graph of ship group states, shown above the per-item history. */
  flow?: RoutingFlow;
  /** Available to promise at the item's location, for items whose location is short. */
  shortStock?: Record<string, number>;
}>();

const emit = defineEmits<{ retry: [] }>();

const seed = useSeedData();
const { getProduct, primaryIdentifier, secondaryIdentifier } = useProductIdentity();

/** How many rows each item's timeline shows; "View more" adds a page. */
const PAGE_SIZE = 10;
const shownByItem = reactive(new Map<string, number>());
/** Items picked in the graph; their sections are outlined. */
const highlighted = ref<string[]>([]);

const EVENT_ICONS: Record<RoutingEventKind, string> = {
  brokered: compassOutline,
  released: arrowRedoOutline,
  allocated: arrowRedoOutline,
  moved: swapHorizontalOutline,
  rejected: returnDownBackOutline,
  parked: pauseCircleOutline,
  unfillable: banOutline,
  cancelled: closeCircleOutline,
};

const MOVEMENT_TITLES: Record<MovementKind, string> = {
  sync: "Inventory sync",
  reserved: "Reserved for {order}",
  released: "Reservation released for {order}",
  shipped: "Shipped {order}",
  transferred: "Transferred out on {order}",
  received: "Received on {order}",
  adjusted: "Stock adjusted",
  other: "Stock changed",
};

type Row = {
  id: string;
  at: number;
  type: "routing" | "stock";
  /** Ionic color for the row's icon. */
  color: string;
  icon: string;
  title: string;
  detail: string;
  /** Available to promise at the location: "1 → 0" across the change, or the level when it did not move. */
  available: string;
  onHand: string;
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
const signed = (value: number | null | undefined) => value === null || value === undefined ? "—" : formatNumber(value);
const change = (before: number | null, after: number | null) => before !== null && after !== null && before !== after
  ? translate("{before} → {after}", { before: signed(before), after: signed(after) })
  : signed(after);
const onHand = (value: number | null | undefined) => value === null || value === undefined ? "" : translate("{onHand} on hand", { onHand: signed(value) });

function itemImage(item: EnrichedOrderItem) {
  return getProduct(item.productId)?.mainImageUrl || item.imageUrl;
}

function isShort(entry: Entry) {
  const available = entry.history.since?.availableNow;

  return typeof available === "number" && available < 0;
}

function locationLabel(entry: Entry) {
  const name = entry.item.facilityName || facility(entry.item.facilityId);

  return isShort(entry) ? translate("{facility} ({available})", { facility: name, available: signed(entry.history.since!.availableNow) }) : name;
}

function eventTitle(event: RoutingEvent) {
  switch (event.kind) {
    case "brokered": return translate("Brokered to {facility}", { facility: facility(event.toFacilityId) });
    case "released": return translate("Released to {facility}", { facility: facility(event.toFacilityId) });
    case "allocated": return translate("Allocated to {facility}", { facility: facility(event.toFacilityId) });
    case "moved": return translate("{from} to {to}", { from: facility(event.fromFacilityId), to: facility(event.toFacilityId) });
    case "rejected": return translate("Rejected from {facility}", { facility: facility(event.fromFacilityId) });
    case "parked": return translate("Parked in {facility}", { facility: facility(event.toFacilityId) });
    case "cancelled": return translate("Cancelled at {facility}", { facility: facility(event.fromFacilityId) });
    default: return event.attempts > 1
      ? translate("No location had stock ({count} attempts)", { count: event.attempts })
      : translate("No location had stock");
  }
}

/** Why and by whom, as in the graph: the reason for a rejection, then the user or the rule. */
function eventDetail(event: RoutingEvent) {
  const parts: string[] = [];
  if(["rejected", "cancelled", "moved"].includes(event.kind) && event.reasonEnumId) {parts.push(seed.enumDescription(event.reasonEnumId) || event.reasonEnumId);}
  if(event.rule) {parts.push(event.rule.split(" › ").pop() || event.rule);} else if(event.actor) {parts.push(event.actor);}

  return parts.join(" · ");
}

function movementTitle(movement: StockMovement) {
  const order = movement.isThisOrder ? translate("this order") : movement.orderName;

  return translate(MOVEMENT_TITLES[movement.kind], { order });
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
    available: event.stock ? change(event.stock.before, event.stock.after) : "",
    onHand: onHand(event.stock?.onHand),
  }));
  const stock: Row[] = (history.since?.movements || []).map((movement) => ({
    id: `m-${movement.id}`,
    at: movement.at,
    type: "stock",
    color: movement.kind === "sync" ? "warning" : "medium",
    icon: movement.kind === "sync" ? refreshOutline : cubeOutline,
    title: movementTitle(movement),
    detail: "",
    available: change(movement.atpAfter === null ? null : movement.atpAfter - movement.atpDiff, movement.atpAfter),
    onHand: onHand(movement.qohAfter),
  }));

  return [...routing, ...stock].sort((a, b) => a.at - b.at);
}

/** Newest first, a page at a time. */
function visibleRows(entry: Entry) {
  return [...entry.rows].reverse().slice(0, shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE);
}

function remainingCount(entry: Entry) {
  return Math.max(entry.rows.length - (shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE), 0);
}

function showMore(entry: Entry) {
  shownByItem.set(entry.item.orderItemSeqId, (shownByItem.get(entry.item.orderItemSeqId) ?? PAGE_SIZE) + PAGE_SIZE);
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

.routing-stock {
  font-variant-numeric: tabular-nums;
}
</style>
