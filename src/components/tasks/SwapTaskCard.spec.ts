import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('swap task card Figma routing block', () => {
  it('maps the Figma routing detail row to Ionic list primitives', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/SwapTaskCard.vue'), 'utf8');

    expect(source).toContain('gitBranchOutline');
    expect(source).toContain('routingMovementLabel(task)');
    expect(source).toContain("routingPath(task) || translate('Routing details')");
    expect(source).toContain('routingTimestamp(task)');
    expect(source).toContain('formatRoutingTimestamp(task)');
    expect(source).toContain("translate('Routing justification')");
    expect(source).toContain("routingParts.join(' > ')");
    expect(source).toContain('isSwapItemUnavailable(item)');
    expect(source).toContain("translate('Unavailable')");
    expect(source).toContain('<ion-text color="danger">');
    expect(source).toContain('orderedSwapActionItem(item)');
    expect(source).toContain('_sourceOrderItemSeqId: item.orderItemSeqId');
    expect(source).toContain('chevronForwardOutline');
    expect(source).toContain('openSuggestedProductActionsPopover($event, orderedSwapActionItem(item), task)');
    expect(source).toContain('function productImageUrl(productId: string): string');
    expect(source).toContain('getProduct(productId)?.mainImageUrl || \'\'');
    expect(source).toContain(':src="productImageUrl(item.productId)"');
    expect(source).toContain(':src="productImageUrl(suggested.productId)"');
    expect(source).toContain(':progress-value="taskProgressValue(task)"');
    expect(source).toContain(':progress-color="task.progressColor"');
    expect(source).toContain('function taskProgressValue(task: any): number | undefined');
    expect(source).toContain('?? task.progress');
    expect(source).toContain('?? task.progressPercent');
    expect(source).toContain('?? task.completionPercentage');
    expect(source).not.toContain('getProduct(item.productId).mainImageUrl');
    expect(source).not.toContain("translate('Order facility change routing')");
    expect(source).not.toContain("translate('Routing facility change description')");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
