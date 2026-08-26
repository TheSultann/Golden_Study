import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput component', () => {
  it('toggles input type between password and text when eye button is clicked', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Parol" defaultValue="mysecret123" />)

    const input = screen.getByLabelText('Parol') as HTMLInputElement
    expect(input.type).toBe('password')

    const toggleButton = screen.getByRole('button', { name: 'Parolni ko‘rsatish' })
    await user.click(toggleButton)

    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Parolni yashirish' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Parolni yashirish' }))
    expect(input.type).toBe('password')
  })
})
