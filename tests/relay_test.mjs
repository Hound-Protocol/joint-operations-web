/* Relay tests: runs tools/signin-relay/worker.js in Node with GitHub and Cloudflare KV answered locally (no network).
   Covers Guest Pass 2.0 (grant, peek, claim by name bound to a device key, signed requests, the in-use answer for a
   second device, tampering, clock, levels and repositories, extensions approved by LV7 only, revoke, end, reissue,
   clear and history), visitor requests (name rules, rate, approve with a pre-bound key, decline), LV7 checks and
   /health. Run: node tests/relay_test.mjs (Node 20+). */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const here = new URL(".", import.meta.url).pathname;
const code = readFileSync(join(here, "../tools/signin-relay/worker.js"), "utf8").replace(/^export default \{/m, "globalThis.W = {");
const tmp = join(mkdtempSync(join(tmpdir(), "relay-")), "worker.mjs");
writeFileSync(tmp, code);
await import(tmp);
const W = globalThis.W;
const store = new Map();
const KV = { async get(k, t) { const v = store.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; } };
/* A throwaway RSA key stands in for the GitHub App's private key */
const rsa = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(await crypto.subtle.exportKey("pkcs8", rsa.privateKey)).toString("base64") + "\n-----END PRIVATE KEY-----";
const env = { SITE_ORIGIN: "https://hound-protocol.github.io", GUEST_SECRET: "s3cret-test", OWNER_GITHUB_ID: "249122176", HP_KV: KV,
  GITHUB_APP_ID: "1", GITHUB_APP_PRIVATE_KEY: pem, GUEST_REPOS: JSON.stringify({ 3: "Hound-Protocol/hp-staff", 5: "Hound-Protocol/hp-leads", 6: "Hound-Protocol/hp-admin" }) };
const ghReads = [];
globalThis.fetch = async (u, o) => {
  u = String(u);
  if (u === "https://api.github.com/user") { const ok = ((o && o.headers && o.headers.Authorization) || "") === "Bearer owner"; return new Response(JSON.stringify(ok ? { id: 249122176, login: "Forge77" } : {}), { status: ok ? 200 : 401 }); }
  if (u.includes("/memberships/")) return new Response("{}", { status: 404 });
  const m = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)(.*)$/.exec(u);
  if (m) { ghReads.push(m[1]); if (m[2] === "") return new Response(JSON.stringify({ default_branch: "main" })); if (m[2].startsWith("/git/trees/")) return new Response(JSON.stringify({ tree: [{ type: "blob", path: "notes/a.md" }] })); return new Response("# doc"); }
  throw new Error("unexpected " + u);
};
/* The GitHub App token is answered locally */
const tmpCode = readFileSync(tmp, "utf8");
const call = async (path, init = {}) => { const r = await W.fetch(new Request("https://relay.test" + path, init), env); const t = await r.text(); try { return [r.status, JSON.parse(t)]; } catch (e) { return [r.status, t]; } };
const O = { headers: { Authorization: "Bearer owner" } }, OP = { method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" } };
const P = (body, extra) => Object.assign({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, extra || {});
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) { fails++; process.exitCode = 1; } };
const b64u = u => Buffer.from(u).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/* A browser's device key, as the website makes it: ECDSA P-256, private half not extractable */
async function device() {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", k.publicKey);
  return { pub: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    async signed(id, method, path, ts) {
      ts = ts || Date.now();
      const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k.privateKey, new TextEncoder().encode(ts + "\n" + method + "\n" + path));
      return { method, headers: { "X-HP-Guest": id + "." + ts + "." + b64u(new Uint8Array(sig)) } };
    } };
}
/* Stub the app token: the relay asks GitHub for an installation token; answer it */
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  u = String(u);
  if (/\/repos\/[^/]+\/[^/]+\/installation$/.test(u)) return new Response(JSON.stringify({ id: 7 }));
  if (u.includes("/app/installations/")) return new Response(JSON.stringify({ token: "app-token", expires_at: new Date(Date.now() + 3600e3).toISOString() }));
  return realFetch(u, o);
};

let [s, j] = await call("/health");
ok(s === 200 && j.ok && j.relay >= 4 && j.kv === true, "health reports version " + j.relay + " and storage, no secrets");

/* Grant and links */
[s, j] = await call("/guest/grant", Object.assign({}, OP, { body: JSON.stringify({ lvl: 4 }) })); ok(s === 400, "a level other than LV2, LV3, LV5 or LV6 is refused");
[s, j] = await call("/guest/grant", { method: "POST", headers: { Authorization: "Bearer nobody", "Content-Type": "application/json" }, body: "{}" }); ok(s === 401, "granting needs LV7");
[s, j] = await call("/guest/grant", Object.assign({}, OP, { body: JSON.stringify({ lvl: 5 }) }));
ok(s === 200 && j.id === "GC-00001" && /^[2-9A-HJ-NP-Z]{6}$/.test(j.code) && j.lvl === 5, "first pass is GC-00001 with a 6-character code: " + j.id + "-" + j.code);
const g1 = j;
[s, j] = await call("/guest/grant", Object.assign({}, OP, { body: JSON.stringify({ lvl: 2 }) })); ok(j.id === "GC-00002", "numbers count up: " + j.id);
const g2 = j;
ok(!JSON.stringify([...store.values()]).includes(g1.code), "the code is never stored in plain text");
[s, j] = await call("/guest/peek?id=GC-00001&code=" + (g1.code === "AAAAAA" ? "BBBBBB" : "AAAAAA")); ok(s === 404 && j.code === "invalid", "a wrong code finds nothing");
[s, j] = await call("/guest/peek?id=GC-00001&code=" + g1.code); ok(s === 200 && j.state === "unclaimed" && j.lvl === 5 && j.by === "Forge77", "peek with the code shows level and state");

