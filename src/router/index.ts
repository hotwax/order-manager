import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Login } from '@common';
import { useAuth } from '@common/composables/useAuth';
import OrderSearch from '@/views/OrderSearch.vue';
import OrderDetail from '@/views/OrderDetail.vue';
import Customers from '@/views/Customers.vue';
import CustomerDetail from '@/views/CustomerDetail.vue';
import Settings from '@/views/Settings.vue';
import Funnel from '@/views/Funnel.vue';
import SwapOrders from '@/views/SwapOrders.vue';
import BadAddressOrders from '@/views/BadAddressOrders.vue';
import FraudOrders from '@/views/FraudOrders.vue';
import HoldOrders from '@/views/HoldOrders.vue';
import OpenOrders from '@/views/OpenOrders.vue';
import InflightOrders from '@/views/InflightOrders.vue';
import PackedOrders from '@/views/PackedOrders.vue';
import CreateOrder from '@/views/CreateOrder.vue';

const authGuard = async () => {
  if (!useAuth().isAuthenticated.value) {
    return { path: '/login' };
  }
};

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/funnel'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/funnel',
    name: 'Funnel',
    component: Funnel,
    beforeEnter: authGuard
  },
  {
    path: '/orders',
    name: 'OrderSearch',
    component: OrderSearch,
    beforeEnter: authGuard
  },
  {
    path: '/orders/:orderId',
    name: 'OrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/customers',
    name: 'CustomerFind',
    component: Customers,
    beforeEnter: authGuard
  },
  {
    path: '/customers/:customerId',
    name: 'CustomerDetail',
    component: CustomerDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/swap',
    name: 'SwapOrders',
    component: SwapOrders,
    beforeEnter: authGuard
  },
  {
    path: '/bad-address',
    name: 'BadAddressOrders',
    component: BadAddressOrders,
    beforeEnter: authGuard
  },
  {
    path: '/fraud',
    name: 'FraudOrders',
    component: FraudOrders,
    beforeEnter: authGuard
  },
  {
    path: '/hold',
    name: 'HoldOrders',
    component: HoldOrders,
    beforeEnter: authGuard
  },
  {
    path: '/open',
    name: 'OpenOrders',
    component: OpenOrders,
    beforeEnter: authGuard
  },
  {
    path: '/inflight',
    name: 'InflightOrders',
    component: InflightOrders,
    beforeEnter: authGuard
  },
  {
    path: '/packed',
    name: 'PackedOrders',
    component: PackedOrders,
    beforeEnter: authGuard
  },
  {
    path: '/create-order',
    name: 'CreateOrder',
    component: CreateOrder,
    beforeEnter: authGuard
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    beforeEnter: authGuard
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/funnel'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
