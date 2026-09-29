import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import agentReportSchema from "./agent-report.schema.json";
import { parseAgentReport, type AgentReport, type AgentRole } from "./domain";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommandOptions = {
  timeoutMs?: number;
  stdin?: string;
  cwd?: string;
};

export type CommandRunner = (args: string[], options?: CommandOptions) => Promise<CommandResult>;

export type CodexStatus = {
  installed: boolean;
  authenticated: boolean;
  version: string | null;
  accountDetail: string;
};

type RunCodexOptions = {
  schemaPath?: string;
  temporaryDirectory?: string;
  timeoutMs?: number;
};

const MAX_COMMAND_OUTPUT_BYTES = 1_000_000;
const MAX_REPORT_BYTES = 1_000_000;

export async function runCommand(args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const timeoutMs = options.timeoutMs ?? 15_000;
    let stdout = "";
    let stderr = "";
    let settled = false;
    let terminating = false;
    const resolved = resolveCodexCommand(args, process.platform, process.env.PATH ?? "", process.execPath);
    const child = spawn(/* turbopackIgnore: true */ resolved.command, resolved.args, {
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
      cwd: options.cwd,
      env: restrictedEnvironment(),
    });
    const timer = setTimeout(() => terminate("Codex CLI command timed out"), timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stdout) + chunk.byteLength > MAX_COMMAND_OUTPUT_BYTES) {
        terminate("Codex CLI output exceeded the size limit");
        return;
      }
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stderr) + chunk.byteLength > MAX_COMMAND_OUTPUT_BYTES) {
        terminate("Codex CLI output exceeded the size limit");
        return;
      }
      stderr += chunk.toString();
    });
    child.on("error", () => finish({ exitCode: 127, stdout: "", stderr: "Codex CLI is not installed" }));
    child.on("close", (exitCode) => finish({ exitCode: terminating ? 124 : exitCode ?? 1, stdout, stderr }));
    child.stdin.on("error", () => terminate("Codex CLI input failed"));
    if (options.stdin !== undefined) child.stdin.end(options.stdin);
    else child.stdin.end();

    function finish(result: CommandResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    function terminate(reason: string) {
      if (terminating || settled) return;
      terminating = true;
      stderr = reason;
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true });
        killer.once("error", () => child.kill("SIGKILL"));
      } else if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      } else {
        child.kill("SIGKILL");
      }
      const cleanupTimer = setTimeout(
        () => finish({ exitCode: 124, stdout, stderr: "Codex CLI process-tree cleanup timed out" }),
        5_000,
      );
      cleanupTimer.unref();
    }
  });
}

export async function getCodexStatus(runner: CommandRunner = runCommand): Promise<CodexStatus> {
  const versionResult = await runner(["codex", "--version"], { timeoutMs: 15_000 });
  if (versionResult.exitCode !== 0) {
    return {
      installed: false,
      authenticated: false,
      version: null,
      accountDetail: "Codex CLI is not installed",
    };
  }

  const authResult = await runner(["codex", "login", "status"], { timeoutMs: 15_000 });
  const versionLine = versionResult.stdout.trim().split(/\r?\n/, 1)[0];
  const version = /^codex-cli \d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(versionLine) ? versionLine : null;
  return {
    installed: true,
    authenticated: authResult.exitCode === 0,
    version,
    accountDetail: authResult.exitCode === 0 ? "Logged in using ChatGPT" : "Codex CLI account is not authenticated",
  };
}

export async function runCodexAgent(
  role: AgentRole,
  prompt: string,
  runner: CommandRunner = runCommand,
  options: RunCodexOptions = {},
): Promise<AgentReport> {
  const directory = options.temporaryDirectory ?? join(tmpdir(), "caltron-quote-validation");
  await mkdir(directory, { recursive: true });
  const runId = randomUUID();
  const outputPath = join(directory, `agent-${runId}.json`);
  const schemaPath = options.schemaPath ?? join(directory, `schema-${runId}.json`);
  const ownsSchema = !options.schemaPath;
  if (ownsSchema) await writeFile(schemaPath, JSON.stringify(agentReportSchema), "utf8");

  const command = [
    "codex",
    "--search",
    "exec",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--skip-git-repo-check",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "-",
  ];

  try {
    const result = await runner(command, { timeoutMs: options.timeoutMs ?? 85_000, stdin: prompt, cwd: directory });
    if (result.exitCode !== 0) throw new Error("Codex agent execution failed");
    const reportStats = await stat(outputPath);
    if (reportStats.size > MAX_REPORT_BYTES) throw new Error("Codex agent response exceeded the size limit");
    const report = parseAgentReport(JSON.parse(await readFile(outputPath, "utf8")));
    if (report.role !== role) throw new Error(`Codex agent role mismatch: expected ${role}, got ${report.role}`);
    return report;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Codex returned invalid structured JSON");
    throw error;
  } finally {
    await rm(outputPath, { force: true });
    if (ownsSchema) await rm(schemaPath, { force: true });
  }
}

export function resolveCodexCommand(args: string[], platform = process.platform, pathValue = process.env.PATH ?? "", nodePath = process.execPath) {
  if (platform !== "win32" || args[0].toLowerCase() !== "codex") {
    return { command: args[0], args: args.slice(1) };
  }

  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const executable = join(directory, "codex.exe");
    if (existsSync(executable)) return { command: executable, args: args.slice(1) };
    const script = join(directory, "node_modules", "@openai", "codex", "bin", "codex.js");
    if (existsSync(script)) return { command: nodePath, args: [script, ...args.slice(1)] };
  }
  return { command: args[0], args: args.slice(1) };
}

function restrictedEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "ComSpec",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "HOMEDRIVE",
    "HOMEPATH",
    "APPDATA",
    "LOCALAPPDATA",
    "XDG_CONFIG_HOME",
    "CODEX_HOME",
    "NODE_ENV",
  ];
  return Object.fromEntries(allowed.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
}
