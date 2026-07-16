import { describe, expect, it } from 'vitest';
import { countShipGroupHoldTasks } from '@/utils/orderHoldTasks';

describe('ship-group hold task count', () => {
  it('counts both directly scoped and order-level tasks that block a ship group', () => {
    const tasks = [
      { workEffortId: 'TASK_1', shipGroupSeqId: '00001' },
      { workEffortId: 'TASK_2', shipGroupSeqId: null },
      { workEffortId: 'TASK_3', shipGroupSeqId: '00002' },
    ];

    expect(countShipGroupHoldTasks(tasks, '00001')).toBe(2);
  });
});
