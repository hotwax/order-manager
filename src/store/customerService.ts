import { defineStore } from 'pinia';
import { DateTime } from 'luxon';
import { useOrderStore } from '@/store/order';
import { api, commonUtil, translate } from '@common';
import type {
  BulkActionDefinition,
  WorkflowBucket,
  WorkflowFilters,
  WorkflowOrder,
  FulfillmentProgress,
  FacilityFulfillmentProgress
} from '@/types/customerService';
import { getPickProfileGroups, type FulfillmentSyncData, type SortRule } from '@/services/fulfillmentSync';
import { useSeedStore } from '@/store/seed';
import { useOrderDetailStore } from '@/store/orderDetail';


function emptyFilters(): WorkflowFilters {
  return {
    query: '',
    customerName: '',
    productStoreId: 'All',
    salesChannelEnumId: 'All',
    facilityId: 'All',
    shipmentMethodTypeId: 'All',
    priority: null,
    dateFrom: '',
    dateThru: ''
  };
}

function matchesFilters(order: WorkflowOrder, filters: WorkflowFilters): boolean {
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = `${order.orderName} ${order.externalId} ${order.orderId}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.customerName) {
    if (!order.customerName.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
  }
  if (filters.productStoreId !== 'All' && order.productStoreId !== filters.productStoreId) return false;
  if (filters.salesChannelEnumId !== 'All' && order.salesChannelEnumId !== filters.salesChannelEnumId) return false;
  if (filters.facilityId !== 'All' && order.facilityId !== filters.facilityId) return false;
  if (filters.shipmentMethodTypeId !== 'All' && order.shippingMethodTypeId !== filters.shipmentMethodTypeId) return false;
  if (filters.dateFrom) {
    const from = DateTime.fromISO(filters.dateFrom).startOf('day');
    if (DateTime.fromISO(order.orderDate) < from) return false;
  }
  if (filters.dateThru) {
    const thru = DateTime.fromISO(filters.dateThru).endOf('day');
    if (DateTime.fromISO(order.orderDate) > thru) return false;
  }
  return true;
}

function inBucket(order: WorkflowOrder, bucket: WorkflowBucket): boolean {
  return order.bucket === bucket;
}

export const useCustomerServiceStore = defineStore('customerService', {
  state: () => ({
    fulfillmentProgress: {
      totalOrdersCount: 0,
      totalShipGroupsCount: 0,
      brokeredShipGroupsCount: 0,
      pickedShipGroupsCount: 0,
      packedShipGroupsCount: 0,
      shippedShipGroupsCount: 0
    } as FulfillmentProgress,
    openOrders: {
      openOrdersCount: 0,
      oldestOpenOrderDate: null as number | null
    },
    unfillable: {
      unfillableHourlyCounts: [] as { shipGroupDateHour: string; shipGroupCount: number }[]
    },
    holdTasks: {
      holdTasksTotalCount: 0,
      holdSubstituteCount: 0,
      holdBadAddressCount: 0,
      holdFraudRiskCount: 0
    },
    facilityOrderVolume: [] as any[],
    facilityFulfillmentVelocity: [] as any[],
    facilityPartialFulfillments: [] as any[],
    facilityFulfillmentProgress: null as FacilityFulfillmentProgress | null,
    pickProfileGroups: [] as any[],
    orders: [] as WorkflowOrder[],
    filters: {
      unfillable: emptyFilters(),
      fraud: emptyFilters(),
      open: emptyFilters(),
      inflight: emptyFilters(),
      packed: emptyFilters()
    } as Record<WorkflowBucket, WorkflowFilters>,
    selection: {
      unfillable: [] as string[],
      fraud: [] as string[],
      open: [] as string[],
      inflight: [] as string[],
      packed: [] as string[]
    } as Record<WorkflowBucket, string[]>,
    lastAction: '' as string,
    fulfillmentSyncData: null as any
  }),
  getters: {
    priorities: () => ['HIGH', 'NORMAL', 'LOW'],
    ordersInBucket: (state) => (bucket: WorkflowBucket) =>
      state.orders.filter((order) => inBucket(order, bucket)),
    filteredOrders(state) {
      return (bucket: WorkflowBucket) => {
        const orderStore = useOrderStore();
        if (bucket === 'open' || bucket === 'inflight' || bucket === 'packed') {
          return orderStore.workflowOrders[bucket];
        }
        const filters = state.filters[bucket];
        return state.orders.filter((order) => inBucket(order, bucket) && matchesFilters(order, filters));
      };
    },
    bucketCounts: (state) => {
      const { workflowOrders } = useOrderStore();
      return {
        unfillable: state.orders.filter((order) => inBucket(order, 'unfillable')).length,
        fraud: state.orders.filter((order) => inBucket(order, 'fraud')).length,
        open: workflowOrders.open.length,
        inflight: workflowOrders.inflight.length,
        packed: workflowOrders.packed.length
      };
    },
    unfillableTrend(state): number[] {
      const todayStr = DateTime.now().toFormat('yyyy-MM-dd');
      return Array.from({ length: 24 }, (_, h) => {
        const match = state.unfillable.unfillableHourlyCounts?.find((d) => {
          const parsed = DateTime.fromSQL(d.shipGroupDateHour).isValid
            ? DateTime.fromSQL(d.shipGroupDateHour)
            : DateTime.fromISO(d.shipGroupDateHour);
          return parsed.isValid && parsed.toFormat('yyyy-MM-dd') === todayStr && parsed.hour === h;
        });
        return match ? match.shipGroupCount : 0;
      });
    },
    getFulfillmentProgress: (state) => state.fulfillmentProgress,
    getOpenOrders: (state) => state.openOrders,
    getUnfillable: (state) => state.unfillable,
    getHoldTasks: (state) => state.holdTasks,
    getFacilityOrderVolume: (state) => state.facilityOrderVolume,
    getFacilityFulfillmentVelocity: (state) => state.facilityFulfillmentVelocity,
    getFacilityPartialFulfillments: (state) => state.facilityPartialFulfillments,
    getFacilityFulfillmentProgress: (state) => state.facilityFulfillmentProgress,
    getFulfillmentSyncData: (state) => state.fulfillmentSyncData
  },
  actions: {
    async fetchFulfillmentProgress(productStoreId?: string) {
      try {
        const resp = await api({
          url: 'oms/orders/funnelDashboard/fulfillmentProgress',
          method: 'GET',
          params: {
            productStoreId: productStoreId,
            dateFilter: DateTime.now().toFormat('yyyy-MM-dd')
          }
        });
        if (resp.data) {
          this.fulfillmentProgress = resp.data;
        }
      } catch (error) {
        console.error('Failed to fetch fulfillment progress', error);
      }
    },
    async fetchOpenOrders(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/openOrders',
          method: 'GET',
          params
        });
        if (resp.data) this.openOrders = resp.data;
      } catch (error) {
        console.error('Failed to fetch open orders', error);
      }
    },
    async fetchUnfillable(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/unfillable',
          method: 'GET',
          params
        });
        if (resp.data) this.unfillable = resp.data;
      } catch (error) {
        console.error('Failed to fetch unfillable stats', error);
      }
    },
    async fetchHoldTasks(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/holdTasks',
          method: 'GET',
          params
        });
        if (resp.data) this.holdTasks = resp.data;
      } catch (error) {
        console.error('Failed to fetch hold task counts', error);
      }
    },
    async fetchFacilityOrderVolume(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityOrderVolume',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityOrderVolume = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility order volume', error);
      }
    },
    async fetchFacilityFulfillmentVelocity(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityFulfillmentVelocity',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityFulfillmentVelocity = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility fulfillment velocity', error);
      }
    },
    async fetchFacilityPartialFulfillments(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityPartialFulfillments',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityPartialFulfillments = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility partial fulfillments', error);
      }
    },
    async fetchFacilityFulfillmentProgress(facilityId: string, productStoreId?: string) {
      try {
        const dateFilter = DateTime.now().toFormat('yyyy-MM-dd'); // Default / demo date filter
        const startOfDayStr = DateTime.fromISO(dateFilter).startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
        const endOfDayStr = DateTime.fromISO(dateFilter).plus({ days: 1 }).startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

        // 1. Fetch Facility Details
        const facilityPromise = api({
          url: `oms/facilities/${facilityId}`,
          method: 'GET'
        }).catch(err => {
          console.error('Failed to fetch facility details', err);
          return { data: {} };
        });

        // 2. Fetch Allocations today
        const allocationsPromise = api({
          url: `oms/facilities/facilityOrderCounts`,
          method: 'GET',
          params: {
            facilityId: facilityId, 
            entryDate: dateFilter
          }
        }).catch(err => {
          console.error('Failed to fetch allocations', err);
          return { data: {} };
        });

        // 3. Fetch Rejections today
        const rejectionsPromise = api({
          url: 'oms/dataDocumentView',
          method: 'POST',
          data: {
            dataDocumentId: 'ORDER_FACILITY_CHANGE',
            customParametersMap: {
              fromFacilityId: facilityId,
              facilityId: 'REJECTED_ITM_PARKING',
              productStoreId,
              pageNoLimit: true,
              changeDatetime_from: startOfDayStr,
              changeDatetime_thru: endOfDayStr
            },
            fieldsToSelect: 'orderId,shipGroupSeqId',
            distinct: true
          }
        }).catch(err => {
          console.error('Failed to fetch rejections', err);
          return { data: {} };
        });

        // 5. Fetch Pending Orders and progress stats
        const progressStatsPromise = api({
          url: 'oms/orders/funnelDashboard/fulfillmentProgress',
          method: 'GET',
          params: {
            facilityId,
            productStoreId,
            dateFilter
          }
        }).catch(err => {
          console.error('Failed to fetch facility fulfillment progress stats', err);
          return { data: {} };
        });

        const [facilityResp, allocationsResp, rejectionsResp, progressStatsResp] = await Promise.all([
          facilityPromise,
          allocationsPromise,
          rejectionsPromise,
          progressStatsPromise
        ]);

        const facilityData = facilityResp.data || {};
        const capacityLimit = facilityData.maximumOrderLimit ? Number(facilityData.maximumOrderLimit) : null;
        const openTime = facilityData.openTime ? String(facilityData.openTime) : null;
        const closeTime = facilityData.closeTime ? String(facilityData.closeTime) : null;
        const facilityTimeZone = facilityData.facilityTimeZone || 'UTC';
        const carrierPickupTime = '16:30:00';

        const allocationsList = allocationsResp.data || [];
        const ordersAllocated = allocationsList.length > 0 ? Number(allocationsList[0].lastOrderCount || 0) : 0;

        const rejectionsList = rejectionsResp.data?.entityValueList || [];
        const uniqueRejected = new Set(rejectionsList.map((item: any) => `${item.orderId}-${item.shipGroupSeqId}`));
        const ordersRejected = uniqueRejected.size;

        const progressData = progressStatsResp.data || {};
        const ordersPacked = Number(progressData.packedShipGroupsCount || 0) + Number(progressData.shippedShipGroupsCount || 0);

        const totalProcessed = ordersPacked + ordersRejected;
        const fillRate = totalProcessed > 0 ? (ordersPacked / totalProcessed) : 0;

        const openCount = Number(progressData.brokeredShipGroupsCount || 0);
        const inProgressCount = Number(progressData.pickedShipGroupsCount || 0);
        const totalPending = openCount + inProgressCount;
        
        let oldestAssignedTime: number | null = null;
        if (progressData.oldestShipGroupAssignedDatetime) {
          const parsed = DateTime.fromISO(String(progressData.oldestShipGroupAssignedDatetime));
          if (parsed.isValid) {
            oldestAssignedTime = parsed.toMillis();
          } else {
            const rawMillis = Date.parse(progressData.oldestShipGroupAssignedDatetime);
            if (!isNaN(rawMillis)) oldestAssignedTime = rawMillis;
          }
        }
        const assignedBeforeTodayCount = 0;

        this.facilityFulfillmentProgress = {
          ordersAllocated,
          ordersPacked,
          ordersRejected,
          capacityLimit,
          fillRate,
          openCount,
          inProgressCount,
          totalPending,
          oldestAssignedTime,
          assignedBeforeTodayCount,
          openTime,
          closeTime,
          facilityTimeZone,
          carrierPickupTime
        };

      } catch (error) {
        console.error('Failed to fetch facility fulfillment progress', error);
      }
    },
    async fetchPickProfileGroups(facilityId?: string) {
      try {
        const params: any = {};
        if (facilityId) params.facilityId = facilityId;
        this.pickProfileGroups = await getPickProfileGroups(params);
      } catch (error) {
        console.error('Failed to fetch pick profile groups', error);
      }
    },
    async updateSortRulesOrder(facilityId: string, updatedSortRules: any[]) {
      const group = this.pickProfileGroups.find(g => g.facilityId === facilityId);
      if (!group) return;

      const activeProfile = group.profiles?.find((p: any) => p.statusId === 'PICK_PROF_ACTIVE');
      if (!activeProfile) return;

      const filters = activeProfile.pickProfileFilters || [];


      updatedSortRules.forEach((rule, idx) => {
        const cond = filters.find((f: any) => f.fieldName === rule.id && f.conditionTypeEnumId === 'ENTCT_SORT_BY');
        if (cond) {
          cond.sequenceNum = (idx + 1) * 10;
        }
      });
      try {
        await this.savePickProfile(activeProfile);
        await this.fetchFulfillmentSyncData(facilityId, activeProfile.productStoreId);
      } catch (error) {
        console.error('Failed to update sort rules order', error);
        commonUtil.showToast(translate('Failed to reorder sort rules.'));
      }
    },
    async addSortRule(facilityId: string, fieldName: string) {
      const group = this.pickProfileGroups.find(g => g.facilityId === facilityId);
      if (!group) return;

      const activeProfile = group.profiles?.find((p: any) => p.statusId === 'PICK_PROF_ACTIVE');
      if (!activeProfile) return;

      const filters = activeProfile.pickProfileFilters || [];

      const alreadyExists = filters.some((f: any) => f.fieldName === fieldName && f.conditionTypeEnumId === 'ENTCT_SORT_BY');
      if (!alreadyExists) {
        const maxSeqId = Math.max(0, ...filters.map((f: any) => parseInt(f.conditionSeqId) || 0));
        const nextSeqId = String(maxSeqId + 1).padStart(2, '0');
        const sortFilters = filters.filter((f: any) => f.conditionTypeEnumId === 'ENTCT_SORT_BY');
        const maxSeqNum = Math.max(0, ...sortFilters.map((f: any) => f.sequenceNum ?? 0));

        filters.push({
          profileId: activeProfile.profileId,
          conditionSeqId: nextSeqId,
          conditionTypeEnumId: 'ENTCT_SORT_BY',
          fieldName,
          conditionOperator: 'equals',
          fieldValue: 'ASC',
          sequenceNum: maxSeqNum + 10
        });
      }
      try {
        await this.savePickProfile(activeProfile);
        await this.fetchFulfillmentSyncData(facilityId, activeProfile.productStoreId);
      } catch (error) {
        console.error('Failed to add sort rule', error);
        commonUtil.showToast(translate('Failed to add sort rule.'));
      }
    },
    async removeSortRule(facilityId: string, fieldName: string) {
      const group = this.pickProfileGroups.find(g => g.facilityId === facilityId);
      if (!group) return;

      const activeProfile = group.profiles?.find((p: any) => p.statusId === 'PICK_PROF_ACTIVE');
      if (!activeProfile) return;

      const filters = activeProfile.pickProfileFilters || [];
      const cond = filters.find((f: any) => f.fieldName === fieldName && f.conditionTypeEnumId === 'ENTCT_SORT_BY');
      if (!cond || !cond.conditionSeqId) return;

      try {
        const resp = await api({
          url: `poorti/pickProfile/${activeProfile.profileId}/conditions/${cond.conditionSeqId}`,
          method: 'DELETE'
        });
        if (resp && commonUtil.hasError(resp)) {
          throw new Error('Failed to delete condition from server');
        }
        await this.fetchFulfillmentSyncData(facilityId, activeProfile.productStoreId);
      } catch (error) {
        console.error('Failed to remove sort rule', error);
        commonUtil.showToast(translate('Failed to remove sort rule.'));
      }
    },
    async updateBatchSize(facilityId: string, batchSize: number) {
      console.log('updateBatchSize called with facilityId:', facilityId, 'batchSize:', batchSize);
      const group = this.pickProfileGroups.find(g => g.facilityId === facilityId);
      if (!group) {
        console.error('updateBatchSize: group not found for facilityId:', facilityId);
        return;
      }

      const activeProfileBasic = group.profiles?.find((p: any) => p.statusId === 'PICK_PROF_ACTIVE');
      if (!activeProfileBasic) {
        console.error('updateBatchSize: activeProfileBasic not found');
        return;
      }

      // Fetch full active profile details first to preserve existing conditions
      let activeProfile = activeProfileBasic;
      try {
        const profileResp = await api({
          url: `poorti/pickProfile/${activeProfileBasic.profileId}`,
          method: 'GET'
        });
        if (profileResp.data) {
          activeProfile = profileResp.data;
        }
      } catch (error) {
        console.error('Failed to fetch profile before updating batch size', error);
      }

      const filters = activeProfile.pickProfileFilters || [];
      console.log('updateBatchSize - existing filters:', JSON.stringify(filters, null, 2));

      let batchSizeFilter = filters.find((f: any) => f.conditionTypeEnumId === 'PPF_BATCH_SIZE' || (f.conditionTypeEnumId === 'ENTCT_FILTER' && f.fieldName === 'orderLimit'));

      if (!batchSizeFilter) {
        console.log('updateBatchSize - no existing batch size filter, creating a new one.');
        const maxSeqId = Math.max(0, ...filters.map((f: any) => parseInt(f.conditionSeqId) || 0));
        const nextSeqId = String(maxSeqId + 1).padStart(2, '0');
        const standardFilters = filters.filter((f: any) => f.conditionTypeEnumId !== 'ENTCT_SORT_BY');
        const maxSeqNum = Math.max(0, ...standardFilters.map((f: any) => f.sequenceNum ?? 0));

        batchSizeFilter = {
          profileId: activeProfile.profileId,
          conditionSeqId: nextSeqId,
          conditionTypeEnumId: 'PPF_BATCH_SIZE',
          fieldName: 'orderLimit',
          conditionOperator: 'equals',
          fieldValue: String(batchSize),
          sequenceNum: maxSeqNum + 10
        };
        filters.push(batchSizeFilter);
      } else {
        console.log('updateBatchSize - found existing filter. Updating and normalizing type.', batchSizeFilter);
        batchSizeFilter.fieldValue = String(batchSize);
        batchSizeFilter.conditionTypeEnumId = 'PPF_BATCH_SIZE'; // ensure it is normalized to PPF_BATCH_SIZE
      }

      try {
        await this.savePickProfile(activeProfile);
        await this.fetchFulfillmentSyncData(facilityId, activeProfile.productStoreId);
      } catch (error) {
        console.error('Failed to update batch size', error);
        commonUtil.showToast(translate('Failed to update batch size.'));
      }
    },
    async fetchFulfillmentSyncData(facilityId: string, productStoreId: string) {
      try {
        const params: any = {};
        if (facilityId) params.facilityId = facilityId;
        this.pickProfileGroups = await getPickProfileGroups(params);

        const group = this.pickProfileGroups.find((g: any) => g.facilityId === facilityId);
        if (!group) {
          this.fulfillmentSyncData = null;
          return;
        }

        const activeProfileBasic = group.profiles?.find((p: any) => p.statusId === 'PICK_PROF_ACTIVE');
        if (!activeProfileBasic) {
          this.fulfillmentSyncData = null;
          return;
        }

        // Fetch the full active profile details containing filters/conditions
        let activeProfile = activeProfileBasic;
        try {
          const profileResp = await api({
            url: `poorti/pickProfile/${activeProfileBasic.profileId}`,
            method: 'GET'
          });
          if (profileResp.data) {
            activeProfile = profileResp.data;
          }
        } catch (error) {
          console.error('Failed to fetch single pick profile details', error);
        }

        const filters = activeProfile.pickProfileFilters || [];

        // 1. Batch Size (PPF_BATCH_SIZE filter value)
        const batchSizeFilter = filters.find((f: any) => f.conditionTypeEnumId === 'PPF_BATCH_SIZE' || (f.conditionTypeEnumId === 'ENTCT_FILTER' && f.fieldName === "orderLimit"));
        const batchSize = batchSizeFilter ? Number(batchSizeFilter.fieldValue) : 200;

        // Fetch Service Job Details for Frequency
        let frequency = 'EVERY 5 MINUTES';
        let jobPaused = 'N';
        let cronExpression = '0 */5 * ? * *';
        if (group.jobName) {
          try {
            const jobResp = await api({
              url: `admin/serviceJobs/${group.jobName}`,
              method: 'GET'
            });
            const jobDetail = jobResp.data?.jobDetail;
            if (jobDetail) {
              frequency = jobDetail.cronDescription || jobDetail.cronExpression || 'EVERY 5 MINUTES';
              jobPaused = jobDetail.paused || 'N';
              cronExpression = jobDetail.cronExpression || '0 */5 * ? * *';
            }
          } catch (error) {
            console.error('Failed to fetch service job details', error);
          }
        }

        // 2. Sort Rules (ENTCT_SORT_BY conditions)
        const sortConditions = filters
          .filter((f: any) => f.conditionTypeEnumId === 'ENTCT_SORT_BY')
          .sort((a: any, b: any) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0));

        const seedStore = useSeedStore() as any;
        const sortParamEnums = seedStore.getEnumsByType('PP_SORT_PARAM_TYPE') || [];

        const sortRules: SortRule[] = sortConditions.map((cond: any) => {
          const enumRecord = sortParamEnums.find((e: any) => e.enumCode === cond.fieldName);
          return {
            id: cond.fieldName,
            name: enumRecord ? enumRecord.description : cond.fieldName,
            sequenceNum: cond.sequenceNum ?? 0,
            conditionSeqId: cond.conditionSeqId
          };
        });

        // 3. Fetch order counts grouped by topSortField
        const topSortField = sortRules[0]?.id || 'deliveryDays';
        let groupByFields = [topSortField];

        let records: any[] = [];
        if (activeProfile.profileId) {
          try {
            const countResp = await api({
              url: `poorti/pickProfile/${activeProfile.profileId}/orderCount`,
              method: 'POST',
              data: {
                groupByFields
              }
            });
            records = countResp.data?.records || [];
          } catch (error) {
            console.error('Failed to fetch pick profile order counts', error);
          }
        }

        const totalPendingSync = records.reduce((sum, rec) => sum + Number(rec.orderCount || 0), 0);

        this.fulfillmentSyncData = {
          settings: {
            pendingSyncCount: totalPendingSync,
            batchSize,
            frequency,
            cronExpression,
            paused: jobPaused,
            jobName: group.jobName,
            sortRules
          },
          rawOrderCountRecords: records
        };
      } catch (error) {
        console.error('Failed to fetch fulfillment sync data', error);
      }
    },
    async updateServiceJob(jobName: string, cronExpression: string, paused: string, facilityId: string, productStoreId: string) {
      try {
        const resp = await api({
          url: `admin/serviceJobs/${jobName}`,
          method: 'PUT',
          data: {
            cronExpression,
            paused
          }
        });
        if (resp && commonUtil.hasError(resp)) {
          throw new Error('Failed to update service job');
        }
        await this.fetchFulfillmentSyncData(facilityId, productStoreId);
        commonUtil.showToast(translate('Fulfillment sync schedule updated successfully.'));
      } catch (error) {
        console.error('Failed to update service job', error);
        commonUtil.showToast(translate('Failed to update fulfillment sync schedule.'));
      }
    },
    async savePickProfile(profile: any) {
      try {
        const resp = await api({
          url: `poorti/pickProfile/${profile.profileId}`,
          method: 'PUT',
          data: profile
        });
        if (resp && commonUtil.hasError(resp)) {
          throw new Error('Failed to save pick profile');
        }
      } catch (error) {
        console.error('Failed to save pick profile', error);
        throw error;
      }
    },
    clearFilters(bucket: WorkflowBucket) {
      this.filters[bucket] = emptyFilters();
    },
    toggleSelection(bucket: WorkflowBucket, orderId: string) {
      const set = new Set(this.selection[bucket]);
      if (set.has(orderId)) set.delete(orderId);
      else set.add(orderId);
      this.selection[bucket] = [...set];
    },
    setSelection(bucket: WorkflowBucket, ids: string[]) {
      this.selection[bucket] = ids;
    },
    clearSelection(bucket: WorkflowBucket) {
      this.selection[bucket] = [];
    },
    async runBulkAction(bucket: WorkflowBucket, actionId: string) {
      const selectedIds = new Set(this.selection[bucket]);
      if (selectedIds.size === 0) return;

      if (bucket === 'open' && actionId === 'cancel') {
        await useOrderDetailStore().bulkCancelOrders([...selectedIds]);
        await useOrderStore().fetchWorkflowOrders(bucket, this.filters[bucket]);
        this.lastAction = `${actionId} · ${selectedIds.size} order${selectedIds.size === 1 ? '' : 's'}`;
        this.clearSelection(bucket);
        return;
      }

      this.orders = this.orders.map((order) => {
        if (!selectedIds.has(order.orderId)) return order;

        if (actionId === 'cancel') {
          return { ...order, statusId: 'ORDER_CANCELLED', bucket: 'open' };
        }
        if (actionId === 'release') {
          return { ...order, statusId: 'ORDER_APPROVED', bucket: 'open' };
        }
        if (actionId === 'rebroker') {
          return { ...order, statusId: 'ORDER_APPROVED', bucket: 'open', facilityId: null, facilityName: null };
        }
        if (actionId === 'wave') {
          return {
            ...order,
            picklistBinId: `BIN-${Math.floor(1000 + Math.random() * 9000)}`,
            bucket: 'packed'
          };
        }
        if (actionId === 'ship') {
          return { ...order, statusId: 'ORDER_COMPLETED', bucket: 'open' };
        }
        return order;
      });

      this.orders = this.orders.filter((order) => order.statusId !== 'ORDER_CANCELLED' && order.statusId !== 'ORDER_COMPLETED');

      this.lastAction = `${actionId} · ${selectedIds.size} order${selectedIds.size === 1 ? '' : 's'}`;
      this.clearSelection(bucket);
    }
  }
});

export const BULK_ACTIONS: Record<WorkflowBucket, BulkActionDefinition[]> = {
  unfillable: [
    { id: 'rebroker', label: 'Rebroker order' },
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  fraud: [
    { id: 'release', label: 'Release order' },
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  open: [
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  inflight: [
    { id: 'wave', label: 'Add to picklist' }
  ],
  packed: [
    { id: 'ship', label: 'Ship orders' }
  ]
};
