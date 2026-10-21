// Timeo service worker
// - Pages: stale-while-revalidate snapshots in IndexedDB. Open a page and the
//   last copy shows instantly (no cold start), while a fresh copy loads in the
//   background; the page is told to refresh when it changed.
// - Static assets: cache first (hashed, immutable).
// - Web Push: show notifications, open the right screen on tap.

const VERSION = "timeo-v6";
const OFFLINE_URL = "/offline.html";
// registered as /sw.js?dev=1 by `next dev`: no snapshots, no asset caching
const IS_DEV = new URL(self.location.href).searchParams.get("dev") === "1";
const SNAPSHOT_MAX_AGE = 7 * 86_400_000;
// never snapshot these (landing, auth screens, API, files)
const NO_SNAPSHOT = [/^\/$/, /^\/login/, /^\/signup/, /^\/forgot-password/, /^\/reset-password/, /^\/api\//, /^\/offline/, /\.[a-z0-9]+$/i];
// live screens: always the network copy, the snapshot only when offline
const NETWORK_FIRST = [/^\/app\/fitness\/workout\//];

// ─────────────────────────── IndexedDB ───────────────────────────

let dbPromise;
function idb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("timeo", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function store(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", mode);
    const req = fn(tx.objectStore("pages"));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

const getSnapshot = (key) => store("readonly", (s) => s.get(key)).catch(() => undefined);
const putSnapshot = (snap) => store("readwrite", (s) => s.put(snap)).catch(() => {});
const clearSnapshots = () => store("readwrite", (s) => s.clear()).catch(() => {});

// ─────────────────────────── Helpers ───────────────────────────

const keyFor = (url) => {
  const u = new URL(url);
  u.searchParams.delete("_rsc");
  return u.pathname + (u.search || "");
};

// The set of script URLs identifies the deployment; a change means new code.
const buildSignature = (html) => {
  const srcs = html.match(/\/_next\/static\/[^"'\s)]+\.js/g) || [];
  return Array.from(new Set(srcs)).sort().join("|").slice(0, 4000);
};

const withSnapshotMeta = (html, savedAt) =>
  html.replace("</head>", `<meta name="timeo-snapshot" content="${savedAt}"></head>`);

async function notify(clientId, message) {
  const client = clientId ? await self.clients.get(clientId) : null;
  if (client) client.postMessage(message);
}

// Background revalidation results, so a page that loads later can ask for them.
const revalidations = new Map();
const lastServed = new Map();

async function fetchAndStore(url, key) {
  const res = await fetch(url, { credentials: "include", headers: { accept: "text/html" }, cache: "no-store" });
  const loggedOut = res.redirected && /^\/(login|signup)/.test(new URL(res.url).pathname);
  if (loggedOut) {
    await clearSnapshots();
    return { status: "logged-out" };
  }
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return { status: "skip" };
  const html = await res.text();
  const savedAt = Date.now();
  await putSnapshot({ key, html, savedAt, build: buildSignature(html) });
  return { status: "ok", html, savedAt };
}

// ─────────────────────────── Lifecycle ───────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE_URL, "/icon-192.png", "/badge.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Saved pages are keyed by URL; a new version may have moved routes (v6 moved the app to /app), so start clean.
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
      clearSnapshots(),
    ]),
  );
  self.clients.claim();
});

// ─────────────────────────── Fetch ───────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // never cache in development: chunk names are not content-hashed there
  if (IS_DEV) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

async function handleNavigation(event) {
  const { request } = event;
  const url = new URL(request.url);
  const key = keyFor(request.url);
  const cacheable = !IS_DEV && !NO_SNAPSHOT.some((r) => r.test(url.pathname));

  if (!cacheable) {
    if (/^\/(login|signup|reset-password)/.test(url.pathname)) event.waitUntil(clearSnapshots());
    return fetch(request).catch(() => caches.match(OFFLINE_URL));
  }

  const snap = await getSnapshot(key);
  const recentlyServed = Date.now() - (lastServed.get(key) || 0) < 15_000; // reload loop guard
  const live = NETWORK_FIRST.some((r) => r.test(url.pathname));
  const usable = snap && !live && Date.now() - snap.savedAt < SNAPSHOT_MAX_AGE && !recentlyServed;

  if (usable) {
    lastServed.set(key, Date.now());
    const clientId = event.resultingClientId;
    const job = fetchAndStore(request.url, key)
      .then((r) => {
        if (r.status === "logged-out") return { type: "timeo:reload", url: key };
        if (r.status !== "ok") return { type: "timeo:fresh", url: key, changed: false };
        const newBuild = r.html && buildSignature(r.html) !== snap.build;
        return newBuild
          ? { type: "timeo:reload", url: key }
          : { type: "timeo:fresh", url: key, changed: r.html !== snap.html, savedAt: r.savedAt };
      })
      .catch(() => ({ type: "timeo:offline", url: key }));
    revalidations.set(key, job);
    event.waitUntil(job.then((msg) => notify(clientId, msg)));
    return new Response(withSnapshotMeta(snap.html, snap.savedAt), {
      headers: { "content-type": "text/html; charset=utf-8", "x-timeo-snapshot": String(snap.savedAt) },
    });
  }

  // network first; keep a copy for next time
  try {
    const res = await fetch(request);
    const isHtml = (res.headers.get("content-type") || "").includes("text/html");
    const loggedOut = res.redirected && /^\/(login|signup)/.test(new URL(res.url).pathname);
    if (loggedOut) event.waitUntil(clearSnapshots());
    else if (res.ok && isHtml && !res.redirected) {
      const copy = res.clone();
      event.waitUntil(copy.text().then((html) => putSnapshot({ key, html, savedAt: Date.now(), build: buildSignature(html) })));
    }
    return res;
  } catch {
    if (snap) return new Response(withSnapshotMeta(snap.html, snap.savedAt), { headers: { "content-type": "text/html; charset=utf-8" } });
    return caches.match(OFFLINE_URL);
  }
}

// Pages ask "did my background refresh finish?" once they've mounted.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "timeo:hello" && data.url) {
    const job = revalidations.get(keyFor(new URL(data.url, self.location.origin).href));
    if (job) job.then((msg) => event.source && event.source.postMessage(msg));
  }
  if (data.type === "timeo:clear") event.waitUntil(clearSnapshots());
});

// ─────────────────────────── Push ───────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Timeo", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Timeo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: "/badge.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Push payloads are data, not navigation authority: keep taps on-origin.
  // Rebuilding from the pathname is not enough ("//evil.com" re-parses off-origin), so check the parsed origin.
  let target = "/app";
  try {
    const parsed = new URL(event.notification.data?.url || "/app", self.location.origin);
    if (parsed.origin === self.location.origin) target = parsed.href;
  } catch {}
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The browser rotated the subscription: re-subscribe and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription ? event.oldSubscription.options : null;
  if (!options) return;
  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((sub) =>
      fetch("/api/push/resubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ old: event.oldSubscription?.endpoint, sub: sub.toJSON() }),
      }),
    ),
  );
});
