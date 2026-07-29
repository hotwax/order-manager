import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  navigateNativeRouterLink,
  resolveHoldTaskRouterLink,
  resolveNativeRouterLink,
  resolveVirtualLocationRouterLink,
  resolveWorkflowRouterLink
} from '@/utils/funnelRoutes';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory('/order-manager/'),
    routes: [
      { path: '/unfillable', component: {} },
      { path: '/brokering', component: {} },
      { path: '/open', component: {} },
      { path: '/inflight', component: {} },
      { path: '/packed', component: {} },
      { path: '/swap', component: {} },
      { path: '/bad-address', component: {} },
      { path: '/fraud', component: {} },
      { path: '/hold', component: {} }
    ]
  });
}

describe('Funnel router links', () => {
  it('resolves virtual-location links to native href strings with repeated query values', () => {
    const router = makeRouter();

    const unfillable = resolveVirtualLocationRouterLink(router, {
      id: 'unfillable',
      facilityIds: ['UNFILLABLE_PARKING']
    });
    const brokering = resolveVirtualLocationRouterLink(router, {
      id: 'awaiting-brokering',
      facilityIds: ['_NA_', 'FACILITY & WEST']
    });

    expect(unfillable.href).toBe('/order-manager/unfillable');
    expect(brokering.href).toBe(
      '/order-manager/brokering?facilityId=_NA_&facilityId=FACILITY+%26+WEST'
    );
    expect([unfillable.href, brokering.href]).not.toContain('[object Object]');
  });

  it('resolves facility workflow links with an escaped facility id', () => {
    const router = makeRouter();

    const open = resolveWorkflowRouterLink(router, '/open', 'FACILITY=A&B');
    const inflight = resolveWorkflowRouterLink(router, '/inflight', 'FACILITY=A&B');

    expect(open.href).toBe(
      '/order-manager/open?facilityId=FACILITY=A%26B'
    );
    expect(inflight.href).toBe(
      '/order-manager/inflight?facilityId=FACILITY=A%26B'
    );
  });

  it('resolves unfiltered dashboard destinations against the router base', () => {
    const router = makeRouter();

    expect(resolveNativeRouterLink(router, '/open').href).toBe('/order-manager/open');
    expect(resolveNativeRouterLink(router, '/inflight').href).toBe('/order-manager/inflight');
    expect(resolveNativeRouterLink(router, '/packed').href).toBe('/order-manager/packed');
    expect(resolveNativeRouterLink(router, '/unfillable').href).toBe('/order-manager/unfillable');
  });

  it('resolves known and purpose-specific hold links to native href strings', () => {
    const router = makeRouter();

    expect(resolveHoldTaskRouterLink(router, 'NEG_RES_REVIEW').href).toBe(
      '/order-manager/swap'
    );
    expect(resolveHoldTaskRouterLink(router, 'INVALID_ADDRESS').href).toBe(
      '/order-manager/bad-address'
    );
    expect(resolveHoldTaskRouterLink(router, 'REVIEW_RISK_ORDER').href).toBe(
      '/order-manager/fraud'
    );
    expect(resolveHoldTaskRouterLink(router, 'ORD_HOLD=A&B').href).toBe(
      '/order-manager/hold?purpose=ORD_HOLD=A%26B'
    );
  });

  it('uses Vue Router only for unmodified primary clicks', async () => {
    const router = makeRouter();
    const push = vi.spyOn(router, 'push');
    const link = resolveHoldTaskRouterLink(router, 'ORD_HOLD_MANUAL');
    const primaryClick = new MouseEvent('click', {
      button: 0,
      cancelable: true,
    });

    await navigateNativeRouterLink(primaryClick, router, link);

    expect(primaryClick.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith(link.to);

    push.mockClear();
    const modifierClick = new MouseEvent('click', {
      button: 0,
      ctrlKey: true,
      cancelable: true,
    });

    navigateNativeRouterLink(modifierClick, router, link);

    expect(modifierClick.defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
