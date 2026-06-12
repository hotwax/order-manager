import { alertController, toastController } from '@ionic/vue';
import { translate } from '@common';
import { useProductCacheStore } from '@/store/productCache';

export const showToast = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    position: 'bottom',
  })

  return toast.present();
}

export const confirmParkOrder = async (): Promise<boolean> => {
  let confirmed = false;
  const alert = await alertController.create({
    header: translate('Park this order?'),
    message: translate('Parking does not resolve this task. It moves the order to the selected facility and releases the inventory committed to the other items.'),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Park order'),
        role: 'confirm',
        handler: () => {
          confirmed = true;
        },
      },
    ],
  });

  await alert.present();
  await alert.onDidDismiss();
  return confirmed;
}

export const isKit = (item: any) => {
  const productCache = useProductCacheStore();
  const product = productCache.getProduct(item.productId);
  return product && product.productTypeId === 'MARKETING_PKG_PICK';
}

/** Maps an ORDER_RISK_LEVEL enum id to an Ionic color. Shared by the fraud order list and order detail. */
export const riskLevelColor = (riskLevelEnumId: string): string => {
  const map: Record<string, string> = {
    ORLVL_HIGH: 'danger',
    ORLVL_MEDIUM: 'warning',
    ORLVL_LOW: 'success',
    ORLVL_NONE: 'medium',
    ORLVL_PENDING: 'medium',
  };
  return map[riskLevelEnumId] ?? 'medium';
}
