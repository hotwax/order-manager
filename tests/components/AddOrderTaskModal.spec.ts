import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('AddOrderTaskModal canonical hold WorkEffort model (#345)', () => {
  const modal = readFileSync(resolve(process.cwd(), 'src/components/tasks/AddOrderTaskModal.vue'), 'utf8');
  const seed = readFileSync(resolve(process.cwd(), 'src/store/seed.ts'), 'utf8');

  it('fixes the task type to RESOLVE_ONHOLD_ORDER', () => {
    // Poorti only excludes open hold tasks from ready-to-pick when the WorkEffort
    // type is RESOLVE_ONHOLD_ORDER, so tasks must always be created with it.
    expect(modal).toContain("const WORK_EFFORT_TYPE_ID = 'RESOLVE_ONHOLD_ORDER'");
    expect(modal).toContain('workEffortTypeId: WORK_EFFORT_TYPE_ID');
  });

  it('never exposes a task-type picker (no obsolete ORDER_HOLD leak)', () => {
    expect(modal).not.toContain("getEnumsByType('WorkEffortType')");
    expect(modal).not.toContain("loadEnumType('WorkEffortType')");
    expect(modal).not.toContain("translate('Select Task Type')");
    expect(modal).not.toContain('taskTypes');
  });

  it('scopes the purpose picker to the canonical hold purpose bucket', () => {
    expect(modal).toContain('getEnumsByType(WORK_EFFORT_TYPE_ID)');
    expect(modal).toContain('loadEnumType(WORK_EFFORT_TYPE_ID)');
    expect(modal).not.toContain("getEnumsByParentType('WorkEffortPurposeType')");
  });

  it('supports the canonical manual purpose as the selected modal default', () => {
    expect(modal).toContain('defaultWorkEffortPurposeTypeId?: string');
    expect(modal).toContain("workEffortPurposeTypeId: props.defaultWorkEffortPurposeTypeId || ''");
    // #399 renders the purpose picker as an icon popover (ion-select-option can't show
    // icons), so each option sets the canonical purpose id on click instead of via :value.
    expect(modal).toContain('@click="form.workEffortPurposeTypeId = option.enumId"');
  });

  it('only offers operator-created purposes in the ship-group modal', () => {
    expect(modal).toContain("new Set(['ORD_HOLD_MANUAL', 'ORD_HOLD_CUST_REQ'])");
    expect(modal).toContain('OPERATOR_HOLD_PURPOSE_IDS.has(purpose.enumId)');
    expect(modal).toContain('fraud is order-scoped');
  });

  it('stops loading the obsolete ORDER_HOLD task seed buckets', () => {
    expect(seed).not.toContain('ORDER_HOLD_STATUS');
    expect(seed).not.toContain('ORDER_HOLD_PURPOSE');
  });
});
