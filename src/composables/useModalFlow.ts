import { computed, inject, provide, reactive, ref, toValue, type InjectionKey, type MaybeRefOrGetter } from 'vue';
import { logger, translate } from '@common';
import { confirmAction, showToast } from '@/utils';

/** An alert the flow shows before it goes on: a title, a body, and the two buttons' words. */
export type ModalAlert = {
  title: string;
  body: string;
  /** The button that goes on. */
  confirmText: string;
  /** The button that stays. Defaults to Cancel. */
  cancelText?: string;
};

export type ModalFlowOptions<T> = {
  /** The modal holds input that closing would lose; exiting asks first. */
  dirty?: MaybeRefOrGetter<boolean>;
  /** The confirm path can run: the form is valid, or something is selected. Defaults to true. */
  canConfirm?: MaybeRefOrGetter<boolean>;
  /**
   * The confirm path's work. What it returns is the modal's result; returning nothing means true.
   * Throw an Error (or a string) to stay open: its message is what the operator reads. Anything
   * else thrown, like an uncaught request error, shows a generic message.
   */
  confirm?: () => T | Promise<T>;
  /** Replaces the default "Discard changes" alert shown when exiting a dirty modal. */
  exitAlert?: ModalAlert;
  /** Asks before the confirm path runs. */
  confirmAlert?: ModalAlert;
  /** The error toast stays up, with a Dismiss button, instead of fading. */
  persistError?: boolean;
};

/**
 * open: waiting for the operator. asking: an alert is up. saving: the confirm path is running.
 * closing: the confirm path succeeded and the modal is on its way out.
 */
export type ModalFlowState = 'open' | 'asking' | 'saving' | 'closing';

export type ModalFlow = {
  readonly state: ModalFlowState;
  /** Nothing else can start: an alert is up, or the confirm path is running. */
  readonly busy: boolean;
  readonly saving: boolean;
  readonly canConfirm: boolean;
  exit: () => Promise<boolean>;
  confirm: () => Promise<void>;
  /** Hands the flow its ion-modal. DxpModalHeader does this; a custom header calls it with any element inside the modal. */
  attach: (element?: Element | null) => void;
};

/** The role the confirm path closes with. Every other way out resolves openModal to undefined. */
export const CONFIRM_ROLE = 'confirm';

const ModalFlowKey: InjectionKey<ModalFlow> = Symbol('ModalFlow');

function errorText(error: unknown) {
  if (typeof error === 'string' && error) return error;
  // A plain Error was raised on purpose with words for the operator; a TypeError or a request error was not.
  if (error instanceof Error && error.name === 'Error' && error.message) return error.message;
  return translate('Something went wrong. Please try again.');
}

/**
 * A modal's two ways out. The exit path (the close button, a backdrop tap, Escape, a swipe, the
 * hardware back button) asks first when the modal is dirty. The confirm path runs the modal's own
 * work, stays open with a toast when that fails, and closes with its result when it succeeds.
 * The modal brings the content and the logic; DxpModalHeader and DxpModalConfirmFab bring the paths.
 */
export function useModalFlow<T = true>(options: ModalFlowOptions<T> = {}): ModalFlow {
  const state = ref<ModalFlowState>('open');
  let host: HTMLIonModalElement | null = null;

  async function ask(alert: ModalAlert) {
    state.value = 'asking';
    try {
      return await confirmAction(alert.title, alert.body, alert.confirmText, alert.cancelText);
    } finally {
      state.value = 'open';
    }
  }

  const exitAlert = (): ModalAlert => options.exitAlert ?? {
    title: translate('Discard changes'),
    body: translate('What you entered will be lost.'),
    confirmText: translate('Discard'),
    cancelText: translate('Keep editing'),
  };

  // Ionic runs this for every dismiss, the confirm path's own included.
  async function canDismiss(_data?: unknown, role?: string) {
    if (state.value === 'closing') return role === CONFIRM_ROLE;
    if (state.value !== 'open') return false;
    if (!toValue(options.dirty)) return true;
    return ask(exitAlert());
  }

  function attach(element?: Element | null) {
    host = element?.closest('ion-modal') ?? null;
    if (host) host.canDismiss = canDismiss;
    else logger.warn('useModalFlow: no ion-modal around this modal, so its exit path cannot ask before closing.');
  }

  const exit = async () => !!(await host?.dismiss(undefined, 'cancel'));

  const canConfirm = computed(() => toValue(options.canConfirm) ?? true);

  async function confirm() {
    if (state.value !== 'open' || !canConfirm.value) return;
    if (options.confirmAlert && !(await ask(options.confirmAlert))) return;

    state.value = 'saving';
    let result: unknown;
    try {
      result = options.confirm ? await options.confirm() : undefined;
    } catch (error) {
      logger.error('The modal could not complete its action', error);
      state.value = 'open';
      await showToast(errorText(error), { persistent: options.persistError });
      return;
    }

    state.value = 'closing';
    const closed = await host?.dismiss(result === undefined ? true : result, CONFIRM_ROLE);
    if (!closed) state.value = 'open';
  }

  const flow = reactive({
    state,
    busy: computed(() => state.value !== 'open'),
    saving: computed(() => state.value === 'saving' || state.value === 'closing'),
    canConfirm,
    exit,
    confirm,
    attach,
  }) as ModalFlow;

  provide(ModalFlowKey, flow);
  return flow;
}

/** The flow of the modal this component sits in. */
export function injectModalFlow(): ModalFlow {
  const flow = inject(ModalFlowKey, null);
  if (!flow) throw new Error('DxpModalHeader and DxpModalConfirmFab need useModalFlow() in the modal that renders them.');
  return flow;
}
