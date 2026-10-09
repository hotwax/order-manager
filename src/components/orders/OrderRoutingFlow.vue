<template>
  <!-- The graph stays pinned at the top of the segment while the item history below scrolls under it.
       It scrolls inside its own frame so a long routing history never widens the page. -->
  <div class="routing-flow">
    <div class="routing-flow-scroll">
      <div class="routing-flow-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
        <div
          v-for="column in flow.columns"
          :key="column.index"
          class="routing-flow-column-label"
          :style="{ left: `${columnX(column.index)}px`, width: `${SIZE.cardWidth}px` }"
        >
          <strong>{{ columnLabel(column) }}</strong>
          <span>{{ formatDateTime(column.at, { year: false }) }}</span>
        </div>

        <svg class="routing-flow-edges" :width="layout.width" :height="layout.height" :viewBox="`0 0 ${layout.width} ${layout.height}`">
          <g
            v-for="edge in flow.edges"
            :key="edge.id"
            class="routing-flow-edge"
            :class="[`edge-${edge.kind}`, { selected: isSelected('edge', edge.id) }]"
            role="button"
            tabindex="0"
            :aria-label="edgeTitle(edge)"
            @click="select('edge', edge.id)"
            @keydown.enter="select('edge', edge.id)"
          >
            <line class="edge-hit" v-bind="edgeEnds(edge)" />
            <line class="edge-line" v-bind="edgeEnds(edge)" />
            <text :x="edgeLabelPoint(edge).x" :y="edgeLabelPoint(edge).y" text-anchor="middle">{{ edgeLabel(edge) }}</text>
            <text v-if="edgeActor(edge)" class="edge-actor" :x="edgeLabelPoint(edge).x" :y="edgeLabelPoint(edge).y + 20" text-anchor="middle">
              {{ edgeActor(edge) }}
            </text>
          </g>
        </svg>

        <button
          v-for="node in flow.nodes"
          :key="node.id"
          type="button"
          class="routing-flow-node"
          :class="{ current: node.isCurrent, virtual: !isStockLocation(node.facilityId), short: isNodeShort(node), selected: isSelected('node', node.id) }"
          :style="nodeStyle(node)"
          @click="select('node', node.id)"
        >
          <span class="routing-flow-node-title">{{ facility(node.facilityId) }}</span>
          <small class="routing-flow-node-subtitle">
            {{ translate('Ship group {id}', { id: node.shipGroupSeqId }) }}
            <ion-badge v-if="nodeBadge(node)" :color="nodeBadge(node)!.color">{{ nodeBadge(node)!.label }}</ion-badge>
          </small>
          <span v-for="id in node.orderItemSeqIds" :key="id" class="routing-flow-item">
            <span class="routing-flow-thumb"><DxpShopifyImg :key="itemImage(id)" :src="itemImage(id)" size="small" /></span>
            <span class="routing-flow-item-text">
              <span>{{ itemPrimary(id) }}</span>
              <small>{{ itemSecondary(id) }}</small>
            </span>
            <span v-if="node.isCurrent && shortStock[id] !== undefined" class="routing-flow-short">
              {{ translate('({available})', { available: formatNumber(shortStock[id]) }) }}
            </span>
          </span>
        </button>
      </div>
    </div>

    <ion-card v-if="selectedEdge || selectedNode" class="routing-flow-inspector">
      <ion-button class="routing-flow-inspector-close" fill="clear" color="medium" size="small" :aria-label="translate('Close')" @click="clearSelection">
        <ion-icon slot="icon-only" :icon="closeOutline" />
      </ion-button>
      <ion-list v-if="selectedEdge" lines="none">
        <ion-item>
          <ion-label class="ion-text-wrap">
            <h2>{{ edgeTitle(selectedEdge) }}</h2>
            <p>{{ nodePlace(selectedEdge.from) }} → {{ nodePlace(selectedEdge.to) }}</p>
            <p>{{ edgeMeta(selectedEdge) }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ formatDateTime(selectedEdge.at, { year: false }) }}
          </ion-note>
        </ion-item>
        <ion-item v-for="id in selectedEdge.orderItemSeqIds" :key="id">
          <ion-label class="ion-text-wrap">
            {{ itemPrimary(id) }}
            <p v-if="stockForMove(selectedEdge, id)">
              {{ stockForMove(selectedEdge, id) }}
            </p>
          </ion-label>
        </ion-item>
      </ion-list>
      <ion-list v-else-if="selectedNode" lines="none">
        <ion-item>
          <ion-label class="ion-text-wrap">
            <h2>{{ nodePlace(selectedNode.id) }}</h2>
            <p>{{ nodeWhen(selectedNode) }}</p>
          </ion-label>
        </ion-item>
        <ion-item v-for="id in selectedNode.orderItemSeqIds" :key="id">
          <ion-label class="ion-text-wrap">
            {{ itemPrimary(id) }}
            <p v-if="selectedNode.isCurrent && stockNow(id)">
              {{ stockNow(id) }}
            </p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-card>
    <p v-else class="routing-flow-hint">
      {{ translate('Select a ship group or a move to see its details.') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { DxpShopifyImg, translate } from "@common";
import { useSeedData } from "@common/db";
import { IonBadge, IonButton, IonCard, IonIcon, IonItem, IonLabel, IonList, IonNote } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { computed, ref } from "vue";
import { useProductIdentity } from "@/composables/useProductIdentity";
import type { EnrichedOrderItem } from "@/types/orderDetail";
import { formatDateTime, formatNumber } from "@/utils/format";
import { type FlowColumn, type FlowEdge, type FlowNode, type RoutingFlow, layoutRoutingFlow } from "@/utils/routingFlow";
import { type ItemRoutingHistory, isStockLocation } from "@/utils/routingHistory";

const props = defineProps<{
  flow: RoutingFlow;
  items: EnrichedOrderItem[];
  history: ItemRoutingHistory[];
  /** Available to promise at the item's location, for items whose location is short. */
  shortStock: Record<string, number>;
}>();

const emit = defineEmits<{ "select-items": [orderItemSeqIds: string[]] }>();

const seed = useSeedData();
const { getProduct, primaryIdentifier, secondaryIdentifier } = useProductIdentity();

const SIZE = { cardWidth: 260, columnGap: 210, headerHeight: 58, rowHeight: 52, cardGap: 28, top: 52, left: 16 };
const layout = computed(() => layoutRoutingFlow(props.flow, SIZE));

const KIND_LABELS: Record<string, string> = {
  imported: "Imported",
  brokered: "Brokered",
  released: "Released",
  allocated: "Allocated",
  moved: "Moved",
  rejected: "Rejected",
  parked: "Parked",
  unfillable: "No stock",
  cancelled: "Cancelled",
  stayed: "Stayed",
  mixed: "Several changes",
};

const selected = ref<{ kind: "node" | "edge"; id: string } | null>(null);
const selectedEdge = computed(() => selected.value?.kind === "edge" ? props.flow.edges.find((edge) => edge.id === selected.value?.id) : undefined);
const selectedNode = computed(() => selected.value?.kind === "node" ? props.flow.nodes.find((node) => node.id === selected.value?.id) : undefined);

function select(kind: "node" | "edge", id: string) {
  selected.value = isSelected(kind, id) ? null : { kind, id };
  emit("select-items", selectedEdge.value?.orderItemSeqIds || selectedNode.value?.orderItemSeqIds || []);
}

function clearSelection() {
  selected.value = null;
  emit("select-items", []);
}

function isSelected(kind: "node" | "edge", id: string) {
  return selected.value?.kind === kind && selected.value.id === id;
}

const itemsById = computed(() => new Map(props.items.map((item) => [item.orderItemSeqId, item])));
const historyById = computed(() => new Map(props.history.map((entry) => [entry.orderItemSeqId, entry])));
const facility = (facilityId: string) => seed.facilityName(facilityId) || facilityId;
const signed = (value: number | null | undefined) => value === null || value === undefined ? "—" : formatNumber(value);

function itemPrimary(id: string) {
  const item = itemsById.value.get(id);

  return (item && (primaryIdentifier(item.productId) || item.name)) || translate("Item {id}", { id });
}

function itemSecondary(id: string) {
  const item = itemsById.value.get(id);

  return item ? secondaryIdentifier(item.productId) || item.sku : "";
}

function itemImage(id: string) {
  const item = itemsById.value.get(id);

  return item ? getProduct(item.productId)?.mainImageUrl || item.imageUrl : "";
}

const columnX = (index: number) => SIZE.left + index * (SIZE.cardWidth + SIZE.columnGap);

function nodeStyle(node: FlowNode) {
  const position = layout.value.positions[node.id];

  return { left: `${position.x}px`, top: `${position.y}px`, width: `${SIZE.cardWidth}px`, height: `${position.height}px` };
}

/** Done when every item in it is: Completed (items sold in store end here) or Cancelled; else Current while it still holds them. */
function nodeBadge(node: FlowNode): { label: string; color: string } | undefined {
  if(!node.isCurrent) {return undefined;}
  const statuses = node.orderItemSeqIds.map((id) => itemsById.value.get(id)?.statusId);
  if(statuses.every((status) => status === "ITEM_COMPLETED" || status === "ITEM_CANCELLED")) {
    return statuses.includes("ITEM_COMPLETED")
      ? { label: translate("Completed"), color: "success" }
      : { label: translate("Cancelled"), color: "medium" };
  }

  return { label: translate("Current"), color: "primary" };
}

function isNodeShort(node: FlowNode) {
  return node.isCurrent && node.orderItemSeqIds.some((id) => props.shortStock[id] !== undefined);
}

function columnLabel(column: FlowColumn) {
  const label = translate(KIND_LABELS[column.kind]);

  return column.attempts > 1 ? translate("{label} ×{count}", { label, count: column.attempts }) : label;
}

/** A line leaves its card at a point spread along the card's height, so several lines from one card stay apart. */
function anchor(nodeId: string, edge: FlowEdge, side: "out" | "in") {
  const position = layout.value.positions[nodeId];
  const siblings = props.flow.edges.filter((other) => (side === "out" ? other.from : other.to) === nodeId);
  const index = siblings.findIndex((other) => other.id === edge.id);

  return {
    x: position.x + (side === "out" ? SIZE.cardWidth : 0),
    y: position.y + (position.height * (index + 1)) / (siblings.length + 1),
  };
}

function edgeEnds(edge: FlowEdge) {
  const from = anchor(edge.from, edge, "out");
  const to = anchor(edge.to, edge, "in");

  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

function edgeLabelPoint(edge: FlowEdge) {
  const ends = edgeEnds(edge);

  return { x: (ends.x1 + ends.x2) / 2, y: (ends.y1 + ends.y2) / 2 - 6 };
}

function edgeLabel(edge: FlowEdge) {
  let label = edge.kind === "rejected" && edge.reasonEnumId
    ? seed.enumDescription(edge.reasonEnumId) || translate(KIND_LABELS.rejected)
    : translate(KIND_LABELS[edge.kind]);
  if(edge.attempts > 1) {label = translate("{label} ×{count}", { label, count: edge.attempts });}

  return edge.orderItemSeqIds.length > 1 ? translate("{label} ({count})", { label, count: edge.orderItemSeqIds.length }) : label;
}

/** Who moved the items: the user's login, the routing rule for a brokering, or the system that did it. */
function edgeActor(edge: FlowEdge) {
  if(edge.kind === "stayed") {return "";}
  if(edge.user) {return edge.user;}
  if(edge.rule) {return edge.rule.split(" › ").pop() || edge.rule;}

  return edge.actor;
}

function edgeTitle(edge: FlowEdge) {
  const count = edge.orderItemSeqIds.length;

  return translate("{label}: {count} items", { label: edgeLabel(edge), count });
}

function edgeMeta(edge: FlowEdge) {
  const parts: string[] = [];
  if(edge.rule) {parts.push(translate("Rule: {rule}", { rule: edge.rule }));}
  if(edge.actor && !edge.rule) {parts.push(translate("By {actor}", { actor: edge.actor }));}
  if(edge.reasonEnumId && edge.kind !== "brokered") {parts.push(seed.enumDescription(edge.reasonEnumId) || edge.reasonEnumId);}

  return parts.join(" · ");
}

function nodePlace(nodeId: string) {
  const node = props.flow.nodes.find((entry) => entry.id === nodeId);

  return node ? translate("{facility}, ship group {id}", { facility: facility(node.facilityId), id: node.shipGroupSeqId }) : "";
}

function nodeWhen(node: FlowNode) {
  const column = props.flow.columns[node.column];
  const label = translate("{label} {time}", { label: columnLabel(column), time: formatDateTime(column.at, { year: false }) });

  return node.isCurrent ? translate("{label}; still there now", { label }) : label;
}

/** The stock the item's own routing change saw, from the routing history. */
function stockForMove(edge: FlowEdge, id: string) {
  const event = historyById.value.get(id)?.events.find((entry) => edge.changeIds.includes(entry.id));
  const stock = event?.stock;
  if(!stock) {return "";}
  const place = facility(stock.facilityId);

  return stock.exact && stock.before !== stock.after
    ? translate("Available at {facility}: {before} → {after}, on hand {onHand}", { facility: place, before: signed(stock.before), after: signed(stock.after), onHand: signed(stock.onHand) })
    : translate("Available at {facility}: {available}, on hand {onHand}", { facility: place, available: signed(stock.after), onHand: signed(stock.onHand) });
}

function stockNow(id: string) {
  const since = historyById.value.get(id)?.since;

  return since ? translate("Available now: {available}, on hand {onHand}", { available: signed(since.availableNow), onHand: signed(since.onHandNow) }) : "";
}
</script>

<style scoped>
.routing-flow {
  position: sticky;
  top: 0;
  z-index: 2;
}

.routing-flow-scroll {
  max-height: 40vh;
  overflow: auto;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  /* The same grid the Data Document graph builder draws behind its cards. */
  background-color: var(--ion-background-color, #fff);
  background-image:
    linear-gradient(var(--ion-color-light) 1px, transparent 1px),
    linear-gradient(90deg, var(--ion-color-light) 1px, transparent 1px);
  background-size: 28px 28px;
}

.routing-flow-canvas {
  position: relative;
  min-width: 100%;
}

.routing-flow-column-label {
  position: absolute;
  top: 12px;
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--ion-color-medium-shade);
}

.routing-flow-column-label strong {
  color: var(--ion-text-color);
}

.routing-flow-edges {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.routing-flow-edge {
  cursor: pointer;
}

.routing-flow-edge .edge-hit {
  stroke: transparent;
  stroke-width: 16;
}

.routing-flow-edge .edge-line {
  stroke: var(--ion-color-medium);
  stroke-width: 2;
}

.routing-flow-edge text.edge-actor {
  font-size: 11px;
  fill: var(--ion-color-medium-shade);
}

.routing-flow-edge text {
  font-size: 12px;
  fill: var(--ion-text-color);
  paint-order: stroke;
  stroke: var(--ion-background-color, #fff);
  stroke-width: 5px;
  stroke-linejoin: round;
}

.edge-brokered .edge-line, .edge-released .edge-line, .edge-allocated .edge-line {
  stroke: var(--ion-color-primary);
}

.edge-rejected .edge-line, .edge-cancelled .edge-line {
  stroke: var(--ion-color-warning-shade);
}

.edge-unfillable .edge-line, .edge-parked .edge-line {
  stroke: var(--ion-color-medium);
  stroke-dasharray: 6 4;
}

.edge-stayed .edge-line {
  stroke: var(--ion-color-light-shade);
  stroke-dasharray: 2 4;
}

.routing-flow-edge.selected .edge-line, .routing-flow-edge:focus-visible .edge-line {
  stroke-width: 4;
}

.routing-flow-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  background: var(--ion-background-color, #fff);
  box-shadow: 0 6px 16px rgba(var(--ion-color-dark-rgb, 15, 23, 42), 0.1);
  color: var(--ion-text-color);
  text-align: start;
  cursor: pointer;
  font: inherit;
  overflow: hidden;
  box-sizing: border-box;
}

.routing-flow-node.virtual {
  opacity: 0.6;
  box-shadow: none;
}

.routing-flow-node.virtual.selected, .routing-flow-node.virtual:focus-visible {
  opacity: 1;
}

.routing-flow-node.short {
  border-color: var(--ion-color-warning);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-warning-rgb), 0.5);
}

.routing-flow-node.selected, .routing-flow-node:focus-visible {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.3);
}

.routing-flow-node-title {
  font-weight: 600;
}

.routing-flow-node-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ion-color-medium-shade);
}

.routing-flow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  height: 48px;
  box-sizing: border-box;
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 4px;
}

.routing-flow-thumb {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 4px;
}

.routing-flow-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.85rem;
}

.routing-flow-item-text span, .routing-flow-item-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.routing-flow-item-text small {
  color: var(--ion-color-medium-shade);
}

.routing-flow-short {
  margin-inline-start: auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
  font-size: 0.75rem;
  font-weight: 600;
}

.routing-flow-inspector {
  position: absolute;
  top: 8px;
  right: 8px;
  width: min(340px, calc(100% - 16px));
  max-height: calc(40vh - 16px);
  margin: 0;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(var(--ion-color-dark-rgb, 15, 23, 42), 0.18);
}

.routing-flow-inspector ion-item:first-of-type {
  --inner-padding-end: 36px;
}

.routing-flow-inspector-close {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
}

.routing-flow-hint {
  position: absolute;
  top: 8px;
  right: 12px;
  margin: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ion-color-light);
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  pointer-events: none;
}
</style>
