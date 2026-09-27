import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), role: '' }));

vi.mock('@ionic/vue', () => ({
  alertController: { create: mocks.create },
  toastController: { create: vi.fn() },
}));
vi.mock('@common', () => ({ translate: (value: string) => value }));
vi.mock('@/store/productCache', () => ({ useProductCacheStore: () => ({}) }));

import { confirmAction } from '@/utils';

describe('confirm action', () => {
  beforeEach(() => {
    mocks.create.mockReset().mockImplementation(async () => ({
      present: vi.fn(),
      onDidDismiss: async () => ({ role: mocks.role }),
    }));
  });

  it('asks with Cancel first and the action verb second', async () => {
    mocks.role = 'confirm';

    expect(await confirmAction('Delete contact', 'This contact will be removed.', 'Delete')).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({
      header: 'Delete contact',
      message: 'This contact will be removed.',
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'confirm' }],
    });
  });

  it('goes ahead only on the confirm button', async () => {
    mocks.role = 'backdrop';
    expect(await confirmAction('Delete contact', 'This contact will be removed.', 'Delete')).toBe(false);
  });
});
