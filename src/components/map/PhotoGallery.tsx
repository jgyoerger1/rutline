import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, CaretLeft, CaretRight, Images, Trash, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { addPhotos, db, deletePhoto } from '../../lib/db'
import { fmtDateTime } from '../../lib/format'
import type { Photo } from '../../lib/types'
import { useApp } from '../AppContext'
import { Button, Input, SectionLabel } from '../ui'

function useObjectUrls(blobs: Array<{ id: number; blob: Blob }>): Map<number, string> {
  const [urls, setUrls] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    const next = new Map<number, string>()
    for (const b of blobs) next.set(b.id, URL.createObjectURL(b.blob))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
  }, [blobs])
  return urls
}

export default function PhotoGallery({ waypointId }: { waypointId: number }) {
  const { toast } = useApp()
  const photos = useLiveQuery(() => db.photos.where('waypointId').equals(waypointId).reverse().sortBy('takenAt'), [waypointId])
  const thumbs = useMemo(() => (photos ?? []).map((p) => ({ id: p.id!, blob: p.thumb })), [photos])
  const urls = useObjectUrls(thumbs)
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const camRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const n = await addPhotos(waypointId, files)
      toast(n === 1 ? 'Photo added' : `${n} photos added`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photos')
    } finally {
      setBusy(false)
      if (camRef.current) camRef.current.value = ''
      if (libRef.current) libRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Photos{photos?.length ? ` · ${photos.length}` : ''}</SectionLabel>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => camRef.current?.click()} disabled={busy}>
            <Camera size={16} /> Camera
          </Button>
          <Button size="sm" variant="ghost" onClick={() => libRef.current?.click()} disabled={busy}>
            <Images size={16} /> Library
          </Button>
        </div>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <input ref={libRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />

      {busy && <div className="skeleton h-24 mb-2" />}
      {photos && photos.length === 0 && !busy && (
        <button onClick={() => libRef.current?.click()} className="push w-full rounded-2xl border border-dashed border-bone-50/12 px-4 py-6 text-center text-[13px] text-bone-400 hover:border-bone-50/25 transition-colors">
          <Images size={22} className="mx-auto mb-2 text-bone-600" />
          Add trail-cam pulls or a shot of the setup. Capture dates come from the photo.
        </button>
      )}
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setOpen(i)} className="push relative aspect-square rounded-lg overflow-hidden bg-pine-800 border border-bone-50/6">
              {urls.get(p.id!) && <img src={urls.get(p.id!)} alt={p.caption || 'Photo'} className="w-full h-full object-cover" loading="lazy" />}
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>{open != null && photos && photos[open] && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  )
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = photos[index]
  const [url, setUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState(p.caption)
  const { toast } = useApp()
  useEffect(() => {
    const u = URL.createObjectURL(p.blob)
    setUrl(u)
    setCaption(p.caption)
    return () => URL.revokeObjectURL(u)
  }, [p])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onIndex])

  async function remove() {
    if (!confirm('Delete this photo?')) return
    await deletePhoto(p.id!)
    toast('Photo deleted')
    if (photos.length <= 1) onClose()
    else onIndex(Math.max(0, index - 1))
  }

  return (
    <motion.div className="fixed inset-0 z-[90] bg-pine-950/95 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true">
      <div className="flex items-center gap-2 px-4 pt-safe h-14 shrink-0">
        <div className="text-[12px] font-mono text-bone-400 tnum">
          {index + 1} / {photos.length} · {fmtDateTime(p.takenAt)}
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={remove} aria-label="Delete photo" className="push w-10 h-10 grid place-items-center rounded-lg text-bone-400 hover:text-ember-400">
            <Trash size={18} />
          </button>
          <button onClick={onClose} aria-label="Close" className="push w-10 h-10 grid place-items-center rounded-lg text-bone-400 hover:text-bone-50">
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2">
        {url && <motion.img key={p.id} src={url} alt={p.caption || 'Photo'} className="max-w-full max-h-full object-contain rounded-lg" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} />}
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} aria-label="Previous" className="push absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full glass">
            <CaretLeft size={20} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button onClick={() => onIndex(index + 1)} aria-label="Next" className="push absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full glass">
            <CaretRight size={20} />
          </button>
        )}
      </div>
      <div className="shrink-0 px-4 py-3 pb-safe">
        <Input
          value={caption}
          placeholder="Caption, like 'Big 8 at 6:42 am'"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption !== p.caption) void db.photos.update(p.id!, { caption })
          }}
        />
      </div>
    </motion.div>
  )
}
