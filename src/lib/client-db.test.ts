import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeDb } from "./client-db";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("writeDb", () => {
  it("serializes writes to one collection so an older settings snapshot cannot finish last", async () => {
    const firstResponse = deferred<{ status: number; ok: boolean }>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockResolvedValueOnce({ status: 200, ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: true });

    const firstWrite = writeDb("settings", { compatibilityRules: [{ id: "revision-1" }] });
    const secondWrite = writeDb("settings", { compatibilityRules: [{ id: "revision-2" }] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ compatibilityRules: [{ id: "revision-1" }] });

    firstResponse.resolve({ status: 200, ok: true });
    await firstWrite;
    await secondWrite;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ compatibilityRules: [{ id: "revision-2" }] });
  });
});
