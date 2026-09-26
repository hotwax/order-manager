import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageOrderAttributesModal from '@/components/orders/ManageOrderAttributesModal.vue';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  dismiss: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@common', () => ({
  api: mocks.api,
  commonUtil: { hasError: () => false },
  translate: (value: string) => value,
}));

vi.mock('@/utils', () => ({ showToast: mocks.showToast }));

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: { props: ['message'], template: '<p class="empty">{{ message }}</p>' },
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  const button = { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' };
  return {
    IonBadge: { template: '<span class="badge"><slot /></span>' },
    IonButton: button,
    IonButtons: component,
    IonContent: component,
    IonFab: component,
    IonFabButton: button,
    IonHeader: component,
    IonIcon: component,
    IonInput: {
      props: ['modelValue', 'label'],
      emits: ['update:modelValue'],
      template: '<input :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    IonItem: component,
    IonLabel: component,
    IonList: component,
    IonListHeader: component,
    IonSpinner: component,
    IonTitle: component,
    IonToolbar: component,
    modalController: { dismiss: mocks.dismiss },
  };
});

type Attribute = { attrName: string; attrValue?: string; attrDescription?: string };

const mountWith = (attributes: Attribute[]) => mount(ManageOrderAttributesModal, { props: { orderId: 'O1', attributes } });
type Modal = ReturnType<typeof mountWith>;

const button = (wrapper: Modal, label: string) => wrapper.find(`button[aria-label="${label}"]`);
const click = async (wrapper: Modal, label: string) => {
  await button(wrapper, label).trigger('click');
  await flushPromises();
};
const clickAdd = async (wrapper: Modal) => {
  await wrapper.findAll('button').find((candidate) => candidate.text() === 'Add')!.trigger('click');
  await flushPromises();
};
const fill = async (wrapper: Modal, fields: Record<string, string>) => {
  for (const [label, value] of Object.entries(fields)) await wrapper.find(`input[data-label="${label}"]`).setValue(value);
};
/** The names of the rows carrying the Unsaved marker. */
const unsaved = (wrapper: Modal) => wrapper.findAll('.attribute-kv')
  .filter((row) => row.find('.badge').exists())
  .map((row) => row.find('dt').text());

