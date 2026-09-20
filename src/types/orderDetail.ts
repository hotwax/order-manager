export interface ItemActionCapabilities {
  canCancel: boolean;
  cancelReason?: string;
  canTransfer: boolean;
  canRejectAndRelease: boolean;
}

export interface ShipGroupActionCapabilities {
  canCancel: boolean;
  canRelease: boolean;
  canReassignFacility: boolean;
  canEditShippingMethod: boolean;
}

export interface IssuanceBadge {
  label: string;
  tone: string;
  qohBefore: number;
  qohAfter: number;
}

export interface EnrichedOrderItem {
  orderItemSeqId: string;
  id: string; // alias for orderItemSeqId
  externalId: string;
  productId: string;
  sku: string;
  name: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  returnedQty: number;
  returnableQty: number;
  statusId: string;
  status: string;
  statusColor: string;
  shipGroupSeqId: string;
  facilityId: string;
  facilityName: string;
  attributes: any[];
  attributeCount: number;
  adjustments: Array<{ comment: string; amount: number }>;
  actions: ItemActionCapabilities;
  issuanceBadge?: IssuanceBadge;
}

export interface EnrichedShipGroup {
  id: string;
  shipGroupSeqId: string;
  facilityId: string;
  facilityName: string;
  facilityTypeId?: string;
  facilityParentTypeId?: string;
  isVirtual: boolean;
  isPosCompleted: boolean;
  isBrokered: boolean;
  isReadOnly: boolean;
  progress: number;
  statusLabel: string;
  headerTitle: string;
  itemSummary: string;
  firstBrokeredDate?: string | number;
  lifecycle?: Record<string, any>;
  shippingAddress?: {
    lines: string[];
    view: { name: string; street: string; locality: string } | null;
  };
  carrierPartyId?: string;
  carrierName?: string;
  shipmentMethodTypeId?: string;
  shippingMethodLabel?: string;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  shipAfterDate?: string;
  shipByDate?: string;
  picklistDate?: string;
  isGift?: boolean | string;
  giftMessage?: string;
  shippingInstructions?: string;
  contactMechId?: string;
  items: EnrichedOrderItem[];
  actions: ShipGroupActionCapabilities;
}

export interface EnrichedOrderAdjustmentRow {
  label: string;
  detail: string;
  amount: number;
  isIncluded: boolean;
}

export interface EnrichedOrderTotals {
  subtotal: number;
  adjustments: Record<string, number>;
  includedAdjustments: Record<string, number>;
  total: number;
  adjustmentRows?: EnrichedOrderAdjustmentRow[];
}

export interface EnrichedPaymentPreference {
  id: string;
  paymentMethodTypeId: string;
  paymentMethodTypeDesc: string;
  amount: number;
  statusId: string;
  statusDesc: string;
  createdDate?: string;
  parentRefNum?: string;
}

export type EnrichedOrderPayments = EnrichedPaymentPreference[] & {
  rawList: any[];
  receivedTotal: number;
  netAmount: number;
  netColor?: 'danger' | 'warning' | undefined;
  sections: Array<{ statusId: string; label: string; payments: any[]; total: number }>;
  allItemsReturned: boolean;
};

export interface EnrichedOrderRisk {
  hasRiskSignal: boolean;
  recommendation: string;
  level: string;
  facts: any[];
  counts: { negative: number; positive: number; neutral: number };
  factCount: number;
}

export interface EnrichedOrderTimelineEvent {
  id: string;
  label: string;
  icon: string;
  value?: number;
  valueType: 'date-time-millis';
  timeDiff?: string;
  metaData?: string;
  route?: string;
}

export interface EnrichedOrderCustomer {
  partyId: string;
  name: string;
  email: string;
  phone: string;
  billingAddress?: { lines: string[] };
}

export interface EnrichedOrder {
  id: string;
  orderName: string;
  externalId?: string;
  status: string;
  statusId: string;
  statusInfo: {
    id: string;
    label: string;
    color: string;
  };
  channel: string;
  salesChannelEnumId?: string;
  salesChannel: {
    id: string;
    label: string;
  };
  productStoreName: string;
  originFacilityId?: string;
  originFacilityName?: string;
  originFacility: {
    id: string;
    name: string;
  };
  currency: string;
  localeString?: string;
  customerName?: string;
  customer: EnrichedOrderCustomer;
  riskRecommendationEnumId?: string;
  riskLevelEnumId?: string;
  history: Array<{
    id: string;
    label: string;
    detail: string;
    changeReason: string;
    at: string;
  }>;
  identifications: Array<{
    orderIdentificationTypeId: string;
    typeLabel: string;
    idValue: string;
    fromDate?: string;
    shopifyAdminUrl?: string;
  }>;
  payments: EnrichedOrderPayments;
  risk: EnrichedOrderRisk;
  attributes: any[];
  shipGroups: EnrichedShipGroup[];
  groupedItems: any[];
  itemGroups: any[];
  totals: EnrichedOrderTotals;
  timeline: EnrichedOrderTimelineEvent[];
}
