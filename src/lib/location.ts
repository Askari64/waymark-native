import type { Point } from "./geo";

export const FIX_MAX_AGE = 60000;
export function freshPoint(point: Point | null, now = Date.now()): point is Point {
  return !!point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 &&
    Number.isFinite(point.timestamp) && now - point.timestamp! >= -5000 &&
    now - point.timestamp! < FIX_MAX_AGE;
}
export type Subscription = { remove(): void };
export type LocationDriver = {
  permission(prompt: boolean): Promise<boolean>;
  services(): Promise<boolean>;
  current(): Promise<Point>;
  watch(update: (point: Point) => void, error: () => void): Promise<Subscription>;
};
export type LocationState = { busy: boolean; error: string; phase: "idle" | "permission" | "finding" | "ready" | "error" };

// Owns one foreground session. Native promises cannot be cancelled; generations
// ignore late results and remove subscriptions even when they resolve after stop.
export function createLocationController(
  driver: LocationDriver,
  onState: (state: LocationState) => void,
  onPoint: (point: Point) => void,
  deadlineMs = 20000,
) {
  let generation = 0, running = false, subscription: Subscription | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function stop() {
    generation++;
    running = false;
    clearTimeout(timer);
    subscription?.remove();
    subscription = null;
  }
  function suspend() {
    stop();
    onState({ busy: false, error: "", phase: "idle" });
  }
  async function start(prompt = true) {
    if (running) return;
    stop();
    running = true;
    const id = generation;
    let gotFix = false, watching = false, newestTimestamp = 0;
    const live = () => id === generation;
    const fail = (error: string) => {
      if (!live()) return;
      stop();
      onState({ busy: false, error, phase: "error" });
    };
    const accept = (point: Point) => {
      if (!live() || !freshPoint(point) || point.timestamp! < newestTimestamp) return;
      newestTimestamp = point.timestamp!;
      gotFix = true;
      running = false;
      onPoint(point);
      onState({ busy: false, error: "", phase: "ready" });
      if (watching) clearTimeout(timer);
    };
    onState({ busy: true, error: "", phase: "permission" });
    try {
      timer = setTimeout(() => fail("Location permission request did not finish. Try again."), Math.max(deadlineMs, 60000));
      if (!await driver.permission(prompt)) {
        fail("Location permission is off. Allow it in Settings, then tap Refresh location.");
        return;
      }
      if (!live()) return;
      clearTimeout(timer);
      timer = setTimeout(() => fail("Location services did not respond. Refresh to retry."), deadlineMs);
      if (!await driver.services()) {
        fail("Location services are off. Turn them on, then tap Refresh location.");
        return;
      }
      if (!live()) return;
      clearTimeout(timer);
      onState({ busy: true, error: "", phase: "finding" });
      timer = setTimeout(() => fail(gotFix
        ? "Location received, but live updates did not start. Refresh to reconnect."
        : "No fresh location fix yet. Try again outdoors or check location settings."), deadlineMs);
      // A watch fix can arrive before registration resolves. Neither registration
      // nor the one-shot is allowed to hold the ready UI hostage.
      void driver.watch(accept, () => fail("Live location updates stopped. Refresh to reconnect."))
        .then((sub) => {
          if (!live()) { sub.remove(); return; }
          subscription = sub;
          watching = true;
          if (gotFix) clearTimeout(timer);
        }, () => fail("Could not start live location updates. Refresh to reconnect."));
      void driver.current().then(accept, () => {
        // The watch may still supply a fix before the deadline.
      });
    } catch {
      fail("Could not connect location. Check permission and services, then try again.");
    }
  }
  return { start, stop, suspend };
}
