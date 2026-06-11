import { defineStore } from 'pinia';
import { api } from '@common';
import { useUserStore } from '@/store/user';

export const useOrderTaskStore = defineStore('orderTask', {
  state: () => ({
    holdTasks: [] as any[],
    addressValidationTasks: [] as any[],
    swapTasks: [] as any[],
    fraudTasks: [] as any[],
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
    }
  },
  actions: {
    async fetchHoldTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useUserStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'ONHOLD', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(
          tasks.map(async (task: any) => {
            const detailResponse = await api({ url: `oms/orders/tasks/${task.workEffortId}`, method: 'GET' });
            return { ...task, ...detailResponse.data.task };
          })
        );
        this.holdTasks = payload.viewIndex > 0 ? [...this.holdTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the hold tasks', err);
      }
    },
    async fetchAddressValidationTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useUserStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'RESOLVE_ONHOLD_ORDER', workEffortPurposeTypeId: 'INVALID_ADDRESS', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(
          tasks.map(async (task: any) => {
            const shipGroupResponse = await api({ url: `oms/orders/${task.orderId}/shipGroups/${task.shipGroupSeqId}`, method: 'GET' });
            return { ...task, ...shipGroupResponse.data.shipGroup };
          })
        );
        this.addressValidationTasks = payload.viewIndex > 0 ? [...this.addressValidationTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the address validation tasks', err);
      }
    },
    async fetchSwapTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useUserStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks/shipGroupTasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(
          tasks.map(async (task: any) => {
            const shipGroupResponse = await api({ url: `oms/orders/${task.orderId}/shipGroups/${task.shipGroupSeqId}`, method: 'GET' });
            return { ...task, ...shipGroupResponse.data.shipGroup };
          })
        );
        this.swapTasks = payload.viewIndex > 0 ? [...this.swapTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the swap tasks', err);
      }
    },
    async fetchFraudTasks(payload: { viewSize?: any; viewIndex?: any; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string; riskRecommendationEnumId?: string; riskLevelEnumId?: string } = {}) {
      try {
        const productStoreId = useUserStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', workEffortTypeId: 'REVIEW_RISK_ORDER', productStoreId } });
        const tasks = listResponse.data ?? [];
        const detailedTasks = await Promise.all(
          tasks.map(async (task: any) => {
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
          })
        );
        this.fraudTasks = payload.viewIndex > 0 ? [...this.fraudTasks, ...detailedTasks] : detailedTasks;
      } catch (err) {
        console.error('Failed to fetch the fraud tasks', err);
      }
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
    async cancelOrder(orderId: string, items: { orderItemSeqId: string; shipGroupSeqId: string, reason:string, comment: string }[]) {
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
    async changeTaskStatus(workEffortId: string, statusId: string) {
      try {
        await api({ url: `oms/orders/tasks/${workEffortId}/status`, method: 'POST', data: { statusId } });
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
