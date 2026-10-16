import { test } from "node:test";
import assert from "node:assert/strict";
import { routeSummary } from "../src/lib/geo.ts";
import { buildOptions, parseRoutes, routeUrl } from "../src/lib/routes.ts";

const line = (lng0: number, dLat = 0) => [
  [lng0, 12 + dLat],
  [lng0 + 0.001, 12 + dLat],
  [lng0 + 0.002, 12 + dLat],
];
const raw = (distance: number, coords: number[][], duration?: number) => ({
  distance,
  ...(duration !== undefined ? { duration } : {}),
  geometry: { coordinates: coords },
});

test("route URLs pick the profile server and ask for alternatives only when walking", () => {
  const a = { lat: 12, lng: 77 };
  const b = { lat: 12.1, lng: 77.1 };
  const walk = routeUrl("walk", a, b);
  assert.ok(walk.startsWith("https://routing.openstreetmap.de/routed-foot/"));
  assert.ok(walk.includes("77,12;77.1,12.1"));
  assert.ok(walk.includes("alternatives=3"));
  const road = routeUrl("road", a, b);
  assert.ok(road.includes("/routed-car/"));
  assert.ok(!road.includes("alternatives"));
});

test("parseRoutes keeps valid routes (max 3) and drops malformed ones", () => {
  const data = {
    code: "Ok",
    routes: [
      raw(100, line(77)),
      raw(Number.NaN, line(77, 0.01)),
      { distance: 5, geometry: { coordinates: [[1, 1]] } },
      raw(120, [
        [200, 0],
        [1, 1],
      ]),
      raw(130, line(77, 0.02)),
      raw(140, line(77, 0.03)),
    ],
  };
  const out = parseRoutes(data, "walk");
  assert.equal(out.length, 1);
  assert.equal(
    parseRoutes({ routes: [raw(1, line(1)), raw(2, line(2))] }, "walk").length,
    2,
  );
  assert.equal(
    parseRoutes({ routes: [raw(1, line(1)), raw(2, line(2))] }, "road").length,
    1,
  );
  assert.deepEqual(parseRoutes(null, "walk"), []);
  assert.deepEqual(parseRoutes({ routes: "x" }, "walk"), []);
});

test("parseRoutes keeps server durations only when valid", () => {
  assert.equal(
    parseRoutes({ routes: [raw(1000, line(77), 620)] }, "walk")[0].duration,
    620,
  );
  assert.equal(
    parseRoutes({ routes: [raw(1000, line(77))] }, "walk")[0].duration,
    undefined,
  );
  assert.equal(
    parseRoutes({ routes: [raw(1000, line(77), Number.NaN)] }, "walk")[0]
      .duration,
    undefined,
  );
});

test("first walking route is Best; duplicates are dropped", () => {
  const walk = parseRoutes(
    {
      routes: [
        raw(1000, line(77)),
        raw(1010, line(77)),
        raw(1200, line(77, 0.01)),
      ],
    },
    "walk",
  );
  const opts = buildOptions(walk, undefined);
  assert.deepEqual(
    opts.map((o) => o.label),
    ["Best", "Option 2"],
  );
  assert.equal(opts[0].distance, 1000);
});

test("main road route is appended only when distinct and not a big detour", () => {
  const walk = parseRoutes({ routes: [raw(1000, line(77))] }, "walk");
  const far = parseRoutes({ routes: [raw(1300, line(77, 0.01))] }, "road")[0];
  const same = parseRoutes({ routes: [raw(1000, line(77))] }, "road")[0];
  const detour = parseRoutes(
    { routes: [raw(2000, line(77, 0.01))] },
    "road",
  )[0];
  assert.deepEqual(
    buildOptions(walk, far).map((o) => o.label),
    ["Best", "Main road"],
  );
  assert.equal(buildOptions(walk, same).length, 1);
  assert.equal(buildOptions(walk, detour).length, 1);
  assert.equal(buildOptions([], far).length, 0);
});

test("option summary uses the app walking estimate", () => {
  const o = parseRoutes({ routes: [raw(830, line(77))] }, "walk")[0];
  assert.equal(routeSummary(o.distance), "10 min · 830 m");
  assert.equal(routeSummary(2500), "30 min · 2.5 km");
});


test("spatial duplicate detection matches pairwise reference including negative cell boundaries", () => {
  const overlap = (a: number[][], b: number[][]) => {
    const s = a.length <= b.length ? a : b, other = s === a ? b : a;
    return s.filter((p) => other.some((q) => Math.abs(p[0]-q[0]) < 0.0003 && Math.abs(p[1]-q[1]) < 0.0003)).length / s.length;
  };
  let seed = 7;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let n = 0; n < 100; n++) {
    const a = Array.from({length:50}, () => [(random() - 0.5) * 0.003, (random() - 0.5) * 0.003]);
    const b = n % 2 ? a.map((p) => [p[0] + 0.00001, p[1] - 0.00001])
      : Array.from({length:70}, () => [(random() - 0.5) * 0.003, (random() - 0.5) * 0.003]);
    const routes = [a,b].map((coords,i) => ({id:`walk-${i}`,kind:'walk' as const,label:'',coords,distance:1000}));
    assert.equal(buildOptions(routes,undefined).length, overlap(a,b) < 0.9 ? 2 : 1);
  }
});

