# Translations

Messages live in `src/locales/en-US.json` and `src/locales/es-ES.json`. Both files have the same keys, sorted case-insensitively, and `tests/locales.spec.ts` fails if they drift.

## Keys

- **The key is the English text.** `translate('Cancel order')`. The only exceptions are plural and linked messages, whose English value differs from the key (see below).
- **Use sentence case.** Write `Add task`, not `Add Task`. Keep one key per term; a second spelling of the same words is a duplicate.
- **Common's components read their text from this file too.** Login, the app switcher, toasts and loaders are examples. Their keys stay, even though nothing in `src` calls them.

## Whole messages, not glued words

The word order belongs to the translator, so a value goes inside the message as a parameter:

```ts
translate('Item {id}', { id })                       // not `${translate('Item')} ${id}`
translate('Qty: {count}', { count })                 // not {{ translate('Qty') }}: {{ count }}
translate('{count} selected', { count: ids.length }) // not {{ ids.length }} {{ translate('selected') }}
```

Never patch a translated string afterwards. `translate(key).replace('{count}', n)` shows nothing, because vue-i18n fills a missing `{count}` with an empty string before `.replace` runs.

## Plurals

- **Key and value:** the key is the plural phrase, and the English value holds both forms: `"{count} items": "{count} item | {count} items"`.
- **Passing the count:** pass `count` as a number, and vue-i18n picks the form. Without a numeric `count`, it always shows the first form.
- **"Some of all" labels:** these pick the form by the total, so the total goes in `count`: `translate('{shown} of {count} orders', { shown, count: total })`.
- **Other languages:** Spanish may need two forms where English needs one, for example `"{count} open": "{count} abierto | {count} abiertos"`.

## Linked messages and casing

- **Linking a term:** a message can include another message, so a term is translated once: `"Edit @.lower:{'Shipping address'}"`.
  - `@.lower`, `@.upper` and `@.capitalize` change the case of the linked text.
  - The modifier sits in each language's message, so each language decides its own casing.
- **Linking from a parameter:** the linked key can come from a parameter. For example, `"Top 10 facilities by @.lower:{metric}"` with `metric: 'Order Volume'`.
- **Keys with a period:** never link to one. The link renders empty, and the test fails.
- **Visual capitals:** all-caps for looks belongs in CSS or Ionic, not in a separate key. Ionic buttons already uppercase their text.
- **Special characters:** `@ { } |` are part of the message syntax. Write them as `{'@'}`. The `\@` escape needs vue-i18n 11.3; on 9.9 it's a compile error.

## Numbers, dates and money

Use `src/utils/format.ts`. It follows the app's language and the user's time zone:

- `formatMoney(amount, currency)` uses the currency the server returned for that order, task or return.
- `formatNumber`, `formatDate`, `formatTime`, `formatDateTime`, `formatMonthYear`, `formatRelative` and `formatElapsed` cover the rest.
- Avoid `toLocaleString()`, `new Intl.NumberFormat(undefined, …)` and luxon's `toFormat()`. They use the browser's language instead of the app's.

## Text that Ionic renders as HTML

`main.ts` sets Ionic's `innerHTMLTemplatesEnabled`, so alert, toast and loading text is HTML. When such a message includes outside text (a server error, a customer name), pass it escaped:

```ts
showToast(translate('Shopify Error: {message}', { message }, { escapeParameter: true }));
```

Don't enable `escapeParameter` globally: it would show `O'Brien` as `O&apos;Brien` in ordinary text.

## The language

- **Where it's chosen:** Settings sets the language and saves it in the `locale` cookie for a year.
- **On startup:** the app starts in the saved language and keeps `<html lang>` in step with it.
- **Coming in common:** [hotwax/accxui#177](https://github.com/hotwax/accxui/pull/177) moves this into `createDxpI18n` and adds `setLocale()`. It also formats `count` for the language: "1,204 orders", "12.000 pedidos".

## What the tests check

`tests/locales.spec.ts` fails when any of these happens:

- a message doesn't compile in either language;
- a key the app or common uses is missing from `en-US`;
- the two files have different keys or order;
- a message renders the same in Spanish as in English (a short list of words that are the same in both is allowed);
- Spanish uses different placeholders from English;
- a link points to a missing key.

## What this can't translate

Text that comes from OMS data shows as the server sends it. That covers status and enum descriptions, facility and channel names, identification types, and shipping-method descriptions.
