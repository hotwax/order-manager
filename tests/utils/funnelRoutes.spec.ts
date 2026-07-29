import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  resolveHoldTaskRouterLink,
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

    expect(unfillable).toBe('/order-manager/unfillable');
    expect(brokering).toBe(
      '/order-manager/brokering?facilityId=_NA_&facilityId=FACILITY+%26+WEST'
    );
    expect([unfillable, brokering]).not.toContain('[object Object]');
  });

  it('resolves facility workflow links with an escaped facility id', () => {
    const router = makeRouter();

    const open = resolveWorkflowRouterLink(router, '/open', 'FACILITY=A&B');
    const inflight = resolveWorkflowRouterLink(router, '/inflight', 'FACILITY=A&B');

    expect(open).toBe(
      '/order-manager/open?facilityId=FACILITY=A%26B'
    );
    expect(inflight).toBe(
      '/order-manager/inflight?facilityId=FACILITY=A%26B'
    );
  });

  it('resolves known and purpose-specific hold links to native href strings', () => {
    const router = makeRouter();

    expect(resolveHoldTaskRouterLink(router, 'NEG_RES_REVIEW')).toBe(
      '/order-manager/swap'
    );
    expect(resolveHoldTaskRouterLink(router, 'INVALID_ADDRESS')).toBe(
      '/order-manager/bad-address'
    );
    expect(resolveHoldTaskRouterLink(router, 'REVIEW_RISK_ORDER')).toBe(
      '/order-manager/fraud'
    );
    expect(resolveHoldTaskRouterLink(router, 'ORD_HOLD=A&B')).toBe(
      '/order-manager/hold?purpose=ORD_HOLD=A%26B'
    );
  });
});
