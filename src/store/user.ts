import { DateTime, Settings } from "luxon";
import { defineStore } from "pinia";
import { api, commonUtil, translate } from "@common";
import { useAuth } from "@common/composables/useAuth";
import logger from "@/logger";
import { showToast } from "@/utils";
import { useSeedStore } from "./seed";
import { useOrderDetailStore } from "./orderDetail";
import { useProductCacheStore } from "./productCache";

export const useUserStore = defineStore("user", {
  state: () => ({
    current: {} as any,
    permissions: [] as string[],
    currentProductStore: {
      productStoreId: "",
      storeName: "None",
    } as any,
    pwaState: {
      updateExists: false,
      registration: null as any,
    },
    timeZones: [] as any[],
    oms: "",
    fetchStatus: {
      profile: "none",
      permissions: "none"
    } as any
  }),
  getters: {
    getPermissions: (state) => state.permissions,
    getUserProfile: (state) => state.current,
    getPwaState: (state) => state.pwaState,
    getCurrentProductStore: (state) => state.currentProductStore,
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
      this.fetchStatus.permissions = "pending";
      const serverPermissions = [] as string[];
      const viewSize = 200;
      let viewIndex = 0;

      try {
        let resp;
        do {
          resp = await api({
            url: "admin/user/permissions",
            method: "get",
            baseURL: commonUtil.getMaargURL(),
            params: { viewIndex, viewSize }
          }) as any;

          if (resp.status === 200 && resp.data.docs?.length && !commonUtil.hasError(resp)) {
            serverPermissions.push(...resp.data.docs.map((permission: any) => permission.permissionId));
            viewIndex++;
          } else {
            resp = null;
          }
        } while (resp);

        this.permissions = serverPermissions;
        this.fetchStatus.permissions = "success";
      } catch (error: any) {
        this.fetchStatus.permissions = "error";
        return Promise.reject(error);
      }
    },
    async fetchProductStores() {
      try {
        const productStoresResp = await api({
          url: "admin/productStores",
          method: "get",
          baseURL: commonUtil.getMaargURL()
        });

        this.current.stores = productStoresResp.data;
        useSeedStore().setProductStores(productStoresResp.data || []);
        this.current.stores.push({
          productStoreId: "",
          storeName: "None",
        });

        await this.setCurrentProductStore(this.current.stores[0]);
      } catch (error: any) {
        logger.error("Failed to fetch product stores", error);
        return Promise.reject(error);
      }
    },
    async fetchProductStorePreference() {
      try {
        const preferredStoreResp = await api({
          url: "admin/user/preferences",
          method: "GET",
          params: {
            pageSize: 1,
            userId: this.current.userId,
            preferenceKey: "FAVORITE_PRODUCT_STORE"
          },
        });
        const preferredStoreId = preferredStoreResp.data;
        if (preferredStoreId) {
          const store = this.current.stores.find((store: any) => store.productStoreId === preferredStoreId);
          if (store) await this.setCurrentProductStore(store);
        }
      } catch (error) {
        logger.error("Favourite product store not found", error);
      }
    },
    async setCurrentProductStore(productStoreInfo: any) {
      let productStore = productStoreInfo;
      if (!productStoreInfo.storeName) {
        productStore = this.current.stores.find((store: any) => store.productStoreId === productStoreInfo.productStoreId);
      }
      this.currentProductStore = productStore || {
        productStoreId: "",
        storeName: "None",
      };
      await useSeedStore().loadProductStoreSeedData(this.currentProductStore.productStoreId);
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
        await this.fetchPermissions();
        await this.fetchProductStores();
        await this.fetchProductStorePreference();
        const productStoreIds = (this.current.stores || []).map((store: any) => store.productStoreId).filter(Boolean);
        await useSeedStore().loadInitialSeedData(productStoreIds);
      } catch (error: any) {
        return Promise.reject(error);
      }
    },
    async postLogout() {
      useSeedStore().resetSeedData();
      useOrderDetailStore().reset();
      useProductCacheStore().reset();
      this.$reset();
    }
  },
  persist: true,
});
