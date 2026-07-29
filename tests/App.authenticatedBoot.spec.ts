import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('authenticated app boot', () => {
  it('refreshes permissions and canonical product-store state for a restored session', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    const menuSource = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('const { isAuthenticated } = useAuth();');
    expect(source).toContain('if (isAuthenticated.value)');
    expect(source).toContain('await userStore.fetchPermissions()');
    expect(mainSource).toContain('await useProductStore().initializeProductStoreSelection()');
    expect(mainSource.indexOf('await useProductStore().initializeProductStoreSelection()'))
      .toBeLessThan(mainSource.indexOf("app.mount('#app')"));
    expect(menuSource).not.toContain('productStore.fetchProductStores()');
    expect(menuSource).not.toContain('productStore.fetchProductStorePreference()');
  });
});
