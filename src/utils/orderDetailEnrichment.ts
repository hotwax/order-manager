import { commonUtil, translate } from '@common';
import {
  arrowUndoOutline,
  checkmarkDoneOutline,
  closeCircleOutline,
  compassOutline,
  downloadOutline,
  pauseCircleOutline,
  pulseOutline,
  storefrontOutline,
  sunnyOutline,
  swapHorizontalOutline,
  warningOutline,
} from 'ionicons/icons';
import { OrderActionValidator } from './OrderActionValidator';
import { shipGroupItemStates as itemStatesFor } from './shipGroupItemStates';
import { rollUpItemStatuses } from './itemStatusBadges';
import { sentimentCounts } from './index';
import { isInventoryTransferEligibleItem } from '@/services/inventoryTransfers';
import type {
  EnrichedOrder,
  EnrichedOrderAdjustmentRow,
  EnrichedOrderItem,
  EnrichedOrderPayments,
  EnrichedOrderRisk,
  EnrichedOrderTimelineEvent,
  EnrichedOrderTotals,
  EnrichedShipGroup,
  IssuanceBadge,
  ItemActionCapabilities,
  ShipGroupActionCapabilities,
} from '@/types/orderDetail';

const PAYMENT_COLLECTED_STATUSES = new Set(['PAYMENT_AUTHORIZED', 'PAYMENT_SETTLED', 'PAYMENT_RECEIVED']);

const FACILITY_CHANGE_LABELS: Record<string, string> = {
  BROKERED: 'Brokered',
  ALLOCATED: 'Allocated',
  RELEASED: 'Released',
  PARKED: 'Parked',
};

const FACILITY_CHANGE_ICONS: Record<string, string> = {
  BROKERED: compassOutline,
  ALLOCATED: compassOutline,
  RELEASED: storefrontOutline,
  PARKED: pauseCircleOutline,
};

function timelineMillis(value: any): number | undefined {
  if (!value) return undefined;
  const millis = commonUtil.parseDateTimeValue(value)?.toMillis();
  return Number.isFinite(millis) ? millis : undefined;
}

