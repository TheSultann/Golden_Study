import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}: PaginationProps) {
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      onPageChange(1)
    }
  }, [page, totalPages, onPageChange])

  if (totalItems <= 0) return null

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className={`pagination-container ${className}`.trim()} aria-label="Sahifalash">
      <div className="pagination-info">
        <span>
          Jami {totalItems} ta yozuvdan {startItem}–{endItem} ko‘rsatilmoqda
        </span>
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Oldingi sahifa"
          >
            <ChevronLeft size={16} />
            <span>Oldingi</span>
          </button>

          <div className="pagination-pages">
            {pages.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`pagination-page-button ${p === page ? 'active' : ''}`}
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className="pagination-button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Keyingi sahifa"
          >
            <span>Keyingi</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
