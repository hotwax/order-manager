import { alertCircleOutline, banOutline, locationOutline, pauseCircleOutline, shieldHalfOutline } from 'ionicons/icons';

// Centralized hold-task purpose -> icon mapping, reusing the side-menu / task-page icon
// language (see Menu.vue) so the purpose picker, task cards, and menu stay in sync and
// don't drift. Keyed by WorkEffortPurposeType enumId.
export const TASK_PURPOSE_ICONS: Record<string, string> = {
  INVALID_ADDRESS: locationOutline,    // Bad address
  NEG_RES_REVIEW: alertCircleOutline,  // Swap / negative inventory reservation review
  ORD_HOLD_MANUAL: pauseCircleOutline, // Manual hold
  // Fraud/risk review is currently a WorkEffortType, not a purpose (see #321). When a
  // fraud/risk purpose exists, and if an "unfillable" purpose is ever exposed, they map to:
  REVIEW_RISK_ORDER: shieldHalfOutline,
  UNFILLABLE_PARKING: banOutline,
};

/** Icon for a task purpose, or undefined when the purpose has no mapped icon. */
export function getTaskPurposeIcon(purposeId?: string): string | undefined {
  return purposeId ? TASK_PURPOSE_ICONS[purposeId] : undefined;
}
