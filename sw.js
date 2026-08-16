// Exists purely to satisfy Chrome's PWA installability criteria (a
// registered service worker with a fetch handler is required for the
// automatic "Install app" prompt on Android — without one, the prompt
// never appears at all, regardless of how correct the manifest is).
//
// Deliberately does NOT cache anything. This app is under active
// development and deploys often — a real caching strategy here risks
// showing a stale version after a fresh push, which would be a much
// worse problem than the missing install prompt this fixes. Every
// request is just forwarded straight to the network, unmodified.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
