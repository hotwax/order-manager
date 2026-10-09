import { type RoutingEventKind, isStockLocation, routingEventKind, ruleLabel } from "@/utils/routingHistory";

/**
 * An order's routing as a left-to-right graph: each card is a ship group's contents at a moment,
 * each line is items moving between cards.
 *
 * Column 0 is the order as imported. Every later column is one moment when items moved (changes a
 * minute apart read as one step). A ship group gets a new card only when its contents change, so a
 * group that keeps some items while others leave shows a second card joined by a "stayed" line.
 */

export type FlowEdgeKind = RoutingEventKind | "stayed";

export interface FlowColumn {
  index: number;
  at: number;
  /** What happened in this step, when every change in it was the same kind. */
  kind: RoutingEventKind | "imported" | "mixed";
  attempts: number;
}

export interface FlowNode {
  id: string;
  column: number;
  shipGroupSeqId: string;
  facilityId: string;
  orderItemSeqIds: string[];
  /** The ship group still holds exactly these items now. */
  isCurrent: boolean;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowEdgeKind;
  orderItemSeqIds: string[];
  /** The facility change rows behind the move, one per item, for the inspector. */
  changeIds: string[];
  at: number;
  attempts: number;
  reasonEnumId: string;
  actor: string;
  rule: string;
}

