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
      :history="history"
      :short-stock="shortStock || {}"
      @select-items="highlighted = $event"
    />

    <ion-card
      v-for="entry in entries"
      :key="entry.item.orderItemSeqId"
      class="order-routing-card"
      :class="{ highlighted: highlighted.includes(entry.item.orderItemSeqId) }"
    >
      <ion-card-header class="order-routing-header">
        <div>
          <ion-card-title>{{ primaryIdentifier(entry.item.productId) || entry.item.name }}</ion-card-title>
          <ion-card-subtitle>{{ translate('Item {id}', { id: entry.item.orderItemSeqId }) }} · {{ secondaryIdentifier(entry.item.productId) || entry.item.sku }}</ion-card-subtitle>
        </div>
        <ion-chip v-if="entry.item.facilityId" :outline="!isShort(entry)" :class="{ 'facility-warning': isShort(entry) }">
          <ion-icon :icon="businessOutline" />
          <ion-label>{{ locationLabel(entry) }}</ion-label>
        </ion-chip>
      </ion-card-header>

      <ion-list lines="full">
        <ion-item v-if="hiddenCount(entry)" button :detail="false" @click="expanded.add(entry.item.orderItemSeqId)">
          <ion-label color="medium">
            {{ translate('Show {count} earlier changes', { count: hiddenCount(entry) }) }}
          </ion-label>
        </ion-item>

        <ion-item v-for="event in visibleEvents(entry)" :key="event.id">
          <ion-icon slot="start" :icon="EVENT_ICONS[event.kind]" :color="event.kind === 'rejected' || event.kind === 'unfillable' ? 'warning' : 'medium'" />
          <ion-label class="ion-text-wrap">
            <h3>{{ eventTitle(event) }}</h3>
            <p v-if="eventDetail(event)">
              {{ eventDetail(event) }}
            </p>
            <p v-if="event.stock" class="order-routing-stock">
              {{ stockLine(event) }}
            </p>
          </ion-label>
          <ion-note slot="end" class="order-routing-time">
            {{ formatDateTime(event.at, { year: false }) }}
          </ion-note>
        </ion-item>

        <ion-item v-if="!entry.history.events.length && status === 'loaded'" lines="none">
          <ion-label color="medium">
            {{ translate('No routing changes recorded for this item.') }}
          </ion-label>
        </ion-item>
        <ion-item v-if="status === 'loading' && !entry.history.events.length" lines="none">
          <ion-label color="medium">
            {{ translate('Loading routing history...') }}
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-list v-if="entry.history.since" lines="full" class="order-routing-since">
        <ion-list-header>
          <ion-label>{{ sinceTitle(entry.history.since) }}</ion-label>
        </ion-list-header>
        <ion-item v-for="movement in entry.history.since.movements" :key="movement.id">
          <ion-label class="ion-text-wrap">
            <h3>
              {{ movementTitle(movement) }}
              <ion-badge v-if="movement.kind === 'sync'" color="warning">
                {{ translate('Inventory sync') }}
              </ion-badge>
            </h3>
            <p>{{ movementLine(movement) }}</p>
          </ion-label>
          <ion-note slot="end" class="order-routing-time">
            {{ formatDateTime(movement.at, { year: false }) }}
          </ion-note>
        </ion-item>
        <ion-item v-if="entry.history.since.fromAt && !entry.history.since.movements.length">
          <ion-label color="medium">
            {{ translate('No stock changes since then.') }}
          </ion-label>
        </ion-item>
        <ion-item v-if="entry.history.since.truncated">
          <ion-label color="medium">
            {{ translate('Older stock changes are not shown.') }}
          </ion-label>
        </ion-item>
        <ion-item lines="none" :color="isShort(entry) ? 'warning' : undefined">
          <ion-label class="ion-text-wrap">
            <h3>{{ nowLine(entry.history.since) }}</h3>
            <p v-if="isShort(entry)">
              {{ translate('This location has promised more than it has. HotWax does not re-route an allocated item on its own; reject the item to send it back to routing.') }}
            </p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { useSeedData } from "@common/db";
import {
  IonBadge, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonIcon, IonItem, IonLabel,
  IonList, IonListHeader, IonNote,
} from "@ionic/vue";
import {
  arrowRedoOutline, banOutline, businessOutline, closeCircleOutline, compassOutline, pauseCircleOutline, returnDownBackOutline,
  swapHorizontalOutline, warningOutline,
} from "ionicons/icons";
import { computed, reactive, ref } from "vue";
import OrderRoutingFlow from "@/components/orders/OrderRoutingFlow.vue";
import { useProductIdentity } from "@/composables/useProductIdentity";
import type { EnrichedOrder, EnrichedOrderItem } from "@/types/orderDetail";
import { formatDateTime, formatNumber } from "@/utils/format";
import type { RoutingFlow } from "@/utils/routingFlow";
import type { ItemRoutingHistory, MovementKind, RoutingEvent, RoutingEventKind, SinceBlock, StockMovement } from "@/utils/routingHistory";

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
const { primaryIdentifier, secondaryIdentifier } = useProductIdentity();

