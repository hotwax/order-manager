<template>
  <EmptyState :title="title" :message="message">
    <template #actions>
      <ion-button v-if="filtered" fill="outline" @click="emit('clear')">
        {{ translate('Clear filters') }}
      </ion-button>

      <ion-button v-else-if="kind === 'hold' && canCreateTasks" fill="outline" @click="emit('start')">
        {{ translate('Find orders') }}
      </ion-button>

      <ion-button v-else-if="kind === 'badAddress' && companyCarrierUrl" fill="outline" :href="companyCarrierUrl">
        {{ translate('Configure address validation in Company') }}
      </ion-button>

      <template v-else-if="kind === 'fraud'">
        <ion-button fill="outline" :href="SHOPIFY_FRAUD_ANALYSIS_URL" target="_blank" rel="noopener noreferrer">
          {{ translate('Shopify fraud analysis') }}
        </ion-button>
        <ion-button fill="clear" :href="SHOPIFY_RISK_FLOW_URL" target="_blank" rel="noopener noreferrer">
          {{ translate('Configure high-risk workflows') }}
        </ion-button>
        <ion-button fill="clear" :href="SHOPIFY_RISK_ASSESSMENT_URL" target="_blank" rel="noopener noreferrer">
          {{ translate('Create custom risk assessments') }}
        </ion-button>
      </template>
    </template>
  </EmptyState>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';
import { computed } from 'vue';
import { translate } from '@common';
import EmptyState from '@/components/common/EmptyState.vue';

type TaskQueueKind = 'badAddress' | 'fraud' | 'hold';

const SHOPIFY_FRAUD_ANALYSIS_URL = 'https://help.shopify.com/en/manual/fulfillment/managing-orders/protecting-orders/fraud-analysis';
const SHOPIFY_RISK_FLOW_URL = 'https://help.shopify.com/en/manual/fulfillment/managing-orders/protecting-orders/shopify-flow';
const SHOPIFY_RISK_ASSESSMENT_URL = 'https://help.shopify.com/en/manual/shopify-flow/reference/actions/create-order-risk-assessment';

const props = withDefaults(defineProps<{
  kind: TaskQueueKind;
  filtered?: boolean;
  canCreateTasks?: boolean;
  companyCarrierUrl?: string | null;
}>(), {
  filtered: false,
  canCreateTasks: false,
  companyCarrierUrl: null,
});

const emit = defineEmits<{
  (event: 'clear'): void;
  (event: 'start'): void;
}>();

const copy = {
  badAddress: {
    title: 'No addresses to review',
    message: 'Orders appear here when automatic address validation cannot verify a shipping address. Address validation must be configured for this product store. FedEx through Unigate is currently supported.',
  },
  fraud: {
    title: 'No fraud reviews',
    message: 'Shopify orders appear here when risk recommends Investigate, or when it recommends Cancel and automatic cancellation is off. Review Shopify fraud-analysis eligibility and configure how high-risk orders should be handled.',
  },
  hold: {
    title: 'No manual holds',
    message: 'Create a hold from an order\'s Holds tab, or select orders in Find Order and choose Add task.',
  },
} as const;

const title = computed(() => translate(props.filtered ? 'No matching tasks' : copy[props.kind].title));
const message = computed(() => translate(props.filtered
  ? 'Clear or adjust the filters to see other open tasks.'
  : copy[props.kind].message));
</script>
