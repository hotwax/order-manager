<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Hold') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search unfillable orders...')"
        @search="fetchHoldTasks()"
        @clear="clearFilters"
      >
        
        <ion-input v-model="dateAfter" :label="translate('Date after')" label-placement="stacked" type="date" />
        <ion-input v-model="dateBefore" :label="translate('Date before')" label-placement="stacked" type="date" />
        <ion-select v-model="orderChannel" :label="translate('Channel')" label-placement="stacked" interface="popover">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-item lines="none" class="select-all-item" v-if="heldTasks.length">
        <ion-checkbox slot="start" v-model="selectAll" />
        <ion-label>{{ translate('Select all') }}</ion-label>
      </ion-item>

      <div class="hold-orders-list">
        <ion-card v-if="heldTasks.length" v-for="task in heldTasks" :key="task.workEffortId">
          <ion-item lines="none">
            <ion-checkbox slot="start" v-model="selectedOrders[task.workEffortId]" />
            <ion-label>
              {{ task.orderName }}
              <p>{{ task.orderDate }}</p>
            </ion-label>
            <ion-chip slot="end" outline color="medium">
              {{ translate('Task') }}: {{ task.workEffortId }}
            </ion-chip>
            <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
          </ion-item>

          <ion-card-content>
            <!-- Contact Details -->
            <div class="contact-details border-top ion-padding-top">
              <ion-item lines="none">
                <ion-icon slot="start" :icon="personOutline" />
                <ion-label>
                  {{ getCustomerName(task.customer) }}
                  <p>{{ translate('Customer') }}</p>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button fill="clear" :href="'tel:' + commonUtil.formatPhoneNumber(task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber)">
                    <ion-icon slot="icon-only" :icon="callOutline" />
                  </ion-button>
                  <ion-button fill="clear" :href="'mailto:' + (task.billingEmail ?? task.shippingEmail)">
                    <ion-icon slot="icon-only" :icon="mailOutline" />
                  </ion-button>
                </ion-buttons>
              </ion-item>

              <ion-item lines="none" v-if="task.customerPhone">
                <ion-label>
                  <p>{{ translate('Telecom contact') }}</p>
                  {{ task.customerPhone }}
                </ion-label>
              </ion-item>

              <ion-item lines="none" v-if="task.customerEmail">
                <ion-label>
                  <p>{{ translate('Email contact') }}</p>
                  {{ task.customerEmail }}
                </ion-label>
              </ion-item>
            </div>

            <!-- Task Details -->
            <div class="task-details border-top ion-padding-top">
              <ion-list lines="none">
                <ion-item>
                  <ion-label>
                    {{ task.workEffortName }}
                    <p>{{ task.purposeDescription }}</p>
                  </ion-label>
                  <ion-note slot="end" v-if="task.estimatedCompletionDate">{{ translate('Due') }}: {{ task.estimatedCompletionDate }}</ion-note>
                </ion-item>
                <ion-item v-if="task.notes">
                  <ion-label>
                    <p>{{ translate('Notes') }}</p>
                    {{ task.notes }}
                  </ion-label>
                </ion-item>
              </ion-list>

              <ion-list lines="none" class="ion-margin-top">
                <ion-item>
                  <ion-label>
                    {{ getAssignedParty(task, 'TASK_ASSIGNEE') }}
                    <p>{{ translate('Assignee') }}</p>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>
                    {{ getAssignedParty(task, 'TASK_REPORTER') }}
                    <p>{{ translate('Reporter') }}</p>
                  </ion-label>
                </ion-item>
              </ion-list>

              <ion-list lines="none" class="ion-margin-top">
                <ion-item>
                  <ion-textarea
                    :label="translate('Resolution comment')"
                    label-placement="stacked"
                    :placeholder="translate('Enter resolution comment...')"
                    v-model="resolutionComments[task.workEffortId]"
                  />
                </ion-item>
              </ion-list>
            </div>

            <!-- Actions -->
            <div class="actions border-top ion-margin-top ion-padding-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary" @click="resolveTask(task.workEffortId)">{{ translate('Resolve task') }}</ion-button>
                <ion-button fill="outline" color="secondary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
              </ion-buttons>
            </div>
          </ion-card-content>
        </ion-card>
        <div class="empty-state" v-if="!heldTasks.length">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

      <ion-infinite-scroll
        @ionInfinite="loadMoreHoldTasks($event)"
        threshold="100px"
        v-if="isScrollable"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="heldTasks.length">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks" @click="resolveSelectedTasks()">{{ translate('Resolve') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonChip,
  IonTextarea,
  alertController,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter
} from '@ionic/vue';
import {
  personOutline,
  callOutline,
  mailOutline
} from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import { useUserStore } from '@/store/user';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));

const searchQuery = ref('');
const swappable = ref(false);
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectAll = ref(false);
const resolutionComments = ref<Record<string, string>>({});
const selectedOrders = ref<Record<string, boolean>>({});

const heldTasks = computed(() => orderTaskStore.getHoldTasks);
const isScrollable = computed(() => orderTaskStore.isHoldTasksScrollable);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => !!(searchQuery.value || dateAfter.value || dateBefore.value || orderChannel.value));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([dateAfter, dateBefore, orderChannel], () => {
  fetchHoldTasks();
});

watch(selectAll, (val) => {
  heldTasks.value.forEach(task => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

function clearFilters() {
  searchQuery.value = '';
  swappable.value = false;
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  fetchHoldTasks();
}

async function resolveTask(workEffortId: string) {
  const alert = await alertController.create({
    header: translate('Resolve task'),
    message: translate('Are you sure you want to mark this task as resolved?'),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          await orderTaskStore.changeTaskStatus(workEffortId, 'TASK_COMPLETED');
          await fetchHoldTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function resolveSelectedTasks() {
  const selected = Object.entries(selectedOrders.value)
    .filter(([, checked]) => checked)
    .map(([id]) => id);
  if (!selected.length) return;

  const alert = await alertController.create({
    header: translate('Resolve tasks'),
    message: translate('Are you sure you want to resolve {count} selected task(s)?').replace('{count}', String(selected.length)),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          await Promise.all(selected.map(id => orderTaskStore.changeTaskStatus(id, 'TASK_COMPLETED')));
          selectedOrders.value = {};
          selectAll.value = false;
          await fetchHoldTasks();
        }
      }
    ]
  });
  await alert.present();
}

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
}

function getAssignedParty(task: any, roleTypeId: string): string {
  const party = task.assignedParties?.find((p: any) => p.roleTypeId === roleTypeId);
  if (!party) return roleTypeId === 'TASK_ASSIGNEE' ? translate('Unassigned') : translate('System');
  return party.groupName || [party.firstName, party.lastName].filter(Boolean).join(' ') || party.partyId;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}


const fetchHoldTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchHoldTasks({
    viewSize,
    viewIndex,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
  });
};

async function loadMoreHoldTasks(event: any) {
  await fetchHoldTasks(
    undefined,
    Math.ceil(heldTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  fetchHoldTasks();
});
</script>

<style scoped>
.border-top {
  border-top: 1px solid var(--ion-color-light);
}
</style>
