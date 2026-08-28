#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const explicitExecutable = process.argv.slice(2).find((arg) => arg !== "--");

const getDefaultExecutable = () => {
  // Must match electron-builder.json5's `directories.output` ("release/BcsBeam/${version}").
  // This was still "Base" — the pristine OpenIM electron demo's product name
  // before the "fork scaffold — rebrand OpenIM electron demo as BCS Beam
  // desktop client" commit — left stale since that rebrand, so every local
  // (and presumably CI) run of `pnpm electron:smoke` has been throwing
  // "Packaged Electron executable is missing" rather than actually
  // smoke-testing anything. Found 2026-08-28 while verifying this session's
  // changes build and pass CI's own steps before considering a client
  // release.
  const releaseRoot = path.join(repoRoot, "release", "BcsBeam", rootPackage.version);
  if (process.platform === "darwin") {
    return path.join(
      releaseRoot,
      `mac-${process.arch}`,
      `${rootPackage.name}.app`,
      "Contents",
      "MacOS",
      rootPackage.name,
    );
  }
  if (process.platform === "win32") {
    // electron-builder names the win-unpacked executable after `productName`
    // ("BCS Beam.exe"), not the package.json `name` field — found 2026-08-28
    // verifying this on real Windows hardware; same rebrand-leftover pattern
    // as the release/Base path bug above, just a different stale identifier.
    // (electron-builder.json5's mac branch below likely has the same bug —
    // .app bundles are also named after productName — but that's unverified;
    // I don't have mac hardware to confirm it here, so leaving it alone.)
    return path.join(
      releaseRoot,
      "win-unpacked",
      `${rootPackage.productName ?? rootPackage.name}.exe`,
    );
  }
  return path.join(releaseRoot, "linux-unpacked", rootPackage.name);
};

const executablePath = path.resolve(
  repoRoot,
  explicitExecutable ?? getDefaultExecutable(),
);
if (!existsSync(executablePath)) {
  throw new Error(`Packaged Electron executable is missing: ${executablePath}`);
}

const userDataPath = mkdtempSync(path.join(os.tmpdir(), "openim-electron-smoke-"));
const child = spawn(
  executablePath,
  [`--user-data-dir=${userDataPath}`, "--no-sandbox"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: "1",
      OPENIM_SMOKE_TEST: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
const collectOutput = (stream, destination) => {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    destination.write(text);
  });
};
collectOutput(child.stdout, process.stdout);
collectOutput(child.stderr, process.stderr);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const exitPromise = new Promise((resolve) => {
  child.once("exit", (code, signal) => resolve({ type: "exit", code, signal }));
});
const errorPromise = new Promise((resolve) => {
  child.once("error", (error) => resolve({ type: "error", error }));
});
const readyPromise = new Promise((resolve) => {
  const inspect = () => {
    if (output.includes("OPENIM_ELECTRON_READY")) {
      resolve({ type: "ready" });
    }
  };
  child.stdout.on("data", inspect);
  child.stderr.on("data", inspect);
});

const stopChild = async () => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([exitPromise, delay(3000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exitPromise, delay(3000)]);
  }
};

try {
  const startupResult = await Promise.race([
    readyPromise,
    exitPromise,
    errorPromise,
    delay(15000).then(() => ({ type: "timeout" })),
  ]);
  if (startupResult.type !== "ready") {
    throw new Error(
      `Packaged Electron app failed startup smoke test (${startupResult.type})\n${output}`,
    );
  }

  const stabilizationResult = await Promise.race([
    exitPromise,
    errorPromise,
    delay(2000).then(() => ({ type: "stable" })),
  ]);
  if (stabilizationResult.type !== "stable") {
    throw new Error(
      `Packaged Electron app exited during startup (${stabilizationResult.type})\n${output}`,
    );
  }
  if (
    /Uncaught Exception|Cannot find module|A JavaScript error occurred/i.test(output)
  ) {
    throw new Error(`Packaged Electron app reported a startup error\n${output}`);
  }
  console.log("Packaged Electron startup smoke test passed");
} finally {
  await stopChild();
  rmSync(userDataPath, { recursive: true, force: true });
}
