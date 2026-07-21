import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('authenticated app boot', () => {
  it('refreshes permissions for a restored session', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');

    expect(source).toContain('const { isAuthenticated } = useAuth();');
    expect(source).toContain('if (isAuthenticated.value)');
    expect(source).toContain('await userStore.fetchPermissions()');
  });
});
