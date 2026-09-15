const CACHE_NAME = 'racha-da-santa-v10'

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

  // Rede primeiro, cache como rede de seguranca. O cache so e lido quando o
  // fetch falha, entao nunca serve versao velha com a rede disponivel.
  // Antes nada era gravado no cache, entao o fallback offline nunca tinha o
  // que servir e o catch caia em undefined.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(event.request)
        if (res && res.ok && res.type === 'basic') {
          const cache = await caches.open(CACHE_NAME)
          cache.put(event.request, res.clone())
        }
        return res
      } catch (err) {
        const cached = await caches.match(event.request)
        if (cached) return cached
        throw err
      }
    })()
  )
})
