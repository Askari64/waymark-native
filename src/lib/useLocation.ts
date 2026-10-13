import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import type { Point } from "./geo";
import { createLocationController, FIX_MAX_AGE, freshPoint, type LocationState } from "./location";

const point = (fix: Location.LocationObject): Point => ({
  lat: fix.coords.latitude, lng: fix.coords.longitude,
  accuracy: fix.coords.accuracy ?? undefined, timestamp: fix.timestamp,
});
const driver = {
  async permission(prompt: boolean) {
    const permission = prompt ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    return permission.status === "granted";
  },
  services: () => Location.hasServicesEnabledAsync(),
  async current() { return point(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })); },
  watch(update: (p: Point) => void, error: () => void) {
    return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5,
      timeInterval: 5000, mayShowUserSettingsDialog: false }, (fix) => update(point(fix)), error);
  },
};
export function useLocation(active: boolean, demo: boolean, initial: Point | null) {
  const [position, setPosition] = useState<Point | null>(initial);
  const [state, setState] = useState<LocationState>({ busy: false, error: "", phase: "idle" });
  const [now, setNow] = useState(Date.now());
  const enabled = useRef(false), activeRef = useRef(active);
  activeRef.current = active;
  const [controller] = useState(() => createLocationController(driver, setState, (p) => {
    setPosition(p); setNow(Date.now());
  }));
  const locate = useCallback(() => {
    if (demo || !activeRef.current || AppState.currentState !== "active") return;
    enabled.current = true;
    void controller.start(true);
  }, [controller, demo]);
  useEffect(() => {
    if (demo) return;
    if (!active) controller.suspend();
    else if (enabled.current && AppState.currentState === "active") void controller.start(false);
  }, [active, controller, demo]);
  useEffect(() => {
    if (demo) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") controller.suspend();
      else {
        setNow(Date.now());
        if (enabled.current && activeRef.current) void controller.start(false);
      }
    });
    return () => { sub.remove(); controller.stop(); };
  }, [controller, demo]);
  useEffect(() => {
    if (demo || !position?.timestamp) return;
    const timeout = setTimeout(() => setNow(Date.now()), Math.max(0, position.timestamp + FIX_MAX_AGE - Date.now()));
    return () => clearTimeout(timeout);
  }, [position, demo]);
  return { position, busy: state.busy, locationError: state.error, locate,
    stale: !!position && !demo && !freshPoint(position, now) };
}