function findTimeDiff(startMillis?: number, endMillis?: number): string | undefined {
  if (!startMillis || !endMillis || endMillis <= startMillis) return undefined;
  const diffMs = endMillis - startMillis;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

export interface EnrichmentAuxiliaryData {
  facilityChanges?: any[];
  unfillable?: { count: number; atLeast: boolean; lastAttemptDate: string } | null;
  issuanceByItem?: Record<string, any> | null;
  riskAssessments?: any[];
  timelineByShipGroup?: Record<string, any>;
  returnedQtyBySeqId?: Record<string, number>;
  exchangeChildren?: Array<{ orderId: string; itemCount: number; facilityName: string; value: number }>;
  returnHeadersById?: Record<string, any>;
  shopifyAdminUrl?: string;
}

export interface EnrichmentStores {
  seedStore: any;
  productCache: any;
}

export function isVirtualFacility(facilityId: string, seedStore: any): boolean {
  if (!facilityId || facilityId === '_NA_') return true;
  const facility = seedStore.facility?.(facilityId);
  const facilityTypeId = facility?.facilityTypeId;
  const parentTypeId = seedStore.facilityType?.(facilityTypeId)?.parentTypeId;
  return facilityTypeId === 'VIRTUAL_FACILITY' || parentTypeId === 'VIRTUAL_FACILITY';
}

export function isPosCompletedShipGroup(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

export function calculateShipGroupProgress(
  shipGroup: any,
  isBrokered: boolean,
  timelineEntry: any,
  itemStates: { total: number; fulfilled: number; settled: boolean }
): number {
  if (isPosCompletedShipGroup(shipGroup)) return 1;
  if (itemStates.settled) return itemStates.total ? itemStates.fulfilled / itemStates.total : 0;

  let progress = 0;
  if (isBrokered) progress += 0.25;
  if (timelineEntry?.picklistDate) progress += 0.25;
  if (timelineEntry?.packedDate) progress += 0.25;
  if (timelineEntry?.shippedDate) progress += 0.25;
  return progress;
}

export function calculateShipGroupStatusLabel(
  shipGroup: any,
  isVirtual: boolean,
  itemStates: { total: number; fulfilled: number; settled: boolean },
  progress: number
): string {
  if (isPosCompletedShipGroup(shipGroup)) return translate('Sold in store');

  const { total, fulfilled, settled } = itemStates;
  if (settled && fulfilled === 0) return translate('Cancelled');
  if (settled && fulfilled < total) return translate('Partially complete');

  if (!settled && isVirtual) return translate('Not Brokered');

  return `${Math.round(progress * 100)}% ${translate('Complete')}`;
}

export function calculatePaymentSummary(
  rawOrder: any,
  returnedQtyBySeqId: Record<string, number>,
  seedStore?: any
): EnrichedOrderPayments {
  const rawList = rawOrder?.paymentPreferences || [];

  const list: any[] = rawList.map((payment: any) => ({
    id: payment.orderPaymentPreferenceId,
    paymentMethodTypeId: payment.paymentMethodTypeId,
    paymentMethodTypeDesc: seedStore?.paymentMethodDescription?.(payment.paymentMethodTypeId) || payment.paymentMethodTypeId || '',
    amount: Number(payment.maxAmount ?? payment.presentmentAmount ?? payment.amount ?? 0),
    statusId: payment.statusId,
    statusDesc: seedStore?.statusDescription?.(payment.statusId) || payment.statusId || '',
    createdDate: payment.createdDate || payment.createdStamp,
    parentRefNum: payment.parentRefNum || '',
  }));

  const receivedTotal = rawList.reduce((sum: number, payment: any) => {
    return PAYMENT_COLLECTED_STATUSES.has(payment.statusId)
      ? sum + Number(payment.maxAmount ?? payment.presentmentAmount ?? payment.amount ?? 0)
      : sum;
  }, 0);

  const netAmount = rawList.reduce((sum: number, payment: any) => {
    const amt = Number(payment.maxAmount ?? payment.presentmentAmount ?? payment.amount ?? 0);
    if (PAYMENT_COLLECTED_STATUSES.has(payment.statusId)) return sum + amt;
    if (payment.statusId === 'PAYMENT_REFUNDED') return sum - amt;
    return sum;
  }, 0);

  const roundedReceived = Math.round(receivedTotal * 100) / 100;
  const roundedNet = Math.round(netAmount * 100) / 100;

  // Sections grouped by status
  const sectionsMap: Record<string, { statusId: string; label: string; payments: any[]; total: number }> = {};
  const sections: Array<{ statusId: string; label: string; payments: any[]; total: number }> = [];

  list.forEach((payment: any) => {
    const statusId = payment.statusId || 'UNKNOWN';
    if (!sectionsMap[statusId]) {
      sectionsMap[statusId] = {
        statusId,
        label: payment.statusDesc || payment.status || statusId,
        payments: [],
        total: 0,
      };
      sections.push(sectionsMap[statusId]);
    }
    sectionsMap[statusId].payments.push(payment);
    sectionsMap[statusId].total += payment.amount;
  });

  sections.forEach((sec) => {
    sec.total = Math.round(sec.total * 100) / 100;
  });

  sections.sort((left, right) =>
    Number(left.statusId === 'PAYMENT_REFUNDED') - Number(right.statusId === 'PAYMENT_REFUNDED')
  );

  // Check if all non-cancelled items are returned
  const allItems = (rawOrder?.shipGroups || []).flatMap((sg: any) => sg.items || []);
  const nonCancelled = allItems.filter((i: any) => i.statusId !== 'ITEM_CANCELLED');
  const allItemsReturned =
    nonCancelled.length > 0 &&
    nonCancelled.every((item: any) => (returnedQtyBySeqId[item.orderItemSeqId] || 0) >= Number(item.quantity || 0));

  let netColor: 'danger' | 'warning' | undefined;
  if (roundedNet < 0) netColor = 'danger';
  else if (roundedNet > 0 && allItemsReturned) netColor = 'warning';

  Object.assign(list, {
    rawList,
    receivedTotal: roundedReceived,
    netAmount: roundedNet,
    netColor,
    sections,
    allItemsReturned,
  });

  return list as EnrichedOrderPayments;
}

export function orderAttributeRows(raw: any) {
  return (raw?.attributes || raw?.orderAttributes || raw?.orderAttributeList || [])
    .map((attribute: any, index: number) => {
      const name = attribute.name ?? attribute.attrName ?? attribute.attributeName ?? attribute.orderAttributeName ?? attribute.orderAttributeTypeId;
      const value = attribute.value ?? attribute.attrValue ?? attribute.attributeValue ?? attribute.orderAttributeValue;
      return {
        id: attribute.orderAttributeId || attribute.id || `${name || 'attribute'}-${index}`,
        name: name || '',
        value: value != null ? String(value) : '',
        description: attribute.attrDescription || attribute.description || '',
      };
    });
}

export function calculateRiskSummary(rawOrder: any, riskAssessments: any[], seedStore: any): EnrichedOrderRisk {
  const recommendationEnumId = rawOrder?.riskRecommendationEnumId || '';
  const levelEnumId = rawOrder?.riskLevelEnumId || '';
  const facts = riskAssessments.flatMap((r: any) => r.facts || []);
  const counts = sentimentCounts(facts);

  return {
    hasRiskSignal: Boolean(recommendationEnumId || levelEnumId),
    recommendation: recommendationEnumId ? seedStore.enumDescription(recommendationEnumId) : translate('No recommendation'),
    level: levelEnumId ? seedStore.enumDescription(levelEnumId) : translate('No risk level'),
    facts,
    counts,
    factCount: facts.length,
  };
}

export function buildOrderTimeline(
  rawOrder: any,
  auxiliaryData: EnrichmentAuxiliaryData,
  stores: EnrichmentStores
): EnrichedOrderTimelineEvent[] {
  const timeline: EnrichedOrderTimelineEvent[] = [];
  const usedStatusIds = new Set<string>();

  const orderDate = timelineMillis(rawOrder.orderDate);
  const entryDate = timelineMillis(rawOrder.entryDate);

  if (orderDate) {
    timeline.push({
      id: 'orderDate',
      label: 'Created in Shopify',
      value: orderDate,
      icon: sunnyOutline,
      valueType: 'date-time-millis',
    });
    usedStatusIds.add('ORDER_CREATED');
  }

  // Exchanges from
  const exchangeSourceOrderIds = [
    ...new Set(
      (rawOrder.itemAssocs || [])
        .filter((assoc: any) => assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== rawOrder.orderId)
        .map((assoc: any) => assoc.toOrderId as string)
    ),
  ];
  exchangeSourceOrderIds.forEach((toOrderId) => {
    const assoc = (rawOrder.itemAssocs || []).find((row: any) => row.toOrderId === toOrderId);
    timeline.push({
      id: `exchange-${toOrderId}`,
      label: 'Exchanged from',
      value: timelineMillis(assoc?.createdStamp) || orderDate,
      icon: swapHorizontalOutline,
      valueType: 'date-time-millis',
      metaData: toOrderId,
      route: `/orders/${toOrderId}`,
    });
  });

  // Returns raised
  const returnGroups: Record<string, { count: number; value: number }> = {};
  (rawOrder.returnItems || []).forEach((item: any) => {
    if (!item.returnId) return;
    if (!returnGroups[item.returnId]) returnGroups[item.returnId] = { count: 0, value: 0 };
    const group = returnGroups[item.returnId];
    group.count += Number(item.returnQuantity || 0) || 1;
    const created = timelineMillis(item.createdStamp);
    if (created && (!group.value || created < group.value)) group.value = created;
  });

  Object.entries(returnGroups).forEach(([returnId, group]) => {
    const facilityId = auxiliaryData.returnHeadersById?.[returnId]?.destinationFacilityId;
    const facilityName = facilityId ? stores.seedStore.facilityName(facilityId) : '';
    const itemWord = group.count === 1 ? translate('item') : translate('items');
    const value = group.value || orderDate;
    timeline.push({
      id: `return-${returnId}`,
      label: 'Return created',
      value,
      icon: arrowUndoOutline,
      valueType: 'date-time-millis',
      timeDiff: findTimeDiff(orderDate, value),
      metaData: facilityName
        ? `${group.count} ${itemWord} ${translate('returned at')} ${facilityName}`
        : `${group.count} ${itemWord} ${translate('returned')}`,
      route: `/returns/${returnId}`,
    });
  });

  // Reverse exchanges
  (auxiliaryData.exchangeChildren || []).forEach((child) => {
    const itemWord = child.itemCount === 1 ? translate('item') : translate('items');
    const value = child.value || orderDate;
    timeline.push({
      id: `exchange-child-${child.orderId}`,
      label: 'Exchange created',
      value,
      icon: swapHorizontalOutline,
      valueType: 'date-time-millis',
      timeDiff: findTimeDiff(orderDate, value),
      metaData: child.facilityName
        ? `${child.itemCount} ${itemWord} ${translate('purchased in exchange at')} ${child.facilityName}`
        : `${child.itemCount} ${itemWord} ${translate('purchased in exchange')}`,
      route: `/orders/${child.orderId}`,
    });
  });

  if (entryDate) {
    timeline.push({
      id: 'entryDate',
      label: 'Imported from Shopify',
      value: entryDate,
      icon: downloadOutline,
      valueType: 'date-time-millis',
      timeDiff: findTimeDiff(orderDate, entryDate),
    });
  }

  // Header statuses (approved, completed, etc.)
  const headerStatuses = (rawOrder.statuses || []).filter(
    (s: any) => !s.orderItemSeqId || s.orderItemSeqId === '_NA_'
  );

  const approvedStatus = headerStatuses.find((s: any) => s.statusId === 'ORDER_APPROVED' || s.statusId === 'ORDER_ACCEPTED');
  if (approvedStatus) {
    const approvedDate = timelineMillis(approvedStatus.statusDatetime);
    if (approvedDate) {
      timeline.push({
        id: 'approvedDate',
        label: 'Approved for fulfillment',
        value: approvedDate,
        icon: checkmarkDoneOutline,
        valueType: 'date-time-millis',
        timeDiff: findTimeDiff(orderDate, approvedDate),
      });
      usedStatusIds.add('ORDER_APPROVED');
      usedStatusIds.add('ORDER_ACCEPTED');
    }
  }

  const completedStatus = headerStatuses.find((s: any) => s.statusId === 'ORDER_COMPLETED');
  if (completedStatus) {
    const completedDate = timelineMillis(completedStatus.statusDatetime);
    if (completedDate) {
      timeline.push({
        id: 'completedDate',
        label: 'Order completed',
        value: completedDate,
        icon: pulseOutline,
        valueType: 'date-time-millis',
        timeDiff: findTimeDiff(orderDate, completedDate),
      });
      usedStatusIds.add('ORDER_COMPLETED');
    }
  }

  // Facility change events
  (auxiliaryData.facilityChanges || []).forEach((event: any) => {
    const itemWord = event.itemCount === 1 ? translate('item') : translate('items');
    const knownMove = FACILITY_CHANGE_LABELS[event.changeReasonEnumId];
    const isRejection = !knownMove && !!event.changeReasonEnumId;
    const facilityId = isRejection ? event.fromFacilityId : event.facilityId;
    const facilityName = facilityId ? stores.seedStore.facilityName(facilityId) : '';
    const direction = isRejection ? translate('from') : translate('to');

    timeline.push({
      id: `facility-change-${event.id}`,
      label: knownMove || (isRejection ? 'Rejected' : 'Facility changed'),
      value: event.value,
      icon: FACILITY_CHANGE_ICONS[event.changeReasonEnumId] || (isRejection ? closeCircleOutline : compassOutline),
      valueType: 'date-time-millis',
      timeDiff: findTimeDiff(orderDate, event.value),
      metaData: [
        `${event.itemCount} ${itemWord}`,
        facilityName ? `${direction} ${facilityName}` : '',
        isRejection ? stores.seedStore.enumDescription(event.changeReasonEnumId) : '',
        event.changeUserLogin,
      ]
        .filter(Boolean)
        .join(' - '),
    });
  });

  // Unfillable brokering attempts
  const unfillable = auxiliaryData.unfillable;
  const lastUnfillableDate = timelineMillis(unfillable?.lastAttemptDate);
  if (unfillable && lastUnfillableDate) {
    timeline.push({
      id: 'unfillable-attempts',
      label: 'Brokering could not fill',
      value: lastUnfillableDate,
      icon: warningOutline,
      valueType: 'date-time-millis',
      timeDiff: findTimeDiff(orderDate, lastUnfillableDate),
      metaData: `${unfillable.count}${unfillable.atLeast ? '+' : ''} ${
        unfillable.count === 1 ? translate('attempt') : translate('attempts')
      }`,
    });
  }

  // Remaining header statuses
  headerStatuses
    .filter((status: any) => status.statusId && !usedStatusIds.has(status.statusId))
    .forEach((status: any) => {
      const value = timelineMillis(status.statusDatetime);
      if (!value) return;

      timeline.push({
        id: status.orderStatusId || `${status.statusId}-${status.statusDatetime}`,
        label: stores.seedStore.statusDescription(status.statusId),
        value,
        icon: pulseOutline,
        valueType: 'date-time-millis',
        timeDiff: findTimeDiff(orderDate, value),
        metaData: [status.statusUserLogin, status.changeReason ? stores.seedStore.describe(status.changeReason) : '']
          .filter(Boolean)
          .join(' - '),
      });
    });

  return timeline.sort((left, right) => {
    if (left.value === right.value) return 0;
    if (left.value == undefined) return 1;
    if (right.value == undefined) return -1;
    return left.value - right.value;
  });
}

export function enrichOrder(
  rawOrder: any,
  auxiliaryData: EnrichmentAuxiliaryData,
  stores: EnrichmentStores
): EnrichedOrder {
  const { seedStore, productCache } = stores;
  const returnedQtyBySeqId = auxiliaryData.returnedQtyBySeqId || {};

  // Resolve customer contacts
  const contactMechs = rawOrder.contactMechs || [];
  const findContact = (typeId: string, purposes: string[]) =>
    contactMechs.find((m: any) => m.contactMechTypeId === typeId && purposes.includes(m.contactMechPurposeTypeId));

  const emailMech = findContact('EMAIL_ADDRESS', ['ORDER_EMAIL', 'PRIMARY_EMAIL']);
  const phoneMech = findContact('TELECOM_NUMBER', ['PHONE_BILLING', 'PRIMARY_PHONE', 'PHONE_SHIPPING', 'PHONE_MOBILE']);
  const billingMech = findContact('POSTAL_ADDRESS', ['BILLING_LOCATION']);

  const placingRole = (rawOrder.roles || []).find((r: any) => r.roleTypeId === 'PLACING_CUSTOMER');
  const person = placingRole?.person;
  const customerName =
    person && (person.firstName || person.lastName)
      ? [person.firstName, person.lastName].filter(Boolean).join(' ')
      : placingRole?.partyGroup?.groupName ||
        contactMechs.find((m: any) => m.contactMechPurposeTypeId === 'SHIPPING_LOCATION')?.postalAddress?.toName ||
        '';

  const billingLines: string[] = [];
  if (billingMech?.postalAddress) {
    const pa = billingMech.postalAddress;
    if (pa.toName) billingLines.push(pa.toName);
    if (pa.address1) billingLines.push(pa.address1);
    if (pa.address2) billingLines.push(pa.address2);
    const cityStateZip = [pa.city, pa.stateProvinceGeoId, pa.postalCode].filter(Boolean).join(', ');
    if (cityStateZip) billingLines.push(cityStateZip);
    if (pa.countryGeoId) billingLines.push(pa.countryGeoId);
  }

  // Pre-enrich ship groups and items
  const shipGroups: EnrichedShipGroup[] = (rawOrder.shipGroups || []).map((sg: any) => {
    const isVirtual = isVirtualFacility(sg.facilityId, seedStore);
    const isPosCompleted = isPosCompletedShipGroup(sg);
    const itemStates = itemStatesFor(sg.items);
    const isReadOnly = itemStates.settled;

    const timelineEntry = auxiliaryData.timelineByShipGroup?.[sg.shipGroupSeqId];
    const isBrokered = !isVirtual || Boolean(timelineEntry?.firstBrokeredDate || timelineEntry?.firstReleasedDate);
    const progress = calculateShipGroupProgress(sg, isBrokered, timelineEntry, itemStates);
    const statusLabel = calculateShipGroupStatusLabel(sg, isVirtual, itemStates, progress);
    const facilityName = seedStore.facilityName(sg.facilityId) || sg.facilityName || '';
    const headerTitle = `${sg.shipGroupSeqId} ${facilityName || translate('Facility Name')}`;

    // Item Action Context & Validation
    const enrichedItems: EnrichedOrderItem[] = (sg.items || []).map((item: any) => {
      const product = productCache.getProduct(item.productId);
      const name = product?.parentProductName || product?.productName || item.itemDescription || item.productId;
      const sku = product?.sku || item.productId;
      const imageUrl = product?.mainImageUrl || '';
      const returnedQty = returnedQtyBySeqId[item.orderItemSeqId] || 0;
      const returnableQty = Math.max(0, Number(item.quantity || 0) - returnedQty);
      const status = seedStore.statusDescription(item.statusId);
      const statusColor = commonUtil.getStatusColor ? commonUtil.getStatusColor(item.statusId) : 'medium';

      let issuanceBadge: IssuanceBadge | undefined = undefined;
      if (isPosCompleted && auxiliaryData.issuanceByItem) {
        const summary = auxiliaryData.issuanceByItem[item.orderItemSeqId];
        const ordered = Number(item.quantity || 0);
        const issued = summary?.issued || 0;
        const stock = { qohBefore: summary?.qohBefore ?? 0, qohAfter: summary?.qohAfter ?? 0 };

        if (issued <= 0) issuanceBadge = { label: translate('Inventory not issued'), tone: 'warning', ...stock };
        else if (ordered && issued < ordered) issuanceBadge = { label: translate('Inventory partly issued'), tone: 'warning', ...stock };
        else issuanceBadge = { label: translate('Inventory issued'), tone: 'success', ...stock };
      }

      const isTransferEligible = isInventoryTransferEligibleItem(
        { productId: item.productId, statusId: item.statusId, quantity: item.quantity },
        isVirtual
      );

      // Item action context for OrderActionValidator
      const itemContext = {
        isVirtual,
        itemAllowedToStatusIds: new Set(seedStore.allowedTransitions(item.statusId).map((t: any) => t.toStatusId)),
        allItems: (rawOrder.shipGroups || []).flatMap((g: any) => g.items || []),
      };

      const cancelValidation = OrderActionValidator.validateItemAction(rawOrder, item, 'CANCEL_ITEM', itemContext);

      const facilityActionValidation = isVirtual
        ? OrderActionValidator.validateShipGroupAction(rawOrder, sg, 'RELEASE', [item], { isVirtual, allItems: itemContext.allItems })
        : OrderActionValidator.validateItemAction(rawOrder, item, 'REJECT_AND_RELEASE', itemContext);

      const actions: ItemActionCapabilities = {
        canCancel: cancelValidation.allowed,
        cancelReason: cancelValidation.reason,
        canTransfer: isTransferEligible,
        canRejectAndRelease: facilityActionValidation.allowed,
      };

      return {
        orderItemSeqId: item.orderItemSeqId,
        id: item.orderItemSeqId,
        externalId: item.externalId || sku || item.orderItemSeqId,
        productId: item.productId,
        sku,
        name,
        imageUrl,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        returnedQty,
        returnableQty,
        statusId: item.statusId,
        status,
        statusColor,
        shipGroupSeqId: sg.shipGroupSeqId,
        facilityId: sg.facilityId,
        facilityName,
        attributes: item.orderItemAttributes || item.attributes || [],
        attributeCount: (item.orderItemAttributes || item.attributes || []).length,
        adjustments: (item.adjustments || []).map((adj: any) => ({
          comment: adj.comments || adj.description || seedStore.orderAdjustmentTypeDescription(adj.orderAdjustmentTypeId) || '',
          amount: Number(adj.amount || 0),
        })),
        actions,
        issuanceBadge,
      };
    });

    // Ship Group Action Capabilities
    const sgContext = {
      isVirtual,
      allItems: (rawOrder.shipGroups || []).flatMap((g: any) => g.items || []),
    };

    const actions: ShipGroupActionCapabilities = {
      canCancel: OrderActionValidator.validateShipGroupAction(rawOrder, sg, 'CANCEL', enrichedItems, sgContext).allowed,
      canRelease: OrderActionValidator.validateShipGroupAction(rawOrder, sg, 'RELEASE', enrichedItems, sgContext).allowed,
      canReassignFacility: OrderActionValidator.validateShipGroupAction(rawOrder, sg, 'REASSIGN_FACILITY', enrichedItems, sgContext).allowed,
      canEditShippingMethod: OrderActionValidator.validateShipGroupAction(rawOrder, sg, 'EDIT_SHIPPING_METHOD', enrichedItems, sgContext).allowed,
    };

    const units = (sg.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const itemSummary = `${(sg.items || []).length} ${(sg.items || []).length === 1 ? 'item' : 'items'} · ${units} ${units === 1 ? 'unit' : 'units'}`;

    const brokeredFromTimeline = timelineEntry?.firstBrokeredDate || timelineEntry?.firstReleasedDate;
    const earliestFacilityChange = !isVirtual
      ? (auxiliaryData.facilityChanges || [])
          .filter((c: any) => c.shipGroupSeqId === sg.shipGroupSeqId && c.value)
          .sort((a: any, b: any) => a.value - b.value)[0]?.value
      : undefined;
    const firstBrokeredDate = brokeredFromTimeline || earliestFacilityChange;

    const lifecycle = {
      ...(timelineEntry || {}),
      firstBrokeredDate,
    };

    const shippingMech = sg.contactMechId
      ? contactMechs.find((m: any) => m.contactMechId === sg.contactMechId)
      : contactMechs.find((m: any) => m.contactMechPurposeTypeId === 'SHIPPING_LOCATION');
    const addr = shippingMech?.postalAddress;
    const shippingAddress = addr ? {
      lines: [
        addr.toName,
        addr.address1,
        addr.address2,
        [addr.city, seedStore.geoName?.(addr.stateProvinceGeoId), addr.postalCode].filter(Boolean).join(', '),
        seedStore.geoName?.(addr.countryGeoId)
      ].filter(Boolean) as string[],
      view: {
        name: addr.toName || '',
        street: [addr.address1, addr.address2].filter(Boolean).join(', '),
        locality: [addr.city, addr.postalCode, seedStore.geoName?.(addr.stateProvinceGeoId), seedStore.geoName?.(addr.countryGeoId)].filter(Boolean).join(', ')
      }
    } : undefined;

    return {
      id: sg.shipGroupSeqId,
      shipGroupSeqId: sg.shipGroupSeqId,
      facilityId: sg.facilityId,
      facilityName,
      facilityTypeId: seedStore.facility?.(sg.facilityId)?.facilityTypeId,
      facilityParentTypeId: seedStore.facilityType?.(seedStore.facility?.(sg.facilityId)?.facilityTypeId)?.parentTypeId,
      isVirtual,
      isPosCompleted,
      isBrokered,
      isReadOnly,
      progress,
      statusLabel,
      headerTitle,
      itemSummary,
      firstBrokeredDate,
      lifecycle,
      shippingAddress,
      carrierPartyId: sg.carrierPartyId,
      carrierName: sg.carrierPartyId ? seedStore.carrierParties?.find((c: any) => c.partyId === sg.carrierPartyId)?.groupName || sg.carrierPartyId : '',
      shipmentMethodTypeId: sg.shipmentMethodTypeId,
      shippingMethodLabel: sg.shipmentMethodTypeId ? seedStore.shipmentMethodDescription(sg.shipmentMethodTypeId) : '',
      estimatedShipDate: sg.estimatedShipDate,
      estimatedDeliveryDate: sg.estimatedDeliveryDate,
      shipAfterDate: sg.shipAfterDate,
      shipByDate: sg.shipByDate,
      picklistDate: sg.picklistDate,
      isGift: sg.isGift,
      giftMessage: sg.giftMessage,
      shippingInstructions: sg.shippingInstructions,
      contactMechId: sg.contactMechId,
      items: enrichedItems,
      actions,
    };
  });

  // Grouped Items (by externalId)
  const groups: Record<string, any> = {};
  shipGroups.forEach((sg) => {
    sg.items.forEach((item) => {
      const extId = item.externalId;
      if (!groups[extId]) {
        groups[extId] = {
          externalId: extId,
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          unitPrice: item.unitPrice,
          currency: rawOrder.currencyUom,
          totalQty: 0,
          totalPrice: 0,
          statuses: [],
          items: [],
        };
      }
      groups[extId].items.push(item);
      groups[extId].totalQty += item.quantity;
      groups[extId].totalPrice += item.unitPrice * item.quantity;
    });
  });

  const groupedItems = Object.values(groups).map((group) => {
    group.statuses = rollUpItemStatuses(group.items);
    return group;
  });

  const itemGroups = groupedItems.map((group: any) => ({
    group,
    soleItem: group.items.length === 1 ? group.items[0] : null,
  }));

  // Totals
  let subtotal = 0;
  shipGroups.forEach((sg) => {
    sg.items.forEach((item) => {
      subtotal += item.unitPrice * item.quantity;
    });
  });

  const adjustments: Record<string, number> = {};
  const includedAdjustments: Record<string, number> = {};
  let adjustmentsTotal = 0;
  const seenAdjustments = new Set<string>();

  const recordAdj = (adj: any, fallbackSeqId = '') => {
    const key = adj.orderAdjustmentId || `${fallbackSeqId}|${adj.orderAdjustmentTypeId}|${adj.amount}`;
    if (seenAdjustments.has(key)) return;
    seenAdjustments.add(key);

    const amount = Number(adj.amount || 0);
    adjustmentsTotal += amount;
    const includedAmount = Number(adj.amountAlreadyIncluded || 0);
    const isIncluded = amount === 0 && includedAmount > 0;
    const label = adj.comments || adj.description || seedStore.orderAdjustmentTypeDescription(adj.orderAdjustmentTypeId) || 'Adjustment';

    if (isIncluded) {
      includedAdjustments[label] = (includedAdjustments[label] || 0) + includedAmount;
    } else {
      adjustments[label] = (adjustments[label] || 0) + amount;
    }
  };

  (rawOrder.adjustments || []).forEach((adj: any) => recordAdj(adj));
  (rawOrder.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      (item.adjustments || []).forEach((adj: any) => recordAdj(adj, item.orderItemSeqId));
    });
  });

  const computedTotal = Math.round((subtotal + adjustmentsTotal) * 100) / 100;
  const shippingMethodsList = Array.from(new Set(shipGroups.map((sg: any) => sg.shippingMethodLabel).filter(Boolean))).join(', ');
  const adjustmentRows: EnrichedOrderAdjustmentRow[] = [
    ...Object.entries(adjustments).map(([label, amount]) => ({
      label,
      detail: /shipping/i.test(label) ? shippingMethodsList : '',
      amount: Number(amount),
      isIncluded: false,
    })),
    ...Object.entries(includedAdjustments).map(([label, amount]) => ({
      label,
      detail: /shipping/i.test(label) ? shippingMethodsList : '',
      amount: Number(amount),
      isIncluded: true,
    })),
  ].filter((row) => row.amount !== 0);

  const totals: EnrichedOrderTotals = {
    subtotal,
    adjustments,
    includedAdjustments,
    total: computedTotal || rawOrder.grandTotal || 0,
    adjustmentRows,
  };

  const payments = calculatePaymentSummary(rawOrder, returnedQtyBySeqId, seedStore);
  const risk = calculateRiskSummary(rawOrder, auxiliaryData.riskAssessments || [], seedStore);
  const timeline = buildOrderTimeline(rawOrder, auxiliaryData, stores);

  return {
    id: rawOrder.orderId,
    orderName: rawOrder.orderName,
    externalId: rawOrder.externalId,
    status: seedStore.statusDescription(rawOrder.statusId),
    statusId: rawOrder.statusId,
    statusInfo: {
      id: rawOrder.statusId,
      label: seedStore.statusDescription(rawOrder.statusId),
      color: commonUtil.getStatusColor ? commonUtil.getStatusColor(rawOrder.statusId) : 'medium',
    },
    channel: seedStore.enumDescription(rawOrder.salesChannelEnumId),
    salesChannelEnumId: rawOrder.salesChannelEnumId,
    salesChannel: {
      id: rawOrder.salesChannelEnumId,
      label: seedStore.enumDescription(rawOrder.salesChannelEnumId),
    },
    productStoreName: seedStore.productStoreName(rawOrder.productStoreId),
    originFacilityId: rawOrder.originFacilityId || '',
    originFacilityName: rawOrder.originFacilityId && rawOrder.originFacilityId !== '_NA_'
      ? (rawOrder.originFacilityName || seedStore.facility?.(rawOrder.originFacilityId)?.facilityName || rawOrder.originFacilityId)
      : '',
    originFacility: {
      id: rawOrder.originFacilityId || '',
      name: rawOrder.originFacilityId && rawOrder.originFacilityId !== '_NA_'
        ? (rawOrder.originFacilityName || seedStore.facility?.(rawOrder.originFacilityId)?.facilityName || rawOrder.originFacilityId)
        : '',
    },
    currency: rawOrder.currencyUom,
    localeString: rawOrder.localeString || rawOrder.locale,
    customerName: customerName,
    customer: {
      partyId: placingRole?.partyId || '',
      name: customerName,
      email: emailMech?.infoString || '',
      phone: commonUtil.formatPhoneNumber?.(phoneMech?.telecomNumber?.contactNumber) || phoneMech?.infoString || '',
      billingAddress: billingLines.length ? { lines: billingLines } : undefined,
    },
    riskRecommendationEnumId: rawOrder.riskRecommendationEnumId,
    riskLevelEnumId: rawOrder.riskLevelEnumId,
    history: (rawOrder.statuses || [])
      .filter((s: any) => !s.orderItemSeqId || s.orderItemSeqId === '_NA_')
      .map((entry: any) => ({
        id: entry.orderStatusId,
        label: seedStore.statusDescription(entry.statusId),
        detail: entry.statusUserLogin || '',
        changeReason: entry.changeReason || '',
        at: entry.statusDatetime,
      })),
    identifications: (rawOrder.identifications || [])
      .filter((id: any) => !id.thruDate || new Date(id.thruDate).getTime() > Date.now())
      .map((id: any) => ({
        orderIdentificationTypeId: id.orderIdentificationTypeId,
        typeLabel: seedStore.orderIdentificationTypeDescription(id.orderIdentificationTypeId),
        idValue: id.idValue,
        fromDate: id.fromDate,
        shopifyAdminUrl: id.orderIdentificationTypeId === 'SHOPIFY_ORD_ID' ? auxiliaryData.shopifyAdminUrl : '',
      })),
    payments,
    risk,
    attributes: orderAttributeRows(rawOrder),
    shipGroups,
    groupedItems,
    itemGroups,
    totals,
    timeline,
  };
}
