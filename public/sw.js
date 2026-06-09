const CACHE_NAME = "yuuume-ass-converter-v1"
const ASSETS = [
    "/",
    "/index.html",
    "/about/",
    "/about/index.html",
    "/favicon.ico",
    "/icon-192x192.png",
    "/icon-512x512.png"
]

// Install Event
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS)
        })
    )
    self.skipWaiting()
})

// Activate Event
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key)
                    }
                })
            )
        })
    )
    self.clients.claim()
})

// Fetch Event
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return

    // Do not cache extension/development files or browser extension schemas
    const url = new URL(event.request.url)
    if (url.protocol !== "http:" && url.protocol !== "https:") return

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // Fetch new version in background to update cache
                fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, networkResponse)
                            })
                        }
                    })
                    .catch(() => {})
                return cachedResponse
            }
            return fetch(event.request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
                    return networkResponse
                }
                const responseToCache = networkResponse.clone()
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache)
                })
                return networkResponse
            })
        })
    )
})
