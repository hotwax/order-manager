<template>
  <ion-page class="settings">
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Settings") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="user-profile">
        <ion-card>
          <ion-item lines="full">
            <ion-avatar slot="start">
              <ion-label>{{ userInitials }}</ion-label>
            </ion-avatar>
            <ion-card-header class="ion-no-padding ion-padding-vertical">
              <ion-card-subtitle>{{ userProfile.username || userProfile.emailAddress || userProfile.userId }}</ion-card-subtitle>
              <ion-card-title>{{ userProfile.userFullName || userProfile.partyId || userProfile.userId || translate("User") }}</ion-card-title>
            </ion-card-header>
          </ion-item>
          <ion-button color="danger" @click="logout()">{{ translate("Logout") }}</ion-button>
          <ion-button fill="outline" @click="goToLaunchpad()">
            {{ translate("Go to Launchpad") }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
        </ion-card>
      </div>

      <div class="section-header">
        <h1>{{ translate('OMS') }}</h1>
      </div>
      <section>
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>{{ translate("OMS instance") }}</ion-card-subtitle>
            <ion-card-title>{{ omsInstance }}</ion-card-title>
            <ion-badge v-if="isOmsOffline" color="danger">{{ translate("Offline") }}</ion-badge>
          </ion-card-header>
          <ion-card-content>
            {{ translate("This is the name of the OMS you are connected to right now. Make sure that you are connected to the right instance before proceeding.") }}
          </ion-card-content>
          <ion-button v-if="!commonUtil.isMoqui()" fill="clear" :disabled="!userStore.hasPermission(Actions.APP_COMMERCE_VIEW)" @click="commonUtil.goToOms()">
            {{ translate("Go to OMS") }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>{{ translate("Product Store") }}</ion-card-subtitle>
            <ion-card-title>{{ translate("Store") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate("A store represents a company or a unique catalog of products. If your OMS is connected to multiple eCommerce stores selling different collections of products, you may have multiple Product Stores set up in HotWax Commerce.") }}
          </ion-card-content>
          <ion-item lines="none">
            <ion-select :label="translate('Select store')" label-placement="stacked" interface="popover" :value="currentProductStore.productStoreId" @ionChange="setCurrentProductStore($event)">
              <ion-select-option v-for="store in productStores" :key="store.productStoreId" :value="store.productStoreId">
                {{ store.storeName || store.productStoreId }}
              </ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>
      </section>
      <hr />
      <DxpAppVersionInfo />
      <section>
        <DxpProductIdentifier />

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Barcode Identifier") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate("Specify which product identifier should be used to scan barcodes to look up products.") }}
          </ion-card-content>
          <ion-item lines="none">
            <ion-select :label="translate('Barcode Identifier')" interface="popover" :placeholder="translate('Select')" :value="barcodeIdentificationPref" @ionChange="setBarcodeIdentificationPref($event.detail.value)">
              <ion-select-option v-for="identification in barcodeIdentificationOptions" :key="identification.goodIdentificationTypeId" :value="identification.goodIdentificationTypeId">{{ identification.description ? identification.description : identification.goodIdentificationTypeId }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Timezone") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate("The timezone you select is used to ensure automations you schedule are always accurate to the time you select.") }}
          </ion-card-content>
          <ion-item v-if="showBrowserTimeZone">
            <ion-label>
              <p class="overline">{{ translate("Browser TimeZone") }}</p>
              {{ browserTimeZone.id }}
              <p v-if="showDateTime">{{ commonUtil.getCurrentTime(browserTimeZone.id, dateTimeFormat) }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <p class="overline">{{ translate("Selected TimeZone") }}</p>
              {{ currentTimeZone }}
              <p v-if="showDateTime">{{ commonUtil.getCurrentTime(currentTimeZone, dateTimeFormat) }}</p>
            </ion-label>
            <ion-button id="time-zone-modal" slot="end" fill="outline" color="dark">
              {{ translate("Change") }}
            </ion-button>
          </ion-item>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Language") }}</ion-card-title>
          </ion-card-header>
          <ion-item lines="none">
            <ion-select :label="translate('Select language')" label-placement="stacked" interface="popover" :value="locale" @ionChange="setLocale($event.detail.value)">
              <ion-select-option value="en-US">English</ion-select-option>
              <ion-select-option value="es-ES">Español</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <div class="card-header">
              <div>
                <ion-card-title>{{ translate('Data Fetch Status') }}</ion-card-title>
                <ion-card-subtitle v-if="cacheSubtitle">{{ cacheSubtitle }}</ion-card-subtitle>
              </div>
              <ion-button fill="clear" size="small" :disabled="!!refreshing" @click="refreshAll()">
                <ion-spinner v-if="refreshing === '*'" name="dots" />
                <ion-icon v-else slot="icon-only" :icon="syncOutline" />
              </ion-button>
            </div>
          </ion-card-header>
          <ion-list lines="none">
            <!-- Session data: held in memory, not in the local cache. -->
            <ion-item v-for="item in sessionFetchStatus" :key="item.label">
              <ion-icon slot="start" :icon="getStatusIcon(item.status)" :color="getStatusColor(item.status)" />
              <ion-label>
                {{ item.label }}
                <p v-if="item.status === 'success' && item.count !== undefined">{{ translate("Fetched") }} {{ item.count }} {{ translate("records") }}</p>
                <p v-else>{{ translate(getStatusLabel(item.status)) }}</p>
              </ion-label>
              <ion-button slot="end" fill="clear" @click="item.refresh()">
                <ion-icon slot="icon-only" :icon="syncOutline" />
              </ion-button>
            </ion-item>

            <!-- Local cache (IndexedDB): live row counts straight from the database. -->
            <ion-item-divider>
              <ion-label>{{ translate("Local cache") }} · {{ totalRows }} {{ translate("records") }}</ion-label>
            </ion-item-divider>
            <ion-item v-for="domain in domains" :key="domain.name">
              <ion-icon slot="start" :icon="getStatusIcon(domain.status)" :color="getStatusColor(domain.status)" />
              <ion-label>
                {{ translate(domain.label) }}
                <p>
                  {{ domain.count }} {{ translate("records") }}
                  <template v-if="domain.syncedAt"> · {{ translate("synced") }} {{ formatSyncTime(domain.syncedAt) }}</template>
                  <template v-else-if="domain.syncClass === 'A'"> · {{ translate("live while in use") }}</template>
                  <template v-else> · {{ translate("not synced yet") }}</template>
                </p>
              </ion-label>
              <ion-button slot="end" fill="clear" :disabled="!!refreshing" @click="refreshDomain(domain.name)">
                <ion-spinner v-if="refreshing === domain.name" name="dots" />
                <ion-icon v-else slot="icon-only" :icon="syncOutline" />
              </ion-button>
            </ion-item>
          </ion-list>
        </ion-card>
      </section>

      <ion-modal ref="timeZoneModal" trigger="time-zone-modal" @didPresent="search()" @didDismiss="clearSearch()">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeModal" :aria-label="translate('Close')">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>{{ translate("Select time zone") }}</ion-title>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar @ionFocus="selectSearchBarText($event)" :placeholder="translate('Search time zones')" v-model="queryString" @keyup.enter="findTimeZone()" />
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <ion-radio-group v-model="timeZoneId">
            <ion-list v-if="showBrowserTimeZone">
              <ion-list-header>{{ translate("Browser time zone") }}</ion-list-header>
              <ion-item>
                <ion-radio label-placement="end" justify="start" :value="browserTimeZone.id">
                  <ion-label>
                    {{ browserTimeZone.label }} ({{ browserTimeZone.id }})
                    <p v-if="showDateTime">{{ commonUtil.getCurrentTime(browserTimeZone.id, dateTimeFormat) }}</p>
                  </ion-label>
                </ion-radio>
              </ion-item>
            </ion-list>

            <ion-list>
              <ion-list-header v-if="showBrowserTimeZone">{{ translate("Select a different time zone") }}</ion-list-header>
              <ion-item v-if="isLoading" lines="none">
                <ion-spinner color="secondary" name="crescent" slot="start" />
                <ion-label>{{ translate("Fetching time zones") }}</ion-label>
              </ion-item>
              <ion-item v-else-if="filteredTimeZones.length === 0" lines="none">
                <ion-label>{{ translate("No time zone found") }}</ion-label>
              </ion-item>
              <template v-else>
                <ion-item v-for="timeZone in filteredTimeZones" :key="timeZone.id">
                  <ion-radio label-placement="end" justify="start" :value="timeZone.id">
                    <ion-label>
                      {{ timeZone.label }} ({{ timeZone.id }})
                      <p v-if="showDateTime">{{ commonUtil.getCurrentTime(timeZone.id, dateTimeFormat) }}</p>
                    </ion-label>
                  </ion-radio>
                </ion-item>
              </template>
            </ion-list>
          </ion-radio-group>

          <ion-fab vertical="bottom" horizontal="end" slot="fixed">
            <ion-fab-button :disabled="!timeZoneId" @click="saveUserTimeZone" :aria-label="translate('Save')">
              <ion-icon :icon="saveOutline" />
            </ion-fab-button>
          </ion-fab>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonAvatar, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonListHeader, IonMenuButton, IonModal, IonPage, IonRadio, IonRadioGroup, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar } from '@ionic/vue';
import { checkmarkCircle, closeCircle, closeOutline, openOutline, saveOutline, syncOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, onBeforeMount, ref } from 'vue';
import { api, commonUtil, cookieHelper, i18n, translate } from '@common';
import { useCacheStatus } from '@common/cache';
import { useAuth } from '@common/composables/useAuth';
import { useUserStore } from '@/store/user';
import { useProductStore } from '@/store/productStore';
import { orderManagerDb } from '@/cache/appCacheDb';
import { ORDER_MANAGER_CACHE_CATALOG } from '@/config/appSyncConfig';
import DxpProductIdentifier from "@/components/settings/DxpProductIdentifier.vue";
import DxpAppVersionInfo from "@/components/settings/DxpAppVersionInfo.vue";
import Actions from "@/authorization/actions";

const userStore = useUserStore();
const userProfile = computed(() => userStore.getUserProfile);
const currentProductStore = computed(() => useProductStore().getCurrentProductStore);
const productStores = computed(() => useProductStore().getProductStores || []);
const barcodeIdentificationPref = computed(() => useProductStore().getBarcodeIdentifierPref);
const barcodeIdentificationOptions = computed(() => useProductStore().getBarcodeIdentifierOptions);
const timeZones = computed(() => userStore.getAvailableTimeZones);
const currentTimeZone = computed(() => userStore.getUserTimeZone || userProfile.value?.userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
const omsInstance = computed(() => cookieHelper().get('oms') || userStore.oms);
const userInitials = computed(() => {
  const name = userProfile.value?.userFullName || userProfile.value?.partyId || userProfile.value?.userId || '';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('') || 'OM';
});

const locale = computed(() => i18n.global.locale.value);

function setLocale(newLocale: string) {
  i18n.global.locale.value = newLocale;
  cookieHelper().set('locale', newLocale);
}

const props = defineProps({
  showBrowserTimeZone: {
    type: Boolean,
    default: true
  },
  showDateTime: {
    type: Boolean,
    default: true
  },
  dateTimeFormat: {
    type: String,
    default: 't ZZZZ'
  }
});

const isLoading = ref(true);
const isOmsOffline = ref(false);
const timeZoneModal = ref();
const queryString = ref('');
const filteredTimeZones = ref<any[]>([]);
const timeZoneId = ref(currentTimeZone.value);
const browserTimeZone = ref({
  label: '',
  id: Intl.DateTimeFormat().resolvedOptions().timeZone
});

onBeforeMount(async () => {
  isLoading.value = true;
  checkOmsConnection();
  await userStore.fetchAvailableTimeZones();
  timeZoneId.value = currentTimeZone.value;

  if (props.showBrowserTimeZone) {
    browserTimeZone.value.label = timeZones.value.find((timeZone: any) => timeZone.id.toLowerCase().match(browserTimeZone.value.id.toLowerCase()))?.label || browserTimeZone.value.id;
  }

  findTimeZone();
  isLoading.value = false;
});

async function checkOmsConnection() {
  if (!omsInstance.value) {
    isOmsOffline.value = true;
    return;
  }

  try {
    await api({
      url: commonUtil.isMoqui() ? "admin/user/permissions" : "getPermissions",
      method: "GET",
      baseURL: commonUtil.getOmsURL(),
      params: { viewIndex: 0, viewSize: 1 },
      timeout: 3000,
    });
    isOmsOffline.value = false;
  } catch (error: any) {
    isOmsOffline.value = !error?.response;
  }
}

function setCurrentProductStore(event: CustomEvent) {
  if (currentProductStore.value.productStoreId !== event.detail.value) {
    const selectedProductStore = productStores.value.find((store: any) => store.productStoreId == event.detail.value)
    useProductStore().setProductStorePreference(selectedProductStore)
  }
}

async function setBarcodeIdentificationPref(value: string) {
  await useProductStore().setProductStoreSetting(
    currentProductStore.value.productStoreId,
    "BARCODE_IDEN_PREF",
    value
  )
}

async function saveUserTimeZone() {
  await userStore.setUserTimeZone(timeZoneId.value);
  closeModal();
}

function logout() {
  useAuth().logout({ isUserUnauthorised: false });
}

function goToLaunchpad() {
  window.location.href = `${import.meta.env.VITE_LAUNCHPAD_URL}`;
}

function closeModal() {
  timeZoneModal.value?.$el?.dismiss(null, 'cancel');
}

function findTimeZone() {
  const searchedString = queryString.value.toLowerCase();
  filteredTimeZones.value = timeZones.value.filter((timeZone: any) => timeZone.id.toLowerCase().match(searchedString) || timeZone.label.toLowerCase().match(searchedString));

  if (props.showBrowserTimeZone) {
    filteredTimeZones.value = filteredTimeZones.value.filter((timeZone: any) => !timeZone.id.toLowerCase().match(browserTimeZone.value.id.toLowerCase()));
  }
}

async function selectSearchBarText(event: any) {
  const element = await event.target.getInputElement();
  element.select();
}

function search() {
  timeZoneId.value = currentTimeZone.value;
  isLoading.value = true;
  findTimeZone();
  isLoading.value = false;
}

function clearSearch() {
  queryString.value = '';
  filteredTimeZones.value = [];
  isLoading.value = true;
}

// Live IndexedDB cache status
const {
  domains, refreshing, totalRows, oldestSyncedAt, lastSyncedAt, refreshDomain, refreshAll,
} = useCacheStatus(orderManagerDb, ORDER_MANAGER_CACHE_CATALOG);

const formatSyncTime = (millis: number) =>
  DateTime.fromMillis(millis).toLocaleString(DateTime.DATETIME_MED);

const cacheSubtitle = computed(() => {
  if (!lastSyncedAt.value) return translate("Cache not synced yet");
  const parts = [`${translate("Last sync:")} ${formatSyncTime(lastSyncedAt.value)}`];
  if (oldestSyncedAt.value && oldestSyncedAt.value !== lastSyncedAt.value) {
    parts.push(`${translate("oldest:")} ${formatSyncTime(oldestSyncedAt.value)}`);
  }
  return parts.join(" · ");
});

const userFetchStatus = computed(() => userStore.fetchStatus);

const sessionFetchStatus = computed(() => [
  {
    label: translate("User Profile"),
    status: userFetchStatus.value.profile,
    count: userProfile.value ? 1 : 0,
    refresh: () => userStore.fetchUserProfile()
  },
  {
    label: translate("Permissions"),
    status: userFetchStatus.value.permissions,
    count: userStore.permissions?.length || 0,
    refresh: () => userStore.fetchPermissions()
  }
]);

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success': return checkmarkCircle;
    case 'error': return closeCircle;
    case 'pending': return syncOutline;
    default: return syncOutline;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success': return 'success';
    case 'error': return 'danger';
    case 'pending': return 'medium';
    default: return 'medium';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'success': return 'Success';
    case 'error': return 'Error';
    case 'pending': return 'Pending';
    default: return 'Not fetched';
  }
};
</script>

<style scoped>
ion-card > ion-button {
  margin: var(--spacer-xs);
}
section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  align-items: start;
}
.user-profile {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
}
hr {
  border-top: 1px solid var(--border-medium);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacer-xs) 10px 0px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
