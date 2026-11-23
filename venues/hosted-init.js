import { createDemoBooking } from './booking-browser.js';
import { configs } from './hosted-config.js';

export function demoTransport(site) {
  const store = createDemoBooking({ site, context: configs[site] });
  return {
    async month(parameters) {
      const result = await store.month(parameters.get('month'), parameters.get('kind') || 'rent');
      return new Response(JSON.stringify(result), { status: 200 });
    },
    async submit(input) {
      const { status, payload } = await store.submit(input);
      return new Response(JSON.stringify(payload), { status });
    }
  };
}
