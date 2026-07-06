'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'

const CATEGORIAS = [
  'General', 'Manicura y Pedicura', 'Maquillaje', 'Masajes',
  'Limpieza Facial', 'Cejas y Pestañas', 'Peinados',
  'Barbería', 'Depilación Corporal', 'Peluquería', 'Podología',
]

interface FotoGaleria {
  id: string
  url: string
  storage_path: string
  categoria: string
  descripcion: string | null
  orden: number
  activo: boolean
  created_at: string
}

export default function GaleriaView() {
  const [fotos, setFotos] = useState<FotoGaleria[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [categoria, setCategoria] = useState('General')
  const [descripcion, setDescripcion] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const loadFotos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('galeria')
      .select('*')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false })
    setFotos((data as FotoGaleria[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadFotos() }, [loadFotos])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5MB'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setShowModal(true)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('galeria')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('galeria').getPublicUrl(path)

      const res = await fetch('/api/galeria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: publicUrl,
          storage_path: path,
          categoria,
          descripcion: descripcion.trim() || null,
          orden: fotos.length,
        }),
      })
      if (!res.ok) throw new Error('Error guardando en base de datos')

      toast.success('✅ Foto subida correctamente')
      setShowModal(false)
      setFile(null)
      setPreview(null)
      setCategoria('General')
      setDescripcion('')
      loadFotos()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(foto: FotoGaleria) {
    if (!confirm(`¿Eliminar esta foto de ${foto.categoria}?`)) return
    setDeleting(foto.id)
    const res = await fetch(`/api/galeria?id=${foto.id}&path=${encodeURIComponent(foto.storage_path)}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      toast.success('Foto eliminada')
      loadFotos()
    } else {
      toast.error('Error al eliminar')
    }
    setDeleting(null)
  }

  function closeModal() {
    setShowModal(false)
    setFile(null)
    setPreview(null)
    setCategoria('General')
    setDescripcion('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-beauty-text">Galería</h2>
          <p className="text-gray-500 text-sm">{fotos.length} fotos publicadas en el sitio web</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="btn-beauty text-sm py-2"
        >
          <Plus size={16} /> Subir foto
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Grid fotos */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="aspect-square bg-beauty-rosa-claro/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-beauty-primary/40 rounded-2xl p-16 text-center cursor-pointer hover:border-beauty-primary hover:bg-beauty-rosa-claro/10 transition-all"
        >
          <ImageIcon size={40} className="mx-auto text-beauty-primary/40 mb-3" />
          <p className="font-semibold text-beauty-text-muted">No hay fotos aún</p>
          <p className="text-sm text-beauty-text-muted mt-1">Haz clic para subir la primera foto</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Card agregar */}
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-beauty-primary/40 flex flex-col items-center justify-center gap-2 hover:border-beauty-primary hover:bg-beauty-rosa-claro/10 transition-all group"
          >
            <Upload size={24} className="text-beauty-primary/50 group-hover:text-beauty-primary transition-colors" />
            <span className="text-xs text-beauty-text-muted group-hover:text-beauty-primary transition-colors font-medium">Agregar foto</span>
          </button>

          {fotos.map(foto => (
            <div key={foto.id} className="relative aspect-square rounded-2xl overflow-hidden group shadow-card">
              <Image
                src={foto.url}
                alt={foto.descripcion || foto.categoria}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex flex-col justify-between p-3">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                  <button
                    onClick={() => handleDelete(foto)}
                    disabled={deleting === foto.id}
                    className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors shadow-lg"
                  >
                    {deleting === foto.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded-lg">
                    {foto.categoria}
                  </span>
                  {foto.descripcion && (
                    <p className="text-[10px] text-white/80 mt-1 truncate">{foto.descripcion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal subir foto */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-beauty-text">Subir foto a la galería</h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Preview */}
              {preview && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                  <Image src={preview} alt="Preview" fill className="object-contain" />
                </div>
              )}

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="input-beauty"
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Ej: Diseño de uñas en gel..."
                  className="input-beauty"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 border-2 border-gray-200 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 btn-beauty justify-center py-3 disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
                ) : (
                  <><Upload size={16} /> Publicar foto</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
