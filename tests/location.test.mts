import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocationController, freshPoint, type LocationDriver, type LocationState, type Subscription } from "../src/lib/location.ts";
const point = () => ({ lat: 12, lng: 77, accuracy: 12, timestamp: Date.now() });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: () => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup(overrides: Partial<LocationDriver> = {}, deadline = 15) {
  const current = deferred<ReturnType<typeof point>>(), watcher = deferred<Subscription>();
  const states: LocationState[] = [], points: ReturnType<typeof point>[] = [];
  let update!: (p: ReturnType<typeof point>) => void, error!: () => void;
  let watchCalls = 0;
  const driver: LocationDriver = { permission: async () => true, services: async () => true,
    current: () => current.promise, watch: (u, e) => { update = u; error = e; watchCalls++; return watcher.promise; }, ...overrides };
  const controller = createLocationController(driver, (s) => states.push(s), (p) => points.push(p as ReturnType<typeof point>), deadline);
  return { controller, states, points, current, watcher, update: () => update, error: () => error, calls: () => watchCalls };
}
test("received position is ready while watch registration stays pending", async () => {
  const t = setup(); await t.controller.start(); t.current.resolve(point()); await tick();
  assert.equal(t.states.at(-1)?.phase, "ready"); assert.equal(t.states.at(-1)?.busy, false);
  t.controller.stop();
});
test("watch callback resolves first-fix UI even if one-shot stays pending", async () => {
  const t = setup(); await t.controller.start(); t.update()(point());
  assert.equal(t.states.at(-1)?.phase, "ready"); t.controller.stop();
});
test("hung acquisition times out and late fix is ignored; late watch removed", async () => {
  const t = setup(); await t.controller.start(); await new Promise((r) => setTimeout(r, 25));
  assert.equal(t.states.at(-1)?.phase, "error"); assert.equal(t.states.at(-1)?.busy, false);
  let removed = 0; t.current.resolve(point()); t.watcher.resolve({ remove: () => removed++ }); await tick();
  assert.equal(t.points.length, 0); assert.equal(removed, 1);
});
test("no overlapping first-fix calls, and suspend cleans up late registration", async () => {
  const t = setup(); await t.controller.start(); await t.controller.start(); assert.equal(t.calls(), 1);
  t.controller.suspend(); let removed = 0; t.watcher.resolve({ remove: () => removed++ });
  t.update()(point()); t.current.resolve(point()); await tick();
  assert.equal(t.points.length, 0); assert.equal(removed, 1); assert.equal(t.states.at(-1)?.busy, false);
});
test("denial and services-off give distinct recoverable errors", async () => {
  const denied = setup({ permission: async () => false }); await denied.controller.start();
  assert.match(denied.states.at(-1)!.error, /permission/); assert.equal(denied.calls(), 0);
  const off = setup({ services: async () => false }); await off.controller.start();
  assert.match(off.states.at(-1)!.error, /services/); assert.equal(off.calls(), 0);
});
test("runtime watch errors stop subscription, retry can recover", async () => {
  const t = setup(); await t.controller.start(); let removed = 0;
  t.watcher.resolve({ remove: () => removed++ }); t.current.resolve(point()); await tick();
  t.error()(); assert.equal(removed, 1); assert.equal(t.states.at(-1)?.phase, "error");
  await t.controller.start(); await tick(); assert.equal(t.states.at(-1)?.phase, "ready"); t.controller.stop();
});
test("stale, malformed and far-future positions cannot unlock save", async () => {
  assert.equal(freshPoint({ ...point(), timestamp: Date.now() - 60000 }), false);
  assert.equal(freshPoint({ ...point(), lat: 100 }), false);
  assert.equal(freshPoint({ ...point(), timestamp: Date.now() + 10000 }), false);
  assert.equal(freshPoint({ ...point(), timestamp: undefined }), false);
  assert.equal(freshPoint(point()), true);
  const t = setup(); await t.controller.start(); t.update()({ ...point(), timestamp: Date.now() - 61000 });
  assert.equal(t.points.length, 0); t.controller.stop();
});
test("late first session cannot overwrite a new session", async () => {
  const t = setup(); await t.controller.start(); const oldUpdate = t.update();
  t.controller.suspend(); await t.controller.start(); oldUpdate(point());
  assert.equal(t.points.length, 0); t.update()(point()); assert.equal(t.points.length, 1); t.controller.stop();
});

test("ready fix does not hide a hung watch registration forever", async () => {
  const t = setup(); await t.controller.start(); t.current.resolve(point()); await tick();
  assert.equal(t.states.at(-1)?.phase, "ready");
  await new Promise((r) => setTimeout(r, 25));
  assert.match(t.states.at(-1)!.error, /live updates did not start/);
  let removed = 0; t.watcher.resolve({ remove: () => removed++ }); await tick();
  assert.equal(removed, 1); assert.equal(t.points.length, 1);
});
test("pending services check is bounded and no watcher starts after stop", async () => {
  const services = deferred<boolean>(); const t = setup({ services: () => services.promise });
  const start = t.controller.start(); await new Promise((r) => setTimeout(r, 25));
  assert.match(t.states.at(-1)!.error, /services did not respond/);
  services.resolve(true); await start; assert.equal(t.calls(), 0);
});

test("older one-shot never replaces a newer watch fix", async () => {
  const t = setup(); await t.controller.start(); const newer = point();
  t.update()(newer); t.current.resolve({ ...newer, timestamp: newer.timestamp - 1000 }); await tick();
  assert.equal(t.points.length, 1); assert.equal(t.points[0].timestamp, newer.timestamp); t.controller.stop();
});
