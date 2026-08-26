import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('mostra o nome do app', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Lariano Doces' })).toBeTruthy()
  })
})
