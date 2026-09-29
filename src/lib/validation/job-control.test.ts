import { describe, expect, it } from "vitest";
import { createJobGate, createSharedAsyncCache } from "./job-control";

describe("createJobGate", () => {
  it("rejects concurrent jobs when the worker is at capacity", async () => {
    const gate = createJobGate({ maxConcurrent: 1, cooldownMs: 0 });
    let release!: () => void;
    const first = gate.run("user-a", () => new Promise<void>((resolve) => { release = resolve; }));

    await expect(gate.run("user-b", async () => undefined)).rejects.toThrow("worker is busy");
    release();
    await first;
  });

  it("applies a per-user cooldown after a completed job", async () => {
    let now = 1_000;
    const gate = createJobGate({ maxConcurrent: 1, cooldownMs: 60_000, now: () => now });
    await gate.run("user-a", async () => undefined);

    await expect(gate.run("user-a", async () => undefined)).rejects.toThrow("wait before starting another job");
    now += 60_001;
    await expect(gate.run("user-a", async () => "ok")).resolves.toBe("ok");
  });
});

describe("createSharedAsyncCache", () => {
  it("coalesces concurrent calls and reuses the result within the time to live", async () => {
    let calls = 0;
    let now = 1_000;
    const cache = createSharedAsyncCache(async () => ({ call: ++calls }), 30_000, () => now);

    const [first, second] = await Promise.all([cache.get(), cache.get()]);
    expect(first).toEqual(second);
    expect((await cache.get()).call).toBe(1);
    now += 30_001;
    expect((await cache.get()).call).toBe(2);
  });
});