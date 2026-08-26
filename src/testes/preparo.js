import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sem `globals: true` no config, o autocleanup do Testing Library não se registra sozinho.
// Sem isto, um arquivo com mais de um `render()` acumula telas — o segundo teste enxerga
// os elementos do primeiro ainda no DOM.
afterEach(() => {
  cleanup()
})
