<template>
  <ion-app>
    <ion-split-pane content-id="main-content" when="lg">
      <Menu v-if="router.currentRoute.value.name !== 'Login'" />
      <ion-router-outlet id="main-content" />
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSplitPane, loadingController } from '@ionic/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Settings } from 'luxon';
import { translate } from '@common';
import emitter from '@/event-bus';
import Menu from '@/components/layout/Menu.vue';
import router from './router';
import { useUserStore } from '@/store/user';
import { useSeedStore } from '@/store/seed';

const loader = ref<HTMLIonLoadingElement | null>(null);
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

  // Ensure seed reference data is loaded on an authenticated boot. postLogin only fires on a
  // login transition, so a page reload with a persisted session would otherwise skip it and
  // leave label datasets (statuses, enums, geo, types) unresolved. loadInitialSeedData is
  // idempotent — already-loaded datasets are skipped.
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
