const CACHE_NAME = 'racha-da-santa-v9'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      await clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = event.request.url

  // Nao cachear storage do Supabase (avatares sempre frescos)
  // Nao cachear API do Supabase (dados sempre frescos)
  if (url.includes('/storage/v1/') || url.includes('/rest/v1/') || url.includes('/auth/v1/')) {
    return
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
