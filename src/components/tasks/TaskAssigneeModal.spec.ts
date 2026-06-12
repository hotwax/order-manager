import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('task assignee modal', () => {
  it('uses a radio list with a pinned Me option and searchable staff results', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskAssigneeModal.vue'), 'utf8');

    expect(source).toContain('<ion-radio-group v-model="selectedAssigneeId">');
    expect(source).toContain('Me');
    expect(source).toContain('@keyup.enter="findAssignees"');
    expect(source).toContain('docType:EMPLOYEE');
    expect(source).toContain('statusId:PARTY_ENABLED');
    expect(source).not.toContain('ion-checkbox');
    expect(source).not.toContain('selectedAssignees');
  });
});
