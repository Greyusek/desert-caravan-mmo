import test from "node:test";
import assert from "node:assert/strict";
import { resolveNpmInvocation } from "./npm-invocation.mjs";

test("DEVX-002: an npm lifecycle reuses npm-cli through the current Node executable", () => {
  assert.deepEqual(
    resolveNpmInvocation(["ci"], {
      platform: "win32",
      environment: {
        npm_execpath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
      },
      nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    }),
    {
      command: "C:\\Program Files\\nodejs\\node.exe",
      commandArguments: [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "ci",
      ],
    },
  );
});

test("DEVX-002: direct Windows launch runs npm.cmd through the command processor", () => {
  assert.deepEqual(
    resolveNpmInvocation(["run", "verify:local"], {
      platform: "win32",
      environment: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
      nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      commandArguments: [
        "/d",
        "/s",
        "/c",
        "npm.cmd",
        "run",
        "verify:local",
      ],
    },
  );
});

test("DEVX-002: direct non-Windows launch keeps the dependency-free npm command", () => {
  assert.deepEqual(
    resolveNpmInvocation(["ci"], {
      platform: "linux",
      environment: {},
      nodeExecutable: "/usr/bin/node",
    }),
    {
      command: "npm",
      commandArguments: ["ci"],
    },
  );
});
