# Next.js App Router PWA — Strategies & Snippets

## Table of Contents

1. [File Map](#file-map)
2. [Manifest](#manifest-appmanifestts)
3. [iOS Meta Tags](#ios-meta-tags-in-applaborouttsx)
4. [Service Worker Registration](#service-worker-registration-client-component)
5. [Update Notification Component](#update-notification-component)
6. [Service Worker — Full Implementation](#service-worker-publicswjs)
    - Cache Versioning
    - Precaching
    - Caching Strategies (fetch handler)
    - Push & Notification handlers
    - Background Sync handler
7. [Server Actions for Push](#server-actions-for-push-appactionsts)
8. [Offline Fallback Page](#offline-fallback-page)
9. [next.config Headers](#nextconfig-headers)
10. [Serwist Configuration](#serwist-configuration)
11. [Local HTTPS and Validation](#local-https-and-validation)
12. [Production Notes](#production-notes)
13. [Troubleshooting Quick Reference](#troubleshooting-quick-reference)

---

## File Map

Typical structure:

- `app/manifest.ts`
- `app/layout.tsx` (iOS meta tags, viewport)
- `app/offline/page.tsx` (offline fallback)
- `public/sw.js`
- `app/components/ServiceWorkerRegister.tsx` (registration + update UX)
- `app/components/PushNotificationManager.tsx` (push subscription)
- `app/actions.ts` (Server Actions for push)
- `next.config.ts` or `next.config.js`

---

## Manifest (app/manifest.ts)

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Next.js PWA",
        short_name: "NextPWA",
        description: "A Progressive Web App built with Next.js",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: [
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/icon-512x512-maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
```

---

## iOS Meta Tags (in app/layout.tsx)

Add inside `<head>` or via Next.js metadata for iOS compatibility:

```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="NextPWA" />
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png" />
```

These are necessary because iOS does not read the Web App Manifest for all properties — it relies on these meta tags for home-screen name, status bar style, and icon.

---

## Service Worker Registration (Client Component)

This component handles both first-time registration and the update notification UX.

```tsx
"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
        null,
    );
    const [showUpdate, setShowUpdate] = useState(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker
            .register("/sw.js", { scope: "/", updateViaCache: "none" })
            .then((registration) => {
                // Check if there's already a waiting worker
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setShowUpdate(true);
                }

                // Listen for new updates
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener("statechange", () => {
                        if (
                            newWorker.state === "installed" &&
                            navigator.serviceWorker.controller
                        ) {
                            // New SW is installed but waiting — show update prompt
                            setWaitingWorker(newWorker);
                            setShowUpdate(true);
                        }
                    });
                });
            })
            .catch((error) => {
                console.error("Service Worker registration failed:", error);
            });

        // When the controlling SW changes, reload to get the new version
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }, []);

    const handleUpdate = () => {
        waitingWorker?.postMessage({ type: "SKIP_WAITING" });
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div
            role="alert"
            style={{
                position: "fixed",
                bottom: 16,
                right: 16,
                zIndex: 9999,
                padding: "12px 20px",
                background: "#1a1a2e",
                color: "#fff",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
        >
            <span>New version available</span>
            <button
                onClick={handleUpdate}
                style={{
                    background: "#4361ee",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 14px",
                    cursor: "pointer",
                }}
            >
                Update
            </button>
        </div>
    );
}
```

---

## Update Notification Component

If you prefer a separate update component (for cases where registration lives elsewhere), extract the update banner into its own component. The key mechanism is the same: listen for `updatefound`, track the `waiting` worker, and post `SKIP_WAITING` when the user clicks "Update".

---

## Service Worker (public/sw.js)

Full implementation with cache versioning, precaching, caching strategies, push, and Background Sync.

```js
// ━━━ Cache versioning ━━━
// Bump CACHE_VERSION on every deploy that changes cached assets.
const CACHE_VERSION = "v1";
const PRECACHE_NAME = `precache-${CACHE_VERSION}`;
const RUNTIME_NAME = `runtime-${CACHE_VERSION}`;

// ━━━ Precache list ━━━
// Assets that must be available offline immediately after install.
// Keep this list small — every entry adds to install time.
const PRECACHE_URLS = ["/", "/offline"];

// ━━━ Install: precache essential assets ━━━
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
    );
    // Do NOT call skipWaiting() here — let the update notification UX handle it.
    // If this SW is push-only (no caching), you can uncomment:
    // self.skipWaiting()
});

// ━━━ Activate: clean up old caches ━━━
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter(
                            (name) =>
                                name !== PRECACHE_NAME && name !== RUNTIME_NAME,
                        )
                        .map((name) => caches.delete(name)),
                ),
            ),
    );
    self.clients.claim();
});

// ━━━ Listen for SKIP_WAITING message from the client ━━━
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// ━━━ Fetch: route-based caching strategies ━━━
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Never cache non-GET requests
    if (request.method !== "GET") return;

    // Skip cross-origin requests unless you explicitly want to cache them
    if (url.origin !== self.location.origin) return;

    // Strategy: Cache First — for hashed static assets
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Strategy: Network First — for HTML navigation requests
    if (request.mode === "navigate") {
        event.respondWith(networkFirstWithOfflineFallback(request));
        return;
    }

    // Strategy: Stale-While-Revalidate — for images and other public assets
    if (
        url.pathname.startsWith("/") &&
        url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/)
    ) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // Default: network only (API routes, etc.)
});

