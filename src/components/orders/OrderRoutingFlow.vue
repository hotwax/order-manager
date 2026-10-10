<template>
  <!-- The graph stays pinned at the top of the segment while the item history below scrolls under it.
       It scrolls inside its own frame so a long routing history never widens the page. -->
  <div class="routing-flow">
    <!-- The frame is sized before the routing arrives, from the ship groups the order has now, so the
         timeline below does not jump when the graph replaces the placeholder. -->
    <div ref="scrollEl" class="routing-flow-scroll" :style="{ height: frameHeight }">
      <Transition name="routing-flow-fade" mode="out-in">
        <div v-if="!flow" key="loading" class="routing-flow-loading" :style="{ height: `${estimatedHeight}px` }">
          <ion-spinner name="crescent" />
          <ion-label color="medium">
            {{ translate('Loading routing history...') }}
          </ion-label>
        </div>
        <div v-else key="graph" class="routing-flow-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
          <div
            v-for="column in graph.columns"
            :key="column.index"
            class="routing-flow-column-label"
            :style="{ left: `${columnX(column.index)}px`, width: `${SIZE.cardWidth}px` }"
          >
            <strong>{{ columnLabel(column) }}</strong>
            <span>{{ formatDateTime(column.at, { year: false }) }}</span>
          </div>

          <svg class="routing-flow-edges" :width="layout.width" :height="layout.height" :viewBox="`0 0 ${layout.width} ${layout.height}`">
            <g
              v-for="edge in graph.edges"
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
            v-for="node in graph.nodes"
            :key="node.id"
            type="button"
            class="routing-flow-node"
            :class="{ virtual: !isStockLocation(node.facilityId), short: isNodeShort(node), selected: isSelected('node', node.id) }"
            :ref="observeNode"
            :style="nodeStyle(node)"
            :data-node-id="node.id"
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
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DxpShopifyImg, translate } from "@common";
import { useSeedData } from "@common/db";
import { IonBadge, IonLabel, IonSpinner } from "@ionic/vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useProductIdentity } from "@/composables/useProductIdentity";
import type { EnrichedOrderItem } from "@/types/orderDetail";
import { formatDateTime, formatNumber } from "@/utils/format";
import {
  type FlowColumn, type FlowEdge, type FlowNode, ROUTING_FLOW_SIZE, type RoutingFlow, estimateFlowHeight, layoutRoutingFlow,
} from "@/utils/routingFlow";
import { isStockLocation, ruleName } from "@/utils/routingHistory";

const props = defineProps<{
  /** Undefined while the routing loads; the frame then holds the graph's likely size. */
  flow?: RoutingFlow;
  items: EnrichedOrderItem[];
  /** Available to promise at the item's location, for items whose location is short. */
  shortStock: Record<string, number>;
}>();

const emit = defineEmits<{ "select-items": [orderItemSeqIds: string[]] }>();

const seed = useSeedData();
const { getProduct, primaryIdentifier, secondaryIdentifier } = useProductIdentity();

const SIZE = ROUTING_FLOW_SIZE;
const EMPTY_FLOW: RoutingFlow = { columns: [], nodes: [], edges: [] };
const graph = computed(() => props.flow ?? EMPTY_FLOW);
// Cards size to their content (wrapped names, badges), and the graph lays them out from what they
// measure, so a change to the card's contents never crops it.
const measuredHeights = ref<Record<string, number>>({});
const layout = computed(() => layoutRoutingFlow(graph.value, SIZE, measuredHeights.value));
const nodeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver((entries) => {
  const next = { ...measuredHeights.value };
  let changed = false;
  entries.forEach((entry) => {
    const element = entry.target as HTMLElement;
    const nodeId = element.dataset.nodeId;
    const height = element.offsetHeight;
    if(nodeId && height && next[nodeId] !== height) {
      next[nodeId] = height;
      changed = true;
    }
  });
  if(changed) {measuredHeights.value = next;}
});

function observeNode(element: unknown) {
  if(element instanceof HTMLElement) {nodeObserver?.observe(element);}
}

