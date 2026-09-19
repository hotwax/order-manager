import { api } from '@common';

export interface SortRule {
  id: string;
  name: string;
  sequenceNum: number;
  conditionSeqId: string;
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
