<template>
 <ion-page>
  <ion-header><ion-toolbar><ion-title>{{ translate('Edit hold') }}</ion-title><ion-buttons slot="end"><ion-button @click="modalController.dismiss()">{{ translate('Cancel') }}</ion-button></ion-buttons></ion-toolbar></ion-header>
  <ion-content class="ion-padding">
   <p>{{ task.workEffortName }} · {{ task.orderName || task.orderId }}</p>
   <ion-list>
    <ion-item><ion-textarea label-placement="stacked" :label="translate('Description')" v-model="description" :rows="3" /></ion-item>
    <ion-item><ion-select label-placement="stacked" :label="translate('Assigned to')" v-model="assignee" interface="popover"><ion-select-option value="">{{ translate('Unassigned') }}</ion-select-option><ion-select-option v-for="person in people" :key="person.id" :value="person.id">{{ person.name }}</ion-select-option></ion-select></ion-item>
    <ion-item><ion-select label-placement="stacked" :label="translate('Priority')" v-model="priority" interface="popover"><ion-select-option v-for="value in ['Normal', 'High', 'Urgent']" :key="value" :value="value">{{ translate(value) }}</ion-select-option></ion-select></ion-item>
    <ion-item><ion-input type="datetime-local" label-placement="stacked" :label="translate('Follow up by') + ' (' + timeZone + ')'" v-model="due" /></ion-item>
    <ion-item><ion-textarea label-placement="stacked" :label="translate('Internal notes')" v-model="notes" :rows="3" /></ion-item>
   </ion-list>
   <ion-text v-if="error" color="danger"><p role="alert">{{ error }}</p></ion-text>
   <div style="height:80px" />
   <ion-fab vertical="bottom" horizontal="end" slot="fixed"><ion-fab-button :aria-label="translate('Save hold details')" @click="save" data-testid="save-hold-details"><ion-icon :icon="checkmarkOutline" /></ion-fab-button></ion-fab>
  </ion-content>
 </ion-page>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { DateTime } from 'luxon';
import { useUserStore } from '@/store/user';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonNote, IonText, IonFab, IonFabButton, IonIcon, modalController } from '@ionic/vue';
import { checkmarkOutline } from 'ionicons/icons';
import { translate } from '@common';
import { useHoldDetailsStore } from '@/store/holdDetails';
const props = defineProps<{ task: any; people: {id:string;name:string}[] }>();

const description = ref(props.task.description || '');
const assignee = ref(props.task.assignedParties?.find((p: any) => p.roleTypeId === 'TASK_ASSIGNEE')?.partyId || '');
const priority = ref(props.task.priority || 'Normal');
const notes = ref(props.task.notes || '');
const timeZone = useUserStore().current?.timeZone || 'UTC';
const due = ref(props.task.estimatedCompletionDate ? DateTime.fromISO(props.task.estimatedCompletionDate, {zone:timeZone}).toFormat("yyyy-MM-dd'T'HH:mm") : '');
const error = ref('');
async function save() {
 if (!description.value.trim()) { error.value = translate('Describe why this hold is needed.'); return; }
 const person = props.people.find(p => p.id === assignee.value);
 const assignedParties = (props.task.assignedParties || []).filter((p: any) => p.roleTypeId !== 'TASK_ASSIGNEE');
 if(person) assignedParties.push({roleTypeId:'TASK_ASSIGNEE',partyId:person.id,firstName:person.name.split(' ')[0],lastName:person.name.split(' ').slice(1).join(' '),fromDate:new Date().toISOString()});
 useHoldDetailsStore().save(props.task.workEffortId, {description:description.value.trim(),priority:priority.value,notes:notes.value.trim(),estimatedCompletionDate:due.value ? DateTime.fromISO(due.value, { zone: timeZone }).toUTC().toISO() : null,assignedParties},props.task.history || []);
 await modalController.dismiss(null, 'saved');
}
</script>
