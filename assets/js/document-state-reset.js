const localHostnames = new Set(["127.0.0.1", "localhost", "[::1]"]);

async function clearLegacyLocalOriginState() {
  if (!localHostnames.has(window.location.hostname)) return false;
  let changed = false;
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      changed = true;
    }
  }
  if ("caches" in window) {
    const cacheNames = await window.caches.keys();
    if (cacheNames.length > 0) {
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      changed = true;
    }
  }
  return changed;
}

async function initializeDocumentLifecycle() {
  try {
    if (await clearLegacyLocalOriginState()) {
      window.location.reload();
      return;
    }
  } catch {
    // Cache cleanup is defensive; navigation must still work when an API is unavailable.
  }

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has("v")) {
    currentUrl.searchParams.delete("v");
    window.location.replace(currentUrl.href);
    return;
  }
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
}

initializeDocumentLifecycle();
