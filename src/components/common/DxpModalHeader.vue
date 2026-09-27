<template>
  <ion-header ref="header">
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button :disabled="flow.saving" @click="flow.exit()" :aria-label="translate('Close')" :title="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ title }}</ion-title>
    </ion-toolbar>
    <!-- More toolbars, such as a searchbar or segments, go under the title. -->
    <slot />
  </ion-header>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { translate } from '@common';
import { injectModalFlow } from '@/composables/useModalFlow';

/** The modal's exit path: the close button, and every other way out through the flow's guard. */
defineProps<{ title: string }>();

const flow = injectModalFlow();
const header = ref();
onMounted(() => flow.attach(header.value?.$el));
</script>
