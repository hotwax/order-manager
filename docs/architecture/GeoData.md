# Geo data (address enrichment)

Status: **implemented** as the `geos` dataset in `src/store/seed.ts`.

Postal addresses in the order payload carry geo **IDs**, not display names:

```
postalAddress.countryGeoId       e.g. "IND"
postalAddress.stateProvinceGeoId e.g. "IN-MP"
```

To show "Madhya Pradesh, India" instead of "IN-MP, IND" we load the Geo reference
table once at login and resolve IDs → names in the UI, exactly like every other seed label.

## Endpoint

`admin/geos` is already live (HTTP 200). No Moqui change needed.

```
GET admin/geos?pageSize=2000      (baseURL = Maarg)
```

Returns `Geo` rows:

```json
{
  "geoId": "ABW",
  "geoTypeEnumId": "GEOT_COUNTRY",
  "geoName": "Aruba",
  "geoCodeAlpha2": "AW",
  "geoCodeAlpha3": "ABW",
  "geoCodeNumeric": "533"
}
```

> Note: `admin/geos` **ignores** `fieldsToSelect` — the full row is always returned.
> Field is `geoTypeEnumId` (not `geoTypeId`).

## Storage & load impact (measured live)

Total geos in this OMS: **1,388 records**, by type:

| geoTypeEnumId | count |
| --- | --- |
| GEOT_PROVINCE | 376 |
| GEOT_STATE | 331 |
| GEOT_COUNTRY | 256 |
| GEOT_COUNTY | 233 |
| GEOT_COUNTY_CITY | 96 |
| GEOT_REGION | 56 |
| GEOT_TERRITORY | 22 |
| GEOT_GROUP | 12 |
| other | 6 |

**Size:**

| Scope | Records | Raw JSON |
| --- | --- | --- |
| All geos | 1,388 | **~232 KB** |
| Countries + states + provinces (what addresses need) | 963 | **~162 KB** |

**Wire:** one GET at login. ~232 KB uncompressed; gzip on the wire ≈ 30–50 KB.

**Memory / persistence:** stored in the seed store (Pinia, `persist: true` → localStorage).
At ~162–232 KB it is a small fraction of the ~5 MB localStorage budget. Parse + index
is sub-millisecond. There is no measurable load-time impact — it is one more
`Promise.allSettled` leg in `loadInitialSeedData`, run in parallel with the other
~25 seed datasets.

**Conclusion:** negligible. Geo is static reference data and belongs in the seed store
alongside statuses, enums, and facilities — not in Dexie (Dexie is reserved for large,
on-demand, per-product data).

## Decision

- Load the **countries + states + provinces** subset (963 rows, ~162 KB) by filtering
  on `geoTypeEnumId` so we don't carry counties/cities/regions we never display:
  ```
  GET admin/geos?geoTypeEnumId=GEOT_COUNTRY,GEOT_STATE,GEOT_PROVINCE&geoTypeEnumId_op=in&pageSize=2000
  ```
  If the filter param is not honored by `admin/geos`, fall back to loading all 1,388 and
  filtering client-side — the size difference (70 KB) is immaterial.
- Store as a seed dataset `geos`, keyed by `geoId`.
- Getter `geoName(geoId)` returns `geoName`, falling back to the raw `geoId` (same
  fallback rule as every other seed getter).
- Refresh: load-once at login. Geo is effectively static; no refresh policy needed now.

## Usage

```ts
const stateName   = seed.geoName(postalAddress.stateProvinceGeoId); // "Madhya Pradesh"
const countryName = seed.geoName(postalAddress.countryGeoId);       // "India"
```

The address formatter in `OrderDetail.vue` joins these in place of the raw geo IDs.
