import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('ReleaseSwapOrderModal', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/ReleaseSwapOrderModal.vue'), 'utf8');

  it('renders modal structure with Ionic header, content, and footer without grids', () => {
    expect(source).toContain('<ion-header>');
    expect(source).toContain('<ion-content>');
    expect(source).toContain('<ion-footer>');
    expect(source).toContain("translate('Release updated order')");
    expect(source).toContain("translate('Confirm and release')");
    expect(source).toContain("translate('Cancel')");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('displays cancelled items and substituted items lists', () => {
    expect(source).toContain('v-if="cancelledItems.length"');
    expect(source).toContain("translate('Items to cancel')");
    expect(source).toContain('v-if="substitutedItems.length"');
    expect(source).toContain("translate('Substituted items')");
    expect(source).toContain('productImageUrl(item.productId)');
    expect(source).toContain('productPrimary(item)');
    expect(source).toContain('productSecondary(item)');
  });

  it('summarizes original total, new net total value, and refund amount', () => {
    expect(source).toContain("translate('Summary')");
    expect(source).toContain("translate('Original total')");
    expect(source).toContain("translate('New total')");
    expect(source).toContain("translate('Refund to customer')");
    expect(source).toContain('money(grandTotal)');
    expect(source).toContain('money(newTotal)');
    expect(source).toContain('money(refundAmount)');
  });

  it('dismisses modal with confirmed flag', () => {
    expect(source).toContain('function closeModal(confirmed = false)');
    expect(source).toContain('modalController.dismiss({ confirmed });');
    expect(source).toContain('@click="closeModal(false)"');
    expect(source).toContain('@click="closeModal(true)"');
  });
});