export interface RoutingFlow {
  columns: FlowColumn[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowItem = { orderItemSeqId: string; shipGroupSeqId: string };
export type FlowShipGroup = { id: string; facilityId: string };

const STEP_WINDOW_MS = 60 * 1000;

const num = (value: unknown) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

type ItemMove = { row: any; at: number; attempts: number };

/**
 * One item's moves, with routing's retries folded in: repeated unfillable attempts, and the
 * "sent back to the queue, still unfillable" loop, become one move with an attempt count.
 */
function foldMoves(rows: any[]): ItemMove[] {
  const moves: ItemMove[] = [];
  rows.forEach((row, index) => {
    const previous = moves[moves.length - 1];
    const kind = routingEventKind(row);
    if(kind === "unfillable" && previous && routingEventKind(previous.row) === "unfillable" && previous.row.shipGroupSeqId === row.shipGroupSeqId) {
      previous.attempts += 1;

      return;
    }
    const next = rows[index + 1];
    // A system detour between two unfillable attempts (back to the queue, or a Shopify sync moving
    // it) is routing retrying. A person's move, or a move to a real location, always shows.
    const systemDetour = previous && routingEventKind(previous.row) === "unfillable" &&
      !row.changeUserLogin && !isStockLocation(row.facilityId);
    if(systemDetour && next && routingEventKind(next) === "unfillable" && next.shipGroupSeqId === previous.row.shipGroupSeqId) {
      // Skip the detour; the next attempt then folds into the previous one as a retry.
      return;
    }
    moves.push({ row, at: num(row.changeDatetime), attempts: 1 });
  });

  return moves;
}

function actorOf(row: any): string {
  if(row.changeUserLogin) {return String(row.changeUserLogin);}
  const prefix = String(row.comments || "").split(":")[0]?.trim();

  return prefix && prefix.length < 40 && prefix !== row.comments ? prefix : "";
}

/** Where an item started: the ship group at the location its first move left from, else where it is now. */
function startingShipGroup(firstMove: ItemMove | undefined, current: string, shipGroups: FlowShipGroup[]): string {
  if(!firstMove) {return current;}
  const from = firstMove.row.fromFacilityId;
  const match = shipGroups
    .filter((group) => group.facilityId === from)
    .sort((a, b) => a.id.localeCompare(b.id))[0];

  return match?.id || current;
}

export function buildRoutingFlow(input: {
  items: FlowItem[];
  shipGroups: FlowShipGroup[];
  changes: any[];
  importedAt: number;
}): RoutingFlow {
  const { items, shipGroups, changes, importedAt } = input;
  const facilityOf = (shipGroupSeqId: string) => shipGroups.find((group) => group.id === shipGroupSeqId)?.facilityId || "";

  const movesByItem = new Map<string, ItemMove[]>();
  items.forEach((item) => {
    const rows = changes
      .filter((row) => row.orderItemSeqId === item.orderItemSeqId)
      .sort((a, b) => num(a.changeDatetime) - num(b.changeDatetime));
    movesByItem.set(item.orderItemSeqId, foldMoves(rows));
  });

  // Steps: moves a minute apart from the step's first move happen together.
  const allMoves = [...movesByItem.entries()]
    .flatMap(([orderItemSeqId, moves]) => moves.map((move) => ({ orderItemSeqId, ...move })))
    .sort((a, b) => a.at - b.at);
  const steps: Array<typeof allMoves> = [];
  allMoves.forEach((move) => {
    const step = steps[steps.length - 1];
    // A second move of the same item always starts a new step, so neither move is hidden.
    const sameItem = step?.some((other) => other.orderItemSeqId === move.orderItemSeqId);
    if(step && !sameItem && move.at - step[0].at <= STEP_WINDOW_MS) {step.push(move);} else {steps.push([move]);}
  });

  const columns: FlowColumn[] = [{ index: 0, at: importedAt, kind: "imported", attempts: 1 }];
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Where each item is, and which card shows it there.
  const location = new Map<string, { shipGroupSeqId: string; nodeId: string }>();
  const addNode = (column: number, shipGroupSeqId: string, orderItemSeqIds: string[]) => {
    const node: FlowNode = {
      id: `${column}-${shipGroupSeqId}`,
      column,
      shipGroupSeqId,
      facilityId: facilityOf(shipGroupSeqId),
      orderItemSeqIds: [...orderItemSeqIds].sort(),
      isCurrent: false,
    };
    nodes.push(node);

    return node;
  };

  const startGroups = new Map<string, string[]>();
  items.forEach((item) => {
    const start = startingShipGroup(movesByItem.get(item.orderItemSeqId)?.[0], item.shipGroupSeqId, shipGroups);
    startGroups.set(start, [...(startGroups.get(start) || []), item.orderItemSeqId]);
  });
  [...startGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([shipGroupSeqId, ids]) => {
    const node = addNode(0, shipGroupSeqId, ids);
    ids.forEach((id) => location.set(id, { shipGroupSeqId, nodeId: node.id }));
  });

  steps.forEach((step, stepIndex) => {
    const column = stepIndex + 1;
    // The last move per item in this step decides where it ends up.
    const finalMove = new Map<string, (typeof step)[number]>();
    step.forEach((move) => finalMove.set(move.orderItemSeqId, move));
    const kinds = new Set([...finalMove.values()].map((move) => routingEventKind(move.row)));
    columns.push({
      index: column,
      at: step[0].at,
      kind: kinds.size === 1 ? [...kinds][0] : "mixed",
      attempts: Math.max(...[...finalMove.values()].map((move) => move.attempts)),
    });

    const before = new Map(location);
    const after = new Map(location);
    finalMove.forEach((move, orderItemSeqId) => {
      after.set(orderItemSeqId, { shipGroupSeqId: move.row.shipGroupSeqId, nodeId: "" });
    });

    // Every ship group whose contents changed gets a new card holding what it has now.
    const touched = new Set<string>();
    finalMove.forEach((move, orderItemSeqId) => {
      touched.add(before.get(orderItemSeqId)?.shipGroupSeqId || "");
      touched.add(move.row.shipGroupSeqId);
    });
    touched.delete("");
    const newNodes = new Map<string, FlowNode>();
    [...touched].sort().forEach((shipGroupSeqId) => {
      const held = [...after.entries()].filter(([, at]) => at.shipGroupSeqId === shipGroupSeqId).map(([id]) => id);
      if(held.length) {newNodes.set(shipGroupSeqId, addNode(column, shipGroupSeqId, held));}
    });
    after.forEach((at, orderItemSeqId) => {
      const node = newNodes.get(at.shipGroupSeqId);
      location.set(orderItemSeqId, node ? { shipGroupSeqId: at.shipGroupSeqId, nodeId: node.id } : before.get(orderItemSeqId)!);
    });

    // Lines: moved items grouped by where they went and why; items that stayed in a changed group.
    const lines = new Map<string, FlowEdge>();
    after.forEach((at, orderItemSeqId) => {
      const from = before.get(orderItemSeqId);
      const to = location.get(orderItemSeqId);
      if(!from || !to || from.nodeId === to.nodeId) {return;}
      const move = finalMove.get(orderItemSeqId);
      const kind: FlowEdgeKind = move ? routingEventKind(move.row) : "stayed";
      const reasonEnumId = move?.row.changeReasonEnumId || "";
      const key = `${from.nodeId}>${to.nodeId}>${kind}>${reasonEnumId}`;
      const line: FlowEdge = lines.get(key) || {
        id: `${column}-${key}`,
        from: from.nodeId,
        to: to.nodeId,
        kind,
        orderItemSeqIds: [],
        changeIds: [],
        at: move?.at ?? step[0].at,
        attempts: move?.attempts ?? 1,
        reasonEnumId,
        actor: move ? actorOf(move.row) : "",
        rule: move ? ruleLabel(move.row.routingRule) : "",
      };
      line.orderItemSeqIds.push(orderItemSeqId);
      if(move?.row.orderFacilityChangeId) {line.changeIds.push(String(move.row.orderFacilityChangeId));}
      line.attempts = Math.max(line.attempts, move?.attempts ?? 1);
      lines.set(key, line);
    });
    edges.push(...[...lines.values()].sort((a, b) => a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind)));
  });

  // A card is current when its ship group still holds exactly those items.
  const currentByGroup = new Map<string, string[]>();
  items.forEach((item) => currentByGroup.set(item.shipGroupSeqId, [...(currentByGroup.get(item.shipGroupSeqId) || []), item.orderItemSeqId]));
  const latestNode = new Map<string, FlowNode>();
  nodes.forEach((node) => latestNode.set(node.shipGroupSeqId, node));
  latestNode.forEach((node, shipGroupSeqId) => {
    const now = (currentByGroup.get(shipGroupSeqId) || []).sort().join();
    node.isCurrent = now !== "" && now === node.orderItemSeqIds.join();
  });

  return { columns, nodes, edges };
}

export interface FlowLayout {
  positions: Record<string, { x: number; y: number; height: number }>;
  width: number;
  height: number;
}

/** Cards sit in columns; each card lines up with the cards its items came from, without overlapping. */
export function layoutRoutingFlow(flow: RoutingFlow, size: {
  cardWidth: number; columnGap: number; headerHeight: number; rowHeight: number; cardGap: number; top: number; left: number;
}): FlowLayout {
  const positions: FlowLayout["positions"] = {};
  const cardHeight = (node: FlowNode) => size.headerHeight + node.orderItemSeqIds.length * size.rowHeight;
  let bottom = 0;
  flow.columns.forEach((column) => {
    const inColumn = flow.nodes.filter((node) => node.column === column.index);
    const desired = (node: FlowNode) => {
      const sources = flow.edges.filter((edge) => edge.to === node.id).map((edge) => positions[edge.from]).filter(Boolean);

      return sources.length ? Math.min(...sources.map((source) => source.y)) : size.top;
    };
    let next = size.top;
    inColumn
      .map((node) => ({ node, want: desired(node) }))
      .sort((a, b) => a.want - b.want || a.node.shipGroupSeqId.localeCompare(b.node.shipGroupSeqId))
      .forEach(({ node, want }) => {
        const y = Math.max(want, next);
        const height = cardHeight(node);
        positions[node.id] = { x: size.left + column.index * (size.cardWidth + size.columnGap), y, height };
        next = y + height + size.cardGap;
        bottom = Math.max(bottom, y + height);
      });
  });

  return {
    positions,
    width: size.left * 2 + flow.columns.length * size.cardWidth + Math.max(flow.columns.length - 1, 0) * size.columnGap,
    height: bottom + size.cardGap,
  };
}
