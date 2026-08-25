#!/usr/bin/env node
// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Zero-dependency local stand-in for the real customer-portal login page +
// token broker, so the Electron login-window mechanics (BrowserWindow open,
// localStorage polling, executeJavaScript fetch, IPC handoff, navigation)
// can be exercised WITHOUT a real customer-portal account and WITHOUT
// touching production. See HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md
// "Stage A" for how to use this.
//
// This does NOT validate the real backend contract (that was verified by
// reading api/portal_authentication.py / openim_bridge/ source directly,
// and by scripts/verify-token-exchange-script.mjs) — it only validates that
// OUR Electron code drives a login window correctly. A real run against
// https://customer.centoffer.com (Stage B) is still required.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORTAL_PORT || 4173);
const MOCK_PORTAL_TOKEN = "mock-portal-token";
const MOCK_CREDENTIALS = {
  openimUserID: "cust_mock",
  token: "mock-im-token-not-a-real-openim-token",
  expireTimeSeconds: 3600,
};

const LOGIN_PAGE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Mock Customer Portal Login</title></head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h2>Mock Customer Portal — Stage A dry run</h2>
  <p>This is NOT the real portal. Clicking the button below simulates what
  the real login page does on success: writes <code>portal_token</code> +
  <code>portal_type</code> to localStorage (see
  frontend/src/utils/portalAuth.ts savePortalUser in the main FINOS repo).</p>
  <button id="go" style="font-size: 1.1rem; padding: 0.5rem 1rem;">
    Simulate successful customer login
  </button>
  <p id="status"></p>
  <script>
    document.getElementById('go').addEventListener('click', () => {
      window.localStorage.setItem('portal_token', ${JSON.stringify(MOCK_PORTAL_TOKEN)});
      window.localStorage.setItem('portal_type', 'customer');
      document.getElementById('status').textContent =
        'portal_token written — the Electron app should detect this within ~800ms and close this window automatically.';
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url.startsWith("/customer-portal/login")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(LOGIN_PAGE_HTML);
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/api/openim/token/")) {
    const auth = req.headers["authorization"] || "";
    const portalType = req.headers["x-portal-type"] || "";
    if (auth !== `Bearer ${MOCK_PORTAL_TOKEN}` || portalType !== "customer") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "mock server: bad/missing bearer or portal-type header" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(MOCK_CREDENTIALS));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found (mock server only serves /customer-portal/login and /api/openim/token/)");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock portal login server on http://127.0.0.1:${PORT}/customer-portal/login`);
  console.log(`Set VITE_PORTAL_LOGIN_URL=http://127.0.0.1:${PORT}/customer-portal/login before running "pnpm dev".`);
});
