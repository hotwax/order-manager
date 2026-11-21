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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Settings } from 'luxon';
import { emitter, FastTravel, translate, useSessionChangeAlert } from '@common';
import { useAuth } from '@common/composables/useAuth';
import { startAppDbSync } from '@/db/appDbSync';
import Menu from '@/components/layout/Menu.vue';
import router from './router';
import { useUserStore } from '@/store/user';

const loader = ref<HTMLIonLoadingElement | null>(null);
const { isAuthenticated } = useAuth();
const userStore = useUserStore();

// A login elsewhere (another instance, Maarg or user) replaced the shared session cookies: the
// framework stops the sync and asks the user to reload.
useSessionChangeAlert();
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

});

watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    userStore.fetchPermissions().catch(() => undefined);
  }
}, { immediate: true });

// The sync waits for the app permission as well as the session. `isAuthenticated` turns true as
// soon as fetchUserProfile() sets the user, BEFORE fetchPermissions() can reject the login for
// VITE_APP_PERMISSION_ID; a worker started then kept syncing for a user the app turned away.
// `fetchStatus.permissions` is "success" only once the permission passed, is reset in postLogin, and
// is persisted, so a reload still starts the sync (startAppDbSync is idempotent when it re-opens).
const canSync = computed(() => isAuthenticated.value && userStore.fetchStatus.permissions === 'success');
watch(canSync, (ready) => {
  if (ready) void startAppDbSync();
}, { immediate: true });

onUnmounted(() => {
  emitter.off('presentLoader', presentLoader);
  emitter.off('dismissLoader', dismissLoader);
});
</script>
