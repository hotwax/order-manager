import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('fraud task card Figma footer', () => {
  it('renders suggested action as an Ionic item with a described action value', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/FraudTaskCard.vue'), 'utf8');

    expect(source).toContain('class="suggested-action"');
    expect(source).toContain('<ion-text :color="suggestedActionColor(task)">');
    expect(source).toContain('suggestedActionLabel(task)');
    expect(source).toContain('seedStore.enumDescription(task.riskRecommendationEnumId)');
    expect(source).toContain('recommendation.includes(\'CANCEL\') ? \'danger\' : undefined');
    expect(source).toContain('function productImageUrl(productId: string): string');
    expect(source).toContain('getProduct(productId)?.mainImageUrl || \'\'');
    expect(source).toContain(':src="productImageUrl(item.productId)"');
    expect(source).toContain('<p class="overline">{{ payment.paymentMethodTypeId }}</p>');
    expect(source).toContain('<ion-text :color="paymentStatusColor(payment)">{{ paymentStatusLabel(payment) }}</ion-text>');
    expect(source).toContain('return status.includes(\'PENDING\') ? \'warning\' : undefined;');
    expect(source).toContain('<ion-icon slot="start" :icon="informationCircleOutline" color="medium" />');
    expect(source).not.toContain(':color="riskLevelColor(risk.riskLevelEnumId)"');
    expect(source).not.toContain('getProduct(item.productId).mainImageUrl');
    expect(source).not.toContain("{{ translate('Suggested action') }}: {{ task.suggestedAction }}");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
