import { describe, expect, it, vi } from "vitest";
import Actions from "@/authorization/actions";
import router from "@/router/index";

vi.mock("@common", () => ({
  Login: {},
  translate: (message: string) => message
}));

vi.mock("@common/composables/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: { value: true },
    checkAppVersionRedirect: () => false
  })
}));

vi.mock("@/store/user", () => ({
  useUserStore: () => ({ hasPermission: () => true })
}));

vi.mock("@/utils", () => ({ showToast: vi.fn() }));

describe("router", () => {
  it("registers settings as an authenticated shell route", () => {
    const settingsRoute = router.getRoutes().find((route) => route.path === "/settings");

    expect(settingsRoute?.name).toBe("Settings");
    expect(settingsRoute?.beforeEnter).toBeTruthy();
  });

  it("protects both returns routes with the dedicated returns permission", () => {
    const returnsRoute = router.getRoutes().find((route) => route.path === "/returns");
    const returnDetailRoute = router.getRoutes().find((route) => route.path === "/returns/:returnId");

    expect(returnsRoute?.name).toBe("Returns");
    expect(returnsRoute?.meta.permissionId).toBe(Actions.APP_ORDER_RETURN_VIEW);
    expect(returnDetailRoute?.name).toBe("ReturnDetail");
    expect(returnDetailRoute?.meta.permissionId).toBe(Actions.APP_ORDER_RETURN_VIEW);
  });
});
