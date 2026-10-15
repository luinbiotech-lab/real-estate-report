// Browser-safe fetch resolution for gateway clients.
//
// WebKit (iOS/macOS Safari) enforces that native fetch is called with the global object as its receiver:
// storing `fetch` on an instance (`this.fetchImpl = fetch`) and calling `this.fetchImpl(...)` throws
// "TypeError: Can only call Window.fetch on instances of Window". Gateways must therefore never keep an
// unbound reference to the native function. See Issue #6.
//
// Keep this module free of imports: scripts/validate-browser-fetch-binding.mjs loads it directly.

/** Returns the injected implementation (tests) or a wrapper that calls the current global fetch with its own receiver. */
export function resolveBrowserFetch(injected?: typeof fetch): typeof fetch {
  if (injected) return injected;
  return (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init);
}