// ━━━ Strategy implementations ━━━

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(RUNTIME_NAME);
        cache.put(request, response.clone());
    }
    return response;
}

async function networkFirstWithOfflineFallback(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback to the offline page for navigation requests
        return (
            caches.match("/offline") || new Response("Offline", { status: 503 })
        );
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_NAME);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);

    return cached || fetchPromise;
}

// ━━━ Push notification handler ━━━
self.addEventListener("push", (event) => {
    if (!event.data) return;

    const { title, body, icon, badge, url } = event.data.json();
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: icon || "/icon-192x192.png",
            badge: badge || "/badge-icon.png",
            data: { url: url || "/" },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";
    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                // Focus an existing tab if one is open at the target URL
                for (const client of clientList) {
                    if (client.url === targetUrl && "focus" in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new tab
                return self.clients.openWindow(targetUrl);
            }),
    );
});

// ━━━ Push subscription change (auto re-subscribe) ━━━
self.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil(
        self.registration.pushManager
            .subscribe(event.oldSubscription.options)
            .then((newSub) =>
                fetch("/api/push/resubscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        old: event.oldSubscription
                            ? JSON.parse(JSON.stringify(event.oldSubscription))
                            : null,
                        new: JSON.parse(JSON.stringify(newSub)),
                    }),
                }),
            ),
    );
});

// ━━━ Background Sync (optional) ━━━
// Register a sync from the client:
//   const reg = await navigator.serviceWorker.ready
//   await reg.sync.register('sync-pending-actions')
self.addEventListener("sync", (event) => {
    if (event.tag === "sync-pending-actions") {
        event.waitUntil(replayPendingActions());
    }
});

async function replayPendingActions() {
    // Read pending actions from IndexedDB
    // For each action, replay the fetch request
    // On success, remove the action from IndexedDB
    // On failure, the browser will retry the sync event later
    //
    // Implementation depends on your data layer.
    // Use idb or idb-keyval for a clean IndexedDB API.
}
```

---

## Server Actions for Push (app/actions.ts)

```ts
"use server";

import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:your-email@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

// In production, replace this with a database query.
let subscription: PushSubscription | null = null;

export async function subscribeUser(sub: PushSubscription) {
    subscription = sub;
    return { success: true };
}

export async function unsubscribeUser() {
    subscription = null;
    return { success: true };
}

