export function isSwapItemUnavailable(item: any): boolean {
  const quantityNotAvailable = Number(item?.quantityNotAvailable);

  return Number.isFinite(quantityNotAvailable) && quantityNotAvailable < 0;
}
