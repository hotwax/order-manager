import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddContactModal from '@/components/AddContactModal.vue';

const mocks = vi.hoisted(() => ({
  states: {} as Record<string, Array<{ geoId: string; geoName: string }>>,
  statesRead: Promise.resolve() as Promise<unknown>,
}));

vi.mock('@common', () => ({
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  const button = { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' };
  return {
    IonButton: button, IonButtons: component, IonContent: component, IonFab: component, IonFabButton: button,
    IonHeader: component, IonIcon: component, IonInput: component, IonItem: component, IonList: component,
    IonSelect: component, IonSelectOption: component, IonTitle: component, IonToolbar: component,
    modalController: { dismiss: vi.fn() },
  };
});

vi.mock('@common/db', () => ({
  useSeedData: () => ({
    countries: () => [{ geoId: 'USA', geoName: 'United States' }, { geoId: 'SGP', geoName: 'Singapore' }],
    states: () => Object.values(mocks.states).flat(),
    statesForCountry: (countryGeoId: string) => mocks.states[countryGeoId] ?? [],
    getStatesForCountry: async (countryGeoId: string) => {
      await mocks.statesRead;
      return mocks.states[countryGeoId] ?? [];
    },
  }),
}));

const address = (countryGeoId: string, stateProvinceGeoId = '') => ({
  contactMechId: 'CM1',
  contactMechTypeId: 'POSTAL_ADDRESS',
  postalAddress: { address1: '1 Main St', city: 'Somewhere', postalCode: '12345', countryGeoId, stateProvinceGeoId },
});

const mountModal = (existingContact: any) =>
  mount(AddContactModal, { props: { contactMechTypeId: 'POSTAL_ADDRESS', existingContact } });

const saveButton = (wrapper: ReturnType<typeof mountModal>) =>
  wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Save')!;

describe('add contact modal postal address', () => {
  beforeEach(() => {
    mocks.states = { USA: [{ geoId: 'NY', geoName: 'New York' }] };
    mocks.statesRead = Promise.resolve();
  });

  it('saves an address for a country that has no states', async () => {
    const wrapper = mountModal(address('SGP'));
    await flushPromises();

    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();
  });

  it('holds Save while the geo tables are still being read', async () => {
    let finishRead!: () => void;
    mocks.statesRead = new Promise<void>((resolve) => { finishRead = resolve; });

    const wrapper = mountModal(address('SGP'));
    await flushPromises();
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();

    finishRead();
    await flushPromises();
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();
  });

  it('still requires a state for a country that has them', async () => {
    const wrapper = mountModal(address('USA'));
    await flushPromises();
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();

    const withState = mountModal(address('USA', 'NY'));
    await flushPromises();
    expect(saveButton(withState).attributes('disabled')).toBeUndefined();
  });
});
