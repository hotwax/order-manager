import { defineStore } from 'pinia';
import { api } from '@common';
import { useOrderStore } from '@/store/order';
import { useProductStore } from '@/store/productStore';
import { useProductMaster } from '@/composables/useProductMaster';
import { useStockStore } from '@/store/stock';
import type { TaskQueueRequestParams } from '@/types/orderTaskFilters';
// Queue-defining task query constants live in a dependency-free module so the
// nav-count priming (services/navCounts) can count the exact same populations
// these queue-list fetches list, without importing the store.
import {
  ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
  FRAUD_RISK_PURPOSE_TYPE_ID,
  HOLD_TASK_TYPE_ID,
  OPEN_TASK_STATUS_IDS,
  SWAP_PURPOSE_TYPE_ID,
  USER_HOLD_PURPOSE_TYPE_IDS,
} from '@/utils/taskQueues';

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
  const taskDetail = detailResponse.data.task ?? {};
  const workEffortCreatedDate = task.workEffortCreatedDate ?? taskDetail.workEffortCreatedDate;
  return { ...task, ...taskDetail, workEffortCreatedDate };
}

/** Address & swap tasks merge the ship group detail onto the row. */
async function enrichShipGroupTask(task: any) {
  const workEffortCreatedDate = task.workEffortCreatedDate;
  const shipGroupResponse = await api({ url: `oms/orders/${task.orderId}/shipGroups/${task.shipGroupSeqId}`, method: 'GET' });
  return { ...task, ...shipGroupResponse.data.shipGroup, workEffortCreatedDate };
}

