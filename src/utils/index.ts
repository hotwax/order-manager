import { alertController, toastController } from '@ionic/vue';
import { alertCircleOutline, checkmarkCircleOutline, removeCircleOutline } from 'ionicons/icons';
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

/** A toast that also offers one follow-up, e.g. jumping to where background work can be watched. */
export const showToastWithAction = async (message: string, actionText: string, handler: () => void) => {
  const toast = await toastController.create({
    message,
    duration: 5000,
    position: 'bottom',
    buttons: [{ text: actionText, role: 'info', handler }],
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

// Risk-fact sentiment: a negative fact pushes risk up, a positive one reassures.
const FACT_SENTIMENT_ORDER: Record<string, number> = {
  SENT_NEGATIVE: 0,
  SENT_NEUTRAL: 1,
  SENT_POSITIVE: 2,
};

export const factSentimentColor = (sentimentEnumId: string): string => {
  const map: Record<string, string> = {
    SENT_NEGATIVE: 'danger',
    SENT_NEUTRAL: 'medium',
    SENT_POSITIVE: 'success',
  };
  return map[sentimentEnumId] ?? 'medium';
}

export const factSentimentIcon = (sentimentEnumId: string): string => {
  const map: Record<string, string> = {
    SENT_NEGATIVE: alertCircleOutline,
    SENT_NEUTRAL: removeCircleOutline,
    SENT_POSITIVE: checkmarkCircleOutline,
  };
  return map[sentimentEnumId] ?? removeCircleOutline;
}

// Surface the risk-increasing facts first, then neutral, then reassuring.
export const sortFactsBySentiment = <T extends { sentimentEnumId?: string }>(facts: T[]): T[] =>
  [...facts].sort((a, b) => (FACT_SENTIMENT_ORDER[a.sentimentEnumId ?? ''] ?? 1) - (FACT_SENTIMENT_ORDER[b.sentimentEnumId ?? ''] ?? 1));

// Tally facts by sentiment for the summary chips.
export const sentimentCounts = (facts: Array<{ sentimentEnumId?: string }> = []) => {
  const counts = { negative: 0, neutral: 0, positive: 0 };
  for (const fact of facts) {
    if (fact.sentimentEnumId === 'SENT_NEGATIVE') counts.negative += 1;
    else if (fact.sentimentEnumId === 'SENT_POSITIVE') counts.positive += 1;
    else counts.neutral += 1;
  }
  return counts;
}
