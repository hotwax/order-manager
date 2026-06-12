<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>{{ translate('Payment') }}</ion-card-title>
    </ion-card-header>
    <ion-list lines="none">
      <ion-item v-for="(payment, index) in payments" :key="payment.id || `${payment.paymentMethodTypeId}-${index}`">
        <ion-label>
          <p class="overline">{{ payment.paymentMethodTypeId || payment.method }}</p>
          {{ payment.paymentMethodTypeDesc || payment.method }}
          <p>{{ payment.statusDesc || payment.status || payment.statusId }}</p>
        </ion-label>
        <ion-note slot="end">{{ money(payment.amount) }}</ion-note>
      </ion-item>
      <ion-item v-if="!payments.length">
        <ion-label>{{ translate('No payment preference records') }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardTitle, IonItem, IonLabel, IonList, IonNote } from '@ionic/vue';
import { commonUtil, translate } from '@common';

const props = withDefaults(defineProps<{
  payments?: any[];
  currency?: string;
}>(), {
  payments: () => [],
  currency: 'USD',
});

function money(value: number) {
  return commonUtil.formatCurrency(value, props.currency);
}
</script>
