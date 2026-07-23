export type TaskCardActionKind = 'primary' | 'neutral' | 'danger';

export interface TaskCardAction {
  id: string;
  label: string;
  kind: TaskCardActionKind;
  disabled?: boolean;
}
