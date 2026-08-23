import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { nativeRouteHref, navigateNativeRoute } from '@/utils/nativeRouterLink';

describe('native router links', () => {
  let router: Router;

  beforeEach(async () => {
    router = createRouter({
      history: createMemoryHistory('/order-manager/'),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/brokering', component: { template: '<div />' } },
        { path: '/hold', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();
  });

  it('resolves object destinations to base-aware browser href strings', () => {
    expect(nativeRouteHref(router, {
      path: '/brokering',
      query: { facilityId: ['FACILITY_A', 'FACILITY_B'] },
    })).toBe('/order-manager/brokering?facilityId=FACILITY_A&facilityId=FACILITY_B');
  });

  it('uses Vue Router for an unmodified primary click', async () => {
    const event = new MouseEvent('click', { button: 0, cancelable: true });

    await navigateNativeRoute(event, router, { path: '/hold', query: { purpose: 'MANUAL_REVIEW' } });

    expect(event.defaultPrevented).toBe(true);
    expect(router.currentRoute.value.fullPath).toBe('/hold?purpose=MANUAL_REVIEW');
  });

  it.each([
    ['meta', { metaKey: true }],
    ['control', { ctrlKey: true }],
    ['alt', { altKey: true }],
    ['shift', { shiftKey: true }],
    ['middle', { button: 1 }],
  ])('preserves native %s-click behavior', async (_name, init) => {
    const event = new MouseEvent('click', { button: 0, cancelable: true, ...init });

    await navigateNativeRoute(event, router, '/brokering');

    expect(event.defaultPrevented).toBe(false);
    expect(router.currentRoute.value.fullPath).toBe('/');
  });
});
