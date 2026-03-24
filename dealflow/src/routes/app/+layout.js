// All /app/* routes load data client-side (onMount + localStorage).
// Disable SSR so SvelteKit client-side navigation is instant —
// no server round-trip needed when clicking sidebar links.
export const ssr = false;
