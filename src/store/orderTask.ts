import { defineStore } from 'pinia';
import { api } from '@common';
import { useProductStore } from '@/store/productStore';
import { useProductMaster } from '@/composables/useProductMaster';
import { useStockStore } from '@/store/stock';

interface TaskStatusCommunicationOptions {
  content?: string;
  communicationEventTypeId?: string;
  subject?: string;
}

// ── Per-task enrichment helpers ───────────────────────────────────────────────
// Shared by both the queue list fetches and the order-scoped detail fetch so the
// two paths stay in lockstep (no duplicated enrichment logic).

/** Hold tasks merge the task detail (`oms/orders/tasks/{workEffortId}`) onto the row. */
async function enrichHoldTask(task: any) {
  const detailResponse = await api({ url: `oms/orders/tasks/${task.workEffortId}`, method: 'GET' });
  return { ...task, ...detailResponse.data.task };
}

/** Address & swap tasks merge the ship group detail onto the row. */
async function enrichShipGroupTask(task: any) {
  const shipGroupResponse = await api({ url: `oms/orders/${task.orderId}/shipGroups/${task.shipGroupSeqId}`, method: 'GET' });
  return { ...task, ...shipGroupResponse.data.shipGroup };
}

/** Fraud tasks enrich from `oms/orders` + `oms/orders/{id}/risks`. */
async function enrichFraudTask(task: any) {
  const [orderResponse, risksResponse] = await Promise.all([
    api({ url: 'oms/orders', method: 'GET', params: { orderId: task.orderId } }),
    api({ url: `oms/orders/${task.orderId}/risks`, method: 'GET'}),
  ]);
  const order = (orderResponse.data ?? [])[0] ?? {};
  const risks = risksResponse.data ?? [];

  // Customer — PLACING_CUSTOMER role
  const placingCustomer = (order.roles || []).find((r: any) => r.roleTypeId === 'PLACING_CUSTOMER');
  const person = placingCustomer?.person;
  const customer = {
    partyId: placingCustomer?.partyId,
    firstName: person?.firstName,
    lastName: person?.lastName,
  };

  // Contact mechs indexed by purpose
  const mechsByPurpose: Record<string, any> = {};
  (order.contactMechs || []).forEach((mech: any) => {
    if (mech.contactMechPurposeTypeId) mechsByPurpose[mech.contactMechPurposeTypeId] = mech;
  });

  const email = mechsByPurpose['ORDER_EMAIL']?.contactMech?.infoString
    || mechsByPurpose['SHIPPING_EMAIL']?.contactMech?.infoString;

  const telecomMech = (order.contactMechs || []).find((mech: any) => mech.telecomNumber);
  const telecom = telecomMech?.telecomNumber;

  // Payments
  const payments = (order.paymentPreferences || []).map((p: any) => ({
    paymentMethodTypeId: p.paymentMethodTypeId,
    paymentMethodDescription: p['org.apache.ofbiz.accounting.payment.PaymentMethodType']?.description,
    statusId: p.statusId,
    statusDescription: p['moqui.basic.StatusItem']?.description,
    maxAmount: p.maxAmount ?? p.presentmentAmount,
  }));

  // Items — flatten across all shipGroups
  const shipGroupSeqId = task.shipGroupSeqId || '00001';
  const items = (order.shipGroups || []).flatMap((sg: any) =>
    (sg.items || []).map((item: any) => ({ ...item, shipGroupSeqId: sg.shipGroupSeqId }))
  );

  return {
    ...task,
    shipGroupSeqId,
    order,
    customer,
    billingEmail: email,
    billingPhone: telecom,
    payments,
    items,
    risks,
    grandTotal: order.grandTotal,
    orderName: order.orderName,
    orderDate: order.orderDate,
  };
}

/** Prefetch product master + stock for swap tasks so cards render images/stock. */
async function prefetchSwapTaskAssets(tasks: any[]) {
  const productIds = tasks
    .flatMap((task: any) => task.items ?? [])
    .flatMap((item: any) => [item.productId, item.substituteProducts?.[0]?.productId])
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }

  const stockRequests = new Map();
  tasks.forEach((task: any) => {
    const facilityId = task.facilityId;
    (task.items ?? []).forEach((item: any) => {
      const productId = item.substituteProducts?.[0]?.productId;
      if (productId && facilityId) {
        const key = `${productId}|${facilityId}`;
        if (!stockRequests.has(key)) stockRequests.set(key, { productId, facilityId });
      }
    });
  });

  await Promise.all(
    [...stockRequests.values()].map((stockRequest: any) => useStockStore().fetchStock(stockRequest))
  );
}

