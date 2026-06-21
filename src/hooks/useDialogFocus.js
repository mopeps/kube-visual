import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Shared keyboard contract for portal dialogs: focus enters on open, Escape
// closes, modal variants keep Tab inside, and focus returns to the opener.
// Resized "peek" sheets pass modal=false because the canvas intentionally
// remains interactive behind them.
export default function useDialogFocus(active, containerRef, onClose, {
  modal = true,
  initialFocusRef,
} = {}) {
  const closeRef = useRef(onClose)
  const openerRef = useRef(null)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!active) return
    openerRef.current = document.activeElement
    const raf = requestAnimationFrame(() => {
      const target = initialFocusRef?.current || containerRef.current
      target?.focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
      openerRef.current = null
    }
  }, [active, containerRef, initialFocusRef])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (!modal || event.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return
      const focusable = [...container.querySelectorAll(FOCUSABLE)]
        .filter((el) => !el.hasAttribute('inert') && el.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focused = document.activeElement
      if (focused === container || !container.contains(focused)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && focused === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, containerRef, modal])
}
