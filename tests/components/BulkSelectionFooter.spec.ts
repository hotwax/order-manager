import { flushPromises, shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BulkSelectionFooter from '@/components/common/BulkSelectionFooter.vue';

const mocks = vi.hoisted(() => ({
  createSheet: vi.fn(),
  downloadCsv: vi.fn()
}));

vi.mock('@common', () => ({
  commonUtil: { downloadCsv: mocks.downloadCsv },
  logger: { error: vi.fn() },
  translate: (key: string) => key
}));

vi.mock('@ionic/vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('@ionic/vue')>(),
  actionSheetController: { create: mocks.createSheet }
}));

vi.mock('@/utils', () => ({ showToast: vi.fn() }));

describe('bulk selection footer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts the CSV download directly from the mobile action sheet tap', async () => {
    mocks.createSheet.mockResolvedValue({
      present: vi.fn(),
      onDidDismiss: vi.fn().mockResolvedValue({})
    });
    const wrapper = shallowMount(BulkSelectionFooter, {
      props: { count: 2, buildCsv: () => 'Order ID\r\n1\r\n2', filename: 'selected-orders.csv' },
      global: { renderStubDefaultSlot: true }
    });

    await wrapper.get('.bulk-action-more').trigger('click');
    const [exportButton, closeButton] = mocks.createSheet.mock.calls[0][0].buttons;
    expect(exportButton.text).toBe('Export selected CSV');
    expect(closeButton.role).toBe('cancel');

    exportButton.handler();
    expect(mocks.downloadCsv).toHaveBeenCalledWith('\uFEFFOrder ID\r\n1\r\n2', 'selected-orders.csv');
  });

  it('keeps a permission-disabled mutation inactive, even if the sheet returns its ID', async () => {
    const cancel = vi.fn();
    mocks.createSheet.mockResolvedValue({
      present: vi.fn(),
      onDidDismiss: vi.fn().mockResolvedValue({ data: { actionId: 'cancel' } })
    });
    const wrapper = shallowMount(BulkSelectionFooter, {
      props: {
        count: 1,
        buildCsv: () => 'Order ID\r\n1',
        filename: 'selected-orders.csv',
        actions: [{ id: 'cancel', label: 'Cancel orders', destructive: true, disabled: true, run: cancel }]
      },
      global: { renderStubDefaultSlot: true }
    });

    await wrapper.get('.bulk-action-more').trigger('click');
    await flushPromises();
    expect(mocks.createSheet.mock.calls[0][0].buttons[1]).toMatchObject({
      text: 'Cancel orders',
      role: 'destructive',
      disabled: true
    });
    expect(cancel).not.toHaveBeenCalled();
  });
});
