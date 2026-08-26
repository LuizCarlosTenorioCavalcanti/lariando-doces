// Service worker mínimo: guarda a casca do app para abrir sem internet. Não guarda dado —
// dado dela mora no IndexedDB, que não passa por aqui.
const CACHE = 'lariando-doces-v1'

self.addEventListener('install', (evento) => {
  evento.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  )
})

// Rede primeiro, cache como rede de segurança. O contrário deixaria ela presa numa versão
// velha do app depois de uma correção — e ela não tem como "limpar o cache" no celular.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        // Só guarda resposta de verdade (200) — um 404 ou 500 em cache viraria a resposta
        // "de sucesso" para toda visita offline seguinte.
        if (resposta.ok) {
          const copia = resposta.clone()
          caches.open(CACHE).then((c) => c.put(evento.request, copia))
        }
        return resposta
      })
      // Sem entrada exata no cache (ex.: rota nova, sem internet na primeira visita),
      // `'./'` cai na casca do app — resolve contra o escopo do service worker — em vez de
      // devolver nada e a navegação offline não abrir de jeito nenhum.
      .catch(() => caches.match(evento.request).then((r) => r ?? caches.match('./'))),
  )
})
