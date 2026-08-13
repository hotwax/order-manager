import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('OrderQueueList', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/OrderQueueList.vue'), 'utf8');

  it('renders queue results with the design-system list item row structure', () => {
    expect(source).toContain('<OrderRow');
    expect(source).toContain('row-class="queue-order-row"');
    expect(source).toContain(':model="toSearchOrderRowViewModel(order)"');
    expect(source).toContain("mode: 'queue-first' as const");
    expect(source).toContain('queueFacilityIds: props.facilityIds');
    expect(source).toContain('handleOrderRowClick(order)');
    expect(source).not.toContain('queueReasonLabel(order)');
    expect(source).not.toContain('customerAddressLine(order)');
  });

  it('labels result totals as matching the active queue filters', () => {
    expect(source).toContain('translate("{loaded} of {total} matching orders"');
    expect(source).toContain('total: searchTotal');
    expect(source).not.toContain('translate("{loaded} of {total} orders"');
  });

  it('keeps the row-level navigation behavior while letting checkboxes enter select mode', () => {
    expect(source).toContain(':select-mode="selectMode"');
    expect(source).toContain('@selection-change="setOrderSelection(order.id, $event)"');
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
    expect(source).toContain('<UniformFilterLayout @clear="clearFilters">');
    expect(source).toContain(":label=\"translate('Sales channel')\"");
    expect(source).toContain('fill="outline"');
    expect(source).toContain("translate('All sales channels')");
    expect(source).toContain('v-model="searchFilters.shipmentMethodTypeId"');
    expect(source).toContain(":label=\"translate('Shipping method')\"");
    expect(source).toContain("translate('All methods')");
    expect(source).toContain('<DateFilterSelect');
    expect(source).toContain('v-model="searchFilters.dateFrom"');
    expect(source).toContain(":label=\"translate('Order date from')\"");
    expect(source).toContain('v-model="searchFilters.dateThru"');
    expect(source).toContain(":label=\"translate('Order date through')\"");
    expect(source).toContain('outlined');
    expect(source).toContain('shipmentMethodTypeId: searchFilters.value.shipmentMethodTypeId');
    expect(source).toContain('dateFrom?: string;');
    expect(source).toContain("dateFrom: props.dateFrom || ''");
    expect(source).not.toContain('statusTriggerId');
    expect(source).not.toContain('All statuses');
    expect(source).not.toContain('Sort by order date');
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('<h3>');
    expect(source).not.toContain("import router from '@/router';");
  });
});