export async function sendNotification(message: string) {
    if (!subscription) throw new Error("No subscription available");

    await webpush.sendNotification(
        subscription,
        JSON.stringify({
            title: "Test Notification",
            body: message,
            icon: "/icon-192x192.png",
        }),
    );

    return { success: true };
}
```

---

## Offline Fallback Page

Create `app/offline/page.tsx`:

```tsx
export default function OfflinePage() {
    return (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h1>You are offline</h1>
            <p>Check your internet connection and try again.</p>
        </div>
    );
}
```

Make sure `/offline` is in the `PRECACHE_URLS` array in `sw.js` so the service worker can serve this page when the network is unavailable.

---

## next.config Headers

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "X-XSS-Protection",
                        value: "1; mode=block",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                ],
            },
            {
                source: "/sw.js",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/javascript; charset=utf-8",
                    },
                    {
                        key: "Cache-Control",
                        value: "no-cache, no-store, must-revalidate",
                    },
                    {
                        key: "Content-Security-Policy",
                        value: "default-src 'self'; script-src 'self'",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
```

---

## Serwist Configuration

Install:

```bash
npm install @serwist/next @serwist/precaching @serwist/strategies
```

Wrap `next.config.js`:

```js
const withSerwist = require("@serwist/next").default({
    swSrc: "app/sw.ts", // your SW source file
    swDest: "public/sw.js", // output location
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // your existing config
};

module.exports = withSerwist(nextConfig);
```

Create `app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import { installSerwist } from "@serwist/sw";

declare const self: ServiceWorkerGlobalScope;

installSerwist({
    precacheEntries: self.__SW_MANIFEST, // injected at build time
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: defaultCache,
});
```

---

## Local HTTPS and Validation

```bash
next dev --experimental-https
```

Validation steps:

1. Service Worker appears in DevTools → Application → Service Workers with expected scope.
2. "Update on reload" checkbox is useful during development.
3. Cache Storage shows the expected cache names.
4. Updates are detected without stale cache lock (`updateViaCache: 'none'`).
5. Manifest and icons are discoverable under Application → Manifest.
6. Push subscribe/send/unsubscribe flows work.
7. Lighthouse PWA checks pass (Installability, PWA Optimized).
8. Offline mode (Network tab → Offline toggle) shows the fallback page.
9. Update flow works: change `sw.js` content → reload → update banner appears → clicking "Update" reloads with new version.

---

## Production Notes

- Replace in-memory subscriptions with persistent storage (database).
- For `output: 'export'`, do not rely on Server Actions for push. Use external API endpoints instead.
- For richer offline strategies in Next.js, use Serwist when requested.
- Set appropriate `Cache-Control` on CDN for `sw.js` — even with `updateViaCache: 'none'`, some CDNs cache aggressively.
- Monitor service worker errors in production via your error tracking service (Sentry, etc.).
- Consider the storage quota: browsers limit the total cache storage. Implement a cache eviction policy for runtime caches (e.g., max 50 entries, max 30 days).

---

## Troubleshooting Quick Reference

| Problem                                   | Check                               | Solution                                                                                              |
| ----------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SW doesn't register                       | Browser console for errors          | Ensure HTTPS or localhost, verify `/sw.js` path returns JS                                            |
| Old content after deploy                  | Cache Storage in DevTools           | Bump `CACHE_VERSION`, verify activate handler cleans old caches                                       |
| Push notifications don't arrive           | `webpush.sendNotification` errors   | Verify VAPID keys, check subscription isn't expired                                                   |
| Offline page doesn't show                 | Precache list, navigation handler   | Ensure `/offline` is in `PRECACHE_URLS` and `networkFirstWithOfflineFallback` is used for navigations |
| "Page does not work offline" (Lighthouse) | `start_url` caching                 | Add manifest's `start_url` value to precache                                                          |
| Update banner never appears               | `updatefound` listener              | Verify `sw.js` content actually changed, check registration code                                      |
| Multiple SWs registered                   | `chrome://serviceworker-internals/` | Unregister extras, ensure consistent scope                                                            |
| iOS install doesn't work                  | Expected iOS limitation             | Guide users to Safari → Share → Add to Home Screen                                                    |
| Background Sync not firing                | Browser support                     | Chromium-only; provide fallback retry on next page load                                               |
