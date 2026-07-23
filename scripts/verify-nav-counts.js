/**
 * Verifiable nav-count cross-check loop.
 *
 * Proves that when the app lands on the Funnel page, every side-menu queue badge
 * "lights up" with the SAME number that queue's own page computes — i.e. the
 * badges reflect real per-queue counts, not placeholder values.
 *
 * How it works: the Funnel primes all badge counts on mount (orders.primeNavCounts
 * + the brokered-workload fetch). This loop snapshots those primed values, then
 * drives the SPA router to each queue page and reads that page's own authoritative
 * total from its store, asserting the two agree.
 *
 * Usage: open the running app, then paste this whole file into the browser devtools
 * console (or run it via the browser automation `javascript_tool`). It returns a
 * `{ allPass, results }` object and logs a table. `allPass === true` means every
 * badge matches its page.
 */
(async () => {
  const app = document.querySelector('#app').__vue_app__;
  const router = app.config.globalProperties.$router;
  const pinia = app.config.globalProperties.$pinia._s;
  const orders = pinia.get('orders');
  const orderTask = () => pinia.get('orderTask');
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Land on the Funnel and let it prime every badge count.
  await router.push('/funnel');
  const primedKeys = ['unfillable', 'brokering', 'hold', 'badAddress', 'swap', 'fraud', 'open', 'inflight', 'packed'];
  for (let i = 0; i < 40; i++) {
    if (primedKeys.every((key) => orders.navCounts[key] !== undefined)) break;
    await wait(250);
  }
  const primed = { ...orders.navCounts };

  // 2. Each queue's own authoritative total, read from its page's store.
  const checks = [
    { key: 'unfillable', route: '/unfillable',  total: () => orders.navCounts.unfillable },
    { key: 'brokering',  route: '/brokering',   total: () => orders.navCounts.brokering },
    { key: 'swap',       route: '/swap',        total: () => orderTask()?.swapTotal },
    { key: 'badAddress', route: '/bad-address', total: () => orderTask()?.addressValidationTotal },
    { key: 'fraud',      route: '/fraud',       total: () => orderTask()?.fraudTotal },
    { key: 'hold',       route: '/hold',        total: () => orderTask()?.holdTotal },
    { key: 'open',       route: '/open',        total: () => orders.navCounts.open },
    { key: 'inflight',   route: '/inflight',    total: () => orders.navCounts.inflight },
    { key: 'packed',     route: '/packed',      total: () => orders.navCounts.packed },
  ];

  const results = [];
  for (const check of checks) {
    await router.push(check.route);
    await wait(2500); // let the page run its own fetch and publish its total
    const pageCount = check.total();
    results.push({ queue: check.key, funnelBadge: primed[check.key], pageCount, match: primed[check.key] === pageCount });
  }
  await router.push('/funnel');

  const allPass = results.every((result) => result.match);
  console.table(results);
  console.log(allPass ? '✅ All nav badges match their queue pages' : '❌ Nav badge mismatch detected');
  return { allPass, results };
})();
