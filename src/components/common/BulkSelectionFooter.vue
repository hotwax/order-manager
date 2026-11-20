<template>
  <ion-footer class="bulk-actions-footer">
    <ion-toolbar>
      <div class="bulk-actions">
        <span class="bulk-selection-count" aria-live="polite">{{ translate('{count} selected', { count }) }}</span>
        <ion-button
          class="bulk-action-more"
          fill="outline"
          aria-haspopup="dialog"
          :disabled="actionsDisabled"
          @click="openBulkActions"
        >
          {{ translate('More actions') }}
        </ion-button>
        <ion-buttons class="bulk-action-buttons">
          <ion-button fill="outline" :disabled="actionsDisabled" @click="exportSelected">
            {{ translate('Export selected CSV') }}
          </ion-button>
          <ion-button
            v-for="action in actions"
            :key="action.id"
            :fill="action.fill || 'outline'"
            :color="action.destructive ? 'danger' : 'primary'"
            :disabled="actionsDisabled || action.disabled"
            @click="action.run"
          >
            {{ action.label }}
          </ion-button>
        </ion-buttons>
      </div>
    </ion-toolbar>
  </ion-footer>
</template>

<script setup lang="ts">
import { commonUtil, logger, translate } from '@common';
import { actionSheetController, IonButton, IonButtons, IonFooter, IonToolbar } from '@ionic/vue';
import { computed, ref } from 'vue';
import { showToast } from '@/utils';

const props = defineProps<{
  count: number;
  disabled?: boolean;
  buildCsv: () => string;
  filename: string;
  actions?: Array<{
    id: string;
    label: string;
    destructive?: boolean;
    disabled?: boolean;
    fill?: 'outline' | 'solid';
    run: () => void | Promise<void>;
  }>;
}>();

const sheetOpen = ref(false);
const actionsDisabled = computed(() => !props.count || props.disabled);

async function exportSelected() {
  if (!props.count || props.disabled) return;
  try {
    const csv = props.buildCsv();
    commonUtil.downloadCsv(`\uFEFF${csv}`, props.filename);
    await showToast(translate('CSV download started.'));
  } catch (err) {
    logger.error(err);
    await showToast(translate('Could not export the selection. Please try again.'));
  }
}

async function openBulkActions() {
  if (sheetOpen.value || actionsDisabled.value) return;
  sheetOpen.value = true;
  try {
    const actions = [...(props.actions ?? [])].sort((a, b) => Number(!!a.destructive) - Number(!!b.destructive));
    const sheet = await actionSheetController.create({
      header: translate('Bulk actions'),
      buttons: [
        // Keep the download inside the tap handler for browsers that require a user gesture.
        { text: translate('Export selected CSV'), handler: () => { void exportSelected(); } },
        ...actions.map((action) => ({
          text: action.label,
          role: action.destructive ? 'destructive' : undefined,
          disabled: action.disabled,
          data: { actionId: action.id }
        })),
        { text: translate('Close'), role: 'cancel' }
      ]
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss();
    if (!props.count || props.disabled) return;
    await props.actions?.find((action) => action.id === data?.actionId && !action.disabled)?.run();
  } finally {
    sheetOpen.value = false;
  }
}
</script>

<style scoped>
.bulk-actions-footer {
  container-type: inline-size;
}

.bulk-actions {
  align-items: center;
  display: flex;
  gap: var(--spacer-xs);
  padding: var(--spacer-xs) var(--spacer-sm);
}

.bulk-selection-count {
  font-weight: 500;
  margin-inline-end: auto;
}

.bulk-action-more {
  display: none;
}

@container (max-width: 900px) {
  .bulk-action-buttons {
    display: none;
  }

  .bulk-action-more {
    display: inline-flex;
  }
}
</style>
