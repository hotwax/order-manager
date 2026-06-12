import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order manager menu', () => {
  it('links the blocked unfillable queue to the unfillable route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('router-link="/unfillable"');
    expect(source).toContain('translate("Unfillable")');
    expect(source).not.toContain('router-link="/swap" router-direction="root"');
  });

  it('groups searchable records under the Figma Find section', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');
    const findDivider = source.indexOf('translate("Find")');
    const ordersItem = source.indexOf('router-link="/orders"');
    const customersItem = source.indexOf('router-link="/customers"');
    const settingsItem = source.indexOf('router-link="/settings"');

    expect(findDivider).toBeGreaterThan(source.indexOf('translate("In progress")'));
    expect(ordersItem).toBeGreaterThan(findDivider);
    expect(customersItem).toBeGreaterThan(ordersItem);
    expect(settingsItem).toBeGreaterThan(customersItem);
    expect(source).toContain('translate("Orders")');
    expect(source).toContain('translate("Customers")');
    expect(source).not.toContain('translate("Find order")');
    expect(source).not.toContain('translate("Find customers")');
  });
});
