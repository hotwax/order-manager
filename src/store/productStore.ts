import { defineStore } from 'pinia'
import { api, commonUtil, useEmbeddedAppStore, logger, translate, useSolrSearch } from '@common'
import { useUserStore } from '@/store/user'
import { useSeedStore } from "@/store/seed";
const defaultProductStoreSettings = JSON.parse(import.meta.env.VITE_DEFAULT_PRODUCT_STORE_SETTINGS as string || '{"PRDT_IDEN_PREF":{"stateKey":"productIdentifier.productIdentificationPref","value":{"primaryId":"SKU","secondaryId":"productId"}}}')

function resolveCanonicalProductStore(stores: any[], preferredStoreId?: string, currentStoreId?: string) {
  return stores.find((store: any) => store.productStoreId === preferredStoreId)
    || stores.find((store: any) => store.productStoreId === currentStoreId)
    || stores[0]
}

async function loadProductStores() {
  const resp = await api({
    url: `/admin/productStores`,
    method: "GET",
    params: {
      fieldsToSelect: ["productStoreId", "storeName"],
      pageSize: 250
    }
  });

  if (commonUtil.hasError(resp)) {
    throw resp.data
  }

  if (!Array.isArray(resp.data)) {
    throw resp.data
  }

  return resp.data
}

async function loadPreferredStoreId(userId: string) {
  const preferredStoreResp = await api({
    url: "admin/user/preferences",
    method: "GET",
    params: {
      pageSize: 1,
      userId,
      preferenceKey: "SELECTED_BRAND"
    },
  }) as any;

  return preferredStoreResp.data?.[0]?.preferenceValue
}

