type JobGateOptions = {
  maxConcurrent: number;
  cooldownMs: number;
  now?: () => number;
};

export function createJobGate(options: JobGateOptions) {
  let activeJobs = 0;
  const lastCompletedByUser = new Map<string, number>();
  const now = options.now ?? Date.now;

  return {
    async run<T>(userId: string, task: () => Promise<T>): Promise<T> {
      if (activeJobs >= options.maxConcurrent) throw new Error("The compatibility worker is busy. Try again later.");
      const lastCompleted = lastCompletedByUser.get(userId);
      if (lastCompleted !== undefined && now() - lastCompleted < options.cooldownMs) {
        throw new Error("Please wait before starting another job.");
      }

      activeJobs += 1;
      try {
        return await task();
      } finally {
        activeJobs -= 1;
        lastCompletedByUser.set(userId, now());
      }
    },
  };
}

export function createSharedAsyncCache<T>(load: () => Promise<T>, ttlMs: number, now: () => number = Date.now) {
  let cached: { value: T; expiresAt: number } | undefined;
  let pending: Promise<T> | undefined;

  return {
    async get(): Promise<T> {
      if (cached && now() < cached.expiresAt) return cached.value;
      if (pending) return pending;
      pending = load().then((value) => {
        cached = { value, expiresAt: now() + ttlMs };
        return value;
      }).finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}