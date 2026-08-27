'use client'

/**
 * Modal — componente base reutilizable para toda la aplicación.
 *
 * Usa createPortal para renderizar directamente en <body>, escapando
 * cualquier stacking context, overflow:hidden o transform en el árbol
 * de componentes (causa principal de modales desplazados en Android).
 *
 * Comportamiento:
 *  - Móvil  (<640px): bottom-sheet (desliza desde abajo)
 *  - Desktop (≥640px): modal centrado con overlay
 *
 * Uso:
 *   <Modal open={show} onClose={() => setShow(false)}>
 *     <Modal.Header title="Título" onClose={() => setShow(false)} />
 *     <div className="p-5">...contenido...</div>
 *     <Modal.Footer>...botones...</Modal.Footer>
 *   </Modal>
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Ancho máximo en desktop. Default: 'max-w-md' */
  maxWidth?: string
  /** z-index. Default: 9999 */
  zIndex?: number
}

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 'sm:max-w-md',
  zIndex = 9999,
}: ModalProps) {
  const portalRef = useRef<HTMLElement | null>(null)

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Inicializar el destino del portal
  useEffect(() => {
    portalRef.current = document.body
  }, [])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      // Evitar que el scroll de la página se propague al overlay
      onTouchMove={e => e.stopPropagation()}
    >
      <div
        className={`
          relative bg-white w-full ${maxWidth}
          rounded-t-3xl sm:rounded-2xl
          shadow-2xl
          max-h-[90dvh] overflow-y-auto
          animate-slide-up
        `}
        // Evitar que el click en el modal cierre el overlay
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar — solo móvil */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

Modal.Header = function ModalHeader({
  title,
  onClose,
  subtitle,
}: {
  title: string
  onClose: () => void
  subtitle?: string
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
      <div>
        <h3 className="font-bold text-gray-800 text-base leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        aria-label="Cerrar"
      >
        <X size={18} />
      </button>
    </div>
  )
}

Modal.Footer = function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100 sticky bottom-0 bg-white">
      {children}
    </div>
  )
}

export default Modal
