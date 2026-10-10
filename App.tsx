import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SpotMap from "./src/components/SpotMap";
import {
  distance,
  distanceLabel,
  mapsUrl,
  validSpot,
  walkLabel,
  type Point,
  type Spot,
} from "./src/lib/geo";

const KEY = "waymark.spots.v1";
const demo =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");
const sample: Point = {
  lat: 12.9757,
  lng: 77.5995,
  accuracy: 12,
  timestamp: Date.now(),
};
const example: Spot = {
  id: "demo",
  name: "The car",
  note: "Level 2, next to the blue lift",
  lat: 12.9784,
  lng: 77.5982,
  createdAt: Date.now() - 1800000,
};
function Main() {
  const dark = useColorScheme() === "dark";
  const c = dark
    ? {
        bg: "#101C19",
        surface: "#1B2B26",
        text: "#ECF4EE",
        muted: "#A6B9AF",
        line: "#30443A",
        green: "#9BE5AF",
        ink: "#11382B",
        accent: "#9BE5AF",
      }
    : {
        bg: "#F5F6F0",
        surface: "#FFFFFF",
        text: "#172F25",
        muted: "#697B70",
        line: "#E0E6DE",
        green: "#B3E6BC",
        ink: "#173C2A",
        accent: "#173C2A",
      };
  const [spots, setSpots] = useState<Spot[]>(demo ? [example] : []),
    [ready, setReady] = useState(false),
    [storageFailed, setStorageFailed] = useState(false),
    [position, setPosition] = useState<Point | null>(demo ? sample : null),
    [error, setError] = useState(""),
    [screen, setScreen] = useState<"home" | "save" | "guide" | "about">("home"),
    [selected, setSelected] = useState<Spot | null>(null),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [saving, setSaving] = useState(false),
    [route, setRoute] = useState<number[][]>(),
    [routeDistance, setRouteDistance] = useState<number>(),
    [routeStatus, setRouteStatus] = useState("Straight-line estimate"),
    [online, setOnline] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null),
    lastRoute = useRef(0),
    lastOrigin = useRef<Point | null>(null),
    routeOrigin = useState<Point | null>(null);
  const text = (
    size = 16,
    color = c.text,
    weight: "400" | "500" | "600" | "700" | "800" = "400",
  ) => ({ fontSize: size, color, fontWeight: weight });
  const button = (
    label: string,
    action: () => void,
    icon: React.ComponentProps<typeof Ionicons>["name"] = "arrow-forward",
    primary = true,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? c.green : c.surface,
          borderColor: c.line,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={text(16, primary ? c.ink : c.text, "700")}>{label}</Text>
      <Ionicons name={icon} size={21} color={primary ? c.ink : c.text} />
    </Pressable>
  );
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!demo) {
          const raw = await AsyncStorage.getItem(KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            if (!Array.isArray(saved) || !saved.every(validSpot))
              throw new Error("bad data");
            if (active) setSpots(saved);
          }
        }
      } catch {
        if (active) setStorageFailed(true);
        if (active)
          setError(
            "Saved spots could not be loaded. Your stored data has not been changed.",
          );
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function locate() {
    if (demo) return;
    setBusy(true);
    setError("");
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== "granted") {
        setError(
          "Location is off. Allow it in Settings to save a spot or find your way back.",
        );
        return;
      }
      watch.current?.remove();
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPosition({
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy: fix.coords.accuracy ?? undefined,
        timestamp: fix.timestamp,
      });
      watch.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (l) =>
          setPosition({
            lat: l.coords.latitude,
            lng: l.coords.longitude,
            accuracy: l.coords.accuracy ?? undefined,
            timestamp: l.timestamp,
          }),
      );
    } catch {
      setError(
        "No location fix yet. Check location services and try again outdoors.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        watch.current?.remove();
        watch.current = null;
      } else if (position && !demo) void locate();
    });
    return () => {
      sub.remove();
      watch.current?.remove();
    };
  }, [!!position]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "home") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);
  const [origin, setOrigin] = routeOrigin;
  useEffect(() => {
    if (
      screen === "guide" &&
      online &&
      position &&
      (!lastOrigin.current || distance(lastOrigin.current, position) >= 30) &&
      Date.now() - lastRoute.current >= 30000
    )
      setOrigin(position);
  }, [position, screen, online]);
  // Route calls are opt-in and limited to once every 30 seconds, after movement.
  useEffect(() => {
    if (screen !== "guide" || !selected || !origin || !online) return;
    if (Date.now() - lastRoute.current < 30000 && lastRoute.current) return;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    lastRoute.current = Date.now();
    lastOrigin.current = origin;
    setRouteStatus("Finding a walking route…");
    fetch(
      `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${origin.lng},${origin.lat};${selected.lng},${selected.lat}?overview=full&geometries=geojson`,
      {
        signal: ctrl.signal,
        headers: { "User-Agent": "WaymarkNative/1.0 (personal spot finder)" },
      },
    )
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        const r = data.routes?.[0];
        if (
          !r ||
          !Array.isArray(r.geometry?.coordinates) ||
          !Number.isFinite(r.distance) ||
          !r.geometry.coordinates.every(
            (v: unknown) =>
              Array.isArray(v) &&
              v.length >= 2 &&
              Number.isFinite(v[0]) &&
              Number.isFinite(v[1]) &&
              Math.abs(v[0]) <= 180 &&
              Math.abs(v[1]) <= 90,
          )
        )
          throw Error();
        setRoute(r.geometry.coordinates);
        setRouteDistance(r.distance);
        setRouteStatus("Walking route · approximate");
      })
      .catch(() => {
        setRoute(undefined);
        setRouteDistance(undefined);
        setRouteStatus("Route unavailable · straight-line estimate");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, [screen, selected, origin, online]);
  async function persist(next: Spot[]) {
    if (storageFailed || !ready) throw new Error("storage unavailable");
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setSpots(next);
  }
  async function save() {
    if (!position || !name.trim() || saving || storageFailed || !ready) return;
    if (!demo && Date.now() - (position.timestamp ?? 0) > 60000) {
      setError("Location is stale. Refresh it before saving.");
      return;
    }
    setSaving(true);
    try {
      const spot: Spot = {
        ...position,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        note: note.trim(),
        createdAt: Date.now(),
      };
      await persist([spot, ...spots]);
      setScreen("home");
      setName("");
      setNote("");
    } catch {
      setError(
        "Could not save this spot. Nothing was removed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  function guide(spot: Spot) {
    setOnline(false);
    setOrigin(null);
    setSelected(spot);
    setRoute(undefined);
    setRouteDistance(undefined);
    setRouteStatus("Straight-line estimate");
    lastOrigin.current = null;
    setScreen("guide");
  }
  function remove(spot: Spot) {
    const perform = async () => {
      try {
        await persist(spots.filter((p) => p.id !== spot.id));
      } catch {
        setError("Could not remove the spot. Please try again.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete ${spot.name}?`)) void perform();
    } else
      Alert.alert("Remove this spot?", spot.name, [
        { text: "Keep it", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void perform() },
      ]);
  }
  const metres = selected && position ? distance(position, selected) : null;
  const stale =
    position && !demo && Date.now() - (position.timestamp ?? 0) > 60000;
  const gps = busy
    ? "Finding your location"
    : position
      ? `Location ready · ±${Math.round(position.accuracy ?? 0)} m`
      : "Location not connected";
  const mapPoint = position ?? selected;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={s.top}>
        <Pressable
          onPress={() => setScreen("home")}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Text style={text(28, c.text, "800")}>
            waymark<Text style={{ color: "#43996A" }}>.</Text>
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setScreen("about")}
          accessibilityRole="button"
          accessibilityLabel="About and privacy"
          style={[s.iconButton, { borderColor: c.line }]}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={c.text} />
        </Pressable>
      </View>
      {screen === "home" && (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.eyebrow}>
            <View
              style={[
                s.statusDot,
                { backgroundColor: position ? "#43996A" : "#91A299" },
              ]}
            />
            <Text style={text(11, c.muted, "700")}>{gps.toUpperCase()}</Text>
          </View>
          <Text style={[text(44, c.text, "800"), s.hero]}>
            Leave a mark.{"\n"}Find your way.
          </Text>
          <Text
            style={[
              text(16, c.muted),
              { lineHeight: 24, marginBottom: 25, maxWidth: 280 },
            ]}
          >
            Your car. A quiet corner. That place worth coming back to.
          </Text>
          <View style={[s.heroCard, { backgroundColor: c.green }]}>
            <View style={s.orbit}>
              <Ionicons name="location" size={46} color={c.ink} />
            </View>
            <Text style={text(23, c.ink, "700")}>Here, remembered.</Text>
            <Text
              style={[
                text(14, c.ink),
                { lineHeight: 21, marginTop: 7, marginBottom: 24 },
              ]}
            >
              Save your exact spot, add a little detail,{"\n"}and let future you
              take it from there.
            </Text>
            <Pressable
              onPress={() => {
                setName("");
                setNote("");
                setScreen("save");
              }}
              accessibilityRole="button"
              accessibilityLabel="Save a new spot"
              style={[s.button, { backgroundColor: c.ink, borderColor: c.ink }]}
            >
              <Text style={text(16, "#F1F7EB", "700")}>Save a new spot</Text>
              <Ionicons name="add" size={22} color="#F1F7EB" />
            </Pressable>
          </View>
          <View style={s.section}>
            <Text style={text(21, c.text, "700")}>Your places</Text>
            <Text style={text(12, c.muted)}>{spots.length} saved</Text>
          </View>
          {!ready ? (
            <ActivityIndicator color={c.accent} />
          ) : spots.length ? (
            spots.map((spot) => (
              <View
                key={spot.id}
                style={[
                  s.spot,
                  { backgroundColor: c.surface, borderColor: c.line },
                ]}
              >
                <View style={s.row}>
                  <View style={[s.smallPin, { backgroundColor: c.bg }]}>
                    <Ionicons name="bookmark-outline" size={22} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={text(18, c.text, "700")}>{spot.name}</Text>
                    <Text
                      numberOfLines={2}
                      style={[text(13, c.muted), { marginTop: 5 }]}
                    >
                      {spot.note || "A place to come back to"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${spot.name}`}
                    onPress={() => remove(spot)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={17} color={c.muted} />
                  </Pressable>
                </View>
                <View style={[s.section, { marginTop: 18, marginBottom: 0 }]}>
                  <Text style={text(12, c.muted)}>
                    {position
                      ? `${distanceLabel(distance(position, spot))} away`
                      : "Saved on this device"}
                  </Text>
                  <Pressable
                    onPress={() => guide(spot)}
                    accessibilityRole="button"
                    accessibilityLabel={`Find ${spot.name}`}
                    style={s.row}
                  >
                    <Text style={text(14, c.accent, "700")}>Find my way</Text>
                    <Ionicons name="arrow-forward" size={17} color={c.accent} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={[s.empty, { borderColor: c.line }]}>
              <Ionicons name="trail-sign-outline" size={28} color={c.muted} />
              <Text style={[text(15, c.text, "600"), { marginTop: 12 }]}>
                Your next adventure starts here.
              </Text>
              <Text
                style={[
                  text(13, c.muted),
                  { marginTop: 6, textAlign: "center", lineHeight: 20 },
                ]}
              >
                Save a spot above. It stays on your phone.
              </Text>
            </View>
          )}
          <Text style={[text(11, c.muted), s.footer]}>
            NO ACCOUNT. JUST YOUR PLACES.
          </Text>
        </ScrollView>
      )}
      {screen === "save" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setScreen("home")} style={s.row}>
              <Ionicons name="arrow-back" size={18} color={c.muted} />
              <Text style={text(13, c.muted)}>Your places</Text>
            </Pressable>
            <Text style={[text(35, c.text, "800"), { marginTop: 24 }]}>
              Make it a memory.
            </Text>
            <Text
              style={[text(15, c.muted), { marginTop: 8, marginBottom: 22 }]}
            >
              A name now. A little less wandering later.
            </Text>
            {position ? (
              <View style={[s.mapSmall, { borderColor: c.line }]}>
                <SpotMap point={position} dark={dark} />
              </View>
            ) : (
              <View
                style={[s.empty, { borderColor: c.line, marginBottom: 20 }]}
              >
                <Ionicons name="locate-outline" size={30} color={c.accent} />
                <Text
                  style={[
                    text(15, c.muted),
                    { textAlign: "center", marginTop: 14, lineHeight: 22 },
                  ]}
                >
                  Connect your location to drop a mark.
                </Text>
              </View>
            )}
            {button(
              busy
                ? "Getting a fix…"
                : position
                  ? "Refresh location"
                  : "Use my location",
              () => void locate(),
              "locate-outline",
              false,
              busy,
            )}
            <Text
              style={[text(11, c.muted), { marginTop: 12, marginBottom: 24 }]}
            >
              {gps}
              {stale ? " · stale" : ""}
            </Text>
            <Text style={text(12, c.muted, "700")}>SPOT NAME</Text>
            <TextInput
              accessibilityLabel="Spot name"
              placeholder="The car, my favourite view…"
              placeholderTextColor={c.muted}
              value={name}
              onChangeText={setName}
              maxLength={70}
              style={[
                s.input,
                text(18, c.text, "600"),
                { borderColor: c.line, backgroundColor: c.surface },
              ]}
            />
            <Text style={[text(12, c.muted, "700"), { marginTop: 22 }]}>
              A LITTLE DETAIL (OPTIONAL)
            </Text>
            <TextInput
              accessibilityLabel="Spot note"
              placeholder="Level 2, next to the blue lift"
              placeholderTextColor={c.muted}
              value={note}
              onChangeText={setNote}
              maxLength={240}
              multiline
              style={[
                s.input,
                text(16),
                {
                  borderColor: c.line,
                  backgroundColor: c.surface,
                  minHeight: 90,
                  textAlignVertical: "top",
                },
              ]}
            />
            <View style={{ marginTop: 28 }}>
              {button(
                saving ? "Saving…" : "Keep this spot",
                () => void save(),
                "bookmark-outline",
                true,
                !position ||
                  !name.trim() ||
                  saving ||
                  !!stale ||
                  storageFailed ||
                  !ready,
              )}
            </View>
            <Text
              style={[
                text(12, c.muted),
                { marginTop: 18, textAlign: "center" },
              ]}
            >
              Stored on this device. Not in the cloud.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      {screen === "guide" && selected && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 24, paddingBottom: 18 }}>
            <Pressable onPress={() => setScreen("home")} style={s.row}>
              <Ionicons name="arrow-back" size={18} color={c.muted} />
              <Text style={text(13, c.muted)}>Your places</Text>
            </Pressable>
            <Text style={[text(29, c.text, "800"), { marginTop: 17 }]}>
              {selected.name}
            </Text>
            <Text style={[text(14, c.muted), { marginTop: 6 }]}>
              {selected.note || "Let’s get you back."}
            </Text>
          </View>
          <View style={{ flex: 1, minHeight: 150 }}>
            {mapPoint && (
              <SpotMap
                key={`${selected.id}-${!!position}`}
                point={mapPoint}
                target={selected}
                route={
                  route ??
                  (position
                    ? [
                        [position.lng, position.lat],
                        [selected.lng, selected.lat],
                      ]
                    : undefined)
                }
                dark={dark}
              />
            )}
          </View>
          <View
            style={[
              s.guideCard,
              { backgroundColor: c.bg, borderColor: c.line },
            ]}
          >
            <View style={s.row}>
              <View style={[s.statusDot, { backgroundColor: "#43996A" }]} />
              <Text style={text(11, c.muted, "700")}>BACK TO YOUR MARK</Text>
            </View>
            {metres !== null ? (
              <View
                style={[s.section, { marginTop: 14, alignItems: "flex-end" }]}
              >
                <Text style={text(48, c.text, "800")}>
                  {distanceLabel(routeDistance ?? metres)}
                </Text>
                <View style={{ alignItems: "flex-end", paddingBottom: 6 }}>
                  <Ionicons name="walk-outline" size={21} color={c.accent} />
                  <Text style={[text(14, c.text, "600"), { marginTop: 5 }]}>
                    ~{walkLabel(routeDistance ?? metres)} min walk
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[text(22, c.text, "700"), { marginVertical: 14 }]}>
                Connect location to guide back.
              </Text>
            )}
            <Text
              style={[text(12, c.muted), { marginBottom: 15, lineHeight: 18 }]}
            >
              {stale
                ? "Location stale · refresh before following"
                : routeStatus}
              {metres !== null && metres < 25
                ? " · You’re close. Check your surroundings."
                : ""}
            </Text>
            {!position &&
              button(
                "Use my location",
                () => void locate(),
                "locate-outline",
                true,
                busy,
              )}
            {position &&
              !online &&
              button(
                "Show walking route",
                () => setConsent(true),
                "map-outline",
                false,
              )}
            <View style={{ height: 10 }} />
            {button(
              "Open in Google Maps",
              () =>
                void Linking.openURL(mapsUrl(selected)).catch(() =>
                  setError(
                    "Could not open Maps. Please check your connection.",
                  ),
                ),
              "open-outline",
            )}
            <Pressable
              onPress={() => {
                setScreen("home");
                setOnline(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="End guide"
              style={{ alignSelf: "center", padding: 14 }}
            >
              <Text style={text(13, c.muted, "600")}>End guide</Text>
            </Pressable>
          </View>
        </View>
      )}
      {screen === "about" && (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={text(35, c.text, "800")}>A little less lost.</Text>
          <Text style={[text(16, c.muted), { lineHeight: 25, marginTop: 20 }]}>
            Waymark 1.0.0{"\n\n"}Save a place. Find your way back. No account,
            ads, analytics, or direction arrow. Location is only used while the
            app is open.{"\n\n"}Your saved coordinates and notes stay in this
            app’s device storage. They are not encrypted. Removing the app
            removes its spots. Android backup is disabled.{"\n\n"}Maps are
            online: OpenFreeMap receives tile requests and your IP address,
            which can reveal the area you’re viewing. Walking routes are
            optional: FOSSGIS receives your current and saved coordinates and
            logs route requests. Opening Google Maps shares your destination
            with Google.{"\n\n"}GPS, distances, and walking estimates can be
            wrong. This is not a safety or emergency navigation tool. Check
            paths, signs, traffic, and local access rules. Maps and routing need
            internet and may be unavailable.
          </Text>
          <View style={{ marginTop: 28 }}>
            {button(
              "Map data © OpenStreetMap",
              () =>
                void Linking.openURL("https://www.openstreetmap.org/copyright"),
              "open-outline",
              false,
            )}
            <View style={{ height: 10 }} />
            {button(
              "Fix the map",
              () => void Linking.openURL("https://www.openstreetmap.org/"),
              "open-outline",
              false,
            )}
            <View style={{ height: 10 }} />
            {button("Back to my places", () => setScreen("home"))}
          </View>
        </ScrollView>
      )}
      {!!error && (
        <View
          style={[s.error, { backgroundColor: dark ? "#512D25" : "#FFF1E5" }]}
        >
          <Text
            accessibilityRole="alert"
            style={[
              text(13, dark ? "#FFE0CE" : "#7D3C21"),
              { flex: 1, lineHeight: 19 },
            ]}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => setError("")}
            accessibilityLabel="Dismiss error"
          >
            <Ionicons name="close" size={19} color={c.muted} />
          </Pressable>
        </View>
      )}
      <Modal
        transparent
        visible={consent}
        animationType="fade"
        onRequestClose={() => setConsent(false)}
      >
        <View style={s.modal}>
          <View style={[s.dialog, { backgroundColor: c.surface }]}>
            <Ionicons name="map-outline" size={32} color={c.accent} />
            <Text style={[text(24, c.text, "700"), { marginTop: 20 }]}>
              Take the walking route?
            </Text>
            <Text
              style={[
                text(15, c.muted),
                { lineHeight: 23, marginTop: 12, marginBottom: 24 },
              ]}
            >
              The route service receives your current position and destination.
              It logs requests. Your notes and saved list stay on your device.
            </Text>
            {button("Use online routing", () => {
              setConsent(false);
              setOnline(true);
            })}
            <Pressable
              onPress={() => setConsent(false)}
              style={{ padding: 18, alignItems: "center" }}
            >
              <Text style={text(14, c.muted)}>Keep the straight-line view</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  top: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 30 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 17,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  hero: { letterSpacing: -1.7, lineHeight: 49, marginBottom: 14 },
  heroCard: { padding: 23, borderRadius: 25 },
  orbit: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: "#80BB91",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 21,
  },
  button: {
    paddingHorizontal: 18,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 16,
  },
  spot: { padding: 19, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallPin: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: 30,
    borderRadius: 21,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
  },
  footer: { letterSpacing: 1.4, textAlign: "center", marginTop: 26 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 15,
    padding: 17,
    minHeight: 56,
  },
  mapSmall: {
    height: 180,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 15,
  },
  guideCard: {
    paddingHorizontal: 24,
    paddingTop: 22,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderTopWidth: 1,
  },
  error: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
  },
  modal: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "center",
    padding: 26,
  },
  dialog: { borderRadius: 25, padding: 25 },
});
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
