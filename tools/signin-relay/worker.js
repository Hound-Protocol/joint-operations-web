/* Hound Protocol sign-in relay (Cloudflare Worker). See docs/signin.md.
   1. Sign-in: swaps GitHub's one-time sign-in code for a user token, using the app secret that only it holds, and hands
      the token to the website window that asked for it.
   2. Guest passes (Guest Pass 2.0): LV7, checked against GitHub on every request, grants numbered passes (GC-00001 ...)
      at LV2, LV3, LV5 or LV6. A pass is claimed once, by name, and bound to the claiming browser's own key; see the
      Guest passes section below. Restricted documents are read for the guest with the GitHub App's own short-lived,
      read-only token, only from the repositories the pass's level opens.
   3. Contract claims from the website (GitHub name and number, public).
   No logs of tokens, passes or IP addresses.
   Settings (Worker → Settings → Variables and Secrets):
     GITHUB_CLIENT_ID (text), GITHUB_CLIENT_SECRET (secret), SITE_ORIGIN (text, https://hound-protocol.github.io)
     For guest passes: OWNER_GITHUB_ID (text), GUEST_SECRET (secret, a long random string), GITHUB_APP_ID (text),
     GITHUB_APP_PRIVATE_KEY (secret, the app's .pem file), GUEST_REPO (text, Hound-Protocol/hp-staff), and for LV5 and LV6
     passes GUEST_REPOS (text), for example {"3":"Hound-Protocol/hp-staff","5":"Hound-Protocol/hp-leads","6":"Hound-Protocol/hp-admin"}
     (the GitHub App must be installed on each of those repositories).
     Storage: a KV namespace bound as HP_KV (or GUEST_KV). It holds guest passes and their history, guest pass requests and
     contract claims.
     Bans (LV0): BANNED_GITHUB_IDS (secret), the banned GitHub account numbers separated by commas. A banned account is
     refused at sign-in and never receives a token. The list is private; see docs/guides/HP-SOP-012-bans.md. */
/* The relay's version: the website compares it with site/data/config.json signin.relayVersion and tells LV7 when the
   relay is behind (3 = requests, short passes, /health; 4 = Guest Pass 2.0) */
