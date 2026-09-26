import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { modalController } from '@ionic/vue';
import { useOrderActions } from '@/composables/useOrderActions';
import type { EnrichedOrder } from '@/types/orderDetail';

vi.mock('@ionic/vue', async (importOriginal) => ({ ...(await importOriginal<any>()), modalController: { create: vi.fn() } }));

/** The next modal dismisses with this role. */
function dismissModalWith(role: string | undefined) {
  vi.mocked(modalController.create).mockResolvedValue({
    present: vi.fn(),
    onWillDismiss: vi.fn().mockResolvedValue({ role }),
  } as any);
}

function setup() {
  const order = { id: 'O1', statusId: 'ORDER_APPROVED', shipGroups: [], groupedItems: [], identifications: [] } as unknown as EnrichedOrder;
  const loadOrder = vi.fn();
  const actions = useOrderActions({
    order: ref(order),
    loadOrder,
    selectedItemIds: ref(new Set<string>()),
    selectedShipGroupItems: ref({}),
    selectedSegment: ref('items'),
  });
  return { actions, loadOrder };
}

describe('manage order identifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(modalController.create).mockReset();
  });

  // The modal closes with 'confirm' after an edit and 'cancel' without one; a backdrop tap or
  // Escape gives 'backdrop' or no role at all, whether or not anything changed.
  it.each(['confirm', 'backdrop', undefined])('reloads the order when the modal closes with %s', async (role) => {
    const { actions, loadOrder } = setup();
    dismissModalWith(role);

    await actions.openManageIdentificationsModal();

    expect(loadOrder).toHaveBeenCalledWith('O1', true);
  });

  it('skips the reload when the modal is closed without changes', async () => {
    const { actions, loadOrder } = setup();
    dismissModalWith('cancel');

    await actions.openManageIdentificationsModal();

    expect(loadOrder).not.toHaveBeenCalled();
  });
});
