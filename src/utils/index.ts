import { toastController } from '@ionic/vue';
import { useProductCacheStore } from '@/store/productCache';

export const showToast = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    position: 'bottom',
  })

  return toast.present();
}

export const isKit = (item: any) => {
  const productCache = useProductCacheStore();
  const product = productCache.getProduct(item.productId);
  return product && product.productTypeId === 'MARKETING_PKG_PICK';
}
