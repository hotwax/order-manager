import type { RouteLocationRaw, Router } from 'vue-router';

type RouteResolver = Pick<Router, 'resolve'>;
type RouteNavigator = Pick<Router, 'push'>;

export interface NativeRouterLink {
  href: string;
  to: RouteLocationRaw;
}

export function resolveNativeRouterLink(
  router: RouteResolver,
  route: RouteLocationRaw
): NativeRouterLink {
  return {
    href: router.resolve(route).href,
    to: route,
  };
}

export function navigateNativeRouterLink(
  event: MouseEvent,
  router: RouteNavigator,
  link: NativeRouterLink
) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.altKey
    || event.ctrlKey
    || event.shiftKey
  ) {
    return;
  }

  event.preventDefault();
  return router.push(link.to);
}

export function resolveVirtualLocationRouterLink(
  router: RouteResolver,
  item: { id: string; facilityIds: string[] }
) {
  if (item.id === 'unfillable') {
    return resolveNativeRouterLink(router, { path: '/unfillable' });
  }

  return resolveNativeRouterLink(router, {
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
  return resolveNativeRouterLink(router, {
    path,
    query: { facilityId }
  });
}

export function resolveHoldTaskRouterLink(
  router: RouteResolver,
  workEffortPurposeTypeId: string
) {
  if (workEffortPurposeTypeId === 'NEG_RES_REVIEW') {
    return resolveNativeRouterLink(router, '/swap');
  }
  if (workEffortPurposeTypeId === 'INVALID_ADDRESS') {
    return resolveNativeRouterLink(router, '/bad-address');
  }
  if (workEffortPurposeTypeId === 'REVIEW_RISK_ORDER') {
    return resolveNativeRouterLink(router, '/fraud');
  }

  return resolveNativeRouterLink(router, {
    path: '/hold',
    query: { purpose: workEffortPurposeTypeId }
  });
}