/* Claim, bound to one device */
const devA = await device(), devB = await device();
[s, j] = await call("/guest/claim", P({ id: "GC-00001", code: g1.code, name: "   ", pub: devA.pub })); ok(s === 400 && j.code === "name", "claiming without a name is refused");
[s, j] = await call("/guest/claim", P({ id: "GC-00001", code: g1.code, name: "Liquid", pub: { kty: "EC", crv: "P-256", x: "a", y: "b" } })); ok(s === 400 && j.code === "key", "a malformed device key is refused");
[s, j] = await call("/guest/claim", P({ id: "GC-00001", code: g1.code, name: "Revolver <i>Ocelot</i>", pub: devA.pub })); ok(s === 200 && j.name === "Revolver iOcelot/i" && j.exp > Date.now(), "claim binds the pass, name cleaned: " + j.name);
[s, j] = await call("/guest/claim", P({ id: "GC-00001", code: g1.code, name: "Someone Else", pub: devB.pub })); ok(s === 409 && j.code === "in_use" && /in use by Revolver/.test(j.error), "a second device is told: " + j.error);
[s, j] = await call("/guest/peek?id=GC-00001&code=" + g1.code); ok(j.state === "active" && j.name === "Revolver iOcelot/i", "peek after the claim names the holder");

/* Signed requests */
[s, j] = await call("/guest/check", await devA.signed("GC-00001", "GET", "/guest/check")); ok(s === 200 && j.lvl === 5 && j.repos.length === 2, "the claiming device is accepted (LV5 opens " + j.repos.join(", ") + ")");
[s, j] = await call("/guest/check", await devB.signed("GC-00001", "GET", "/guest/check")); ok(s === 401 && j.code === "invalid", "another device's signature is refused");
[s, j] = await call("/guest/check", await devA.signed("GC-00001", "GET", "/guest/check", Date.now() - 10 * 60e3)); ok(s === 401 && j.code === "clock", "an old signature (10 min) is refused");
const sg = await devA.signed("GC-00001", "GET", "/guest/check"); [s, j] = await call("/guest/tree?repo=Hound-Protocol/hp-staff", sg); ok(s === 401, "a signature for another path is refused");
[s, j] = await call("/guest/check", { headers: { "X-HP-Guest": "GC-00001.123.abc" } }); ok(s === 401, "a forged header is refused");
let path = "/guest/tree?repo=Hound-Protocol/hp-leads"; [s, j] = await call(path, await devA.signed("GC-00001", "GET", path)); ok(s === 200 && j.paths.length === 1, "LV5 reads the Leads repository");
path = "/guest/tree?repo=Hound-Protocol/hp-admin"; [s, j] = await call(path, await devA.signed("GC-00001", "GET", path)); ok(s === 403 && j.code === "level", "LV5 cannot read the Administration repository");
path = "/guest/file?repo=Hound-Protocol/hp-staff&path=../secret.md"; [s, j] = await call(path, await devA.signed("GC-00001", "GET", path)); ok(s === 400, "a path escaping the repository is refused");
path = "/guest/file?repo=Hound-Protocol/hp-staff&path=notes/a.md"; [s, j] = await call(path, await devA.signed("GC-00001", "GET", path)); ok(s === 200 && j === "# doc", "a document is read through the relay");

/* LV2 opens no repositories */
const devC = await device();
await call("/guest/claim", P({ id: "GC-00002", code: g2.code, name: "Meryl", pub: devC.pub }));
[s, j] = await call("/guest/check", await devC.signed("GC-00002", "GET", "/guest/check")); ok(s === 200 && j.lvl === 2 && j.repos.length === 0, "LV2 opens no restricted area");

/* Extensions: one at a time, only LV7 approves */
const exp0 = (await call("/guest/check", await devA.signed("GC-00001", "GET", "/guest/check")))[1].exp;
[s, j] = await call("/guest/extend", await devA.signed("GC-00001", "POST", "/guest/extend")); ok(s === 200 && j.ext.state === "pending", "the guest asks for 24 more hours");
[s, j] = await call("/guest/extend", await devA.signed("GC-00001", "POST", "/guest/extend")); ok(s === 409 && j.code === "pending", "only one extension request at a time");
[s, j] = await call("/guest/extend-approve?id=GC-00001", { method: "POST", headers: { Authorization: "Bearer nobody" } }); ok(s === 401, "only LV7 can approve an extension");
[s, j] = await call("/guest/asks", O); ok(j.extensions.length === 1 && j.extensions[0].id === "GC-00001", "LV7 sees the extension request");
[s, j] = await call("/guest/extend-approve?id=GC-00001", OP); ok(s === 200 && j.pass.exp >= exp0 + 24 * 3600e3 - 1000 && j.pass.exts === 1, "approved: 24 hours added");
[s, j] = await call("/guest/asks", O); ok(j.extensions.length === 0, "the request leaves the queue");

