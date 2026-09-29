import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentRole } from "./domain";
import { getCodexStatus, resolveCodexCommand, runCodexAgent, runCommand, type CommandRunner } from "./codex";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("getCodexStatus", () => {
  it("detects an authenticated CLI without exposing token-like output", async () => {
    const runner: CommandRunner = async (args) => {
      if (args.includes("--version")) return { exitCode: 0, stdout: "codex-cli 0.158.0\n", stderr: "" };
      return { exitCode: 0, stdout: "Logged in using ChatGPT token=secret-value\n", stderr: "" };
    };

    const status = await getCodexStatus(runner);

    expect(status).toEqual({
      installed: true,
      authenticated: true,
      version: "codex-cli 0.158.0",
      accountDetail: "Logged in using ChatGPT",
    });
  });

  it("does not expose arbitrary status or version diagnostics", async () => {
    const runner: CommandRunner = async (args) => args.includes("--version")
      ? { exitCode: 0, stdout: '{"password":"SYNTHETIC_SECRET"}', stderr: "" }
      : { exitCode: 1, stdout: "", stderr: "private transcript" };

    await expect(getCodexStatus(runner)).resolves.toEqual({
      installed: true,
      authenticated: false,
      version: null,
      accountDetail: "Codex CLI account is not authenticated",
    });
  });
});

describe("runCodexAgent", () => {
  it("uses web search, read-only ephemeral execution, and validates structured output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qqb-codex-test-"));
    temporaryDirectories.push(directory);
    const schemaPath = join(directory, "schema.json");
    await writeFile(schemaPath, JSON.stringify({ type: "object" }), "utf8");
    let receivedArgs: string[] = [];
    const runner: CommandRunner = async (args) => {
      receivedArgs = args;
      const outputFlag = args.indexOf("--output-last-message");
      await writeFile(
        args[outputFlag + 1],
        JSON.stringify({
          role: "researcher",
          status: "CONFIRMED",
          summary: "Manufacturer evidence found.",
          findings: [],
          sources: ["https://www.axis.com/example"],
        }),
        "utf8",
      );
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const report = await runCodexAgent("researcher" as AgentRole, "Research this item", runner, {
      schemaPath,
      temporaryDirectory: directory,
      timeoutMs: 1_000,
    });

    expect(receivedArgs).toEqual(expect.arrayContaining(["--search", "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check"]));
    expect(report.role).toBe("researcher");
    const remainingFiles = await readFile(schemaPath, "utf8");
    expect(remainingFiles).toContain("object");
  });

  it("rejects a structured response for the wrong role", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qqb-codex-test-"));
    temporaryDirectories.push(directory);
    const schemaPath = join(directory, "schema.json");
    await writeFile(schemaPath, "{}", "utf8");
    const runner: CommandRunner = async (args) => {
      await writeFile(
        args[args.indexOf("--output-last-message") + 1],
        JSON.stringify({ role: "tester", status: "OPEN", summary: "Open", findings: [], sources: [] }),
        "utf8",
      );
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    await expect(
      runCodexAgent("researcher", "Research this item", runner, { schemaPath, temporaryDirectory: directory }),
    ).rejects.toThrow("role mismatch");
  });

  it("does not return CLI diagnostics to the caller", async () => {
    const runner: CommandRunner = async () => ({
      exitCode: 1,
      stdout: "",
      stderr: '{"password":"example-secret","detail":"private transcript"}',
    });

    await expect(runCodexAgent("researcher", "Research this item", runner)).rejects.toThrow(
      "Codex agent execution failed",
    );
  });
});

describe("resolveCodexCommand", () => {
  it("invokes the npm Codex JavaScript entry point without a Windows shell", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qqb-codex-bin-"));
    temporaryDirectories.push(directory);
    const script = join(directory, "node_modules", "@openai", "codex", "bin", "codex.js");
    await mkdir(join(directory, "node_modules", "@openai", "codex", "bin"), { recursive: true });
    await writeFile(script, "", "utf8");

    expect(resolveCodexCommand(["codex", "--version"], "win32", directory, "C:/node/node.exe")).toEqual({
      command: "C:/node/node.exe",
      args: [script, "--version"],
    });
  });
});

describe("runCommand", () => {
  it("handles stdin closure when a child exits before consuming the prompt", async () => {
    const result = await runCommand(
      [process.execPath, "-e", "process.exit(0)"],
      { stdin: "x".repeat(2_000_000), timeoutMs: 5_000 },
    );

    expect([0, 124]).toContain(result.exitCode);
  });
});