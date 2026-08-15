import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNpmInvocation } from "./npm-invocation.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const logDirectory = resolve(
  repositoryRoot,
  "..",
  `${basename(repositoryRoot)}-logs`,
);
const argumentsSet = new Set(process.argv.slice(2));
const knownArguments = new Set(["--help", "--verify-only"]);

if ([...argumentsSet].some((argument) => !knownArguments.has(argument))) {
  console.error("Usage: node scripts/accept-main.mjs [--verify-only]");
  process.exit(2);
}

if (argumentsSet.has("--help")) {
  console.log("Usage: node scripts/accept-main.mjs [--verify-only]");
  console.log("  --verify-only  Verify the current clean branch without switching or pulling.");
  process.exit(0);
}

const verifyOnly = argumentsSet.has("--verify-only");
const runTimestamp = formatTimestamp(new Date());
const filePrefix = `accept_${runTimestamp}`;
const fullLogPath = resolve(logDirectory, `${filePrefix}.log`);
const summaryPath = resolve(logDirectory, `${filePrefix}_summary.txt`);

mkdirSync(logDirectory, { recursive: true });
writeFileSync(
  fullLogPath,
  [
    "Desert Caravan MMO — local acceptance log",
    `Started: ${new Date().toISOString()}`,
    `Repository: ${repositoryRoot}`,
    `Mode: ${verifyOnly ? "verify-only" : "update-main"}`,
    "",
  ].join("\n"),
  "utf8",
);

class StepError extends Error {
  constructor(step, message) {
    super(message);
    this.name = "StepError";
    this.step = step;
  }
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function appendLog(value) {
  appendFileSync(fullLogPath, value, "utf8");
}

function displayCommand(command, commandArguments) {
  return [command, ...commandArguments]
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function runStep(step, command, commandArguments) {
  console.log(`[....] ${step}`);
  appendLog(`\n## ${step}\n$ ${displayCommand(command, commandArguments)}\n`);

  const result = spawnSync(command, commandArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  appendLog(stdout);
  appendLog(stderr);

  if (result.error) {
    appendLog(`\nCommand error: ${result.error.message}\n`);
    throw new StepError(step, result.error.message);
  }
  if (result.status !== 0) {
    throw new StepError(step, `Command exited with code ${result.status ?? "unknown"}.`);
  }

  console.log(`[ OK ] ${step}`);
  return `${stdout}${stderr}`.trimEnd();
}

function runNpmStep(step, commandArguments) {
  const invocation = resolveNpmInvocation(commandArguments);
  return runStep(step, invocation.command, invocation.commandArguments);
}

function requireCleanWorkingTree(step) {
  const status = runStep(step, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.trim()) {
    throw new StepError(
      step,
      `Working tree is not clean. Commit, stash, or remove these files first:\n${status}`,
    );
  }
}

function readMetric(output, name) {
  const cleanOutput = output.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
  const pattern = new RegExp(`(?:^|\\s)${name}\\s+(\\d+)\\s*$`, "i");
  for (const line of cleanOutput.split(/\r?\n/).reverse()) {
    const match = line.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function writeSummary(lines) {
  const summary = `${lines.join("\n")}\n`;
  writeFileSync(summaryPath, summary, "utf8");
  console.log("\n" + summary);
  console.log(`Summary file: ${summaryPath}`);
}

try {
  requireCleanWorkingTree("Check clean working tree");

  if (!verifyOnly) {
    runStep("Switch to main", "git", ["switch", "main"]);
    runStep("Fast-forward main", "git", ["pull", "--ff-only", "origin", "main"]);

    const localCommit = runStep("Read local main commit", "git", ["rev-parse", "HEAD"]);
    const remoteCommit = runStep("Read origin/main commit", "git", [
      "rev-parse",
      "origin/main",
    ]);
    if (localCommit !== remoteCommit) {
      throw new StepError(
        "Confirm main matches origin/main",
        `Local main (${localCommit}) differs from origin/main (${remoteCommit}).`,
      );
    }
  }

  runNpmStep("Install exact dependencies", ["ci"]);
  const verificationOutput = runNpmStep("Build, test, and run demo", [
    "run",
    "verify:local",
  ]);
  runStep("Check whitespace errors", "git", ["diff", "--check"]);
  requireCleanWorkingTree("Confirm clean working tree");

  const commit = runStep("Read verified commit", "git", ["rev-parse", "--short", "HEAD"]);
  const branch = runStep("Read branch status", "git", ["status", "--short", "--branch"])
    .split(/\r?\n/)[0];
  const { version } = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  const tests = readMetric(verificationOutput, "tests");
  const passed = readMetric(verificationOutput, "pass");
  const failed = readMetric(verificationOutput, "fail");
  const skipped = readMetric(verificationOutput, "skipped");

  appendLog(`\nCompleted: ${new Date().toISOString()}\nResult: PASS\n`);
  writeSummary([
    "Desert Caravan MMO — local acceptance",
    "Result: PASS",
    `Commit: ${commit}`,
    `Version: ${version}`,
    `Tests: ${tests ?? "unknown"} total; ${passed ?? "unknown"} passed; ${failed ?? "unknown"} failed; ${skipped ?? "unknown"} skipped`,
    `Branch: ${branch}`,
    `Full log: ${fullLogPath}`,
    "Send the summary file. Keep the full log unless a failure needs investigation.",
  ]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const step = error instanceof StepError ? error.step : "Unexpected error";
  const details = error instanceof Error ? error.stack ?? message : message;
  appendLog(`\n## FAILURE\nStep: ${step}\n${details}\n`);
  writeSummary([
    "Desert Caravan MMO — local acceptance",
    "Result: FAIL",
    `Failed step: ${step}`,
    `Reason: ${message}`,
    `Full log: ${fullLogPath}`,
    "Send both the summary and full log for investigation.",
  ]);
  process.exitCode = 1;
}
