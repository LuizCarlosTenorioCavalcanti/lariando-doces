import { describe, it, expect } from 'vitest'
import { normalizar } from './texto'

describe('normalizar', () => {
  it('ignora acento', () => {
    expect(normalizar('Açúcar')).toBe(normalizar('acucar'))
  })

  it('ignora maiúscula', () => {
    expect(normalizar('TODDY')).toBe(normalizar('toddy'))
  })

  it('ignora espaço sobrando no meio e nas pontas', () => {
    expect(normalizar('  Leite   Condensado ')).toBe('leite condensado')
  })

  it('aguenta vazio e nulo', () => {
    expect(normalizar('')).toBe('')
    expect(normalizar(null)).toBe('')
    expect(normalizar(undefined)).toBe('')
  })

  it('mantém nomes diferentes diferentes', () => {
    expect(normalizar('Brigadeiro')).not.toBe(normalizar('Beijinho'))
  })
})
