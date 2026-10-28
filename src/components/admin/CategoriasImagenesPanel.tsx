'use client'

/**
 * CategoriasImagenesPanel
 *
 * Panel de administración para subir, reemplazar y eliminar
 * las fotografías de las categorías de servicios.
 *
 * - Lee categorías de Supabase (solo lectura).
 * - Lee/escribe imágenes a través de /api/categoria-imagenes.
 * - No modifica ninguna tabla ni dato existente.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { Upload, Trash2, Loader2, ImageIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface Categoria {
  id: string
  nombre: string
  icono: string
  orden: number
}

interface CategoriaImagen {
  categoria_id: string
  imagen_url: string
}

export default function CategoriasImagenesPanel() {
  const supabase = createClient()

  const [categorias,   setCategorias]  = useState<Categoria[]>([])
  const [imagenes,     setImagenes]    = useState<Record<string, string>>({}) // categoriaId → url
  const [loading,      setLoading]     = useState(true)
  const [uploading,    setUploading]   = useState<string | null>(null)  // categoriaId en proceso
  const [deleting,     setDeleting]    = useState<string | null>(null)
  const [preview,      setPreview]     = useState<{ catId: string; url: string; file: File } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeCatRef = useRef<string | null>(null)

  // ── Carga inicial ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, res] = await Promise.all([
      supabase.from('categorias').select('id, nombre, icono, orden').order('orden'),
      fetch('/api/categoria-imagenes'),
    ])

    if (cats) setCategorias(cats as Categoria[])

    if (res.ok) {
      const imgs: CategoriaImagen[] = await res.json()
      const map: Record<string, string> = {}
      imgs.forEach(i => { map[i.categoria_id] = i.imagen_url })
      setImagenes(map)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── Seleccionar archivo ───────────────────────────────────────
  function openFilePicker(catId: string) {
    activeCatRef.current = catId
    if (fileInputRef.current) {
      fileInputRef.current.value = ''   // resetear para permitir re-selección del mismo archivo
      fileInputRef.current.click()
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file  = e.target.files?.[0]
    const catId = activeCatRef.current
    if (!file || !catId) return

    // Validaciones locales antes de mostrar preview
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Usa JPEG, PNG, WebP o GIF.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview({ catId, url: objectUrl, file })
  }

  // ── Confirmar subida ──────────────────────────────────────────
  async function confirmarSubida() {
    if (!preview) return
    const { catId, file } = preview

    setUploading(catId)
    setPreview(null)

    const fd = new FormData()
    fd.append('file',         file)
    fd.append('categoria_id', catId)

    try {
      const res = await fetch('/api/categoria-imagenes', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al subir')
      }
      const { imagen_url } = await res.json()
      setImagenes(prev => ({ ...prev, [catId]: imagen_url }))
      toast.success('✅ Imagen guardada')
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setUploading(null)
      URL.revokeObjectURL(preview?.url ?? '')
    }
  }

  function cancelarPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  // ── Eliminar imagen ───────────────────────────────────────────
  async function eliminarImagen(catId: string) {
    if (!confirm('¿Eliminar la imagen de esta categoría?')) return
    setDeleting(catId)
    try {
      const res = await fetch('/api/categoria-imagenes', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ categoriaId: catId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al eliminar')
      }
      setImagenes(prev => {
        const next = { ...prev }
        delete next[catId]
        return next
      })
      toast.success('Imagen eliminada')
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setDeleting(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-10 border-t border-gray-100 pt-8">
        <h3 className="text-lg font-bold text-beauty-text mb-4">📷 Imágenes de categorías</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-40 bg-beauty-bg rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-10 border-t border-gray-100 pt-8">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-beauty-text">📷 Imágenes de categorías</h3>
        <p className="text-sm text-gray-500 mt-1">
          Sube una foto para cada categoría. Se mostrará en la página pública.
        </p>
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileSelected}
      />

      {/* Modal de preview */}
      {preview && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800">Vista previa</h4>
              <button onClick={cancelarPreview} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-beauty-bg mb-5">
              <Image src={preview.url} alt="Preview" fill className="object-cover" unoptimized />
            </div>
            <p className="text-xs text-gray-500 mb-5 text-center">
              Categoría: <strong>{categorias.find(c => c.id === preview.catId)?.nombre}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelarPreview}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSubida}
                disabled={!!uploading}
                className="flex-1 py-2.5 rounded-xl bg-beauty-primary text-white text-sm font-semibold hover:bg-beauty-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de categorías */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {categorias.map(cat => {
          const imgUrl       = imagenes[cat.id]
          const isUploading  = uploading === cat.id
          const isDeleting   = deleting  === cat.id
          const busy         = isUploading || isDeleting

          return (
            <div key={cat.id} className="flex flex-col gap-2">
              {/* Tarjeta de imagen */}
              <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-beauty-primary/20 bg-beauty-bg group">

                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={cat.nombre}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-beauty-text-muted">
                    <span className="text-3xl">{cat.icono}</span>
                    <ImageIcon size={16} className="opacity-40" />
                  </div>
                )}

                {/* Overlay de acciones */}
                {!busy && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => openFilePicker(cat.id)}
                      title="Subir imagen"
                      className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-beauty-bg transition-colors shadow"
                    >
                      <Upload size={15} className="text-beauty-primary" />
                    </button>
                    {imgUrl && (
                      <button
                        onClick={() => eliminarImagen(cat.id)}
                        title="Eliminar imagen"
                        className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shadow"
                      >
                        <Trash2 size={15} className="text-red-500" />
                      </button>
                    )}
                  </div>
                )}

                {/* Spinner mientras sube/elimina */}
                {busy && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 size={22} className="animate-spin text-beauty-primary" />
                  </div>
                )}
              </div>

              {/* Nombre de la categoría */}
              <div className="text-center">
                <p className="text-xs font-semibold text-beauty-text-dark leading-tight">{cat.nombre}</p>
                {imgUrl ? (
                  <p className="text-[10px] text-green-600 mt-0.5">✓ Con imagen</p>
                ) : (
                  <button
                    onClick={() => openFilePicker(cat.id)}
                    disabled={busy}
                    className="text-[10px] text-beauty-primary underline mt-0.5 hover:text-beauty-primary-dark disabled:opacity-40"
                  >
                    + Subir foto
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