const RELAY_VERSION = 4;
const PASS_HOURS = 24, ASK_MAX_OPEN = 25, ASK_KEEP_MS = 2 * 86400 * 1000;
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const site = env.SITE_ORIGIN;
    /* Health: the relay's version and which storage and settings are present (yes or no only, never their values) */
    if (url.pathname === "/health") {
      return json(site, { ok: true, relay: RELAY_VERSION, kv: !!(env.HP_KV || env.GUEST_KV), guest: !!(env.GUEST_SECRET && env.OWNER_GITHUB_ID), app: !!(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) });
    }
    if (url.pathname === "/claims" || url.pathname === "/claim" || url.pathname === "/unclaim") {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(site) });
      try { return await claims(req, env, url); }
      catch (e) { return json(site, { error: "The relay could not finish that (" + (e && e.message || "error") + ")." }, 500); }
    }
    if (url.pathname.startsWith("/guest/")) {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(site) });
      try { return await guest(req, env, url); }
      catch (e) { return json(site, { error: "The relay could not finish that (" + (e && e.message || "error") + ")." }, 500); }
    }
    if (url.pathname === "/login") {
      const state = crypto.randomUUID();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", url.origin + "/callback");
      gh.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: {
        Location: gh.toString(),
        "Set-Cookie": `hp_state=${state}; Path=/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      const cookie = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)hp_state=([^;]+)/);
      if (!code || !state || !cookie || cookie[1] !== state) return page(site, { error: "Sign-in expired or was not started here. Try again." });
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "hound-protocol-signin" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: url.origin + "/callback" })
      });
      const j = await r.json().catch(() => ({}));
      if (!j.access_token) {
        /* GitHub's error code is not secret; showing it makes setup problems easy to diagnose */
        const why = { incorrect_client_credentials: "the relay's client ID or client secret does not match the GitHub App",
          bad_verification_code: "the sign-in code expired or was already used", redirect_uri_mismatch: "the GitHub App's callback URL does not match this relay" }[j.error];
        if (!env.GITHUB_CLIENT_SECRET) return page(site, { error: "The relay has no GITHUB_CLIENT_SECRET setting (code: missing_secret)." });
        return page(site, { error: "GitHub did not accept the sign-in" + (why ? ": " + why : "") + ". (code: " + (j.error || "http_" + r.status) + ")" });
      }
      /* LV0: refuse banned GitHub accounts before they ever get a token. GitHub account numbers survive renames. */
      if (env.BANNED_GITHUB_IDS) {
        const u = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + j.access_token, Accept: "application/vnd.github+json", "User-Agent": "hound-protocol-signin" } });
        const who = u.ok ? await u.json() : null;
        const banned = String(env.BANNED_GITHUB_IDS).split(/[\s,]+/).filter(Boolean);
        if (!who || banned.indexOf(String(who.id)) > -1) return page(site, { error: who ? "This GitHub account is banned from Hound Protocol." : "Could not check your GitHub account. Try again.", code: who ? "banned" : "check_failed" });
      }
      return page(site, { token: j.access_token, expires_in: j.expires_in || 0 });
    }
    return new Response("Hound Protocol sign-in relay", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
};

/* ---------------- Contract claims ----------------
   Anyone signed in with GitHub (and not banned) can claim a contract from the website. GitHub tells the relay who is
   asking, so a claim always carries the real account. Claims are public: contract, GitHub name and number, time. */
async function claims(req, env, url) {
  const site = env.SITE_ORIGIN, kv = env.HP_KV || env.GUEST_KV;
  if (!kv) return json(site, { error: "Claims need the KV storage on the relay (sign-in setup, section 6).", code: "no_kv" }, 503);
  if (url.pathname === "/claims") {
    const keys = (await kv.list({ prefix: "claim:" })).keys, out = {};
    for (const k of keys) { const v = await kv.get(k.name, "json"); if (v && v.length) out[k.name.slice(6)] = v; }
    return json(site, { claims: out });
  }
  if (req.method !== "POST") return json(site, { error: "Use POST." }, 405);
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get("Authorization") || "");
  if (!m) return json(site, { error: "Sign in first." }, 401);
  const c = String(url.searchParams.get("c") || "").toUpperCase();
  if (!/^[CF]\d{2,3}$/.test(c)) return json(site, { error: "Unknown contract." }, 400);
  const u = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + m[1], Accept: "application/vnd.github+json", "User-Agent": "hound-protocol-signin" } });
  if (!u.ok) return json(site, { error: "GitHub did not recognise your sign-in. Sign in again." }, 401);
  const who = await u.json();
  if (String(env.BANNED_GITHUB_IDS || "").split(/[\s,]+/).indexOf(String(who.id)) > -1) return json(site, { error: "This GitHub account is banned from Hound Protocol.", code: "banned" }, 403);
  const key = "claim:" + c, list = (await kv.get(key, "json")) || [];
  const rest = list.filter(x => String(x.id) !== String(who.id));
  const next = url.pathname === "/claim" ? rest.concat([{ login: who.login, id: who.id, at: Date.now() }]) : rest;
  if (next.length) await kv.put(key, JSON.stringify(next)); else await kv.delete(key);
  return json(site, { ok: true, contract: c, claims: next });
}

/* ---------------- Guest passes ---------------- */
/* Signs a new 24-hour LV3 pass and records it (number, expiry, who granted it, and for whom when it answers a request) */
/* ---------------- Guest passes (Guest Pass 2.0) ----------------
   A pass is numbered GC-00001, GC-00002 ... and opened with a 6-character secret code: the link is <site>#/GC-00001-7KQ4XW.
   The number alone is not enough, so nobody can claim a pass by guessing the next number. LV7 grants it at a clearance
   (LV2, LV3, LV5 or LV6). The recipient claims it within 72 hours by writing their name (required); the claim binds the
   pass to their browser, which creates a key pair whose private half can never be read out (WebCrypto, non-extractable,
   kept in IndexedDB) and sends the public half here. Every later request is signed with that key and checked here, so
   after the claim the link is useless to anyone else: they are told the pass is in use, and by whom. The pass runs 24
   hours from the claim; the guest may ask for 24 more hours, one request at a time, and only LV7 can approve it. Every
   pass stays in the history (who, which level, what happened to it); Clear only hides it from the active list. The code
   is kept only as an HMAC with GUEST_SECRET, so the storage alone never reveals a link. */
const GP_LVLS = [2, 3, 5, 6], GP_CLAIM_MS = 72 * 3600 * 1000, GP_MS = PASS_HOURS * 3600 * 1000, GP_SKEW = 120 * 1000;
const CODE_ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; /* 32 letters and digits that cannot be confused (no 0/O, 1/I) */
function gpCode() { const b = crypto.getRandomValues(new Uint8Array(6)); let c = ""; for (const x of b) c += CODE_ABC[x % 32]; return c; } /* 256 = 8 x 32: no bias */
const gpKey = id => "gp:" + id;
function gpCodeHash(env, id, code) { return hmac(env.GUEST_SECRET, "gp|" + id + "|" + String(code).toUpperCase()); }
function gpState(p, now) {
  if (p.status === "revoked") return "revoked";
  if (p.status === "ended") return "ended";
  if (!p.claimedAt) return p.claimBy > now ? "unclaimed" : "lapsed";
  return p.exp > now ? "active" : "expired";
}
/* What LV7 sees of a pass: never its code hash or the guest's key */
function gpPublic(p, now) {
  return { id: p.id, lvl: p.lvl, by: p.by, at: p.at, claimBy: p.claimBy, name: p.name || "", claimedAt: p.claimedAt || 0, exp: p.exp || 0, state: gpState(p, now),
    ext: p.ext || null, exts: p.exts || 0, revokedAt: p.revokedAt || 0, revokedBy: p.revokedBy || "", endedAt: p.endedAt || 0, hidden: !!p.hidden, fromAsk: p.fromAsk || "", reissued: p.reissued || 0 };
}
function gpName(v) { return String(v || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim(); }
function gpPubOk(j) { return !!(j && j.kty === "EC" && j.crv === "P-256" && typeof j.x === "string" && typeof j.y === "string" && j.x.length === 43 && j.y.length === 43 && !j.d); }
async function gpNew(env, kv, lvl, by, extra) {
  let n = parseInt((await kv.get("gp:seq")) || "0", 10) || 0, id;
  do { n++; id = "GC-" + String(n).padStart(5, "0"); } while (await kv.get(gpKey(id)));
  await kv.put("gp:seq", String(n));
  const code = gpCode(), now = Date.now();
  const p = Object.assign({ id, lvl, by, at: now, claimBy: now + GP_CLAIM_MS, ch: await gpCodeHash(env, id, code), status: "issued", exts: 0 }, extra || {});
  await kv.put(gpKey(id), JSON.stringify(p));
  return { p, code };
}
/* A signed guest request: header X-HP-Guest = "<pass>.<time in ms>.<signature>", the signature (ECDSA P-256, SHA-256)
   over "<time>\n<METHOD>\n<path and query>". The time must be within two minutes of the relay's clock. */
async function gpVerify(req, kv, url) {
  const h = String(req.headers.get("X-HP-Guest") || "").split(".");
  if (h.length !== 3 || !/^GC-\d{5}$/.test(h[0]) || !/^\d{12,14}$/.test(h[1]) || !/^[\w-]{80,100}$/.test(h[2])) return { err: "invalid" };
  if (Math.abs(Date.now() - +h[1]) > GP_SKEW) return { err: "clock" };
  const p = await kv.get(gpKey(h[0]), "json");
  if (!p || !p.pub) return { err: "invalid" };
  let ok = false;
  try {
    const key = await crypto.subtle.importKey("jwk", p.pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(h[2]), new TextEncoder().encode(h[1] + "\n" + req.method + "\n" + url.pathname + url.search));
  } catch (e) { ok = false; }
  return ok ? { p } : { err: "invalid" };
}
/* The repositories a level opens: every entry of GUEST_REPOS at or below it (LV2 opens none) */
function gpRepos(env, lvl) {
  let map = null; try { map = JSON.parse(env.GUEST_REPOS || "null"); } catch (e) { map = null; }
  if (!map || typeof map !== "object") map = { 3: env.GUEST_REPO || "Hound-Protocol/hp-staff" };
  return Object.keys(map).filter(k => +k <= lvl).map(k => String(map[k]));
}
async function sha(s) { return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))); }
async function asksGet(kv) { const a = (await kv.get("asks", "json")) || []; const now = Date.now(); return a.filter(x => now - x.at < ASK_KEEP_MS); }
async function asksPut(kv, a) { await kv.put("asks", JSON.stringify(a)); }
async function extIdx(kv, id, add) { let a = (await kv.get("gp:ext", "json")) || []; a = a.filter(x => x !== id); if (add) a.push(id); await kv.put("gp:ext", JSON.stringify(a)); }
/* LV7: the owner's GitHub account, or any owner (admin) of the organization, as GitHub reports it for this token */
async function lv7(env, auth) {
  const m = /^Bearer\s+(\S+)$/.exec(auth); if (!m) return { err: "Sign in first.", st: 401 };
  const H = { Authorization: "Bearer " + m[1], Accept: "application/vnd.github+json", "User-Agent": "hound-protocol-signin" };
  const u = await fetch("https://api.github.com/user", { headers: H });
  if (!u.ok) return { err: "GitHub did not recognise your sign-in. Sign in again.", st: 401 };
  const who = await u.json();
  if (String(who.id) === String(env.OWNER_GITHUB_ID)) return { who };
  const mm = await fetch("https://api.github.com/user/memberships/orgs/" + (env.GITHUB_ORG || "Hound-Protocol"), { headers: H });
  const ms = mm.ok ? await mm.json() : null;
  return ms && ms.state === "active" && ms.role === "admin" ? { who } : { err: "Only LV7 can manage guest passes.", st: 403 };
}
async function guest(req, env, url) {
  const site = env.SITE_ORIGIN, path = url.pathname, now = Date.now(), kv = env.HP_KV || env.GUEST_KV;
  if (!env.GUEST_SECRET || !env.OWNER_GITHUB_ID) return json(site, { error: "Guest passes are not set up on the relay yet.", code: "guest_off" }, 503);
  if (!kv) return json(site, { error: "Guest passes need the KV storage on the relay (sign-in setup, section 6).", code: "no_kv" }, 503);

  /* Visitors (LV1) ask for a pass with their name and their browser's public key; they check on it with a key only they hold */
  if (path === "/guest/ask" || path === "/guest/ask/status") {
    const asks = await asksGet(kv);
    if (path === "/guest/ask") {
      if (req.method !== "POST") return json(site, { error: "Use POST." }, 405);
      const b = await req.json().catch(() => ({}));
      const name = gpName(b.name);
      if (name.length < 2 || name.length > 40) return json(site, { error: "Write your name (2 to 40 characters), so the owner knows who is asking.", code: "name" }, 400);
      if (b.pub && !gpPubOk(b.pub)) return json(site, { error: "This browser sent an unusable device key.", code: "key" }, 400);
      if (asks.filter(x => x.state === "pending").length >= ASK_MAX_OPEN) return json(site, { error: "Too many requests are waiting right now. Try again later.", code: "busy" }, 429);
      if (now - asks.reduce((m, x) => Math.max(m, x.at), 0) < 3000) return json(site, { error: "Someone just asked. Try again in a few seconds.", code: "busy" }, 429);
      const id = crypto.randomUUID().slice(0, 8), key = crypto.randomUUID();
      asks.push(Object.assign({ id, name, at: now, kh: await sha(key), state: "pending" }, b.pub ? { pub: { kty: "EC", crv: "P-256", x: b.pub.x, y: b.pub.y } } : {}));
      await asksPut(kv, asks);
      return json(site, { ok: true, id, key });
    }
    const a = asks.find(x => x.id === String(url.searchParams.get("id") || ""));
    if (!a || a.kh !== await sha(String(url.searchParams.get("key") || ""))) return json(site, { state: "gone" });
    if (a.state !== "approved") return json(site, { state: a.state });
    const p = a.pass && await kv.get(gpKey(a.pass), "json");
    return json(site, p ? { state: "approved", pass: { id: p.id, lvl: p.lvl, exp: p.exp, name: p.name, bound: !!p.pub }, link: a.link || "" } : { state: "gone" });
  }

  /* Opening a link: look at the pass, then claim it with a name (both need the secret code) */
  if (path === "/guest/peek" || path === "/guest/claim") {
    if (path === "/guest/claim" && req.method !== "POST") return json(site, { error: "Use POST." }, 405);
    const b = path === "/guest/claim" ? await req.json().catch(() => ({})) : {};
    const id = String(b.id || url.searchParams.get("id") || "").toUpperCase(), code = String(b.code || url.searchParams.get("code") || "").toUpperCase();
    const bad = json(site, { error: "This pass link is not valid. Check that it was copied whole.", code: "invalid" }, 404);
    if (!/^GC-\d{5}$/.test(id) || !/^[2-9A-HJ-NP-Z]{6}$/.test(code)) return bad;
    const p = await kv.get(gpKey(id), "json");
    if (!p || p.ch !== await gpCodeHash(env, id, code)) return bad;
    const st = gpState(p, now);
    if (path === "/guest/peek") return json(site, { id, lvl: p.lvl, state: st, name: p.claimedAt ? p.name : "", exp: p.exp || 0, claimBy: p.claimBy, by: p.by });
    if (st !== "unclaimed") return json(site, st === "active" ? { error: "This pass is already in use by " + p.name + ".", code: "in_use", name: p.name } : { error: "This pass can no longer be claimed (" + st + ").", code: st }, 409);
    const name = gpName(b.name);
    if (name.length < 2 || name.length > 40) return json(site, { error: "Write your name (2 to 40 characters). It is kept in the pass history.", code: "name" }, 400);
    if (!gpPubOk(b.pub)) return json(site, { error: "This browser could not create a device key, so the pass cannot be bound to it. Try an up-to-date browser, not in private mode.", code: "key" }, 400);
    Object.assign(p, { name, pub: { kty: "EC", crv: "P-256", x: b.pub.x, y: b.pub.y }, claimedAt: now, exp: now + GP_MS, status: "active" });
    await kv.put(gpKey(id), JSON.stringify(p));
    return json(site, { ok: true, id, lvl: p.lvl, exp: p.exp, name });
  }

  /* LV7 actions */
  if (/^\/guest\/(grant|list|revoke|delete|purge|asks|approve|decline|reissue|forget|extend-approve|extend-decline)$/.test(path)) {
    const L = await lv7(env, req.headers.get("Authorization") || "");
    if (L.err) return json(site, { error: L.err }, L.st);
    const by = L.who.login, id = String(url.searchParams.get("id") || "").toUpperCase();
    const post = req.method === "POST";
    if (path === "/guest/grant" && post) {
      const b = await req.json().catch(() => ({})), lvl = +b.lvl || 3;
      if (GP_LVLS.indexOf(lvl) < 0) return json(site, { error: "Guest passes are LV2, LV3, LV5 or LV6." }, 400);
      const { p, code } = await gpNew(env, kv, lvl, by);
      return json(site, { id: p.id, code, lvl, claimBy: p.claimBy, hours: PASS_HOURS });
    }
    if (path === "/guest/list") {
      const out = [];
      for (const k of (await kv.list({ prefix: "gp:GC-" })).keys) { const p = await kv.get(k.name, "json"); if (p) out.push(gpPublic(p, now)); }
      return json(site, { passes: out.sort((a, b) => b.at - a.at), levels: GP_LVLS });
    }
    if (path === "/guest/asks") {
      const asks = await asksGet(kv), ext = [];
      for (const x of (await kv.get("gp:ext", "json")) || []) { const p = await kv.get(gpKey(x), "json"); if (p && p.ext && p.ext.state === "pending" && gpState(p, now) === "active") ext.push(gpPublic(p, now)); }
      return json(site, { asks: asks.map(x => ({ id: x.id, name: x.name, at: x.at, state: x.state, by: x.by || "", pass: x.pass || "", lvl: x.lvl || 0 })).sort((a, b) => b.at - a.at), extensions: ext, maxOpen: ASK_MAX_OPEN, levels: GP_LVLS });
    }
    if (!post) return json(site, { error: "Use POST." }, 405);
    if (path === "/guest/approve" || path === "/guest/decline") {
      const asks = await asksGet(kv), a = asks.find(x => x.id === String(url.searchParams.get("id") || ""));
      if (!a) return json(site, { error: "That request is gone." }, 404);
      if (a.state !== "pending") return json(site, { error: "That request was already answered." }, 409);
      if (path === "/guest/approve") {
        const lvl = +url.searchParams.get("lvl") || 3;
        if (GP_LVLS.indexOf(lvl) < 0) return json(site, { error: "Guest passes are LV2, LV3, LV5 or LV6." }, 400);
        /* The asker's browser sent its public key with the request, so the pass is bound to it at once: nothing to send */
        const extra = { name: a.name, fromAsk: a.id };
        if (a.pub) Object.assign(extra, { pub: a.pub, claimedAt: now, exp: now + GP_MS, status: "active" });
        const { p, code } = await gpNew(env, kv, lvl, by, extra);
        Object.assign(a, { state: "approved", pass: p.id, lvl }, a.pub ? {} : { link: p.id + "-" + code });
      } else a.state = "declined";
      a.by = by; a.done = now;
      await asksPut(kv, asks);
      return json(site, { ok: true, id: a.id, state: a.state, pass: a.pass || "" });
    }
    if (path === "/guest/purge") {
      const all = url.searchParams.get("all") === "1"; let n = 0;
      for (const k of (await kv.list({ prefix: "gp:GC-" })).keys) {
        const q = await kv.get(k.name, "json"); if (!q || q.hidden) continue;
        const qs = gpState(q, now), ql = qs === "active" || qs === "unclaimed";
        if (ql && !all) continue;
        if (ql) { Object.assign(q, { status: "revoked", revokedAt: now, revokedBy: by }); await extIdx(kv, q.id, false); }
        q.hidden = true; await kv.put(k.name, JSON.stringify(q)); n++;
      }
      return json(site, { ok: true, cleared: n });
    }
    if (!/^GC-\d{5}$/.test(id)) return json(site, { error: "Unknown pass." }, 400);
    const p = await kv.get(gpKey(id), "json");
    if (!p) return json(site, { error: "That pass does not exist." }, 404);
    const st = gpState(p, now), live = st === "active" || st === "unclaimed";
    const revoke = () => { Object.assign(p, { status: "revoked", revokedAt: now, revokedBy: by }); if (p.ext && p.ext.state === "pending") p.ext = { state: "cancelled", at: now }; };
    /* Forget: remove a finished pass from the history entirely, for example when its holder asks for their name to be deleted */
    if (path === "/guest/forget") { if (live) return json(site, { error: "Revoke or wait for this pass to end first." }, 409); await kv.delete(gpKey(id)); await extIdx(kv, id, false); return json(site, { ok: true, id, forgotten: true }); }
    if (path === "/guest/revoke") { if (!live) return json(site, { error: "This pass is not live." }, 409); revoke(); await extIdx(kv, id, false); }
    else if (path === "/guest/delete") { if (live) revoke(); p.hidden = true; await extIdx(kv, id, false); }
    else if (path === "/guest/reissue") {
      /* A new code for the same number, unbound again: for a guest who lost their browser data, or a link sent to the wrong person */
      if (st === "revoked" || st === "ended") return json(site, { error: "This pass has ended. Grant a new one." }, 409);
      const code = gpCode();
      Object.assign(p, { ch: await gpCodeHash(env, id, code), pub: null, name: "", claimedAt: 0, exp: 0, status: "issued", claimBy: now + GP_CLAIM_MS, hidden: false, ext: null, reissued: (p.reissued || 0) + 1 });
      await kv.put(gpKey(id), JSON.stringify(p)); await extIdx(kv, id, false);
      return json(site, { ok: true, id, code, lvl: p.lvl, claimBy: p.claimBy });
    }
    else if (path === "/guest/extend-approve" || path === "/guest/extend-decline") {
      if (!p.ext || p.ext.state !== "pending" || st !== "active") return json(site, { error: "No extension is waiting for this pass." }, 409);
      if (path === "/guest/extend-approve") { p.exp = Math.max(p.exp, now) + GP_MS; p.exts = (p.exts || 0) + 1; p.ext = { state: "approved", at: now, by }; }
      else p.ext = { state: "declined", at: now, by };
      await extIdx(kv, id, false);
    }
    await kv.put(gpKey(id), JSON.stringify(p));
    return json(site, { ok: true, pass: gpPublic(p, now) });
  }

  /* Everything else is a signed request from the browser that claimed the pass */
  const v = await gpVerify(req, kv, url);
  if (v.err) return json(site, { error: v.err === "clock" ? "Your device clock is more than two minutes off. Set it right and try again." : "This guest pass is not valid on this device.", code: v.err }, 401);
  const p = v.p, st = gpState(p, now);
  if (st === "revoked") return json(site, { error: "This guest pass has been revoked.", code: "revoked" }, 401);
  if (st !== "active") return json(site, { error: st === "ended" ? "This guest pass was ended." : "This guest pass has expired.", code: st }, 401);
  if (path === "/guest/check") return json(site, { ok: true, id: p.id, lvl: p.lvl, exp: p.exp, name: p.name, by: p.by, ext: p.ext || null, exts: p.exts || 0, repos: gpRepos(env, p.lvl) });
  if (path === "/guest/extend" && req.method === "POST") {
    if (p.ext && p.ext.state === "pending") return json(site, { error: "An extension request is already waiting for LV7.", code: "pending" }, 409);
    p.ext = { state: "pending", at: now };
    await kv.put(gpKey(p.id), JSON.stringify(p)); await extIdx(kv, p.id, true);
    return json(site, { ok: true, ext: p.ext });
  }
  if (path === "/guest/end" && req.method === "POST") {
    Object.assign(p, { status: "ended", endedAt: now }); if (p.ext && p.ext.state === "pending") p.ext = { state: "cancelled", at: now };
    await kv.put(gpKey(p.id), JSON.stringify(p)); await extIdx(kv, p.id, false);
    return json(site, { ok: true });
  }
  const repo = String(url.searchParams.get("repo") || "");
  if (gpRepos(env, p.lvl).indexOf(repo) < 0) return json(site, { error: "This pass does not open that area.", code: "level" }, 403);
  const tok = await appToken(env, repo);
  const gh = (pth, raw) => fetch("https://api.github.com/repos/" + repo + pth, { headers: { Authorization: "Bearer " + tok, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "User-Agent": "hound-protocol-signin" } });
  if (path === "/guest/tree") {
    const r = await gh(""); if (!r.ok) return json(site, { error: "GitHub refused (" + r.status + ")" }, 502);
    const t = await (await gh("/git/trees/" + encodeURIComponent((await r.json()).default_branch) + "?recursive=1")).json();
    return json(site, { exp: p.exp, paths: (t.tree || []).filter(n => n.type === "blob" && /\.md$/i.test(n.path) && !/(^|\/)README\.md$/i.test(n.path)).map(n => n.path) });
  }
  if (path === "/guest/file") {
    const fp = url.searchParams.get("path") || "";
    if (!/^[\w\-./ ]+\.md$/i.test(fp) || fp.split("/").some(x => x === ".." || x === "")) return json(site, { error: "Bad path." }, 400);
    const r = await gh("/contents/" + fp.split("/").map(encodeURIComponent).join("/"), true);
    if (!r.ok) return json(site, { error: "Not found." }, r.status === 404 ? 404 : 502);
    return new Response(await r.text(), { status: 200, headers: Object.assign({ "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" }, cors(site)) });
  }
  return json(site, { error: "Unknown request." }, 404);
}
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data))));
}
/* The GitHub App's installation token: read-only, for one guest repository at a time, cached per repository while valid */
const tokCache = {};
async function appToken(env, repo) {
  const c = tokCache[repo];
  if (c && c.exp > Date.now() + 120000) return c.tok;
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) throw new Error("guest_app_key_missing");
  const jwt = await appJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const H = { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "User-Agent": "hound-protocol-signin" };
  const inst = await fetch("https://api.github.com/repos/" + repo + "/installation", { headers: H });
  if (!inst.ok) throw new Error("app_not_installed_" + inst.status);
  const id = (await inst.json()).id;
  const t = await fetch("https://api.github.com/app/installations/" + id + "/access_tokens", { method: "POST", headers: H,
    body: JSON.stringify({ repositories: [repo.split("/")[1]], permissions: { contents: "read" } }) });
  if (!t.ok) throw new Error("token_" + t.status);
  const j = await t.json();
  tokCache[repo] = { tok: j.token, exp: Date.parse(j.expires_at) || Date.now() + 3000000 };
  return j.token;
}
async function appJwt(appId, pem) {
  const now = Math.floor(Date.now() / 1000), enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const data = enc({ alg: "RS256", typ: "JWT" }) + "." + enc({ iat: now - 60, exp: now + 540, iss: String(appId) });
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return data + "." + b64u(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data))));
}
/* GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"); Web Crypto wants PKCS#8, so wrap it */
function pkcs8(pem) {
  const isP1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const der = unb64(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  if (!isP1) return der;
  const len = n => n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255];
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const oct = [0x04].concat(len(der.length));
  const inner = [0x02, 0x01, 0x00].concat(algo, oct);
  const head = [0x30].concat(len(inner.length + der.length), inner), out = new Uint8Array(head.length + der.length);
  out.set(head, 0); out.set(der, head.length);
  return out;
}
function b64u(u) { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function unb64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return unb64(s); }
function cors(site) { return { "Access-Control-Allow-Origin": site, "Access-Control-Allow-Headers": "Authorization, Content-Type, X-HP-Guest", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "600", Vary: "Origin" }; }
function json(site, obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, cors(site)) }); }

/* The callback page sends the result to the website window that opened it, and only to the website's origin */
function page(site, msg) {
  const body = `<!doctype html><meta charset="utf-8"><title>Signing in</title><body style="background:#0c0f10;color:#e9edee;font:15px sans-serif;padding:24px">
<p>${msg.error ? msg.error : "Signed in. You can close this window."}</p>
<script>try{window.opener&&window.opener.postMessage(${JSON.stringify({ houndSignin: msg })},${JSON.stringify(site)});}catch(e){}setTimeout(function(){window.close()},${msg.error ? 4000 : 300});</script>`;
  return new Response(body, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Set-Cookie": "hp_state=; Path=/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" } });
}
