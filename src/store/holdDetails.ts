import { defineStore } from 'pinia';
// Frontend draft contract for the richer hold editor; no new backend writes.
export const useHoldDetailsStore = defineStore('holdDetailsDrafts', {
 state: () => ({ byId: {} as Record<string, any>, people: [] as {id:string;name:string}[] }),
 actions: { save(id: string, details: any, previousHistory: any[]) {
  this.byId[id] = { ...details, history: [...previousHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), actor: 'Demo operator', message: 'Updated hold details, ownership and follow-up.' }] };
 } }, persist: { pick: ['byId'] }
});
