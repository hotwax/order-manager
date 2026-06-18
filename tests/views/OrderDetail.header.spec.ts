import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail header', () => {
  it('matches the Figma identity item status badge pattern', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('<ion-icon slot="start" :icon="ticketOutline" />');
    expect(source).toContain('<ion-badge v-if="order.status" slot="end" :color="commonUtil.getStatusColor(order.statusId)">');
    expect(source).toContain('{{ order.status }}');
    expect(source).not.toContain('<p class="overline">{{ order.status }}</p>');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('matches the Figma order identifications and source card labels', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source.indexOf("translate('Order Number')")).toBeLessThan(source.indexOf("translate('Order ID')"));
    expect(source.indexOf("translate('Order ID')")).toBeLessThan(source.indexOf("translate('Order Name')"));
    expect(source).toContain("{{ order.externalId || translate('Order Number') }}");
    expect(source).toContain("{{ order.orderName || translate('Order Name') }}");
    expect(source).toContain("translate('Brand')");
    expect(source).toContain("translate('Channel')");
    expect(source).not.toContain("translate('Order external ID')");
    expect(source).not.toContain("translate('Product store name')");
    expect(source).not.toContain("translate('Sales channel')");
  });

  it('shows custom order attributes in the header details cards', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const detailsStart = source.indexOf('<div class="order-detail-header-details">');
    const detailsEnd = source.indexOf('<ion-card v-if="riskSummary.hasRiskSignal">');
    const detailsSource = source.slice(detailsStart, detailsEnd);

    expect(detailsStart).toBeGreaterThan(-1);
    expect(detailsEnd).toBeGreaterThan(detailsStart);
    expect(detailsSource).toContain("<ion-card-title>{{ translate('Attributes') }}</ion-card-title>");
    expect(detailsSource).toContain('v-for="attribute in order.attributes"');
    expect(detailsSource).toContain("{{ attribute.value || translate('Value not available') }}");
    expect(detailsSource).toContain("{{ translate('No order attributes') }}");
    expect(source).toContain('attributes: orderAttributeRows(raw)');
    expect(source).toContain('raw?.attributes || raw?.orderAttributes || raw?.orderAttributeList');
  });

  it('shows order header locale context on the customer card', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const customerCardStart = source.indexOf("<ion-card-title>{{ order.customerName || 'Customer name' }}</ion-card-title>");
    const customerCardEnd = source.indexOf("<ion-card-title>{{ translate('Order identifications') }}</ion-card-title>");
    const customerCardSource = source.slice(customerCardStart, customerCardEnd);

    expect(customerCardStart).toBeGreaterThan(-1);
    expect(customerCardEnd).toBeGreaterThan(customerCardStart);
    expect(customerCardSource).toContain("<p>{{ translate('Locale') }}</p>");
    expect(customerCardSource).toContain("{{ order.localeString || translate('Locale not available') }}");
    expect(source).toContain('localeString: raw.localeString || raw.locale');
  });

  it('offers inline actions to fill missing customer card values', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const contactModalSource = readFileSync(resolve(process.cwd(), 'src/components/AddContactModal.vue'), 'utf8');
    const customerCardStart = source.indexOf("<ion-card-title>{{ order.customerName || 'Customer name' }}</ion-card-title>");
    const customerCardEnd = source.indexOf("<ion-card-title>{{ translate('Order identifications') }}</ion-card-title>");
    const customerCardSource = source.slice(customerCardStart, customerCardEnd);

    expect(customerCardSource).toContain("v-if=\"!customer?.email && customerPartyId\"");
    expect(customerCardSource).toContain("@click=\"openCustomerContactModal('EMAIL_ADDRESS', 'ORDER_EMAIL')\"");
    expect(customerCardSource).toContain("v-if=\"!customer?.phone && customerPartyId\"");
    expect(customerCardSource).toContain("@click=\"openCustomerContactModal('TELECOM_NUMBER', 'PHONE_BILLING')\"");
    expect(customerCardSource).toContain("v-if=\"!order.localeString\"");
    expect(customerCardSource).toContain('@click="openLocalePrompt"');
    expect(customerCardSource).toContain("v-if=\"!billingAddress?.lines?.length && customerPartyId\"");
    expect(customerCardSource).toContain("@click=\"openCustomerContactModal('POSTAL_ADDRESS', 'BILLING_LOCATION')\"");
    expect(source).toContain('component: AddContactModal');
    expect(source).toContain('componentProps: { contactMechTypeId, contactMechPurposeTypeId }');
    expect(source).toContain("url: `oms/orders/${order.value.id}`");
    expect(source).toContain("data: { orderId: order.value.id, localeString }");
    expect(contactModalSource).toContain('contactMechPurposeTypeId?: string;');
    expect(contactModalSource).toContain('if (props.contactMechPurposeTypeId) return props.contactMechPurposeTypeId;');
  });

  it('keeps payment anchored in the Items summary without a header copy', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).not.toContain('OrderPaymentCard');
    expect(source).toContain("<ion-card-title>{{ translate('Payment') }}</ion-card-title>");
    expect(source.indexOf("<ion-card-title>{{ translate('Payment') }}</ion-card-title>")).toBeGreaterThan(source.indexOf("selectedSegment === 'items'"));
    expect(source.indexOf("<ion-card-title>{{ translate('Payment') }}</ion-card-title>")).toBeLessThan(source.indexOf("<ion-card class=\"totals\">"));
    expect(source.match(/translate\('Payment'\)/g)).toHaveLength(1);
  });

  it('aligns the item summary cards to the start of the row', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const summaryStyleStart = source.indexOf('.order-summary {');
    const summaryStyleEnd = source.indexOf('.item-key-header,');
    const summaryStyleSource = source.slice(summaryStyleStart, summaryStyleEnd);

    expect(summaryStyleStart).toBeGreaterThan(-1);
    expect(summaryStyleEnd).toBeGreaterThan(summaryStyleStart);
    expect(summaryStyleSource).toContain('align-items: start;');
  });

  it('matches the BOPIS and Fulfillment timeline rail structure', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const timelineStart = source.indexOf('<div class="timeline order-detail-timeline">');
    const timelineEnd = source.indexOf('<!-- details wrapper: child matching .order-detail-header-details -->');
    const timelineSource = source.slice(timelineStart, timelineEnd);

    expect(timelineStart).toBeGreaterThan(-1);
    expect(timelineEnd).toBeGreaterThan(timelineStart);
    expect(timelineSource).toContain('<ion-icon slot="start" :icon="timeOutline" />');
    expect(timelineSource).toContain('<h2>{{ translate(\'Timeline\') }}</h2>');
    expect(timelineSource).toContain('<ion-list class="ion-margin-start">');
    expect(timelineSource).toContain('<ion-item v-for="event in orderTimeline" :key="event.id">');
    expect(timelineSource).toContain('<ion-icon :icon="event.icon" slot="start" />');
    expect(timelineSource).toContain('<p v-if="event.timeDiff">{{ event.timeDiff }}</p>');
    expect(timelineSource).toContain("{{ translate(event.label) }}");
    expect(timelineSource).toContain('<ion-note slot="end" v-if="event.value && event.valueType === \'date-time-millis\'">');
    expect(timelineSource).not.toContain('<ion-list-header>');
  });
});
