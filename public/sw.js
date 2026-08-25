// Service worker for Yuuume ASS Converter.
//
// Strategy:
// - Navigations (HTML): network-first so deploys appear immediately; fall back
//   to cache (then /404.html) when offline.
// - Hashed build assets (/_astro/*): cache-first — content is immutable per URL.
// - Everything else: stale-while-revalidate.
//
// The cache name embeds a build ID injected at build time, so every deploy
// invalidates the old cache through the activate cleanup below.

const CACHE_NAME = `yuuume-ass-converter-${self.__BUILD_ID__ || "dev"}`

const PRECACHE_ASSETS = ["/", "/about/", "/qc/", "/favicon.ico", "/icon-192x192.png", "/icon-512x512.png"]

// Install Event — non-atomic: one failed asset must not reject the whole install
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => Promise.allSettled(PRECACHE_ASSETS.map(asset => cache.add(asset))))
    )
    self.skipWaiting()
})

// Activate Event — clean up caches from previous builds
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
        })
    )
    self.clients.claim()
})

async function networkFirstNavigation(request) {
    try {
        const networkResponse = await fetch(request)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const cache = await caches.open(CACHE_NAME)
            cache.put(request, networkResponse.clone())
        }
        return networkResponse
    } catch {
        const cachedResponse = await caches.match(request)
        if (cachedResponse) return cachedResponse
        const offlineFallback = await caches.match("/404.html")
        if (offlineFallback) return offlineFallback
        throw new Error("Offline and no cached page available")
    }
}

function isHashedBuildAsset(url) {
    // Astro emits /_astro/<name>.<hash>.js|css — immutable content
    return url.pathname.startsWith("/_astro/")
}

// Fetch Event
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return

    // Do not intercept non-http(s) schemes (extensions etc.)
    const url = new URL(event.request.url)
    if (url.protocol !== "http:" && url.protocol !== "https:") return

    // Navigations: fresh HTML whenever possible
    if (event.request.mode === "navigate") {
        event.respondWith(networkFirstNavigation(event.request))
        return
    }

    // Immutable hashed assets: cache-first (they never change per URL)
    if (isHashedBuildAsset(url)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
                        const responseToCache = networkResponse.clone()
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache)
                        })
                    }
                    return networkResponse
                })
            })
        )
        return
    }

    // Everything else: stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const networkFetch = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
                        const responseToCache = networkResponse.clone()
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache)
                        })
                    }
                    return networkResponse
                })
                .catch(() => cachedResponse)
            return cachedResponse || networkFetch
        })
    )
})
