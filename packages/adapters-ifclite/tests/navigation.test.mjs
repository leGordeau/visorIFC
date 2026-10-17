import test from "node:test";
import assert from "node:assert/strict";
import { bindNavigation } from "../src/navigation.ts";

class Canvas extends EventTarget {
  dataset = {};
  clientHeight = 500;
  captures = new Set();
  focus() { this.focused = true; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

function setup(mode = "orbit") {
  const canvas = new Canvas();
  const calls = [];
  const camera = Object.fromEntries(["orbit", "pan", "zoom"].map(name =>
    [name, (...args) => calls.push([name, ...args])]));
  const dispose = bindNavigation(canvas, camera, () => mode, () => calls.push(["fit"]));
  function send(type, properties = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 20,
      shiftKey: false, deltaMode: 0, deltaY: 0, ...properties,
    });
    canvas.dispatchEvent(event);
    return event;
  }
  return { canvas, calls, send, dispose };
}

test("left drag rotates; capture retains the gesture until release", () => {
  const { canvas, send, calls } = setup();
  send("pointerdown");
  assert.ok(canvas.focused && canvas.hasPointerCapture(1));
  send("pointermove", { clientX: 40, clientY: 35 });
  send("pointerup");
  send("pointermove", { clientX: 80 });
  assert.deepEqual(calls, [["orbit", 30, 15]]);
  assert.equal(canvas.captures.size, 0);
});

test("right, middle, Shift and explicit pan mode translate instead of rotating", () => {
  for (const [mode, properties] of [
    ["orbit", { button: 2 }], ["orbit", { button: 1 }],
    ["orbit", { shiftKey: true }], ["pan", {}],
  ]) {
    const { send, calls } = setup(mode);
    send("pointerdown", properties);
    send("pointermove", { clientX: 30, clientY: 10 });
    assert.deepEqual(calls, [["pan", 20, -10]]);
  }
});

test("wheel consumes browser scroll and normalizes pixels, lines and pages", () => {
  const { send, calls } = setup();
  assert.ok(send("wheel", { deltaY: -100 }).defaultPrevented);
  send("wheel", { deltaY: 3, deltaMode: 1 });
  send("wheel", { deltaY: 1, deltaMode: 2 });
  assert.deepEqual(calls, [["zoom", -100, false], ["zoom", 48, false], ["zoom", 240, false]]);
});

test("cancel, lost capture, focus loss and missing mouse button all end a drag", () => {
  for (const type of ["pointercancel", "lostpointercapture", "blur", "pointermove"]) {
    const { canvas, send, calls } = setup();
    send("pointerdown");
    send(type, { buttons: 0 });
    send("pointermove", { clientX: 80 });
    assert.deepEqual(calls, []);
    assert.equal(canvas.captures.size, 0);
  }
});

test("a second pointer cannot hijack the active gesture", () => {
  const { send, calls } = setup();
  send("pointerdown");
  send("pointerdown", { pointerId: 2, clientX: 100 });
  send("pointermove", { pointerId: 2, clientX: 150 });
  send("pointerup", { pointerId: 2 });
  send("pointermove", { clientX: 30 });
  assert.deepEqual(calls, [["orbit", 20, 0]]);
});

test("keyboard supports orbit, pan, zoom and fit without claiming browser shortcuts", () => {
  const { send, calls } = setup();
  send("keydown", { key: "ArrowLeft" });
  send("keydown", { key: "ArrowUp", shiftKey: true });
  send("keydown", { key: "+" });
  send("keydown", { key: "-" });
  send("keydown", { key: "f" });
  assert.equal(send("keydown", { key: "+", ctrlKey: true }).defaultPrevented, false);
  assert.deepEqual(calls, [["orbit", -24, 0], ["pan", 0, -24], ["zoom", -120, false], ["zoom", 120, false], ["fit"]]);
});

test("disposal releases capture and removes input listeners", () => {
  const { canvas, send, calls, dispose } = setup();
  send("pointerdown");
  dispose();
  assert.equal(canvas.captures.size, 0);
  send("pointermove", { clientX: 40 });
  send("wheel", { deltaY: 100 });
  send("keydown", { key: "f" });
  assert.deepEqual(calls, []);
});
