import { DateTime, Settings } from "luxon";
import { defineStore } from "pinia";
import { api, commonUtil, cookieHelper, logger, translate } from "@common";
import { startCacheBootstrap, clearAllCaches } from "@common/cache";
import { useAuth } from "@common/composables/useAuth";
import { showToast } from "@/utils";
import { orderManagerDb } from "@/cache/appCacheDb";
import { useSeedStore } from "./seed";
import { useOrderDetailStore } from "./orderDetail";
import { useProductCacheStore } from "./productCache";
import { useProductStore } from "@/store/productStore";
import { ORDER_MANAGER_CACHE_CATALOG } from "@/config/appSyncConfig";

export const useUserStore = defineStore("user", {
  state: () => ({
    current: {} as any,
    permissions: [] as string[],
    pwaState: {
      updateExists: false,
      registration: null as any,
    },
    timeZones: [] as any[],
    oms: "",
    // The app version this deployment is pinned to. undefined = not resolved yet, "" = no version
    // configured, "vX.Y.Z" = pinned. Resolved from the OMS by useAuth().fetchAppVersion() on Login.
    appVersion: undefined as string | undefined,
    fetchStatus: {
      profile: "none",
      permissions: "none"
    } as any
  }),
  getters: {
    getPermissions: (state) => state.permissions,
    getUserProfile: (state) => state.current,
    getAppVersion: (state) => state.appVersion,
    getPwaState: (state) => state.pwaState,
    getUserTimeZone: (state) => state.current.timeZone,
    getAvailableTimeZones: (state) => state.timeZones,
    getFetchStatus: (state) => state.fetchStatus,
    hasPermission: (state) => (permissionId: string): boolean => {
      if (!permissionId) return true;

      if (permissionId.includes(" OR ")) {
        return permissionId.split(" OR ").some((part) => useUserStore().hasPermission(part.trim()));
      }

      if (permissionId.includes(" AND ")) {
        return permissionId.split(" AND ").every((part) => useUserStore().hasPermission(part.trim()));
      }

      return state.permissions.includes(permissionId);
    }
  },
  actions: {
    async fetchUserProfile() {
      this.fetchStatus.profile = "pending";

      try {
        const userProfileResp = await api({
          url: "admin/user/profile",
          method: "get",
          baseURL: commonUtil.getMaargURL()
        });
        this.current = userProfileResp.data;
        useAuth().updateUserId(this.current.userId);

        if (this.current.timeZone) {
          Settings.defaultZone = this.current.timeZone;
        }
        this.fetchStatus.profile = "success";
      } catch (error: any) {
        await showToast(translate("Failed to fetch user profile information"));
        logger.error("Failed to fetch user profile information", error);
        useAuth().clearAuth();
        this.fetchStatus.profile = "error";
        return Promise.reject(error);
      }
    },
    async fetchPermissions() {
      const permissionId = import.meta.env.VITE_APP_PERMISSION_ID
      const serverPermissions = [] as string[]
      const viewSize = 200
      let viewIndex = 0

      this.fetchStatus.permissions = "pending"

      try {
        let resp
        do {
          resp = await api({
            url: "admin/user/permissions",
            method: "get",
            params: { viewIndex, viewSize }
          }) as any

          if (resp.status === 200 && resp.data.docs?.length && !commonUtil.hasError(resp)) {
            serverPermissions.push(...resp.data.docs.map((permission: any) => permission.permissionId))
            viewIndex++
          } else {
            resp = null
          }
        } while (resp)

        if(permissionId) {
          const hasPermission = serverPermissions.includes(permissionId)
          if(!hasPermission) {
            const permissionError = "You do not have permission to access the app."
            await showToast(translate(permissionError))
            logger.error("error", permissionError)
            this.fetchStatus.permissions = "error"
            return Promise.reject(new Error(permissionError))
          }
        }

        this.permissions = serverPermissions
        this.fetchStatus.permissions = "success"
      } catch (error: any) {
        this.fetchStatus.permissions = "error"
        return Promise.reject(error)
      }
    },
    
    async setUserTimeZone(tzId: string) {
      if (this.current.timeZone === tzId) return;

      try {
        const resp = await api({
          url: "admin/user/profile",
          method: "POST",
          data: {
            userId: this.current.userId,
            tzId
          },
        }) as any;

        if (resp?.status !== 200) throw resp;

        this.current.timeZone = tzId;
        Settings.defaultZone = tzId;
        await showToast(translate("Time zone updated successfully"));
        return tzId;
      } catch (error) {
        logger.error("Failed to update time zone", error);
        await showToast(translate("Failed to update time zone"));
        return Promise.reject(error);
      }
    },
    async fetchAvailableTimeZones() {
      if (this.timeZones.length) return;

      try {
        const resp: any = await api({
          url: "admin/user/getAvailableTimeZones",
          method: "get"
        });

        this.timeZones = resp.data.timeZones.filter((timeZone: any) => DateTime.local().setZone(timeZone.id).isValid);
      } catch (error) {
        logger.error("Failed to fetch time zones", error);
      }
    },
    updatePwaState(payload: any) {
      this.pwaState.registration = payload.registration;
      this.pwaState.updateExists = payload.updateExists;
    },
    async postLogin() {
      try {
        await this.fetchUserProfile();
        this.oms = cookieHelper().get("oms") || "";
        await this.fetchPermissions();
        await useProductStore().fetchProductStores();
        await useProductStore().fetchProductStorePreference();

        // Start non-blocking Web Worker sync to hydrate and update IndexedDB cache
        const token = cookieHelper().get("api_key") || cookieHelper().get("token") || (useAuth() as any).token?.value || "";
        startCacheBootstrap({
          workerFactory: () => new Worker(new URL("../workers/appSync.worker.ts", import.meta.url), { type: "module" }),
          token,
          maargUrl: commonUtil.getMaargURL(),
          db: orderManagerDb,
          domains: ORDER_MANAGER_CACHE_CATALOG.map((d) => d.name),
        }).then(() => {
          useSeedStore().populateFromCache();
        }).catch((err) => {
          logger.warn("Cache background sync notice:", err);
        });

        // Initialize in-memory seed store from cache/API
        await useSeedStore().initSeedCache();
      } catch (error: any) {
        return Promise.reject(error);
      }
    },
    async postLogout() {
      await clearAllCaches(orderManagerDb);
      useSeedStore().resetSeedData();
      useOrderDetailStore().reset();
      useProductCacheStore().reset();
      this.$reset();
    }
  },
  persist: true,
});
