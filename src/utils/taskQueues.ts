// Queue-defining task query constants, shared by the order-task store (which
// lists each queue) and the nav-count priming (which counts them). Kept in a
// dependency-free module so counting can reuse them without importing the store.

export const HOLD_TASK_TYPE_ID = 'RESOLVE_ONHOLD_ORDER';
export const FRAUD_RISK_PURPOSE_TYPE_ID = 'REVIEW_RISK_ORDER';
export const OPEN_TASK_STATUS_IDS = 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD';
export const USER_HOLD_PURPOSE_TYPE_IDS = 'ORD_HOLD_MANUAL,ORD_HOLD_CUST_REQ';
export const ADDRESS_VALIDATION_PURPOSE_TYPE_ID = 'INVALID_ADDRESS';
export const SWAP_PURPOSE_TYPE_ID = 'NEG_RES_REVIEW';