onBeforeUnmount(() => nodeObserver?.disconnect());

/** The graph's likely height before it loads: today's ship groups stacked, or every item on one imported card. */
const estimatedHeight = computed(() => {
  const itemsPerGroup = new Map<string, number>();
  props.items.forEach((item) => itemsPerGroup.set(item.shipGroupSeqId, (itemsPerGroup.get(item.shipGroupSeqId) || 0) + 1));

  return estimateFlowHeight([...itemsPerGroup.values()], SIZE);
});

// An explicit height (not max-height) is what lets the frame ease between the estimate and the real
// graph. It includes the frame's border and its horizontal scrollbar, when the graph is wider than the page.
const scrollEl = ref<HTMLElement>();
const scrollbarHeight = ref(0);
const FRAME_BORDER = 2;
const frameHeight = computed(() => `min(${(props.flow ? layout.value.height : estimatedHeight.value) + FRAME_BORDER + scrollbarHeight.value}px, 40vh)`);
watch(layout, async () => {
  await nextTick();
  const el = scrollEl.value;
  if(el) {scrollbarHeight.value = Math.max(el.offsetHeight - el.clientHeight - FRAME_BORDER, 0);}
}, { immediate: true });

const KIND_LABELS: Record<string, string> = {
  imported: "Imported",
  brokered: "Brokered",
  released: "Released",
  allocated: "Allocated",
  moved: "Moved",
  rejected: "Rejected",
  parked: "Parked",
  requeued: "Back to queue",
  unfillable: "No stock",
  cancelled: "Cancelled",
  stayed: "Stayed",
  mixed: "Several changes",
};

const selected = ref<{ kind: "node" | "edge"; id: string } | null>(null);

function select(kind: "node" | "edge", id: string) {
  selected.value = isSelected(kind, id) ? null : { kind, id };
  const edge = selected.value?.kind === "edge" ? graph.value.edges.find((entry) => entry.id === id) : undefined;
  const node = selected.value?.kind === "node" ? graph.value.nodes.find((entry) => entry.id === id) : undefined;
  emit("select-items", edge?.orderItemSeqIds || node?.orderItemSeqIds || []);
}

function isSelected(kind: "node" | "edge", id: string) {
  return selected.value?.kind === kind && selected.value.id === id;
}

const itemsById = computed(() => new Map(props.items.map((item) => [item.orderItemSeqId, item])));
const facility = (facilityId: string) => seed.facilityName(facilityId) || facilityId;

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

  return { left: `${position.x}px`, top: `${position.y}px`, width: `${SIZE.cardWidth}px` };
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
  const siblings = graph.value.edges.filter((other) => (side === "out" ? other.from : other.to) === nodeId);
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
  if(edge.rule) {return ruleName(edge.rule);}

  return edge.actor;
}

function edgeTitle(edge: FlowEdge) {
  const count = edge.orderItemSeqIds.length;

  return translate("{label}: {count} items", { label: edgeLabel(edge), count });
}
</script>

<style scoped>
.routing-flow {
  position: sticky;
  top: 0;
  z-index: 2;
}

.routing-flow-scroll {
  overflow: auto;
  transition: height 0.25s ease;
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

.routing-flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacer-xs, 8px);
}

.routing-flow-fade-enter-active, .routing-flow-fade-leave-active {
  transition: opacity 0.15s ease;
}

.routing-flow-fade-enter-from, .routing-flow-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .routing-flow-scroll, .routing-flow-fade-enter-active, .routing-flow-fade-leave-active {
    transition: none;
  }
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
  gap: var(--spacer-2xs);
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
  /* Only the card's background fades, so the grid shows through; its text and images stay as they are. */
  background: rgba(var(--ion-background-color-rgb, 255, 255, 255), 0.6);
  box-shadow: none;
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
  gap: var(--spacer-2xs);
  color: var(--ion-color-medium-shade);
}

.routing-flow-item {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
  flex: 0 0 auto;
  height: 48px;
  box-sizing: border-box;
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: var(--spacer-2xs);
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

</style>
