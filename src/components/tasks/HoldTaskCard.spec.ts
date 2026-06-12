import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('hold task card assignment details', () => {
  it('renders the assignee assigned date from task party assignments', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/HoldTaskCard.vue'), 'utf8');

    expect(source).toContain("assignedPartyName(task, 'TASK_ASSIGNEE')");
    expect(source).toContain("assignedPartyDate(task, 'TASK_ASSIGNEE')");
    expect(source).toContain('party.roleTypeId === roleTypeId');
    expect(source).toContain('DateTime.fromSQL(value)');
    expect(source).toContain("v-model=\"resolutionComment\"");
    expect((source.match(/<ion-list lines=\"full\">/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED', resolutionCommunication())");
    expect(source).toContain('const content = resolutionComment.value.trim()');
    expect(source).not.toContain("{{ getAssignedParty(task, 'TASK_ASSIGNEE') }}");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
