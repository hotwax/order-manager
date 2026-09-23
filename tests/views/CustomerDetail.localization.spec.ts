import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('CustomerDetail and RelationshipHistoryModal localization', () => {
  const customerDetailSource = readFileSync(resolve(process.cwd(), 'src/views/CustomerDetail.vue'), 'utf8');
  const modalSource = readFileSync(resolve(process.cwd(), 'src/components/RelationshipHistoryModal.vue'), 'utf8');
  const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/en-US.json'), 'utf8'));
  const es = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/es-ES.json'), 'utf8'));

  it('localizes all segment button labels in CustomerDetail', () => {
    const segmentLabels = ['Dashboard', 'Tasks', 'Unfillable', 'Orders', 'Returns', 'Comms'];
    segmentLabels.forEach((label) => {
      expect(customerDetailSource).toContain(`{{ translate('${label}') }}`);
      expect(en[label]).toBeDefined();
      expect(es[label]).toBeDefined();
    });

    expect(es['Dashboard']).toBe('Panel');
    expect(es['Orders']).toBe('Pedidos');
    expect(es['Returns']).toBe('Devoluciones');
  });

  it('localizes title, empty state, and status badges in RelationshipHistoryModal', () => {
    expect(modalSource).toContain("{{ translate('Relationship History') }}");
    expect(modalSource).toContain("{{ translate('No relationship history for this customer.') }}");
    expect(modalSource).toContain("{{ entry.active ? translate('Active') : translate('Expired') }}");
    expect(modalSource).toContain("{{ translate('Active') }}");

    expect(en['Relationship History']).toBe('Relationship History');
    expect(es['Relationship History']).toBe('Historial de relaciones');
    expect(en['No relationship history for this customer.']).toBe('No relationship history for this customer.');
    expect(es['No relationship history for this customer.']).toBe('No hay historial de relaciones para este cliente.');
    expect(en['Active']).toBe('Active');
    expect(es['Active']).toBe('Activo');
    expect(en['Expired']).toBe('Expired');
    expect(es['Expired']).toBe('Expirado');
  });
});
