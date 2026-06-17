import { api } from '@common';

export interface SortRule {
  id: string;
  name: string;
  sequenceNum: number;
  conditionSeqId: string;
}

export interface FulfillmentSyncSettings {
  pendingSyncCount: number;
  sortRules: SortRule[];
  batchSize: number;
  frequency: string;
}

export interface QueueSegment {
  id: string;
  label: string;
  orderCount: number;
  estimatedTime: string;
  color: string;
  percentWidth: number;
}

export interface FulfillmentSyncData {
  profileGroupId: string;
  profileId: string;
  pendingSyncCount: number;
  batchSize: number;
  frequency: string;
  sortRules: SortRule[];
  queueSegments: QueueSegment[];
  rawProfile: any;
}

export async function getPickProfileGroups(params?: any): Promise<any[]> {
  try {
    const response = await api({
      url: 'poorti/pickProfile/groups',
      method: 'GET',
      params
    });
    const list = response.data;
    return Array.isArray(list) ? list : list?.entityValueList || [];
  } catch (error) {
    console.error('Failed to get pick profile groups from server', error);
    return [];
  }
}
