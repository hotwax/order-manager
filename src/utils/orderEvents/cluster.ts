import { toMillis } from '@/utils/format';

// OMS records order events one row per order item, so a single operator action on a
// three-item ship group writes three rows milliseconds apart. Rows sharing a key
// within this window are one event; anything further apart is a separate action,
// even when it repeats an earlier move.
export const EVENT_CLUSTER_MS = 60_000;

export interface EventCluster {
  id: string;
  value: number;
  rows: any[];
}

export const rowMillis = (value: any): number => toMillis(value) ?? 0;

export function clusterEvents(rows: any[], keyOf: (row: any) => string, millisOf: (row: any) => number): EventCluster[] {
  const clusters: EventCluster[] = [];
  const openByKey: Record<string, EventCluster> = {};

  rows
    .map((row) => ({ row, millis: millisOf(row) }))
    .filter(({ millis }) => millis > 0)
    .sort((left, right) => left.millis - right.millis)
    .forEach(({ row, millis }) => {
      const key = keyOf(row);
      const open = openByKey[key];
      if (open && millis - open.value <= EVENT_CLUSTER_MS) {
        open.rows.push(row);
        return;
      }
      const cluster: EventCluster = { id: `${key}|${millis}`, value: millis, rows: [row] };
      openByKey[key] = cluster;
      clusters.push(cluster);
    });

  return clusters;
}

/** The distinct non-empty values of one field across rows, in first-seen order. */
export function distinct(rows: any[], field: string): string[] {
  return [...new Set(rows.map((row) => row?.[field]).filter(Boolean).map(String))];
}
