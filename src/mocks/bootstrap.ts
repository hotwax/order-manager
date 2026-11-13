import { useHoldDetailsStore } from '@/store/holdDetails';
import { people } from './fixtures';
import { Settings } from 'luxon';
import { setOmsInstanceResolver } from '@/db/orderManagerDb';
import { useUserStore } from '@/store/user';
import Actions from '@/authorization/actions';
const fixturePermissions = [...new Set(Object.values(Actions).flatMap(value => value.split(/ OR | AND /)).filter(Boolean))];
const fixtureStore = { productStoreId: 'AWAY_US', storeName: 'Away US' };
import { useProductStore } from '@/store/productStore';
export async function installFixtures() {
 Settings.defaultZone = 'America/New_York';
 setOmsInstanceResolver(() => 'local-ui-fixtures');
 useHoldDetailsStore().people = people;
 const user = useUserStore();
 user.$patch({ current: { userId: 'demo-operator', username: 'Demo operator', firstName: 'Demo', lastName: 'Operator', timeZone: 'America/New_York', stores: [fixtureStore] }, oms: 'local-ui-fixtures', appVersion: '', permissions: [...fixturePermissions, import.meta.env.VITE_APP_PERMISSION_ID] } as any);
 user.fetchPermissions = async () => { user.fetchStatus.permissions = 'success'; };
 user.fetchStatus.permissions = 'success';
 const product = useProductStore();
 product.$patch({ currentProductStore: fixtureStore, productStores: [fixtureStore] } as any);
 product.initializeProductStore = async () => {};
}
