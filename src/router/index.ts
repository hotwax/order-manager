import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Login, translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import { useUserStore } from '@/store/user';
import { showToast } from '@/utils';
import {
  CUSTOMER_CREATE_PERMISSION,
  CUSTOMER_VIEW_PERMISSION,
  ORDER_CANCEL_PERMISSION,
  ORDER_CREATE_PERMISSION,
  ORDER_UPDATE_PERMISSION,
  ORDER_VIEW_PERMISSION,
  SWAP_ORDER_PERMISSION
} from '@/authorization/permissions';
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
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/orders',
    name: 'OrderSearch',
    component: OrderSearch,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/orders/:orderId',
    name: 'OrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/returns/:returnId',
    name: 'ReturnDetail',
    component: ReturnDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: `${ORDER_VIEW_PERMISSION} OR ${CUSTOMER_VIEW_PERMISSION}`
    }
  },
  {
    path: '/open/:orderId',
    name: 'OpenOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/packed/:orderId',
    name: 'PackedOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/inflight/:orderId',
    name: 'InflightOrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/customers',
    name: 'CustomerFind',
    component: Customers,
    beforeEnter: authGuard,
    meta: {
      permissionId: CUSTOMER_VIEW_PERMISSION
    }
  },
  {
    path: '/customers/:customerId',
    name: 'CustomerDetail',
    component: CustomerDetail,
    props: true,
    beforeEnter: authGuard,
    meta: {
      permissionId: CUSTOMER_VIEW_PERMISSION
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
      permissionId: SWAP_ORDER_PERMISSION
    }
  },
  {
    path: '/bad-address',
    name: 'BadAddressOrders',
    component: BadAddressOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_UPDATE_PERMISSION
    }
  },
  {
    path: '/fraud',
    name: 'FraudOrders',
    component: FraudOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_CANCEL_PERMISSION
    }
  },
  {
    path: '/hold',
    name: 'HoldOrders',
    component: HoldOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_UPDATE_PERMISSION
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
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/inflight',
    name: 'InflightOrders',
    component: InflightOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/packed',
    name: 'PackedOrders',
    component: PackedOrders,
    beforeEnter: authGuard,
    meta: {
      permissionId: ORDER_VIEW_PERMISSION
    }
  },
  {
    path: '/create-order',
    name: 'CreateOrder',
    component: CreateOrder,
    beforeEnter: authGuard,
    meta: {
      permissionId: `${ORDER_CREATE_PERMISSION} OR ${CUSTOMER_CREATE_PERMISSION}`
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
  const permissionId = to.meta.permissionId as string | undefined;

  if (permissionId && !useUserStore().hasPermission(permissionId)) {
    showToast(translate('The requested page was not available to your user. Please contact your administrator to update your permissions.'));

    if (from.path === '/login' || from.path === '/') {
      return { path: '/settings' };
    }

    return { path: from.path };
  }
});

export default router;
