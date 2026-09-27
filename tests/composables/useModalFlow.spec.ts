import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ confirmAction: vi.fn(), showToast: vi.fn() }));

vi.mock('@common', () => ({ translate: (value: string) => value, logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/utils', () => ({ confirmAction: mocks.confirmAction, showToast: mocks.showToast }));

import { useModalFlow, type ModalFlow, type ModalFlowOptions } from '@/composables/useModalFlow';

/** An ion-modal stand-in that dismisses the way Ionic does: only if canDismiss agrees. */
function setup(options: ModalFlowOptions<unknown>) {
  const host: any = document.createElement('ion-modal');
  host.closed = null;
  host.dismiss = async (data?: unknown, role?: string) => {
    if (!(await host.canDismiss(data, role))) return false;
    host.closed = { data, role };
    return true;
  };
  const inside = document.createElement('div');
  host.appendChild(inside);

  let flow!: ModalFlow;
  mount(defineComponent({ setup() { flow = useModalFlow(options); return () => h('div'); } }));
  flow.attach(inside);
  return { flow, host };
}

describe('useModalFlow', () => {
  beforeEach(() => {
    mocks.confirmAction.mockReset();
    mocks.showToast.mockReset();
  });

  it('closes a clean modal without asking', async () => {
    const { flow, host } = setup({});
    await flow.exit();
    expect(mocks.confirmAction).not.toHaveBeenCalled();
    expect(host.closed).toEqual({ data: undefined, role: 'cancel' });
  });

  it('asks before any way out of a dirty modal, and stays when told to', async () => {
    const { host } = setup({ dirty: ref(true) });
    mocks.confirmAction.mockResolvedValue(false);
    expect(await host.dismiss(undefined, 'backdrop')).toBe(false);
    expect(mocks.confirmAction).toHaveBeenCalledWith('Discard changes', 'What you entered will be lost.', 'Discard', 'Keep editing');

    mocks.confirmAction.mockResolvedValue(true);
    expect(await host.dismiss(undefined, 'backdrop')).toBe(true);
  });

  it('uses the modal’s own exit alert when it has one', async () => {
    const { flow } = setup({ dirty: true, exitAlert: { title: 'Discard task', body: 'The task will not be created.', confirmText: 'Discard task' } });
    await flow.exit();
    expect(mocks.confirmAction).toHaveBeenCalledWith('Discard task', 'The task will not be created.', 'Discard task', undefined);
  });

  it('confirms without asking about the input it just saved, and closes with the result', async () => {
    const { flow, host } = setup({ dirty: true, confirm: async () => 'task-1' });
    await flow.confirm();
    expect(mocks.confirmAction).not.toHaveBeenCalled();
    expect(host.closed).toEqual({ data: 'task-1', role: 'confirm' });
  });

  it('closes with true when the work returns nothing', async () => {
    const { flow, host } = setup({ confirm: async () => undefined });
    await flow.confirm();
    expect(host.closed).toEqual({ data: true, role: 'confirm' });
  });

  it('stays open and shows the work’s own error text when it fails', async () => {
    const { flow, host } = setup({ confirm: async () => { throw new Error('Failed to create tasks.'); }, persistError: true });
    await flow.confirm();
    expect(host.closed).toBeNull();
    expect(flow.state).toBe('open');
    expect(mocks.showToast).toHaveBeenCalledWith('Failed to create tasks.', { persistent: true });
  });

  it('shows a generic error for a failure the work did not word', async () => {
    const { flow } = setup({ confirm: async () => { throw new TypeError('x is undefined'); } });
    await flow.confirm();
    expect(mocks.showToast).toHaveBeenCalledWith('Something went wrong. Please try again.', { persistent: undefined });
  });

  it('refuses every way out while the work runs', async () => {
    let finish!: () => void;
    const { flow, host } = setup({ confirm: () => new Promise<void>((resolve) => { finish = resolve; }) });
    const confirming = flow.confirm();
    expect(flow.saving).toBe(true);
    expect(await host.dismiss(undefined, 'backdrop')).toBe(false);
    finish();
    await confirming;
    expect(host.closed?.role).toBe('confirm');
  });

  it('does nothing when it cannot confirm, and asks first when told to', async () => {
    const work = vi.fn();
    const { flow } = setup({ canConfirm: false, confirm: work });
    await flow.confirm();
    expect(work).not.toHaveBeenCalled();

    const asked = setup({ confirm: work, confirmAlert: { title: 'Release order', body: 'The order goes to fulfillment.', confirmText: 'Release' } });
    mocks.confirmAction.mockResolvedValue(false);
    await asked.flow.confirm();
    expect(work).not.toHaveBeenCalled();
    expect(asked.host.closed).toBeNull();
  });
});