export const useProductStore = defineStore('productStore', {
  state: () => ({
    currentProductStore: {} as any,
    settings: {
      productIdentifier: {
        productIdentificationPref: {
          primaryId: '',
          secondaryId: ''
        },
        productIdentificationOptions: [] as any[],
        sampleProducts: [],
        currentSampleProduct: null
      },
      barcodeIdentifier: {
        barcodeIdentifierPref: "",
        barcodeIdentifierOptions: [] as any[],
      },
    } as any,
    productStores: [] as any[],
  }),

  getters: {
    getCurrentProductStore: (state) => {
      const selectedStoreId = state.currentProductStore?.productStoreId
      return state.productStores?.find((store: any) => store.productStoreId === selectedStoreId)
        || state.currentProductStore
    },
    getProductStores: (state) => state.productStores,
    getSettings: (state) => state.settings,
    getProductIdentificationPref: (state) => state.settings.productIdentifier.productIdentificationPref,
    getBarcodeIdentifierPref: (state) => state.settings.barcodeIdentifier.barcodeIdentifierPref,
    getProductIdentificationOptions: (state) => state.settings.productIdentifier.productIdentificationOptions,
    getBarcodeIdentifierOptions: (state) => state.settings.barcodeIdentifier.barcodeIdentifierOptions,
    getCurrentSampleProduct: (state) => state.settings.productIdentifier.currentSampleProduct,
  },

  actions: {
    async setCurrentProductStore(store: any) {
      const canonicalStore = this.productStores?.find(
        (productStore: any) => productStore.productStoreId === store?.productStoreId
      )
      this.currentProductStore = canonicalStore || store
    },

    reconcileCurrentProductStore(preferredStoreId?: string, clearWhenCatalogEmpty = false) {
      const stores = Array.isArray(this.productStores) ? this.productStores : []
      const currentStoreId = this.currentProductStore?.productStoreId
      const canonicalStore = resolveCanonicalProductStore(stores, preferredStoreId, currentStoreId)

      if (canonicalStore) {
        this.currentProductStore = canonicalStore
      } else if (clearWhenCatalogEmpty) {
        this.currentProductStore = {}
      }

      return this.currentProductStore
    },

    async fetchProductStores() {
      try {
        this.productStores = await loadProductStores()
        this.reconcileCurrentProductStore(undefined, true)
      } catch (err) {
        logger.error("Failed to fetch product stores", err)
      }
    },

    async fetchProductStorePreference() {
      const userStore = useUserStore();
      let preferredStoreId
      try {
        preferredStoreId = await loadPreferredStoreId(userStore.current.userId)
      } catch (err) {
        logger.error('Favourite product store not found', err)
      }
      this.reconcileCurrentProductStore(preferredStoreId)
    },
    async initializeProductStoreSelection() {
      const userStore = useUserStore();
      const [storesResult, preferenceResult] = await Promise.allSettled([
        loadProductStores(),
        loadPreferredStoreId(userStore.current.userId)
      ])

      if (preferenceResult.status === 'rejected') {
        logger.error('Favourite product store not found', preferenceResult.reason)
      }

      if (storesResult.status === 'rejected') {
        logger.error("Failed to fetch product stores", storesResult.reason)
        return this.currentProductStore
      }

      const stores = storesResult.value
      const preferredStoreId = preferenceResult.status === 'fulfilled'
        ? preferenceResult.value
        : undefined
      const canonicalStore = resolveCanonicalProductStore(
        stores,
        preferredStoreId,
        this.currentProductStore?.productStoreId
      )

      this.$patch({
        productStores: stores,
        currentProductStore: canonicalStore || {}
      })

      return this.currentProductStore
    },
    async setProductStorePreference(payload: any) {
      const userStore = useUserStore();
      const selectedProductStore = this.productStores?.find(
        (store: any) => store.productStoreId === payload?.productStoreId
      ) || payload

      if (!selectedProductStore?.productStoreId) return

      try {
        await api({
          url: "admin/user/preferences",
          method: "PUT",
          data: {
            userId: userStore.current.userId,
            preferenceKey: 'SELECTED_BRAND',
            preferenceValue: selectedProductStore.productStoreId,
          }
        });
      } catch (error) {
        console.error('error', error)
      }
      await this.setCurrentProductStore(selectedProductStore);
      await useSeedStore().loadProductStoreSeedData(selectedProductStore.productStoreId);
    },
    async fetchProductStoreSettings(productStoreId: string) {
      const productStoreSettings = {} as any

      if (productStoreId) {
        const payload = {
          productStoreId,
          settingTypeEnumId: Object.keys(defaultProductStoreSettings),
          settingTypeEnumId_op: "in",
          pageIndex: 0,
          pageSize: 50
        }
        try {
          const resp = await api({
            url: `/oms/dataDocumentView`,
            method: "POST",
            data: {
              dataDocumentId: "ProductStoreSetting",
              customParametersMap: payload
            }
          }) as any

          resp?.data?.entityValueList?.forEach((productSetting: any) => {
            productStoreSettings[productSetting.settingTypeEnumId] = productSetting.settingValue
          })
        } catch (error) {
          logger.error("Failed to fetch settings", error)
        }
      }

      Object.entries(defaultProductStoreSettings).forEach(([settingTypeEnumId, setting]: any) => {
        const { stateKey, value } = setting;
        const settingValue = productStoreSettings[settingTypeEnumId];
        let finalValue;
        try {
          finalValue = settingValue ? JSON.parse(settingValue) : value;
        } catch (e) {
          finalValue = settingValue; // fallback to raw value
        }

        const keys = stateKey.split('.');
        let current = this.settings;

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];

          if (i === keys.length - 1) {
            current[key] = finalValue;
          } else {
            // ensure object exists at each level
            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {};
            }
            current = current[key];
          }
        }
      })
    },
    async setProductStoreSetting(productStoreId: string, settingTypeEnumId: string, settingValue: any) {
      try {
        const payloadSettingValue = typeof settingValue === 'object' ? JSON.stringify(settingValue) : settingValue;
        const resp = await api({
          url: `admin/productStores/${productStoreId}/settings`,
          method: 'POST',
          data: {
            productStoreId,
            settingTypeEnumId,
            settingValue: payloadSettingValue
          }
        })
        if (!commonUtil.hasError(resp)) {
          const defaultSetting = defaultProductStoreSettings[settingTypeEnumId]
          const { stateKey } = defaultSetting
          const keys = stateKey.split('.');
          let current = this.settings;

          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (i === keys.length - 1) {
              current[key] = settingValue;
            } else {
              // ensure object exists at each level
              if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
              }
              current = current[key];
            }
          }
          commonUtil.showToast(translate('Product Store setting updated successfully.'))
        } else {
          throw resp
        }
      } catch (err) {
        commonUtil.showToast(translate('Failed to update Product Store setting.'))
        logger.error(err)
      }
    },

    async prepareProductIdentifierOptions() {
      //static identifications 
      const productIdentificationOptions = [
        { goodIdentificationTypeId: "productId", description: "Product ID" },
        { goodIdentificationTypeId: "groupId", description: "Group ID" },
        { goodIdentificationTypeId: "groupName", description: "Group Name" },
        { goodIdentificationTypeId: "internalName", description: "Internal Name" },
        { goodIdentificationTypeId: "parentProductName", description: "Parent Product Name" },
        { goodIdentificationTypeId: "primaryProductCategoryName", description: "Primary Product Category Name" },
        { goodIdentificationTypeId: "title", description: "Title" }
      ]
      //good identification types
      let fetchedGoodIdentificationOptions = []
      try {
        const resp: any = await api({
          url: "oms/goodIdentificationTypes",
          method: "get",
          params: {
            parentTypeId: "HC_GOOD_ID_TYPE",
            pageSize: 50
          }
        });

        fetchedGoodIdentificationOptions = resp.data
      } catch (error) {
        console.error('Failed to fetch good identification types', error)
      }

      // Merge the arrays and remove duplicates
      this.settings.productIdentifier.productIdentificationOptions = Array.from(new Set([...productIdentificationOptions, ...fetchedGoodIdentificationOptions])).sort();
      this.settings.barcodeIdentifier.barcodeIdentifierOptions = fetchedGoodIdentificationOptions
    },

    async fetchProducts() {
      try {
        const resp = await useSolrSearch().searchProducts({
          viewSize: 10
        })

        // searchProducts returns an array of docs on hits, and {} when the
        // catalog has none. An empty catalog is a normal state (e.g. a fresh
        // OMS with nothing indexed yet), not an error.
        this.settings.productIdentifier.sampleProducts = Array.isArray(resp.products) ? resp.products : []
        this.shuffleProduct()
      } catch (error: any) {
        console.error("Failed to fetch sample products", error)
      }
    },
    shuffleProduct() {
      if (this.settings.productIdentifier.sampleProducts.length) {
        const randomIndex = Math.floor(Math.random() * this.settings.productIdentifier.sampleProducts.length)
        this.settings.productIdentifier.currentSampleProduct = this.settings.productIdentifier.sampleProducts[randomIndex]
      } else {
        this.settings.productIdentifier.currentSampleProduct = null
      }
    }
  },
  persist: true
})
