// Queue-defining task query constants, shared by the order-task store (which
// lists each queue) and the nav-count priming (which counts them). Kept in a
// dependency-free module so counting can reuse them without importing the store.

export const HOLD_TASK_TYPE_ID = 'RESOLVE_ONHOLD_ORDER';
export const FRAUD_RISK_PURPOSE_TYPE_ID = 'REVIEW_RISK_ORDER';
export const OPEN_TASK_STATUS_IDS = 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD';
export const ADDRESS_VALIDATION_PURPOSE_TYPE_ID = 'INVALID_ADDRESS';
export const SWAP_PURPOSE_TYPE_ID = 'NEG_RES_REVIEW';

// Hold-task purposes are Enumeration records under this enum type, so the purpose
// filter options come from `seedStore.getEnumsByType(HOLD_TASK_PURPOSE_ENUM_TYPE_ID)`
// rather than a hardcoded list.
export const HOLD_TASK_PURPOSE_ENUM_TYPE_ID = 'RESOLVE_ONHOLD_ORDER';

/**
 * Hold-task purposes that own a dedicated queue page (Bad Address, Swap, Fraud).
 * The general Hold queue is defined as the complement of this set — every other
 * purpose, including ones added to OMS later — so a task is always listed on
 * exactly one queue and no purpose is silently invisible.
 */
export const DEDICATED_QUEUE_PURPOSE_TYPE_IDS = [
  ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
  SWAP_PURPOSE_TYPE_ID,
  FRAUD_RISK_PURPOSE_TYPE_ID,
];

/** Query params selecting every hold purpose that has no dedicated queue page. */
export function generalHoldPurposeParams() {
  return {
    workEffortPurposeTypeId: DEDICATED_QUEUE_PURPOSE_TYPE_IDS.join(','),
    workEffortPurposeTypeId_op: 'in',
    workEffortPurposeTypeId_not: 'Y',
  };
}

/** True when a purpose belongs to another queue page and must not appear on Hold. */
export function isDedicatedQueuePurpose(purposeTypeId?: string): boolean {
  return !!purposeTypeId && DEDICATED_QUEUE_PURPOSE_TYPE_IDS.includes(purposeTypeId);
}
