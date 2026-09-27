<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button v-if="!source" :aria-label="translate('Close')" :title="translate('Close')" @click="modalController.dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
        <ion-button v-else :disabled="submitting" :aria-label="translate('Back')" :title="translate('Back')" @click="source = null">
          <ion-icon slot="icon-only" :icon="arrowBackOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ source ? translate('Review transfer') : translate('Request transfer') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content ref="content">
    <ion-list v-if="item">
      <ion-item lines="full">
        <ion-thumbnail v-if="product?.mainImageUrl" slot="start">
          <DxpShopifyImg :src="product.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          <p class="overline">
            {{ translate('Item') }} {{ item.orderItemSeqId }}
          </p>
          {{ primaryIdentifier(item.productId) || item.name }}
          <p v-if="featureLabel(item.productId)">
            {{ featureLabel(item.productId) }}
          </p>
          <p v-if="secondaryIdentifier(item.productId)">
            {{ secondaryIdentifier(item.productId) }}
          </p>
        </ion-label>
        <ion-label slot="end" class="ion-text-center">
          {{ item.quantity }}
          <p>{{ translate('qty') }}</p>
        </ion-label>
      </ion-item>

      <!-- Step 1: where the stock comes from. -->
      <template v-if="!source">
        <ion-item lines="full">
          <ion-toggle v-model="hideOutOfStock">
            {{ translate('Hide out of stock') }}
          </ion-toggle>
        </ion-item>
        <ion-item lines="full">
          <ion-select v-model="sortBy" :label="translate('Sort by')" interface="popover">
            <ion-select-option value="inventory">
              {{ translate('Inventory') }}
            </ion-select-option>
            <ion-select-option value="velocity">
              {{ translate('Sales velocity') }}
            </ion-select-option>
            <ion-select-option value="name">
              {{ translate('Alphabetical') }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <div v-if="loading" class="ion-padding ion-text-center">
          <ion-spinner name="crescent" />
        </div>
        <ion-item v-else-if="!facilityGroups.length" lines="none">
          <ion-label>{{ translate('No facilities found') }}</ion-label>
        </ion-item>
        <template v-else>
          <template v-for="group in facilityGroups" :key="group.title">
            <ion-item-divider color="light">
              <ion-label>{{ group.title }}</ion-label>
            </ion-item-divider>
            <ion-item v-for="row in group.rows" :key="row.facilityId" button :detail="true" @click="source = row">
              <ion-label>
                {{ row.facilityName }}
                <p>{{ row.facilityId }}</p>
                <p v-if="row.miles !== undefined">
                  {{ translate('{distance} miles', { distance: distanceFormat.format(row.miles), count: row.miles }) }}
                </p>
              </ion-label>
              <ion-label slot="end" class="ion-text-end transfer-measure">
                {{ shown(row.atp) }}
                <p>{{ translate('ATP') }}</p>
              </ion-label>
              <ion-label slot="end" class="ion-text-end transfer-measure">
                {{ shown(row.qoh) }}
                <p>{{ translate('QOH') }}</p>
              </ion-label>
              <ion-label slot="end" class="ion-text-end transfer-measure">
                {{ shown(row.perDay, rateFormat) }}
                <p>{{ translate('Sales/day') }}</p>
              </ion-label>
            </ion-item>
          </template>
        </template>
      </template>

      <!-- Step 2: review, laid out like an existing transfer. -->
      <template v-else>
        <ion-item lines="none">
          <ion-label>
            <p class="overline">
              {{ translate('New transfer') }}
            </p>
            {{ translate('{count} qty', { count: Number(quantity) }) }}
          </ion-label>
        </ion-item>

        <template v-for="side in sides" :key="side.title">
          <ion-item-divider color="light">
            <ion-label>{{ side.title }}</ion-label>
          </ion-item-divider>
          <ion-item lines="none">
            <ion-label>
              {{ side.facilityName }}
              <p>{{ side.facilityId }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-measure">
              {{ stockNow(side.facilityId, 'atp') }}
              <p>{{ translate('ATP') }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-measure">
              {{ stockNow(side.facilityId, 'qoh') }}
              <p>{{ translate('QOH') }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <p>{{ translate('After transfer') }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-measure">
              {{ stockAfter(side.facilityId, 'atp', side.change) }}
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-measure">
              {{ stockAfter(side.facilityId, 'qoh', side.change) }}
            </ion-label>
          </ion-item>
        </template>

        <ion-item lines="none">
          <ion-textarea
            v-model="comments"
            :label="translate('Comments')"
            label-placement="stacked"
            :placeholder="translate('Optional comments')"
            :auto-grow="true"
          />
        </ion-item>
      </template>
    </ion-list>

    <ion-fab v-if="source" slot="fixed" vertical="bottom" horizontal="end">
      <ion-fab-button :disabled="submitting" :aria-label="translate('Save transfer request')" @click="submit">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { DxpShopifyImg, logger, translate } from "@common";
import {
  IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel,
  IonList, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonThumbnail, IonTitle, IonToggle, IonToolbar, modalController
} from "@ionic/vue";
import { arrowBackOutline, closeOutline, saveOutline } from "ionicons/icons";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { fetchDistancesFromFacility } from "@/composables/useOrderDistances";
import { useProductIdentity } from "@/composables/useProductIdentity";
import {
  fetchFacilitySalesVelocity, fetchFacilityStock, requestInventoryTransfers
} from "@/services/inventoryTransfers";
import { useOrderDetailStore } from "@/store/orderDetail";
import { useSeedStore } from "@/store/seed";
import { showToast } from "@/utils";

const props = defineProps<{
  orderId: string;
  orderItemSeqId: string;
  /** The facility the item ships from, which the stock is moved to. */
  destinationFacilityId: string;
}>();

type Stock = { atp: number; qoh: number };
type FacilityRow = { facilityId: string; facilityName: string; atp?: number; qoh?: number; perDay?: number; miles?: number };

/** Stock is moved out of warehouses or stores, listed in that order; no other kind of facility holds any. */
const FACILITY_GROUPS = [
  { title: "Warehouses", includes: (facility: any) => facility.facilityTypeId === "WAREHOUSE" || facility.parentTypeId === "DISTRIBUTION_CENTER" },
  { title: "Retail stores", includes: (facility: any) => facility.facilityTypeId === "RETAIL_STORE" || facility.parentTypeId === "PHYSICAL_STORE" },
];
const groupOf = (facility: any) => FACILITY_GROUPS.find((group) => group.includes(facility));

const orderDetailStore = useOrderDetailStore();
const seedStore = useSeedStore();
const { getProduct, primaryIdentifier, secondaryIdentifier, featureLabel } = useProductIdentity();

const item = computed(() => orderDetailStore.enrichedOrderByOrderId(props.orderId)?.shipGroups
  .flatMap((shipGroup) => shipGroup.items)
  .find((entry) => entry.orderItemSeqId === props.orderItemSeqId));
const product = computed(() => item.value && getProduct(item.value.productId));
/**
 * The whole item moves. The order document carries no cancelled or shipped quantity for an item:
 * a cancellation takes all of it (ITEM_CANCELLED), and a completed item can't be transferred, so an
 * item still open to transfer is open in full.
 */
const quantity = computed(() => item.value?.quantity || 0);

const facilities = ref<any[]>([]);
// Unknown until loaded, and left unknown if a lookup fails, so a row shows "-" rather than a false 0.
const stock = ref<Record<string, Stock> | null>(null);
const velocity = ref<Record<string, number> | null>(null);
const distances = ref<Record<string, number>>({});
const loading = ref(true);
const sortBy = ref<"inventory" | "velocity" | "name">("inventory");
const hideOutOfStock = ref(false);

const source = ref<FacilityRow | null>(null);
const comments = ref("");
const submitting = ref(false);

// A request is one write, but closing part way through would skip reloading the order's transfers,
// and the item would still offer a transfer it now has. canDismiss covers Escape and backdrop taps too.
const content = ref();
onMounted(() => {
  const modal = content.value?.$el?.closest("ion-modal");
  if(modal) {modal.canDismiss = () => !submitting.value;}
});

// Each step opens at its top, not wherever the other step was scrolled to.
watch(source, async () => {
  await nextTick();
  await content.value?.$el?.scrollToTop?.();
});

const rank = (value?: number) => value ?? -Infinity;
const byName = (a: FacilityRow, b: FacilityRow) => a.facilityName.localeCompare(b.facilityName);
const byInventory = (a: FacilityRow, b: FacilityRow) =>
  rank(b.atp) - rank(a.atp) || rank(b.qoh) - rank(a.qoh) || byName(a, b);
const byVelocity = (a: FacilityRow, b: FacilityRow) =>
  rank(b.perDay) - rank(a.perDay) || byInventory(a, b);
const COMPARATORS = { inventory: byInventory, velocity: byVelocity, name: byName };

/** Nothing available to move: stock held for other orders can't be transferred. A facility whose stock didn't load stays listed. */
const isOutOfStock = (row: FacilityRow) => row.atp !== undefined && row.atp <= 0;

/** Warehouses, then stores, each sorted by the chosen measure, best first, or by name. */
const facilityGroups = computed(() => {
  const rows = facilities.value.map((facility): FacilityRow & { group: unknown } => ({
    facilityId: facility.facilityId,
    facilityName: seedStore.facilityName(facility.facilityId),
    atp: stock.value?.[facility.facilityId]?.atp,
    qoh: stock.value?.[facility.facilityId]?.qoh,
    // A facility Solr has no sales for sold none.
    perDay: velocity.value ? velocity.value[facility.facilityId] || 0 : undefined,
    miles: distances.value[facility.facilityId],
    group: groupOf(facility),
  })).filter((row) => !hideOutOfStock.value || !isOutOfStock(row));
  const compare = COMPARATORS[sortBy.value];

  return FACILITY_GROUPS
    .map((group) => ({ title: translate(group.title), rows: rows.filter((row) => row.group === group).sort(compare) }))
    .filter((group) => group.rows.length);
});

const distanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const rateFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const shown = (value?: number, format?: Intl.NumberFormat) => value === undefined ? "-" : (format ? format.format(value) : String(value));

async function load() {
  loading.value = true;
  try {
    await seedStore.loadFacilities();
  } catch (error) {
    logger.error("Failed to load facilities", error);
  }
  const dataset = seedStore.facilities;
  facilities.value = dataset.ids.map((id) => dataset.byId[id])
    .filter((facility) => facility && facility.facilityId !== props.destinationFacilityId && groupOf(facility));

  const productId = item.value?.productId;
  if(productId) {
    const facilityIds = [...facilities.value.map((facility) => facility.facilityId), props.destinationFacilityId];
    const [stockResult, velocityResult] = await Promise.allSettled([
      fetchFacilityStock(productId, facilityIds),
      fetchFacilitySalesVelocity(productId),
    ]);
    if(stockResult.status === "fulfilled") {stock.value = stockResult.value;} else {logger.error("Failed to load stock for the transfer", stockResult.reason);}
    if(velocityResult.status === "fulfilled") {velocity.value = velocityResult.value;} else {logger.error("Failed to load sales velocity for the transfer", velocityResult.reason);}
  }
  loading.value = false;

  // Distances only decorate the rows, so they fill in once the list is up.
  fetchDistancesFromFacility(props.destinationFacilityId)
    .then((result) => { distances.value = result; })
    .catch((error) => logger.error("Failed to load facility distances", error));
}
onMounted(load);

// Out of the source, into the destination: each side's stock now, and once the transfer completes.
const sides = computed(() => source.value ? [
  { title: translate("Transfer from"), facilityId: source.value.facilityId, facilityName: source.value.facilityName, change: -quantity.value },
  { title: translate("Transfer to"), facilityId: props.destinationFacilityId, facilityName: seedStore.facilityName(props.destinationFacilityId), change: quantity.value },
] : []);

const signed = new Intl.NumberFormat(undefined, { signDisplay: "always" });

function stockNow(facilityId: string, measure: keyof Stock) {
  const current = stock.value?.[facilityId]?.[measure];

  return current === undefined ? "-" : String(current);
}

/** The stock once the transfer completes, with the change beside it: "37 (-1)". */
function stockAfter(facilityId: string, measure: keyof Stock, change: number) {
  const current = stock.value?.[facilityId]?.[measure];

  return current === undefined ? "-" : `${current + change} (${signed.format(change)})`;
}

async function submit() {
  if(!item.value || !source.value || submitting.value) {return;}
  submitting.value = true;
  try {
    const inventoryTransferIds = await requestInventoryTransfers({
      requestReferencePrefix: `ORDER_MANAGER-${props.orderId}-${Date.now()}`,
      transfers: [{
        productId: item.value.productId,
        quantity: quantity.value,
        facilityId: source.value.facilityId,
        facilityIdTo: props.destinationFacilityId,
        orderId: props.orderId,
        orderItemSeqId: props.orderItemSeqId,
        comments: comments.value.trim() || undefined,
      }],
    });
    // Reload the order's transfers while the modal still covers the page, so the item stops offering a
    // transfer before anything behind it can be tapped again.
    await orderDetailStore.fetchInventoryTransfers(props.orderId);
    // canDismiss refuses while submitting, including this dismiss.
    submitting.value = false;
    await modalController.dismiss({ inventoryTransferIds }, "confirm");
  } catch (error) {
    logger.error("Failed to request the inventory transfer", error);
    await showToast(translate("Failed to request inventory transfer. Please try again."));
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

/* A fixed width keeps each measure in a column down the list, and "37 (-1)" as wide as "38". */
.transfer-measure {
  min-width: 4.5rem;
}

/* On a phone, narrower columns leave the facility name room to wrap between words, not inside them. */
@media (max-width: 575.98px) {
  .transfer-measure {
    min-width: 3.5rem;
  }
}
</style>
