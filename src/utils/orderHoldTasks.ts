export function countShipGroupHoldTasks(tasks: any[], shipGroupSeqId: string): number {
  return tasks.filter((task) => task.shipGroupSeqId == null || task.shipGroupSeqId === shipGroupSeqId).length;
}
