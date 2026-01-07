"use strict";

// Pequeño util para refrescar datos sin recargar toda la página.
// Ejecuta la función de refresco cuando la pestaña está visible y evita solaparse.
(function bootstrapLiveRefresh() {
  const DEFAULT_INTERVAL = 12000;
  const MAX_INTERVAL = 60000;

  const start = (refreshFn, options = {}) => {
    const intervalMs = options.intervalMs || DEFAULT_INTERVAL;
    const immediate = options.immediate !== false;
    const guard = typeof options.shouldRun === "function" ? options.shouldRun : () => true;
    const label = options.label || "live-refresh";

    if (typeof refreshFn !== "function") {
      console.warn("[LiveRefresh] refreshFn no es una función");
      return () => {};
    }

    let timer = null;
    let inFlight = false;
    let failureCount = 0;

    const run = async () => {
      if (inFlight) return;
      if (document.visibilityState === "hidden") return;
      if (!guard()) return;
      inFlight = true;
      try {
        await refreshFn();
        failureCount = 0;
      } catch (error) {
        failureCount += 1;
        const nextInterval = Math.min(MAX_INTERVAL, intervalMs * Math.pow(2, failureCount));
        clearInterval(timer);
        timer = setInterval(run, nextInterval);
        console.warn(`[LiveRefresh] fallo en ${label}:`, error);
      } finally {
        inFlight = false;
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        run();
      }
    };

    if (immediate) {
      run();
    }

    timer = setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  };

  window.LiveRefresh = { start };
})();