describe('manage order attributes modal', () => {
  beforeEach(() => {
    mocks.api.mockReset().mockResolvedValue({ data: {} });
    mocks.dismiss.mockReset();
    mocks.showToast.mockReset();
  });

  it('adds to the list without saving, then saves when the operator clicks Save', async () => {
    const wrapper = mountWith([]);
    await fill(wrapper, { Name: ' gift_message ', Value: 'Happy birthday', Description: 'From checkout' });

    await clickAdd(wrapper);

    expect(mocks.api).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('gift_message');
    expect((wrapper.find('input[data-label="Name"]').element as HTMLInputElement).value).toBe('');

    await click(wrapper, 'Save');

    expect(mocks.api).toHaveBeenCalledWith({
      url: 'oms/orders/O1/attributes',
      method: 'POST',
      data: { attrName: 'gift_message', attrValue: 'Happy birthday', attrDescription: 'From checkout' },
    });
    expect(mocks.dismiss).toHaveBeenCalledWith(undefined, 'confirm');
  });

  it('saves an attribute still typed into the form rather than dropping it', async () => {
    const wrapper = mountWith([]);
    await fill(wrapper, { Name: 'gift_message', Value: 'Hi' });

    await click(wrapper, 'Save');

    expect(mocks.api).toHaveBeenCalledWith({ url: 'oms/orders/O1/attributes', method: 'POST', data: { attrName: 'gift_message', attrValue: 'Hi' } });
  });

  it('will not add an attribute the order already has, whatever its case', async () => {
    const wrapper = mountWith([{ attrName: 'gift_message', attrValue: 'Hi' }]);
    await fill(wrapper, { Name: 'Gift_Message' });

    await clickAdd(wrapper);
    await click(wrapper, 'Save');

    expect(mocks.showToast).toHaveBeenCalledWith('This attribute already exists.');
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });

  it('saves an edited value with the description it already had', async () => {
    const wrapper = mountWith([{ attrName: 'gift_message', attrValue: 'Hi', attrDescription: 'From checkout' }]);

    await click(wrapper, 'Edit');
    await fill(wrapper, { gift_message: 'Hello' });
    await click(wrapper, 'Done');

    expect(mocks.api).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Hello');

    await click(wrapper, 'Save');

    expect(mocks.api).toHaveBeenCalledWith({
      url: 'oms/orders/O1/attributes',
      method: 'POST',
      data: { attrName: 'gift_message', attrValue: 'Hello', attrDescription: 'From checkout' },
    });
  });

  it('deletes on Save, and sends nothing for attributes left as they were', async () => {
    const wrapper = mountWith([{ attrName: 'utm source', attrValue: 'google' }, { attrName: 'utm_medium', attrValue: 'cpc' }]);

    await wrapper.findAll('button[aria-label="Delete"]')[0].trigger('click');

    expect(mocks.api).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('utm source');

    await click(wrapper, 'Save');

    expect(mocks.api.mock.calls).toEqual([[{ url: 'oms/orders/O1/attributes/utm%20source', method: 'DELETE' }]]);
  });

  it('marks added and edited rows as unsaved, and clears the mark when an edit is put back', async () => {
    const wrapper = mountWith([{ attrName: 'utm_medium', attrValue: 'cpc' }, { attrName: 'utm_source', attrValue: 'google' }]);
    expect(unsaved(wrapper)).toEqual([]);

    await fill(wrapper, { Name: 'gift_message', Value: 'Hi' });
    await clickAdd(wrapper);
    await click(wrapper, 'Edit');
    await fill(wrapper, { utm_medium: 'email' });
    await click(wrapper, 'Done');

    expect(unsaved(wrapper)).toEqual(['utm_medium', 'gift_message']);

    await click(wrapper, 'Edit');
    await fill(wrapper, { utm_medium: 'cpc' });
    await click(wrapper, 'Done');

    expect(unsaved(wrapper)).toEqual(['gift_message']);
  });

  it('cannot be closed, by any route, while a save is still writing', async () => {
    const host = document.createElement('ion-modal') as HTMLElement & { canDismiss?: () => boolean };
    document.body.appendChild(host);
    let finish!: (value: unknown) => void;
    mocks.api.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const wrapper = mount(ManageOrderAttributesModal, { props: { orderId: 'O1', attributes: [] }, attachTo: host });
    await fill(wrapper, { Name: 'gift_message' });
    expect(host.canDismiss?.()).toBe(true);

    await button(wrapper, 'Save').trigger('click');
    await flushPromises();

    expect(host.canDismiss?.()).toBe(false);
    expect(button(wrapper, 'Close').attributes('disabled')).toBeDefined();
    expect(mocks.dismiss).not.toHaveBeenCalled();

    finish({ data: {} });
    await flushPromises();

    expect(host.canDismiss?.()).toBe(true);
    expect(mocks.dismiss).toHaveBeenCalledWith(undefined, 'confirm');
    wrapper.unmount();
    host.remove();
  });

  it('keeps Save disabled and closes without a reload when nothing changed', async () => {
    const wrapper = mountWith([{ attrName: 'gift_message', attrValue: 'Hi' }]);

    expect(button(wrapper, 'Save').attributes('disabled')).toBeDefined();
    await click(wrapper, 'Close');

    expect(mocks.dismiss).toHaveBeenCalledWith(undefined, 'cancel');
  });

  it('retries only what failed, and reports the part that went through when closed', async () => {
    const wrapper = mountWith([{ attrName: 'old', attrValue: 'x' }]);
    await wrapper.find('button[aria-label="Delete"]').trigger('click');
    await fill(wrapper, { Name: 'new', Value: 'y' });
    mocks.api.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('offline'));

    await click(wrapper, 'Save');

    expect(mocks.showToast).toHaveBeenCalledWith('Failed to save attributes. Please try again.');
    expect(mocks.dismiss).not.toHaveBeenCalled();
    expect(unsaved(wrapper)).toEqual(['new']);

    mocks.api.mockReset().mockResolvedValue({ data: {} });
    await click(wrapper, 'Save');

    expect(mocks.api.mock.calls).toEqual([[{ url: 'oms/orders/O1/attributes', method: 'POST', data: { attrName: 'new', attrValue: 'y' } }]]);
    expect(mocks.dismiss).toHaveBeenCalledWith(undefined, 'confirm');
  });
});
