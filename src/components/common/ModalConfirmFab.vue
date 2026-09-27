<template>
  <ion-fab vertical="bottom" horizontal="end" slot="fixed">
    <ion-fab-button :disabled="!flow.canConfirm || flow.busy" :aria-label="label ?? translate('Save')" @click="flow.confirm()">
      <ion-spinner v-if="flow.saving" name="crescent" />
      <ion-icon v-else :icon="icon ?? saveOutline" />
    </ion-fab-button>
  </ion-fab>
</template>

<script setup lang="ts">
import { IonFab, IonFabButton, IonIcon, IonSpinner } from '@ionic/vue';
import { saveOutline } from 'ionicons/icons';
import { translate } from '@common';
import { injectModalFlow } from '@/composables/useModalFlow';

/** The modal's confirm path, as the bottom-end FAB inside its ion-content. Save unless it says otherwise. */
defineProps<{ label?: string; icon?: string }>();

const flow = injectModalFlow();
</script>
