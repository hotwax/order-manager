import type { RouteLocationRaw, Router } from 'vue-router';

export function nativeRouteHref(router: Router, destination: RouteLocationRaw) {
  return router.resolve(destination).href;
}

function isUnmodifiedPrimaryClick(event: MouseEvent) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey;
}

export async function navigateNativeRoute(event: MouseEvent, router: Router, destination: RouteLocationRaw) {
  if (event.defaultPrevented || !isUnmodifiedPrimaryClick(event)) return;

  event.preventDefault();
  await router.push(destination);
}