/* Revoke, end, reissue */
[s, j] = await call("/guest/revoke?id=GC-00002", OP); ok(s === 200 && j.pass.state === "revoked" && j.pass.revokedBy === "Forge77", "LV7 revokes a pass");
[s, j] = await call("/guest/check", await devC.signed("GC-00002", "GET", "/guest/check")); ok(s === 401 && j.code === "revoked", "a revoked pass stops working at once");
[s, j] = await call("/guest/reissue?id=GC-00002", OP); ok(s === 409, "a revoked pass cannot be reissued");
[s, j] = await call("/guest/grant", Object.assign({}, OP, { body: JSON.stringify({ lvl: 3 }) })); const g3 = j;
[s, j] = await call("/guest/reissue?id=" + g3.id, OP); ok(s === 200 && j.code !== g3.code, "an unclaimed pass can get a new code");
const newCode = j.code;
[s, j] = await call("/guest/peek?id=" + g3.id + "&code=" + g3.code); ok(s === 404, "the old code stops working");
const devD = await device();
[s, j] = await call("/guest/claim", P({ id: g3.id, code: newCode, name: "Raiden", pub: devD.pub })); ok(s === 200, "the new code can be claimed");
[s, j] = await call("/guest/end", await devD.signed(g3.id, "POST", "/guest/end")); ok(s === 200, "the guest can end their own pass");
[s, j] = await call("/guest/check", await devD.signed(g3.id, "GET", "/guest/check")); ok(s === 401 && j.code === "ended", "an ended pass stops working");

/* Visitor requests, approved with a key bound at once */
const devE = await device();
[s, j] = await call("/guest/ask", P({ name: "  " })); ok(s === 400 && j.code === "name", "a request without a name is refused");
[s, j] = await call("/guest/ask", P({ name: "Big Boss", pub: devE.pub })); const ask = j; ok(s === 200 && j.id && j.key, "a visitor asks, with their device key");
[s, j] = await call("/guest/ask", P({ name: "Otacon" })); ok(s === 429, "a second request within 3 s is refused");
[s, j] = await call("/guest/ask/status?id=" + ask.id + "&key=wrong"); ok(j.state === "gone", "the wrong key sees nothing");
[s, j] = await call("/guest/approve?id=" + ask.id + "&lvl=6", OP); ok(s === 200 && j.state === "approved" && /^GC-\d{5}$/.test(j.pass), "LV7 approves at LV6: " + j.pass);
const askPass = j.pass;
[s, j] = await call("/guest/ask/status?id=" + ask.id + "&key=" + ask.key); ok(j.state === "approved" && j.pass.bound && j.pass.lvl === 6 && j.pass.name === "Big Boss", "the asker's pass is bound to their device at once");
[s, j] = await call("/guest/check", await devE.signed(askPass, "GET", "/guest/check")); ok(s === 200 && j.lvl === 6 && j.repos.length === 3, "and works only from that device");
[s, j] = await call("/guest/check", await devB.signed(askPass, "GET", "/guest/check")); ok(s === 401, "not from another");

/* History and clearing */
[s, j] = await call("/guest/delete?id=GC-00001", OP); ok(s === 200 && j.pass.hidden && j.pass.state === "revoked", "Clear on a live pass revokes it and hides it");
[s, j] = await call("/guest/list", O);
const states = Object.fromEntries(j.passes.map(x => [x.id, x.state]));
ok(j.passes.length === 4 && states["GC-00001"] === "revoked" && states["GC-00002"] === "revoked" && states[g3.id] === "ended" && states[askPass] === "active", "the history keeps every pass and what happened: " + JSON.stringify(states));
ok(j.passes.every(x => !("ch" in x) && !("pub" in x)), "the history never shows codes or keys");
[s, j] = await call("/guest/purge?all=1", OP); ok(s === 200 && j.cleared === 3, "Clear all hides the rest (" + j.cleared + ")");
[s, j] = await call("/guest/check", await devE.signed(askPass, "GET", "/guest/check")); ok(s === 401 && j.code === "revoked", "Clear all ends every live pass");
[s, j] = await call("/guest/list", O); ok(j.passes.length === 4 && j.passes.every(x => x.hidden), "the history still holds all four");
[s, j] = await call("/guest/forget?id=GC-00002", OP); ok(s === 200 && j.forgotten, "LV7 can forget a finished pass (privacy)");
[s, j] = await call("/guest/list", O); ok(j.passes.length === 3 && !j.passes.some(x => x.id === "GC-00002"), "it leaves the history");
console.log(fails ? fails + " relay check(s) failed" : "All relay checks passed");
