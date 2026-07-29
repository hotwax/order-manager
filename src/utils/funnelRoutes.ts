import type { RouteLocationRaw, Router } from 'vue-router';

type RouteResolver = Pick<Router, 'resolve'>;

function resolveRouterLink(router: RouteResolver, route: RouteLocationRaw) {
  return router.resolve(route).href;
}

export function resolveVirtualLocationRouterLink(
  router: RouteResolver,
  item: { id: string; facilityIds: string[] }
) {
  if (item.id === 'unfillable') {
    return resolveRouterLink(router, { path: '/unfillable' });
  }

  return resolveRouterLink(router, {
    path: '/brokering',
    query: {
      facilityId: item.facilityIds
    }
  });
}

export function resolveWorkflowRouterLink(
  router: RouteResolver,
  path: string,
  facilityId: string
) {
  return resolveRouterLink(router, {
    path,
    query: { facilityId }
  });
}

export function resolveHoldTaskRouterLink(
  router: RouteResolver,
  workEffortPurposeTypeId: string
) {
  if (workEffortPurposeTypeId === 'NEG_RES_REVIEW') {
    return resolveRouterLink(router, '/swap');
  }
  if (workEffortPurposeTypeId === 'INVALID_ADDRESS') {
    return resolveRouterLink(router, '/bad-address');
  }
  if (workEffortPurposeTypeId === 'REVIEW_RISK_ORDER') {
    return resolveRouterLink(router, '/fraud');
  }

  return resolveRouterLink(router, {
    path: '/hold',
    query: { purpose: workEffortPurposeTypeId }
  });
}
