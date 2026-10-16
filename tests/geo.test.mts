import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  distanceLabel,
  driveLabel,
  durationMinutes,
  mapsUrl,
  validSpot,
  walkLabel,
} from "../src/lib/geo.ts";
test("distance identity and known equatorial distance", () => {
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 1,
  );
});
test("labels and walking estimate", () => {
  assert.equal(distanceLabel(321), "320 m");
  assert.equal(walkLabel(830), 10);
  assert.equal(distanceLabel(2500), "2.5 km");
});
test("driving estimate and server durations", () => {
  assert.equal(driveLabel(2500), 5);
  assert.equal(driveLabel(100), 1);
  assert.equal(durationMinutes(630), 11);
  assert.equal(durationMinutes(20), 1);
});
test("Maps link explicitly requests walking", () =>
  assert.equal(
    mapsUrl({ lat: 12, lng: 77 }),
    "https://www.google.com/maps/dir/?api=1&destination=12,77&travelmode=walking",
  ));
test("Maps link can request driving", () =>
  assert.equal(
    mapsUrl({ lat: 12, lng: 77 }, "driving"),
    "https://www.google.com/maps/dir/?api=1&destination=12,77&travelmode=driving",
  ));
test("reject corrupted storage data", () => {
  assert.equal(
    validSpot({
      id: "x",
      name: "Car",
      note: "",
      createdAt: 1,
      lat: 91,
      lng: 0,
    }),
    false,
  );
  assert.equal(
    validSpot({
      id: "x",
      name: "Car",
      note: "",
      createdAt: 1,
      lat: 12,
      lng: 77,
    }),
    true,
  );
});

