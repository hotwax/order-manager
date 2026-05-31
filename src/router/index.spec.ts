import { describe, expect, it, vi } from 'vitest';

vi.mock('@common', () => ({
  Login: { template: '<div />' },
  api: vi.fn(),
  commonUtil: {
    getDateTime: vi.fn((value) => value),
    getMaargURL: vi.fn(() => 'http://localhost:8080/rest/s1/'),
    getOmsURL: vi.fn(() => 'http://localhost:8080/rest/s1/admin/')
  },
  cookieHelper: () => ({
    get: vi.fn(() => ''),
    set: vi.fn(),
    remove: vi.fn()
  }),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  },
  translate: vi.fn((key) => key),
  useSolrSearch: vi.fn(() => ({}))
}));

vi.mock('@common/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: { value: true }
  })
}));

import router from './index';

describe('router', () => {
  it('registers settings as an authenticated shell route', () => {
    const settingsRoute = router.getRoutes().find((route) => route.path === '/settings');

    expect(settingsRoute?.name).toBe('Settings');
    expect(settingsRoute?.beforeEnter).toBeTruthy();
  });
});
