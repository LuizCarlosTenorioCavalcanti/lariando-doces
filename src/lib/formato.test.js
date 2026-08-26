import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatBRL, formatarQuantidade, formatarDataBR, hojeLocal } from './formato'

describe('formatBRL', () => {
  it('mostra centavos como moeda brasileira', () => {
    expect(formatBRL(1000)).toBe('R$ 10,00')
    expect(formatBRL(650)).toBe('R$ 6,50')
    expect(formatBRL(3250)).toBe('R$ 32,50')
    expect(formatBRL(65)).toBe('R$ 0,65')
  })

  it('mostra travessão quando não há valor, nunca R$ 0,00', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(undefined)).toBe('—')
    expect(formatBRL(NaN)).toBe('—')
  })

  it('mostra zero de verdade como zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })
})

describe('formatarQuantidade', () => {
  it('mostra inteiro sem casa decimal', () => {
    expect(formatarQuantidade(40, 'g')).toBe('40 g')
    expect(formatarQuantidade(50, 'un')).toBe('50 un')
  })

  it('mostra decimal com vírgula e sem zero à toa', () => {
    expect(formatarQuantidade(0.5, 'g')).toBe('0,5 g')
    expect(formatarQuantidade(1.25, 'ml')).toBe('1,25 ml')
    expect(formatarQuantidade(1.2, 'g')).toBe('1,2 g')
  })

  it('mostra travessão quando não há valor', () => {
    expect(formatarQuantidade(null, 'g')).toBe('—')
  })
})

describe('formatarDataBR', () => {
  it('vira dia/mês/ano', () => {
    expect(formatarDataBR('2026-08-26')).toBe('26/08/2026')
  })

  it('aguenta data com hora junto', () => {
    expect(formatarDataBR('2026-08-26T14:30:00.000Z')).toBe('26/08/2026')
  })

  it('mostra travessão para vazio e lixo', () => {
    expect(formatarDataBR('')).toBe('—')
    expect(formatarDataBR(null)).toBe('—')
    expect(formatarDataBR('abc')).toBe('—')
  })
})

describe('hojeLocal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('usa o dia local, não o dia UTC — ela faz doce à noite', () => {
    // 26/08 22:30 em Brasília (UTC-3) é 27/08 01:30 em UTC. `toISOString()` devolveria o
    // dia 27; o dia local, que é o que ela viveu, é 26.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T01:30:00.000Z'))
    expect(hojeLocal()).toBe('2026-08-26')
  })
})