/** Prefetch product master for fraud tasks so cards render images. */
async function prefetchFraudTaskAssets(tasks: any[]) {
  const productIds = tasks
    .flatMap((task: any) => task.items ?? [])
    .map((item: any) => item.productId)
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }
}

export const useOrderTaskStore = defineStore('orderTask', {
  state: () => ({
    holdTasks: [] as any[],
    addressValidationTasks: [] as any[],
    swapTasks: [] as any[],
    fraudTasks: [] as any[],
    orderHoldTasks: [] as any[],
    orderAddressValidationTasks: [] as any[],
    orderSwapTasks: [] as any[],
    orderFraudTasks: [] as any[],
  }),
  getters: {
    getHoldTasks: (state) => state.holdTasks,
    isHoldTasksScrollable: (state): boolean => {
      return (
        state.holdTasks?.length > 0 &&
        (state.holdTasks?.length % Number(import.meta.env.VITE_VIEW_SIZE) === 0)
      );
    },
    getAddressValidationTasks: (state) => state.addressValidationTasks,
    isAddressValidationTasksScrollable: (state): boolean => {
      return (
        state.addressValidationTasks?.length > 0 &&
        (state.addressValidationTasks?.length % Number(import.meta.env.VITE_VIEW_SIZE) === 0)
      );
    },
    getSwapTasks: (state) => state.swapTasks,
    isSwapTasksScrollable: (state): boolean => {
      return (
        state.swapTasks?.length > 0 &&
        (state.swapTasks?.length % Number(import.meta.env.VITE_VIEW_SIZE) === 0)
      );
    },
    getFraudTasks: (state) => state.fraudTasks,
    isFraudTasksScrollable: (state): boolean => {
      return (
        state.fraudTasks?.length > 0 &&
        (state.fraudTasks?.length % Number(import.meta.env.VITE_VIEW_SIZE) === 0)
      );
    },
    getOrderHoldTasks: (state) => state.orderHoldTasks,
    getOrderAddressValidationTasks: (state) => state.orderAddressValidationTasks,
    getOrderSwapTasks: (state) => state.orderSwapTasks,
    getOrderFraudTasks: (state) => state.orderFraudTasks,
  },
  actions: {
    async fetchHoldTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'RESOLVE_ONHOLD_ORDER', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map((task: any) => enrichHoldTask(task)));
        this.holdTasks = payload.viewIndex > 0 ? [...this.holdTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the hold tasks', err);
      }
    },
    async fetchAddressValidationTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'INVALID_ADDRESS', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map((task: any) => enrichShipGroupTask(task)));
        this.addressValidationTasks = payload.viewIndex > 0 ? [...this.addressValidationTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the address validation tasks', err);
      }
    },
    async fetchSwapTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; swappable?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'NEG_RES_REVIEW', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map((task: any) => enrichShipGroupTask(task)));
        this.swapTasks = payload.viewIndex > 0 ? [...this.swapTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the swap tasks', err);
      }
    },
    async fetchFraudTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string; riskRecommendationEnumId?: string; riskLevelEnumId?: string } = {}) {
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'REVIEW_RISK_ORDER', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map((task: any) => enrichFraudTask(task)));
        this.fraudTasks = payload.viewIndex > 0 ? [...this.fraudTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the fraud tasks', err);
      }
    },
    /**
     * Fetch all four hold-task types scoped to a single order, for the OrderDetail
     * "Holds" segment. Hits the same endpoints as the queue list fetches with an
     * extra `orderId` param, then client-side filters to that order (belt-and-braces
     * in case the endpoint ignores it). Results overwrite the order-scoped arrays.
     */
    async fetchOrderHoldTasks(orderId: string) {
      if (!orderId) return;
      const productStoreId = useProductStore().getCurrentProductStore.productStoreId;

      const fetchHold = async () => {
        try {
          const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { orderId, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'RESOLVE_ONHOLD_ORDER', productStoreId } });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          this.orderHoldTasks = await Promise.all(tasks.map((task: any) => enrichHoldTask(task)));
        } catch (err) {
          console.error('Failed to fetch the order hold tasks', err);
        }
      };

      const fetchAddress = async () => {
        try {
          const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { orderId, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'INVALID_ADDRESS', productStoreId } });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          this.orderAddressValidationTasks = await Promise.all(tasks.map((task: any) => enrichShipGroupTask(task)));
        } catch (err) {
          console.error('Failed to fetch the order address validation tasks', err);
        }
      };

      const fetchSwap = async () => {
        try {
          const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { orderId, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'NEG_RES_REVIEW', productStoreId } });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          const detailedTasks = await Promise.all(tasks.map((task: any) => enrichShipGroupTask(task)));
          this.orderSwapTasks = detailedTasks;
          await prefetchSwapTaskAssets(detailedTasks);
        } catch (err) {
          console.error('Failed to fetch the order swap tasks', err);
        }
      };

      const fetchFraud = async () => {
        try {
          const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { orderId, statusId: 'TASK_CREATED', workEffortTypeId: 'REVIEW_RISK_ORDER', productStoreId } });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          const detailedTasks = await Promise.all(tasks.map((task: any) => enrichFraudTask(task)));
          this.orderFraudTasks = detailedTasks;
          await prefetchFraudTaskAssets(detailedTasks);
        } catch (err) {
          console.error('Failed to fetch the order fraud tasks', err);
        }
      };

      await Promise.all([fetchHold(), fetchAddress(), fetchSwap(), fetchFraud()]);
    },
    async updateShippingInformation(orderId: string, shipGroupSeqId: string, address: {
      address1: string; address2?: string; city: string; postalCode: string;
      stateProvinceGeoId?: string; countryGeoId: string;
      contactMechId?: string; contactMechPurposeTypeId?: string; partyId?: string; isEdited?: boolean;
    }) {
      try {
        await api({
          url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}/shippingInformation`,
          method: 'PUT',
          data: address,
        });
      } catch (err) {
        console.error('Failed to update shipping information', err);
        throw err;
      }
    },
    async cancelOrder(orderId: string, items: { orderItemSeqId: string; shipGroupSeqId: string, reason?: string, comment?: string }[]) {
      try {
        await api({
          url: `oms/orders/${orderId}/items/cancel`,
          method: 'POST',
          data: {
            items: items.map((item) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: item.shipGroupSeqId,
              reason: item.reason,
              comment: item.comment,
            })),
          },
        });
      } catch (err) {
        console.error('Failed to cancel the order', err);
      }
    },
    async changeTaskStatus(workEffortId: string, statusId: string, communication?: TaskStatusCommunicationOptions) {
      const content = communication?.content?.trim();
      try {
        await api({
          url: `oms/orders/tasks/${workEffortId}/status`,
          method: 'POST',
          data: {
            statusId,
            ...(content ? {
              content,
              communicationEventTypeId: communication?.communicationEventTypeId ?? 'ORDER_NOTE',
              subject: communication?.subject ?? 'NA',
            } : {}),
          },
        });
      } catch (err) {
        console.error('Failed to change the task status', err);
      }
    },
    async parkOrder(orderId: string, shipGroupSeqId: string, facilityId: string, workEffortId?: string) {
      try {
        await api({
          url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}/park`,
          method: 'POST',
          data: { facilityId, changeReasonEnumId: 'NO_VARIANCE_LOG', ...(workEffortId && { workEffortId }) },
        });
      } catch (err) {
        console.error('Failed to park the order', err);
        throw err;
      }
    },
    async parkOrderFull(orderId: string, facilityId: string) {
      try {
        await api({
          url: `oms/orders/${orderId}/park`,
          method: 'POST',
          data: { facilityId, changeReasonEnumId: 'NO_VARIANCE_LOG' },
        });
      } catch (err) {
        console.error('Failed to park the order', err);
        throw err;
      }
    },
    async brokerShipGroup(payload: { routingGroupId: string; orderId: string; shipGroupSeqId: string; productStoreId: string }) {
      try {
        await api({
          url: `order-routing/groups/${payload.routingGroupId}/run`,
          method: 'POST',
          data: {
            routingGroupId: payload.routingGroupId,
            orderId: payload.orderId,
            shipGroupSeqId: payload.shipGroupSeqId,
            productStoreId: payload.productStoreId,
          },
        });
      } catch (err) {
        console.error('Failed to broker the ship group', err);
        throw err;
      }
    },
    async swapOrder(orderId: string, shipGroupSeqId: string, itemSwapList: { orderItemSeqId: string; newProductId: string; reasonEnumId?: string }[], refundAmount?: number) {
      try {
        await api({
          url: `oms/orders/${orderId}/swap`,
          method: 'POST',
          data: {
            orderId,
            shipGroupSeqId,
            itemSwapList,
            ...(refundAmount != null && { refundAmount }),
          },
        });
      } catch (err) {
        console.error('Failed to swap the order', err);
        throw err;
      }
    },
  },
});
