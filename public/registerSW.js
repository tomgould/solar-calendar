// Registers the service worker once the page has loaded. Leaving the page
// before the worker script arrives makes WebKit reject the registration; it is
// tried again on the next page, so that is no error worth reporting.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}
