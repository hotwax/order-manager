import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Login, translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import { useUserStore } from '@/store/user';
import { showToast } from '@/utils';
import OrderSearch from '@/views/OrderSearch.vue';
import OrderDetail from '@/views/OrderDetail.vue';
import ReturnDetail from '@/views/ReturnDetail.vue';
import Customers from '@/views/Customers.vue';
import CustomerDetail from '@/views/CustomerDetail.vue';
import Settings from '@/views/Settings.vue';
import Funnel from '@/views/Funnel.vue';
import SwapOrders from '@/views/SwapOrders.vue';
import BadAddressOrders from '@/views/BadAddressOrders.vue';
import FraudOrders from '@/views/FraudOrders.vue';
import HoldOrders from '@/views/HoldOrders.vue';
import UnfillableOrders from '@/views/UnfillableOrders.vue';
import BrokeringQueue from '@/views/BrokeringQueue.vue';
import OpenOrders from '@/views/OpenOrders.vue';
import InflightOrders from '@/views/InflightOrders.vue';
import PackedOrders from '@/views/PackedOrders.vue';
import CreateOrder from '@/views/CreateOrder.vue';
import Actions from "@/authorization/actions";

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
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/orders',
    name: 'OrderSearch',
    component: OrderSearch,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/orders/:orderId',
    name: 'OrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/returns/:returnId',
    name: 'ReturnDetail',
    component: ReturnDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: `${Actions.APP_ORDERS_VIEW} OR ${Actions.APP_CUSTOMERS_VIEW}`
    }
  },
  {
    path: '/open/:orderId',
    name: 'OpenOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/packed/:orderId',
    name: 'PackedOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/inflight/:orderId',
    name: 'InflightOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/customers',
    name: 'CustomerFind',
    component: Customers,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_CUSTOMERS_VIEW
    }
  },
  {
    path: '/customers/:customerId',
    name: 'CustomerDetail',
    component: CustomerDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_CUSTOMERS_VIEW
    }
  },
  {
    path: '/unfillable',
    name: 'UnfillableOrders',
    component: UnfillableOrders,
    beforeEnter: authGuard
  },
  {
    path: '/swap',
    name: 'SwapOrders',
    component: SwapOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_SWAP_ORDER
    }
  },
  {
    path: '/bad-address',
    name: 'BadAddressOrders',
    component: BadAddressOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDER_UPDATE
    }
  },
  {
    path: '/fraud',
    name: 'FraudOrders',
    component: FraudOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDER_CANCEL
    }
  },
  {
    path: '/hold',
    name: 'HoldOrders',
    component: HoldOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDER_UPDATE
    }
  },
  {
    path: '/brokering',
    name: 'BrokeringQueue',
    component: BrokeringQueue,
    beforeEnter: authGuard
  },
  {
    path: '/open',
    name: 'OpenOrders',
    component: OpenOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/inflight',
    name: 'InflightOrders',
    component: InflightOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/packed',
    name: 'PackedOrders',
    component: PackedOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: Actions.APP_ORDERS_VIEW
    }
  },
  {
    path: '/create-order',
    name: 'CreateOrder',
    component: CreateOrder,
    beforeEnter: authGuard,
    meta: {
      permissionId: `${Actions.APP_ORDER_CREATE} OR ${Actions.APP_CUSTOMER_CREATE}`
    }
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

router.beforeEach((to, from) => {
  // Enforce the canonical version URL on every navigation (no-op until the version is resolved, or if
  // already canonical). Redirect cancels this navigation. Logic lives in useAuth so it's shared.
  if (useAuth().checkAppVersionRedirect()) return false;

  if (to.meta.permissionId && !useUserStore().hasPermission(to.meta.permissionId)) {
    let redirectToPath = from.path;
    // If the user has navigated from Login page or if it is page load, redirect user to settings page without showing any toast
    if (redirectToPath == "/login" || redirectToPath == "/") redirectToPath = "/settings";
    else {
      showToast(translate('You do not have permission to access this page'));
    }
    return {
      path: redirectToPath,
    }
  }
});

export default router;