/** Items whose older changes the user asked to see. */
const expanded = reactive(new Set<string>());
/** Items picked in the graph; their cards below are outlined. */
const highlighted = ref<string[]>([]);
/** The latest changes tell the current story; older ones are a tap away. */
const VISIBLE_EVENTS = 3;

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
  sync: "Stock reset from the inventory system",
  reserved: "Reserved for {order}",
  released: "Reservation released for {order}",
  shipped: "Shipped {order}",
  transferred: "Transferred out on {order}",
  received: "Received on {order}",
  adjusted: "Stock adjusted",
  other: "Stock changed",
};

const entries = computed(() => {
  const items = props.order.shipGroups.flatMap((group) => group.items);
  const byItem = new Map(props.history.map((history) => [history.orderItemSeqId, history]));

  return items.map((item: EnrichedOrderItem) => ({
    item,
    history: byItem.get(item.orderItemSeqId) || { orderItemSeqId: item.orderItemSeqId, productId: item.productId, facilityId: item.facilityId, events: [], since: null },
  }));
});

type Entry = (typeof entries.value)[number];

const facility = (facilityId: string) => seed.facilityName(facilityId) || facilityId;
const signed = (value: number | null) => value === null ? "—" : formatNumber(value);

function isShort(entry: Entry) {
  const available = entry.history.since?.availableNow;

  return typeof available === "number" && available < 0;
}

function locationLabel(entry: Entry) {
  const name = entry.item.facilityName || facility(entry.item.facilityId);

  return isShort(entry) ? translate("{facility} ({available})", { facility: name, available: signed(entry.history.since!.availableNow) }) : name;
}

function hiddenCount(entry: Entry) {
  return expanded.has(entry.item.orderItemSeqId) ? 0 : Math.max(entry.history.events.length - VISIBLE_EVENTS, 0);
}

function visibleEvents(entry: Entry) {
  return entry.history.events.slice(hiddenCount(entry));
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

function eventDetail(event: RoutingEvent) {
  const parts: string[] = [];
  if(event.rule) {parts.push(translate("Rule: {rule}", { rule: event.rule }));}
  if(["rejected", "cancelled", "moved"].includes(event.kind) && event.reasonEnumId) {parts.push(seed.enumDescription(event.reasonEnumId) || event.reasonEnumId);}
  if(event.actor && !event.rule) {parts.push(translate("By {actor}", { actor: event.actor }));}
  if(event.kind === "unfillable" && event.attempts > 1) {parts.push(translate("Last tried {time}", { time: formatDateTime(event.lastAt, { year: false }) }));}

  return parts.join(" · ");
}

function stockLine(event: RoutingEvent) {
  const stock = event.stock!;
  const place = facility(stock.facilityId);
  if(stock.exact && stock.before !== stock.after) {
    return translate("Available at {facility}: {before} → {after}, on hand {onHand}", { facility: place, before: signed(stock.before), after: signed(stock.after), onHand: signed(stock.onHand) });
  }

  return translate("Available at {facility}: {available}, on hand {onHand}", { facility: place, available: signed(stock.after), onHand: signed(stock.onHand) });
}

function sinceTitle(since: SinceBlock) {
  return since.fromAt
    ? translate("Stock at {facility} since {time}", { facility: facility(since.facilityId), time: formatDateTime(since.fromAt, { year: false }) })
    : translate("Stock at {facility}", { facility: facility(since.facilityId) });
}

function movementTitle(movement: StockMovement) {
  const order = movement.isThisOrder ? translate("this order") : movement.orderName;

  return translate(MOVEMENT_TITLES[movement.kind], { order });
}

function movementLine(movement: StockMovement) {
  const before = movement.atpAfter === null ? null : movement.atpAfter - movement.atpDiff;

  return movement.atpDiff
    ? translate("Available {before} → {after}, on hand {onHand}", { before: signed(before), after: signed(movement.atpAfter), onHand: signed(movement.qohAfter) })
    : translate("Available {available}, on hand {onHand}", { available: signed(movement.atpAfter), onHand: signed(movement.qohAfter) });
}

function nowLine(since: SinceBlock) {
  return translate("Available now: {available}, on hand {onHand}", { available: signed(since.availableNow), onHand: signed(since.onHandNow) });
}
</script>

<style scoped>
.order-routing {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-sm, 12px);
}

.order-routing-card {
  margin: 0;
}

.order-routing-card.highlighted {
  outline: 2px solid var(--ion-color-primary);
}

.facility-warning {
  --background: var(--ion-color-warning);
  --color: var(--ion-color-warning-contrast);
}

.order-routing-header {
  text-align: start;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.order-routing-since ion-list-header {
  border-top: 1px solid var(--ion-color-light-shade);
}

.order-routing-time {
  white-space: nowrap;
  font-size: 0.85em;
}

.order-routing-stock {
  font-variant-numeric: tabular-nums;
}
</style>
