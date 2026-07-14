<template>
  <SearchFilterCard
    :model-value="modelValue.query"
    :placeholder="translate('Order name')"
    :show-clear="false"
    @update:modelValue="updateField('query', $event)"
    @search="emit('search')"
  >
    <UniformFilterLayout @clear="emit('clear')">
      <ion-select
        :value="modelValue.salesChannelEnumId"
        :label="translate('Sales channel')"
        label-placement="stacked"
        fill="outline"
        interface="popover"
        @ionChange="updateField('salesChannelEnumId', $event.detail.value)"
      >
        <ion-select-option value="All">{{ translate('All channels') }}</ion-select-option>
        <ion-select-option v-for="channel in channelOptions" :key="channel.id" :value="channel.id">
          {{ channel.label }}
        </ion-select-option>
      </ion-select>

      <DateFilterSelect
        :model-value="modelValue.orderDateFrom"
        :label="translate('Order date from')"
        outlined
        @update:modelValue="updateField('orderDateFrom', $event)"
      />
      <DateFilterSelect
        :model-value="modelValue.orderDateThru"
        :label="translate('Order date through')"
        outlined
        @update:modelValue="updateField('orderDateThru', $event)"
      />
      <DateFilterSelect
        :model-value="modelValue.taskCreatedFrom"
        :label="translate('Task created from')"
        outlined
        @update:modelValue="updateField('taskCreatedFrom', $event)"
      />
      <DateFilterSelect
        :model-value="modelValue.taskCreatedThru"
        :label="translate('Task created through')"
        outlined
        @update:modelValue="updateField('taskCreatedThru', $event)"
      />

      <template v-if="showShipGroupFilters">
        <ion-select
          :value="modelValue.facilityId"
          :label="translate('Facility')"
          label-placement="stacked"
          fill="outline"
          interface="popover"
          @ionChange="updateField('facilityId', $event.detail.value)"
        >
          <ion-select-option value="All">{{ translate('All facilities') }}</ion-select-option>
          <ion-select-option v-for="facility in facilityOptions" :key="facility.id" :value="facility.id">
            {{ facility.label }}
          </ion-select-option>
        </ion-select>
        <ion-select
          :value="modelValue.shipmentMethodTypeId"
          :label="translate('Shipping method')"
          label-placement="stacked"
          fill="outline"
          interface="popover"
          @ionChange="updateField('shipmentMethodTypeId', $event.detail.value)"
        >
          <ion-select-option value="All">{{ translate('All methods') }}</ion-select-option>
          <ion-select-option v-for="method in shipmentMethodOptions" :key="method.id" :value="method.id">
            {{ method.label }}
          </ion-select-option>
        </ion-select>
      </template>

      <template v-if="showFraudFilters">
        <ion-select
          :value="modelValue.orderStatusId"
          :label="translate('Order status')"
          label-placement="stacked"
          fill="outline"
          interface="popover"
          @ionChange="updateField('orderStatusId', $event.detail.value)"
        >
          <ion-select-option value="All">{{ translate('All statuses') }}</ion-select-option>
          <ion-select-option v-for="status in orderStatusOptions" :key="status.id" :value="status.id">
            {{ status.label }}
          </ion-select-option>
        </ion-select>
        <ion-select
          :value="modelValue.riskRecommendationEnumId"
          :label="translate('Risk recommendation')"
          label-placement="stacked"
          fill="outline"
          interface="popover"
          @ionChange="updateField('riskRecommendationEnumId', $event.detail.value)"
        >
          <ion-select-option value="All">{{ translate('All recommendations') }}</ion-select-option>
          <ion-select-option v-for="recommendation in riskRecommendationOptions" :key="recommendation.id" :value="recommendation.id">
            {{ recommendation.label }}
          </ion-select-option>
        </ion-select>
        <ion-select
          :value="modelValue.riskLevelEnumId"
          :label="translate('Risk level')"
          label-placement="stacked"
          fill="outline"
          interface="popover"
          @ionChange="updateField('riskLevelEnumId', $event.detail.value)"
        >
          <ion-select-option value="All">{{ translate('All risk levels') }}</ion-select-option>
          <ion-select-option v-for="level in riskLevelOptions" :key="level.id" :value="level.id">
            {{ level.label }}
          </ion-select-option>
        </ion-select>
      </template>
    </UniformFilterLayout>
  </SearchFilterCard>
</template>

<script setup lang="ts">
import { IonSelect, IonSelectOption } from '@ionic/vue';
import { translate } from '@common';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import UniformFilterLayout from '@/components/common/UniformFilterLayout.vue';
import type { OrderTaskFilters, TaskFilterOption } from '@/types/orderTaskFilters';

const props = withDefaults(defineProps<{
  modelValue: OrderTaskFilters;
  channelOptions: TaskFilterOption[];
  facilityOptions?: TaskFilterOption[];
  shipmentMethodOptions?: TaskFilterOption[];
  orderStatusOptions?: TaskFilterOption[];
  riskRecommendationOptions?: TaskFilterOption[];
  riskLevelOptions?: TaskFilterOption[];
  showShipGroupFilters?: boolean;
  showFraudFilters?: boolean;
}>(), {
  facilityOptions: () => [],
  shipmentMethodOptions: () => [],
  orderStatusOptions: () => [],
  riskRecommendationOptions: () => [],
  riskLevelOptions: () => [],
  showShipGroupFilters: false,
  showFraudFilters: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: OrderTaskFilters): void;
  (event: 'search'): void;
  (event: 'clear'): void;
}>();

function updateField<Field extends keyof OrderTaskFilters>(field: Field, value: OrderTaskFilters[Field]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
}
</script>
