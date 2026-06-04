import { defineStore } from 'pinia';
import { api } from '@common';
import { useUserStore } from '@/store/user';

export const useOrderTaskStore = defineStore('orderTask', {
  state: () => ({
    holdTasks: [] as any[],
    addressValidationTasks: [] as any[],
    swapTasks: [] as any[],
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
    }
  },
  actions: {
    async fetchHoldTasks(payload: { viewSize?: any; viewIndex?: any; currentUserPartyId?: string; createdDate_from?: number; createdDate_thru?: number; orderName?: string; orderName_op?: string; salesChannelEnumId?: string } = {}) {
      try {
        const productStoreId = useUserStore().getCurrentProductStore.productStoreId;
        const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', productStoreId } });
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
        const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', productStoreId } });
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
        const listResponse = await api({ url: 'oms/orders/tasks', method: 'GET', params: { ...payload, statusId: 'TASK_CREATED', productStoreId } });
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
    async cancelOrder(orderId: string, items: { orderItemSeqId: string; shipGroupSeqId: string }[]) {
      try {
        await api({
          url: `oms/orders/${orderId}/items/cancel`,
          method: 'POST',
          data: {
            items: items.map((item) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: item.shipGroupSeqId,
              reason: '',
              comment: '',
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
    async parkOrder(orderId: string, shipGroupSeqId: string, facilityId: string) {
      try {
        await api({
          url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}`,
          method: 'PUT',
          data: { facilityId },
        });
      } catch (err) {
        console.error('Failed to park the order', err);
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
