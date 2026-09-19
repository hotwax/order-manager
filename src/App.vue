<template>
  <ion-app>
    <ion-split-pane content-id="main-content" when="lg">
      <Menu v-if="router.currentRoute.value.name !== 'Login'" />
      <ion-router-outlet id="main-content" />
    </ion-split-pane>
    <!-- Fast Travel: Cmd/Ctrl+K app switcher + deep-link router across the HotWax suite -->
    <FastTravel current-app="order-manager" />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSplitPane, loadingController } from '@ionic/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Settings } from 'luxon';
import { emitter, FastTravel, translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import { getSyncToken, startAppDbSync } from '@/services/appDbSync';
import Menu from '@/components/layout/Menu.vue';
import router from './router';
import { useUserStore } from '@/store/user';
import { useSeedStore } from '@/store/seed';
import { useProductStore } from '@/store/productStore';

const loader = ref<HTMLIonLoadingElement | null>(null);
const { isAuthenticated } = useAuth();
const userStore = useUserStore();
const userProfile = computed(() => userStore.getUserProfile);

async function presentLoader(options = { message: '', backdropDismiss: true }) {
  if (options.message && loader.value) dismissLoader();

  if (!loader.value) {
    loader.value = await loadingController.create({
      message: options.message ? translate(options.message) : translate("Click the backdrop to dismiss."),
      translucent: true,
      backdropDismiss: options.backdropDismiss
    });
  }

  loader.value.present();
}

function dismissLoader() {
  if (loader.value) {
    loader.value.dismiss();
    loader.value = null;
  }
}

onMounted(async () => {
  loader.value = await loadingController.create({
    message: translate("Click the backdrop to dismiss."),
    translucent: true,
    backdropDismiss: true
  });
  emitter.on('presentLoader', presentLoader);
  emitter.on('dismissLoader', dismissLoader);

  const timeZone = userProfile.value?.timeZone || userProfile.value?.userTimeZone;
  if (timeZone) Settings.defaultZone = timeZone;

  // Initialize the in-memory seed store from IndexedDB on startup/reload. Awaited so the stored
  // datasets are in place before the API fallback below decides what still needs fetching.
  await useSeedStore().initSeedDb();

  // On authenticated boot, start the background Web Worker database bootstrap to ensure sync
  if (isAuthenticated.value) {
    await userStore.fetchPermissions().catch(() => undefined);

    const token = getSyncToken();
    if (token) {
      startAppDbSync(token, () => useSeedStore().populateFromDb())
        .catch((err) => {
          console.warn("Background database bootstrap notice:", err);
        });
    }
  }

  // Ensure seed reference data is loaded on an authenticated boot. Store-scoped datasets need
  // product store ids, but the global ones must load regardless — gating the whole call on
  // having stores left every unfilled dataset resolving labels to raw ids.
  if (isAuthenticated.value) {
    const productStoreIds = (useProductStore().productStores || [])
      .map((store: any) => store.productStoreId)
      .filter(Boolean);
    useSeedStore().loadInitialSeedData(productStoreIds).catch(() => undefined);
  }
});

onUnmounted(() => {
  emitter.off('presentLoader', presentLoader);
  emitter.off('dismissLoader', dismissLoader);
});
</script>
