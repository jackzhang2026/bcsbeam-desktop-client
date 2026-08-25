#!/usr/bin/env node
// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Unit-level check for the JS snippet electron/main/portalLoginWindow.ts
// injects into the login window via executeJavaScript() — the actual
// localStorage-read + token-broker fetch that has to run inside the real
// portal page's context (see NOTICE.md "Login architecture finding").
//
// This does NOT exercise BrowserWindow/IPC/polling — this sandbox has
// ELECTRON_RUN_AS_NODE=1 set (a deliberate guardrail against spawning real
// Electron/Chromium processes here), so a true end-to-end run of the login
// window cannot happen from this environment. What this DOES verify,
// against the real source (extracted by regex, not a hand-copied
// duplicate that could silently drift): the four branches of the injected
// script's own logic, with a mocked window.localStorage/fetch. A real
// click-through run against an actual customer-portal account is still the
// next required verification step, on a machine that can run a real
// Electron window.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "electron/main/portalLoginWindow.ts");
const source = readFileSync(sourcePath, "utf8");

const match = source.match(/executeJavaScript\(`([\s\S]*?)`\)/);
if (!match) {
  console.error(`FAIL: could not find the executeJavaScript(\`...\`) call in ${sourcePath}`);
  process.exit(1);
}
const injectedScript = match[1];

let failures = 0;
const assertEqual = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    failures += 1;
  }
};

async function runScenario({ label, storage, fetchImpl, expected, checkCall }) {
  const calls = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null),
    },
  };
  globalThis.fetch = (...args) => {
    calls.push(args);
    return fetchImpl(...args);
  };
  try {
    // eslint-disable-next-line no-eval
    const result = await eval(injectedScript);
    assertEqual(label, result, expected);
    if (checkCall) checkCall(calls);
  } finally {
    delete globalThis.window;
    delete globalThis.fetch;
  }
}

const mockCredentials = { openimUserID: "cust_42", token: "mock-im-token", expireTimeSeconds: 3600 };

await runScenario({
  label: "no portal_token in storage → null, no fetch attempted",
  storage: {},
  fetchImpl: () => {
    throw new Error("fetch should not have been called");
  },
  expected: null,
});

await runScenario({
  label: "portal_token present but portal_type is not 'customer' → null, no fetch attempted",
  storage: { portal_token: "abc", portal_type: "vendor" },
  fetchImpl: () => {
    throw new Error("fetch should not have been called");
  },
  expected: null,
});

await runScenario({
  label: "valid customer token → calls /api/openim/token/ with Bearer + X-Portal-Type, returns broker JSON",
  storage: { portal_token: "the-real-token", portal_type: "customer" },
  fetchImpl: async () => ({ ok: true, json: async () => mockCredentials }),
  expected: mockCredentials,
  checkCall: (calls) => {
    assertEqual("fetch called exactly once", calls.length, 1);
    const [url, opts] = calls[0];
    assertEqual("fetch URL", url, "/api/openim/token/");
    assertEqual("fetch method", opts.method, "POST");
    assertEqual("Authorization header", opts.headers["Authorization"], "Bearer the-real-token");
    assertEqual("X-Portal-Type header", opts.headers["X-Portal-Type"], "customer");
  },
});

await runScenario({
  label: "broker responds non-ok (e.g. 401/403/502) → null, not a thrown error",
  storage: { portal_token: "the-real-token", portal_type: "customer" },
  fetchImpl: async () => ({ ok: false, json: async () => ({ detail: "nope" }) }),
  expected: null,
});

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All checks passed (script-logic level only — see file header for what this does not cover).");
