<template>
  <ion-app>
    <section
      v-if="productStoreBootstrapPending"
      class="ion-padding"
      aria-busy="true"
      aria-live="polite"
      data-testid="product-store-bootstrap"
    >
      <ion-progress-bar type="indeterminate" :aria-label="translate('Loading...')" />
      <p class="ion-text-center">{{ translate("Loading...") }}</p>
    </section>
    <template v-else>
      <ion-split-pane content-id="main-content" when="lg">
        <Menu v-if="router.currentRoute.value.name !== 'Login'" />
        <ion-router-outlet id="main-content" />
      </ion-split-pane>
      <!-- Fast Travel: Cmd/Ctrl+K app switcher + deep-link router across the HotWax suite -->
      <FastTravel current-app="order-manager" />
    </template>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonProgressBar, IonRouterOutlet, IonSplitPane, loadingController } from '@ionic/vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Settings } from 'luxon';
import { emitter, FastTravel, logger, translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import Menu from '@/components/layout/Menu.vue';
import router from './router';
import { useProductStore } from '@/store/productStore';
import { useUserStore } from '@/store/user';
import { useSeedStore } from '@/store/seed';

const loader = ref<HTMLIonLoadingElement | null>(null);
const { isAuthenticated } = useAuth();
const userStore = useUserStore();
const productStore = useProductStore();
const userProfile = computed(() => userStore.getUserProfile);
const productStoreBootstrapPending = ref(isAuthenticated.value);
const PRODUCT_STORE_BOOTSTRAP_TIMEOUT_MS = 10_000;

watch(isAuthenticated, (authenticated) => {
  if (!authenticated) productStoreBootstrapPending.value = false;
});

async function waitForProductStoreBootstrap(initialization: Promise<unknown>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    initialization.then(() => 'initialized' as const),
    new Promise<'timeout'>((resolve) => {
      timeoutId = setTimeout(() => resolve('timeout'), PRODUCT_STORE_BOOTSTRAP_TIMEOUT_MS);
    })
  ]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  return result;
}

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

  // postLogin only fires on a login transition. Refresh permissions on a restored session so
  // changes made by an administrator are reflected without forcing the user to log out.
  let permissionsRefresh = Promise.resolve();
  if (isAuthenticated.value) {
    permissionsRefresh = userStore.fetchPermissions().catch(() => undefined);
    try {
      const bootstrapResult = await waitForProductStoreBootstrap(
        productStore.initializeProductStoreSelection()
      );
      if (bootstrapResult === 'timeout') {
        logger.warn(`Product store initialization is still pending after ${PRODUCT_STORE_BOOTSTRAP_TIMEOUT_MS}ms`);
      }
    } finally {
      productStoreBootstrapPending.value = false;
    }
  } else {
    productStoreBootstrapPending.value = false;
  }
  await permissionsRefresh;

  // Ensure seed reference data is loaded on an authenticated boot. A page reload with a
  // persisted session would otherwise skip it and leave label datasets unresolved.
  // loadInitialSeedData is idempotent — already-loaded datasets are skipped.
  const productStoreIds = (userStore.current?.stores || [])
    .map((store: any) => store.productStoreId)
    .filter(Boolean);
  if (productStoreIds.length) {
    useSeedStore().loadInitialSeedData(productStoreIds).catch(() => undefined);
  }
});

onUnmounted(() => {
  emitter.off('presentLoader', presentLoader);
  emitter.off('dismissLoader', dismissLoader);
});
</script>
