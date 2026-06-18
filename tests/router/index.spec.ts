import { describe, expect, it } from 'vitest';
import router from '@/router/index';

describe('router', () => {
  it('registers settings as an authenticated shell route', () => {
    const settingsRoute = router.getRoutes().find((route) => route.path === '/settings');

    expect(settingsRoute?.name).toBe('Settings');
    expect(settingsRoute?.beforeEnter).toBeTruthy();
  });
});
