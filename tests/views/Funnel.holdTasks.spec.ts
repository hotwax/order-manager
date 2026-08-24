import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
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
  props: ['href'],
  template: '<div class="hold-task-row"><slot /></div>',
});

const IonLabelStub = defineComponent({
  name: 'IonLabel',
  template: '<span><slot /></span>',
});

describe('Funnel hold task rows', () => {
  it('renders every configured purpose alphabetically and routes specialized and future purposes correctly', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: defineComponent({ template: '<div />' }) }],
    });
    await router.push('/');
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
    // Rows are sorted by their rendered label, not by the order the API returned them.
    expect(rows.map((row) => row.text().replace(/\d+ tasks$/, '').trim())).toEqual([
      'Bad Address',
      'Customer Requested Hold',
      'Fraud Risk',
      'Future Hold',
      'Manual Hold',
      'Substitute',
    ]);
    expect(rows.map((row) => row.props('href'))).toEqual([
      '/bad-address',
      '/hold?purpose=ORD_HOLD_CUST_REQ',
      '/fraud',
      '/hold?purpose=FUTURE_HOLD',
      '/hold?purpose=ORD_HOLD_MANUAL',
      '/swap',
    ]);
    expect(wrapper.text()).toContain('Substitute4 tasks');
    expect(wrapper.text()).toContain('Bad Address3 tasks');
    expect(wrapper.text()).toContain('Fraud Risk2 tasks');
    expect(wrapper.text()).toContain('Manual Hold1 tasks');
    expect(wrapper.text()).toContain('Customer Requested Hold1 tasks');
    expect(wrapper.text()).toContain('Future Hold0 tasks');
  });
});
