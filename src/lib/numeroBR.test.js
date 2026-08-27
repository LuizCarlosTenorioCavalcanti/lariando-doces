import { describe, it, expect } from 'vitest'
import { paraNumero, paraCentavos, centavosParaCampo } from './numeroBR'

describe('paraNumero', () => {
  it('lê vírgula como decimal', () => {
    expect(paraNumero('8,50')).toBe(8.5)
  })

  it('aceita ponto como decimal, que é o que alguns teclados mandam', () => {
    expect(paraNumero('8.50')).toBe(8.5)
  })

  it('com vírgula presente, o ponto é separador de milhar', () => {
    expect(paraNumero('1.200,50')).toBe(1200.5)
  })

  it('deixa passar número que já é número', () => {
    expect(paraNumero(40)).toBe(40)
  })

  it('devolve null para vazio, espaço e texto', () => {
    expect(paraNumero('')).toBe(null)
    expect(paraNumero('   ')).toBe(null)
    expect(paraNumero('abc')).toBe(null)
    expect(paraNumero(null)).toBe(null)
    expect(paraNumero(undefined)).toBe(null)
  })

  it('devolve null para número pela metade', () => {
    expect(paraNumero('8,')).toBe(null)
    expect(paraNumero(',')).toBe(null)
  })
})

describe('paraCentavos', () => {
  it('converte reais digitados em centavos inteiros', () => {
    expect(paraCentavos('8,50')).toBe(850)
    expect(paraCentavos('10')).toBe(1000)
    expect(paraCentavos('0,07')).toBe(7)
  })

  it('devolve inteiro, nunca float', () => {
    expect(Number.isInteger(paraCentavos('6,49'))).toBe(true)
  })

  it('devolve null quando não dá para ler', () => {
    expect(paraCentavos('')).toBe(null)
    expect(paraCentavos('abc')).toBe(null)
  })
})

describe('centavosParaCampo', () => {
  it('centavos viram o texto que vai DENTRO do campo, sem R$', () => {
    expect(centavosParaCampo(195)).toBe('1,95')
    expect(centavosParaCampo(6500)).toBe('65,00')
    expect(centavosParaCampo(5)).toBe('0,05')
  })

  it('sem valor o campo fica vazio, não com travessão', () => {
    expect(centavosParaCampo(null)).toBe('')
    expect(centavosParaCampo(undefined)).toBe('')
  })

  it('fecha a ida e a volta com paraCentavos', () => {
    expect(paraCentavos(centavosParaCampo(195))).toBe(195)
  })

  // Milhar com ponto entraria no campo e `paraNumero` leria "1.234,50" certo, mas o campo
  // com separador atrapalha quem edita no meio do número.
  it('não põe separador de milhar', () => {
    expect(centavosParaCampo(123450)).toBe('1234,50')
  })
})