/** Fraud tasks enrich from `oms/orders` + `oms/orders/{id}/risks`. */
async function enrichFraudTask(task: any) {
  const workEffortCreatedDate = task.workEffortCreatedDate;
  const [orderResponse, risksResponse] = await Promise.all([
    api({ url: 'oms/orders', method: 'GET', params: { orderId: task.orderId } }),
    api({ url: `oms/orders/${task.orderId}/risks`, method: 'GET' }),
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
  const items = (order.shipGroups || []).flatMap((sg: any) =>
    (sg.items || []).map((item: any) => ({ ...item, shipGroupSeqId: sg.shipGroupSeqId }))
  );

  return {
    ...task,
    order,
    customer,
    billingEmail: email,
    billingPhone: telecom,
    payments,
    items,
    risks,
    workEffortCreatedDate,
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

// Load status for a task-list queue. `idle` before the first fetch, `loading`
// while the first page (list + enrichment) is in flight, `success` once cards
// can render stably, `error` when the fetch or enrichment failed.
type TaskLoadStatus = 'idle' | 'loading' | 'success' | 'error';

function responseTotal(response: any): number | null {
  const rawTotal = response?.headers?.get?.('x-total-count')
    ?? response?.headers?.['x-total-count']
    ?? response?.headers?.['X-Total-Count']
    ?? response?.data?.count
    ?? response?.data?.totalCount
    ?? response?.data?.tasksCount
    ?? response?.data?.total;
  if (rawTotal == null || rawTotal === '') return null;
  const total = Number(rawTotal);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function canLoadMore(tasks: any[], total: number, totalKnown: boolean): boolean {
  if (!tasks.length) return false;
  if (totalKnown) return tasks.length < total;
  return tasks.length % Number(import.meta.env.VITE_VIEW_SIZE) === 0;
}

function resolveQueueTotal(
  navKey: string,
  listResponse: any,
  isFirstPage: boolean,
  loadedCount: number,
  currentTotal: number
): { total: number; totalKnown: boolean } {
  const headerTotal = responseTotal(listResponse);
  if (headerTotal !== null) {
    useOrderStore().setNavCount(navKey, headerTotal);
    return { total: headerTotal, totalKnown: true };
  }
  if (isFirstPage) {
    const navCount = useOrderStore().getNavCount(navKey);
    const total = navCount || loadedCount;
    if (navCount > 0) useOrderStore().setNavCount(navKey, total);
    return { total, totalKnown: false };
  }
  return { total: currentTotal, totalKnown: false };
}

export const useOrderTaskStore = defineStore('orderTask', {
  state: () => ({
    holdTasks: [] as any[],
    holdStatus: 'idle' as TaskLoadStatus,
    holdError: '' as string,
    holdTotal: 0,
    holdTotalKnown: false,
    addressValidationTasks: [] as any[],
    addressValidationTotal: 0,
    addressValidationTotalKnown: false,
    swapTasks: [] as any[],
    swapTotal: 0,
    swapTotalKnown: false,
    fraudTasks: [] as any[],
    fraudTotal: 0,
    fraudTotalKnown: false,
    fraudStatus: 'idle' as TaskLoadStatus,
    fraudError: '' as string,
    orderHoldTasksByOrderId: {} as Record<string, any[]>,
    orderAddressValidationTasksByOrderId: {} as Record<string, any[]>,
    orderSwapTasksByOrderId: {} as Record<string, any[]>,
    orderFraudTasksByOrderId: {} as Record<string, any[]>,
    swapStatus: 'idle' as TaskLoadStatus,
    swapError: '' as string,
  }),
  getters: {
    getHoldTasks: (state) => state.holdTasks,
    getHoldStatus: (state) => state.holdStatus,
    getHoldError: (state) => state.holdError,
    getHoldTotal: (state) => state.holdTotal,
    isHoldTasksScrollable: (state): boolean => {
      return canLoadMore(state.holdTasks, state.holdTotal, state.holdTotalKnown);
    },
    getAddressValidationTasks: (state) => state.addressValidationTasks,
    getAddressValidationTotal: (state) => state.addressValidationTotal,
    isAddressValidationTasksScrollable: (state): boolean => {
      return canLoadMore(state.addressValidationTasks, state.addressValidationTotal, state.addressValidationTotalKnown);
    },
    getSwapTasks: (state) => state.swapTasks,
    getSwapTotal: (state) => state.swapTotal,
    isSwapTasksScrollable: (state): boolean => {
      return canLoadMore(state.swapTasks, state.swapTotal, state.swapTotalKnown);
    },
    getSwapStatus: (state) => state.swapStatus,
    getSwapError: (state) => state.swapError,
    getFraudTasks: (state) => state.fraudTasks,
    getFraudTotal: (state) => state.fraudTotal,
    getFraudStatus: (state) => state.fraudStatus,
    getFraudError: (state) => state.fraudError,
    isFraudTasksScrollable: (state): boolean => {
      return canLoadMore(state.fraudTasks, state.fraudTotal, state.fraudTotalKnown);
    },
    getOrderHoldTasksByOrderId: (state) => (orderId: string) => state.orderHoldTasksByOrderId[orderId] || [],
    getOrderAddressValidationTasksByOrderId: (state) => (orderId: string) => state.orderAddressValidationTasksByOrderId[orderId] || [],
    getOrderSwapTasksByOrderId: (state) => (orderId: string) => state.orderSwapTasksByOrderId[orderId] || [],
    getOrderFraudTasksByOrderId: (state) => (orderId: string) => state.orderFraudTasksByOrderId[orderId] || [],
  },
  actions: {
    async fetchHoldTasks(payload: TaskQueueRequestParams = {}, workEffortPurposeTypeId = USER_HOLD_PURPOSE_TYPE_IDS) {
      const isFirstPage = !(Number(payload.pageIndex || 0) > 0);
      // Loading status only gates the first-page fetch; page 2+ keeps the existing
      // list visible and relies on the infinite-scroll indicator instead.
      if (isFirstPage) {
        this.holdStatus = 'loading';
        this.holdError = '';
      }
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({
          // The order-task view retains concrete ship-group fields but also includes null-scope
          // customer-request holds, so the queue matches the complete blocking population.
          url: 'oms/orders/tasks',
          method: 'GET',
          params: {
            ...payload,
            taskStatusId: OPEN_TASK_STATUS_IDS,
            taskStatusId_op: 'in',
            workEffortTypeId: HOLD_TASK_TYPE_ID,
            workEffortPurposeTypeId,
            ...(workEffortPurposeTypeId === USER_HOLD_PURPOSE_TYPE_IDS ? { workEffortPurposeTypeId_op: 'in' } : {}),
            productStoreId,
          },
        });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map(enrichHoldTask));
        this.holdTasks = isFirstPage ? detailedTasks : [...this.holdTasks, ...detailedTasks];
        const { total, totalKnown } = resolveQueueTotal('hold', listResponse, isFirstPage, detailedTasks.length, this.holdTotal);
        this.holdTotal = total;
        this.holdTotalKnown = totalKnown;
        if (isFirstPage) this.holdStatus = 'success';
      } catch (err: any) {
        console.error('Failed to fetch the hold tasks', err);
        if (isFirstPage) {
          this.holdStatus = 'error';
          this.holdError = 'Failed to load hold tasks. Please try again.';
        }
      }
    },
    async fetchAddressValidationTasks(payload: TaskQueueRequestParams = {}) {
      const isFirstPage = !(Number(payload.pageIndex || 0) > 0);
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({
          url: 'oms/orders/tasks',
          method: 'GET',
          params: {
            ...payload,
            taskStatusId: OPEN_TASK_STATUS_IDS,
            taskStatusId_op: 'in',
            workEffortTypeId: HOLD_TASK_TYPE_ID,
            workEffortPurposeTypeId: ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
            productStoreId,
          },
        });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map((task: any) => enrichShipGroupTask(task)));
        this.addressValidationTasks = !isFirstPage ? [...this.addressValidationTasks, ...detailedTasks] : detailedTasks;
        const { total, totalKnown } = resolveQueueTotal('badAddress', listResponse, isFirstPage, detailedTasks.length, this.addressValidationTotal);
        this.addressValidationTotal = total;
        this.addressValidationTotalKnown = totalKnown;
        return true;
      } catch (err) {
        console.error('Failed to fetch the address validation tasks', err);
        return false;
      }
    },
    async fetchSwapTasks(payload: TaskQueueRequestParams = {}) {
      // First-page fetches drive the page-level loading/error state. Pagination
      // (pageIndex > 0) keeps the already-rendered cards visible and is handled
      // by the infinite-scroll spinner instead, so it never flips swapStatus.
      const isFirstPage = !(Number(payload.pageIndex || 0) > 0);
      if (isFirstPage) {
        this.swapStatus = 'loading';
        this.swapError = '';
      }
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({
          url: 'oms/orders/tasks',
          method: 'GET',
          params: {
            ...payload,
            taskStatusId: OPEN_TASK_STATUS_IDS,
            taskStatusId_op: 'in',
            workEffortTypeId: HOLD_TASK_TYPE_ID,
            workEffortPurposeTypeId: SWAP_PURPOSE_TYPE_ID,
            productStoreId,
          },
        });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map(enrichShipGroupTask));
        this.swapTasks = isFirstPage ? detailedTasks : [...this.swapTasks, ...detailedTasks];
        const { total, totalKnown } = resolveQueueTotal('swap', listResponse, isFirstPage, detailedTasks.length, this.swapTotal);
        this.swapTotal = total;
        this.swapTotalKnown = totalKnown;
        // Only mark success once product master + stock enrichment have settled so
        // the cards render their images/stock without flashing partial content.
        await prefetchSwapTaskAssets(detailedTasks);
        if (isFirstPage) this.swapStatus = 'success';
      } catch (err) {
        console.error('Failed to fetch the swap tasks', err);
        if (isFirstPage) {
          this.swapStatus = 'error';
          this.swapError = 'Failed to load swap tasks. Please try again.';
        }
      }
    },
    async fetchFraudTasks(payload: TaskQueueRequestParams = {}) {
      // Treat only first-page requests as the page-level load. Infinite-scroll
      // pages (pageIndex > 0) append without touching the first-load status.
      const isFirstPage = !Number(payload.pageIndex || 0);
      if (isFirstPage) {
        this.fraudStatus = 'loading';
        this.fraudError = '';
      }
      try {
        const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({
          url: 'oms/orders/tasks',
          method: 'GET',
          params: {
            ...payload,
            taskStatusId: OPEN_TASK_STATUS_IDS,
            taskStatusId_op: 'in',
            workEffortTypeId: HOLD_TASK_TYPE_ID,
            workEffortPurposeTypeId: FRAUD_RISK_PURPOSE_TYPE_ID,
            productStoreId,
          },
        });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(tasks.map(enrichFraudTask));
        this.fraudTasks = isFirstPage ? detailedTasks : [...this.fraudTasks, ...detailedTasks];
        const { total, totalKnown } = resolveQueueTotal('fraud', listResponse, isFirstPage, detailedTasks.length, this.fraudTotal);
        this.fraudTotal = total;
        this.fraudTotalKnown = totalKnown;
        // Success only after both the list and the per-task enrichment have settled.
        if (isFirstPage) this.fraudStatus = 'success';
      } catch (err) {
        console.error('Failed to fetch the fraud tasks', err);
        if (isFirstPage) {
          this.fraudStatus = 'error';
          this.fraudError = 'Failed to load fraud tasks. Please try again.';
        }
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
          const listResponse = await api({
            url: 'oms/orders/tasks',
            method: 'GET',
            params: {
              orderId,
              taskStatusId: OPEN_TASK_STATUS_IDS,
              taskStatusId_op: 'in',
              workEffortTypeId: HOLD_TASK_TYPE_ID,
              workEffortPurposeTypeId: USER_HOLD_PURPOSE_TYPE_IDS,
              workEffortPurposeTypeId_op: 'in',
              productStoreId,
            },
          });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          this.orderHoldTasksByOrderId[orderId] = await Promise.all(tasks.map(enrichHoldTask));
        } catch (err) {
          console.error('Failed to fetch the order hold tasks', err);
        }
      };

      const fetchAddress = async () => {
        try {
          const listResponse = await api({
            url: 'oms/orders/tasks',
            method: 'GET',
            params: {
              orderId,
              taskStatusId: OPEN_TASK_STATUS_IDS,
              taskStatusId_op: 'in',
              workEffortTypeId: HOLD_TASK_TYPE_ID,
              workEffortPurposeTypeId: ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
              productStoreId,
            },
          });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          this.orderAddressValidationTasksByOrderId[orderId] = await Promise.all(tasks.map(enrichShipGroupTask));
        } catch (err) {
          console.error('Failed to fetch the order address validation tasks', err);
        }
      };

      const fetchSwap = async () => {
        try {
          const listResponse = await api({
            url: 'oms/orders/tasks',
            method: 'GET',
            params: {
              orderId,
              taskStatusId: OPEN_TASK_STATUS_IDS,
              taskStatusId_op: 'in',
              workEffortTypeId: HOLD_TASK_TYPE_ID,
              workEffortPurposeTypeId: SWAP_PURPOSE_TYPE_ID,
              productStoreId,
            },
          });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          const detailedTasks = await Promise.all(tasks.map(enrichShipGroupTask));
          this.orderSwapTasksByOrderId[orderId] = detailedTasks;
          await prefetchSwapTaskAssets(detailedTasks);
        } catch (err) {
          console.error('Failed to fetch the order swap tasks', err);
        }
      };

      const fetchFraud = async () => {
        try {
          const listResponse = await api({
            url: 'oms/orders/tasks',
            method: 'GET',
            params: {
              orderId,
              taskStatusId: OPEN_TASK_STATUS_IDS,
              taskStatusId_op: 'in',
              workEffortTypeId: HOLD_TASK_TYPE_ID,
              workEffortPurposeTypeId: FRAUD_RISK_PURPOSE_TYPE_ID,
              productStoreId,
            },
          });
          const tasks = (listResponse.data ?? []).filter((task: any) => task.orderId === orderId);
          const detailedTasks = await Promise.all(tasks.map(enrichFraudTask));
          this.orderFraudTasksByOrderId[orderId] = detailedTasks;
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
        throw err;
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
        throw err;
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
