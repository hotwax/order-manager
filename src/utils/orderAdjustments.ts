/**
 * Order adjustments (e.g. tax) commonly carry only an orderAdjustmentTypeId, no free-text
 * comment/description — fall back to the seeded type description so rows show "Sales Tax"
 * rather than the raw "SALES_TAX" id. The same label backs the de-duplication key below, so
 * adjustments only merge under their human-readable label, not the raw type id.
 */
export function adjustmentLabel(adj: any, typeDescription: (typeId: string) => string, fallback: string): string {
  return adj.comments
    || adj.comment
    || adj.description
    || typeDescription(adj.orderAdjustmentTypeId)
    || adj.orderAdjustmentTypeId
    || fallback;
}

/**
 * An adjustment row can arrive both on the order header list and nested under its item;
 * this key identifies it across both so it is only counted once.
 */
export function adjustmentKey(adj: any, label: string, fallbackSeqId = ''): string {
  return adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || '',
    adj.shipGroupSeqId || '',
    adj.orderAdjustmentTypeId || '',
    label,
    Number(adj.amount || 0),
    Number(adj.amountAlreadyIncluded || 0)
  ].join('|');
}

/**
 * The amount an adjustment contributes to its row. A tax already included in the item price
 * carries amount 0 and its value in amountAlreadyIncluded, so that is the one to show.
 */
export function adjustmentAmount(adj: any): { amount: number; isIncluded: boolean } {
  const amount = Number(adj.amount || 0);
  const amountAlreadyIncluded = Number(adj.amountAlreadyIncluded || 0);
  const isIncluded = amount === 0 && amountAlreadyIncluded > 0;
  return { amount: isIncluded ? amountAlreadyIncluded : amount, isIncluded };
}
