import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('OrderQueueList', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/OrderQueueList.vue'), 'utf8');

  it('renders queue results with the design-system list item row structure', () => {
    expect(source).toContain('class="list-item queue-order-row"');
    expect(source).toContain('<p class="overline">{{ order.id }}</p>');
    expect(source).toContain('customerAddressLine(order)');
    expect(source).toContain('queueReasonLabel(order)');
    expect(source).toContain('estimatedDeliveryDateLabel(order)');
    expect(source).toContain('handleOrderRowClick(order)');
    expect(source).not.toContain('<ion-badge :color="statusColor(order.status)" slot="end">');
  });

  it('keeps the row-level navigation behavior while letting checkboxes enter select mode', () => {
    expect(source).toContain(':role="selectMode ? \'button\' : \'link\'"');
    expect(source).toContain('ionRouter.push(orderDetailLink(order));');
    expect(source).toContain('selectMode.value = true;');
  });

  it('offers optional bulk brokering for selected virtual ship groups', () => {
    const unfillableSource = readFileSync(resolve(process.cwd(), 'src/views/UnfillableOrders.vue'), 'utf8');

    expect(unfillableSource).toContain(':global-actions="[\'brokerSelected\']"');
    expect(source).toContain("hasGlobalAction('brokerSelected')");
    expect(source).toContain("{{ translate('Broker selected') }}");
    expect(source).toContain('component: RoutingGroupModal');
    expect(source).toContain('brokerableShipGroupsForOrders(orderIds)');
    expect(source).toContain('fetchOrderShipGroups(orderId)');
    expect(source).toContain('.filter(isVirtualShipGroup)');
    expect(source).toContain('orderTaskStore.brokerShipGroup({');
    expect(source).toContain("url: `oms/orders/${orderId}/shipGroups`");
  });

  it('uses sales channel, shipping method, and shared date filters for queue search', () => {
    expect(source).toContain('label="Sales channel"');
    expect(source).toContain('<ion-select-option value="All">All sales channels</ion-select-option>');
    expect(source).toContain('v-model="searchFilters.shipmentMethodTypeId"');
    expect(source).toContain('label="Shipping method"');
    expect(source).toContain('<ion-select-option value="All">All methods</ion-select-option>');
    expect(source).toContain('<DateFilterSelect v-model="searchFilters.dateFrom" :label="translate(\'Order date from\')" />');
    expect(source).toContain('<DateFilterSelect v-model="searchFilters.dateThru" :label="translate(\'Order date thru\')" />');
    expect(source).toContain('shipmentMethodTypeId: searchFilters.value.shipmentMethodTypeId');
    expect(source).not.toContain('statusTriggerId');
    expect(source).not.toContain('All statuses');
    expect(source).not.toContain('Sort by order date');
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('<h3>');
  });
});
