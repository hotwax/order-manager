import { computed, ref, watch, type Ref } from 'vue';

/** Selection follows the currently loaded results. Appending a page keeps the existing selection. */
export function useFindSelection(resultIds: Ref<readonly string[]>) {
  const selectMode = ref(false);
  const selectedIds = ref<string[]>([]);
  const loaded = computed(() => new Set(resultIds.value.filter(Boolean)));
  const selected = computed(() => new Set(selectedIds.value));
  const allSelected = computed(() => loaded.value.size > 0 && selected.value.size === loaded.value.size);
  const someSelected = computed(() => selected.value.size > 0);

  watch(loaded, (ids) => {
    selectedIds.value = selectedIds.value.filter((id) => ids.has(id));
  }, { flush: 'sync' });

  function setSelected(id: string, checked: boolean) {
    if (!selectMode.value || !loaded.value.has(id)) return;
    if (checked && !selected.value.has(id)) {
      selectedIds.value = [...selectedIds.value, id];
    } else if (!checked) {
      selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id);
    }
  }

  function toggleSelected(id: string) {
    setSelected(id, !selected.value.has(id));
  }

  function selectAll(checked: boolean) {
    if (selectMode.value) selectedIds.value = checked ? [...loaded.value] : [];
  }

  function clearSelection() {
    selectedIds.value = [];
  }

  function exitSelectMode() {
    clearSelection();
    selectMode.value = false;
  }

  function toggleSelectMode() {
    if (selectMode.value) exitSelectMode();
    else selectMode.value = true;
  }

  return { selectMode, selectedIds, selected, allSelected, someSelected, setSelected, toggleSelected, selectAll, clearSelection, exitSelectMode, toggleSelectMode };
}
