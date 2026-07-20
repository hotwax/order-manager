<template>
  <SearchFilterCard
    :model-value="modelValue.query"
    :placeholder="translate('Order name, order ID, external ID')"
    :show-clear="false"
    @update:modelValue="updateField('query', $event)"
  >
    <UniformFilterLayout @clear="emit('clear')">
      <ion-select
        :value="modelValue.priority"
        label="Priority"
        label-placement="stacked"
        fill="outline"
        interface="popover"
        @ionChange="updateField('priority', $event.detail.value)"
      >
        <ion-select-option :value="null">All priorities</ion-select-option>
        <ion-select-option :value="true">High priority</ion-select-option>
        <ion-select-option :value="false">Normal or no priority</ion-select-option>
      </ion-select>
      <ion-select
        :value="modelValue.salesChannelEnumId"
        label="Sales channel"
        label-placement="stacked"
        fill="outline"
        interface="popover"
        @ionChange="updateField('salesChannelEnumId', $event.detail.value)"
      >
        <ion-select-option value="All">All channels</ion-select-option>
        <ion-select-option v-for="channel in channelOptions" :key="channel.id" :value="channel.id">
          {{ channel.label }}
        </ion-select-option>
      </ion-select>
      <ion-select
        :value="modelValue.facilityId"
        label="Facility"
        label-placement="stacked"
        fill="outline"
        interface="popover"
        @ionChange="updateField('facilityId', $event.detail.value)"
      >
        <ion-select-option value="All">All facilities</ion-select-option>
        <ion-select-option v-for="facility in facilityOptions" :key="facility.id" :value="facility.id">
          {{ facility.label }}
        </ion-select-option>
      </ion-select>
      <ion-select
        :value="modelValue.shipmentMethodTypeId"
        label="Shipping method"
        label-placement="stacked"
        fill="outline"
        interface="popover"
        @ionChange="updateField('shipmentMethodTypeId', $event.detail.value)"
      >
        <ion-select-option value="All">All methods</ion-select-option>
        <ion-select-option v-for="method in shipmentMethodOptions" :key="method.id" :value="method.id">
          {{ method.label }}
        </ion-select-option>
      </ion-select>
      <DateFilterSelect
        :model-value="modelValue.dateFrom"
        :label="translate('Order date from')"
        outlined
        @update:modelValue="updateField('dateFrom', $event)"
      />
      <DateFilterSelect
        :model-value="modelValue.dateThru"
        :label="translate('Order date through')"
        outlined
        @update:modelValue="updateField('dateThru', $event)"
      />
    </UniformFilterLayout>
  </SearchFilterCard>
</template>

<script setup lang="ts">
import { IonSelect, IonSelectOption } from '@ionic/vue';
import { translate } from '@common';
import type { WorkflowFilters } from '@/types/customerService';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import UniformFilterLayout from '@/components/common/UniformFilterLayout.vue';

export interface WorkflowFilterOption {
  id: string;
  label: string;
}

const props = defineProps<{
  modelValue: WorkflowFilters;
  channelOptions: WorkflowFilterOption[];
  facilityOptions: WorkflowFilterOption[];
  shipmentMethodOptions: WorkflowFilterOption[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: WorkflowFilters): void;
  (event: 'clear'): void;
}>();

function updateField<Field extends keyof WorkflowFilters>(field: Field, value: WorkflowFilters[Field]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
}
</script>
