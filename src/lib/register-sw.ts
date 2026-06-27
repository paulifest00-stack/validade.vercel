// Service worker registration for production builds
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  try {
    // Don't register if inside an iframe (preview/embedded context)
    if (window.top !== window.self) return;
  } catch {
    return;
  }

  const url = new URL(window.location.href);
  const killSwitch = url.searchParams.get("sw") === "off";

  if (killSwitch) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL?.endsWith("/sw.js")) r.unregister();
      });
    }).catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
