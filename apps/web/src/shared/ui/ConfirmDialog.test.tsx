import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('вызывает выбранное действие', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        title="Guruhni yakunlash"
        description="Amalni tasdiqlang"
        confirmLabel="Yakunlash"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Guruhni yakunlash' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    await user.click(screen.getByRole('button', { name: 'Yakunlash' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('блокирует действия во время запроса', () => {
    render(
      <ConfirmDialog
        title="Kursni faolsiz qilish"
        description="Amalni tasdiqlang"
        confirmLabel="Faolsiz qilish"
        pending
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saqlanmoqda...' })).toBeDisabled()
  })

  it('поддерживает кастомный cancelLabel', () => {
    render(
      <ConfirmDialog
        title="Davomat saqlandi!"
        description="Telegramga yuborasizmi?"
        confirmLabel="Telegramga yuborish"
        cancelLabel="Shart emas"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Shart emas' })).toBeInTheDocument()
  })
})
