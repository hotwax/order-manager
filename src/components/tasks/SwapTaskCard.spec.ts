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
    expect(source).not.toContain("translate('Order facility change routing')");
    expect(source).not.toContain("translate('Routing facility change description')");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
