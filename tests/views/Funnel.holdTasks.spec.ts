import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import HoldTaskCountList from '@/components/tasks/HoldTaskCountList.vue';

vi.mock('@common', () => ({
  translate: (value: string) => value,
}));

const IonListStub = defineComponent({
  name: 'IonList',
  template: '<div><slot /></div>',
});

const IonItemStub = defineComponent({
  name: 'IonItem',
  props: {
    routerLink: {
      type: String,
      required: true,
    },
  },
  template: '<a class="hold-task-row" :href="routerLink" @click.prevent="$router.push(routerLink)"><slot /></a>',
});

const IonLabelStub = defineComponent({
  name: 'IonLabel',
  template: '<span><slot /></span>',
});

describe('Funnel hold task rows', () => {
  it('renders native hrefs for every purpose and preserves click navigation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/funnel', component: {} },
        { path: '/swap', component: {} },
        { path: '/bad-address', component: {} },
        { path: '/fraud', component: {} },
        { path: '/hold', component: {} },
      ],
    });
    await router.push('/funnel');
    await router.isReady();

    const wrapper = mount(HoldTaskCountList, {
      props: {
        holdTaskCounts: [
          { workEffortPurposeTypeId: 'NEG_RES_REVIEW', description: 'Negative Reservation Review', sequenceNum: 10, taskCount: 4 },
          { workEffortPurposeTypeId: 'INVALID_ADDRESS', description: 'Invalid Address', sequenceNum: 20, taskCount: 3 },
          { workEffortPurposeTypeId: 'REVIEW_RISK_ORDER', description: 'Review Risk Order', sequenceNum: 30, taskCount: 2 },
          { workEffortPurposeTypeId: 'ORD_HOLD_MANUAL', description: 'Manual Hold', sequenceNum: 40, taskCount: 1 },
          { workEffortPurposeTypeId: 'ORD_HOLD_CUST_REQ', description: 'Customer Requested Hold', sequenceNum: 50, taskCount: 1 },
          { workEffortPurposeTypeId: 'FUTURE_HOLD', description: 'Future Hold', sequenceNum: null, taskCount: 0 },
        ],
      },
      global: {
        plugins: [router],
        stubs: {
          IonList: IonListStub,
          IonItem: IonItemStub,
          IonLabel: IonLabelStub,
        },
      },
    });

    const rows = wrapper.findAllComponents(IonItemStub);

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.props('routerLink'))).toEqual([
      '/swap',
      '/bad-address',
      '/fraud',
      '/hold?purpose=ORD_HOLD_MANUAL',
      '/hold?purpose=ORD_HOLD_CUST_REQ',
      '/hold?purpose=FUTURE_HOLD',
    ]);
    expect(rows.map((row) => row.attributes('href'))).toEqual([
      '/swap',
      '/bad-address',
      '/fraud',
      '/hold?purpose=ORD_HOLD_MANUAL',
      '/hold?purpose=ORD_HOLD_CUST_REQ',
      '/hold?purpose=FUTURE_HOLD',
    ]);
    expect(wrapper.html()).not.toContain('[object Object]');
    expect(wrapper.text()).toContain('Substitute4 tasks');
    expect(wrapper.text()).toContain('Bad Address3 tasks');
    expect(wrapper.text()).toContain('Fraud Risk2 tasks');
    expect(wrapper.text()).toContain('Manual Hold1 tasks');
    expect(wrapper.text()).toContain('Customer Requested Hold1 tasks');
    expect(wrapper.text()).toContain('Future Hold0 tasks');

    await rows[4].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/hold');
    expect(router.currentRoute.value.query).toEqual({
      purpose: 'ORD_HOLD_CUST_REQ',
    });
  });
});
