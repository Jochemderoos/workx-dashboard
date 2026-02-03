'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Icons } from '@/components/ui/Icons'

interface TextOverlay {
  id: string
  pageNumber: number
  x: number  // mm from left
  y: number  // mm from top
  text: string
  fontSize: number
  color: string
  whiteout?: {
    width: number
    height: number
    padding?: number
  }
}

interface ImageOverlay {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  imageData: string
  imageType: 'png' | 'jpg'
  whiteout?: boolean
  previewUrl?: string
}

interface PdfEditorProps {
  pdfUrl: string
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  textOverlays: TextOverlay[]
  imageOverlays: ImageOverlay[]
  onAddTextOverlay: (overlay: Omit<TextOverlay, 'id'>) => void
  onUpdateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void
  onDeleteTextOverlay: (id: string) => void
  onUpdateImageOverlay: (id: string, updates: Partial<ImageOverlay>) => void
  onDeleteImageOverlay: (id: string) => void
  editMode: 'view' | 'text' | 'whiteout'
  onClose?: () => void
}

// A4 dimensions in mm
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

export default function PdfEditor({
  pdfUrl,
  currentPage,
  totalPages,
  onPageChange,
  textOverlays,
  imageOverlays,
  onAddTextOverlay,
  onUpdateTextOverlay,
  onDeleteTextOverlay,
  onUpdateImageOverlay,
  onDeleteImageOverlay,
  editMode,
  onClose,
}: PdfEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<string | null>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  // Calculate scale factor between display size and A4 mm
  const scale = containerSize.width / A4_WIDTH_MM

  // Get overlays for current page
  const currentTextOverlays = textOverlays.filter(o => o.pageNumber === currentPage)
  const currentImageOverlays = imageOverlays.filter(o => o.pageNumber === currentPage)

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Maintain A4 aspect ratio
        const maxWidth = rect.width
        const maxHeight = rect.height
        const a4Ratio = A4_WIDTH_MM / A4_HEIGHT_MM

        let width = maxWidth
        let height = width / a4Ratio

        if (height > maxHeight) {
          height = maxHeight
          width = height * a4Ratio
        }

        setContainerSize({ width, height })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Handle click on PDF to add text
  const handlePdfClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode === 'view') return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Convert pixels to mm
    const xMm = Math.round(x / scale)
    const yMm = Math.round(y / scale)

    if (editMode === 'text') {
      onAddTextOverlay({
        pageNumber: currentPage,
        x: xMm,
        y: yMm,
        text: 'Nieuwe tekst',
        fontSize: 12,
        color: '#000000',
      })
    } else if (editMode === 'whiteout') {
      onAddTextOverlay({
        pageNumber: currentPage,
        x: xMm,
        y: yMm,
        text: 'Nieuwe tekst',
        fontSize: 12,
        color: '#000000',
        whiteout: { width: 40, height: 6, padding: 1 },
      })
    }
  }, [editMode, currentPage, scale, onAddTextOverlay])

  // Handle drag for repositioning overlays
  const handleOverlayDrag = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedOverlay(id)

    const startX = e.clientX
    const startY = e.clientY
    const overlay = textOverlays.find(o => o.id === id)
    if (!overlay) return

    const startPosX = overlay.x
    const startPosY = overlay.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale

      onUpdateTextOverlay(id, {
        x: Math.max(0, Math.min(A4_WIDTH_MM, Math.round(startPosX + dx))),
        y: Math.max(0, Math.min(A4_HEIGHT_MM, Math.round(startPosY + dy))),
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [textOverlays, scale, onUpdateTextOverlay])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-workx-gray border-b border-white/10">
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <Icons.chevronLeft size={18} />
          </button>
          <span className="text-sm text-white min-w-[80px] text-center">
            Pagina {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <Icons.chevronRight size={18} />
          </button>
        </div>

        {/* Edit mode indicator */}
        <div className="flex items-center gap-2">
          {editMode === 'text' && (
            <span className="px-3 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
              Klik om tekst toe te voegen
            </span>
          )}
          {editMode === 'whiteout' && (
            <span className="px-3 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">
              Klik om tekst te bewerken (whiteout)
            </span>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icons.x size={18} />
          </button>
        )}
      </div>

      {/* PDF viewer with overlay */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 bg-gray-800 overflow-hidden"
      >
        <div
          className="relative bg-white shadow-2xl"
          style={{
            width: containerSize.width,
            height: containerSize.height,
          }}
        >
          {/* PDF display using object tag */}
          <object
            data={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
            type="application/pdf"
            className="absolute inset-0 w-full h-full"
            onLoad={() => setPdfLoaded(true)}
            onError={() => setPdfError(true)}
          >
            {/* Fallback: iframe */}
            <iframe
              src={`${pdfUrl}#page=${currentPage}&toolbar=0`}
              className="absolute inset-0 w-full h-full border-0"
              title="PDF Preview"
            />
          </object>

          {/* Clickable overlay for adding elements */}
          <div
            className={`absolute inset-0 ${editMode !== 'view' ? 'cursor-crosshair' : ''}`}
            onClick={handlePdfClick}
          >
            {/* Render text overlays */}
            {currentTextOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className={`absolute group ${selectedOverlay === overlay.id ? 'z-20' : 'z-10'}`}
                style={{
                  left: overlay.x * scale,
                  top: overlay.y * scale,
                }}
              >
                {/* Whiteout background */}
                {overlay.whiteout && (
                  <div
                    className="absolute bg-white border border-dashed border-amber-400"
                    style={{
                      left: -(overlay.whiteout.padding || 1) * scale,
                      top: -(overlay.whiteout.padding || 1) * scale,
                      width: (overlay.whiteout.width + (overlay.whiteout.padding || 1) * 2) * scale,
                      height: (overlay.whiteout.height + (overlay.whiteout.padding || 1) * 2) * scale,
                    }}
                  />
                )}

                {/* Text element */}
                <div
                  className={`relative cursor-move select-none ${
                    selectedOverlay === overlay.id
                      ? 'ring-2 ring-workx-lime ring-offset-1'
                      : 'hover:ring-2 hover:ring-blue-400'
                  }`}
                  style={{
                    fontSize: overlay.fontSize * scale * 0.75, // Approximate scaling
                    color: overlay.color,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseDown={(e) => handleOverlayDrag(overlay.id, e)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedOverlay(overlay.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditingText(overlay.id)
                  }}
                >
                  {editingText === overlay.id ? (
                    <input
                      type="text"
                      value={overlay.text}
                      onChange={(e) => onUpdateTextOverlay(overlay.id, { text: e.target.value })}
                      onBlur={() => setEditingText(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingText(null)
                      }}
                      className="bg-white border border-workx-lime px-1 outline-none"
                      style={{ fontSize: 'inherit', color: 'inherit' }}
                      autoFocus
                    />
                  ) : (
                    overlay.text
                  )}
                </div>

                {/* Delete button */}
                <button
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize: 10 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteTextOverlay(overlay.id)
                  }}
                >
                  <Icons.x size={10} />
                </button>
              </div>
            ))}

            {/* Render image overlays */}
            {currentImageOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="absolute group z-10"
                style={{
                  left: overlay.x * scale,
                  top: overlay.y * scale,
                  width: overlay.width * scale,
                  height: overlay.height * scale,
                }}
              >
                {overlay.whiteout && (
                  <div className="absolute inset-0 bg-white" />
                )}
                {overlay.previewUrl && (
                  <img
                    src={overlay.previewUrl}
                    alt=""
                    className="w-full h-full object-cover border-2 border-dashed border-green-400"
                  />
                )}
                {/* Delete button */}
                <button
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteImageOverlay(overlay.id)
                  }}
                >
                  <Icons.x size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected overlay editor */}
      {selectedOverlay && (
        <div className="p-3 bg-workx-gray border-t border-white/10">
          {(() => {
            const overlay = textOverlays.find(o => o.id === selectedOverlay)
            if (!overlay) return null

            return (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Tekst:</label>
                  <input
                    type="text"
                    value={overlay.text}
                    onChange={(e) => onUpdateTextOverlay(overlay.id, { text: e.target.value })}
                    className="input-field text-sm w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Grootte:</label>
                  <input
                    type="number"
                    value={overlay.fontSize}
                    onChange={(e) => onUpdateTextOverlay(overlay.id, { fontSize: parseInt(e.target.value) || 12 })}
                    min={8}
                    max={72}
                    className="input-field text-sm w-16"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Kleur:</label>
                  <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => onUpdateTextOverlay(overlay.id, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">X:</label>
                  <input
                    type="number"
                    value={overlay.x}
                    onChange={(e) => onUpdateTextOverlay(overlay.id, { x: parseInt(e.target.value) || 0 })}
                    className="input-field text-sm w-16"
                  />
                  <label className="text-xs text-gray-400">Y:</label>
                  <input
                    type="number"
                    value={overlay.y}
                    onChange={(e) => onUpdateTextOverlay(overlay.id, { y: parseInt(e.target.value) || 0 })}
                    className="input-field text-sm w-16"
                  />
                </div>
                {overlay.whiteout && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-amber-400">Whiteout B:</label>
                      <input
                        type="number"
                        value={overlay.whiteout.width}
                        onChange={(e) => onUpdateTextOverlay(overlay.id, {
                          whiteout: { ...overlay.whiteout!, width: parseInt(e.target.value) || 40 }
                        })}
                        className="input-field text-sm w-16"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-amber-400">H:</label>
                      <input
                        type="number"
                        value={overlay.whiteout.height}
                        onChange={(e) => onUpdateTextOverlay(overlay.id, {
                          whiteout: { ...overlay.whiteout!, height: parseInt(e.target.value) || 6 }
                        })}
                        className="input-field text-sm w-16"
                      />
                    </div>
                  </>
                )}
                <button
                  onClick={() => {
                    if (overlay.whiteout) {
                      onUpdateTextOverlay(overlay.id, { whiteout: undefined })
                    } else {
                      onUpdateTextOverlay(overlay.id, { whiteout: { width: 40, height: 6, padding: 1 } })
                    }
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    overlay.whiteout
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {overlay.whiteout ? 'Whiteout uit' : 'Whiteout aan'}
                </button>
                <button
                  onClick={() => {
                    onDeleteTextOverlay(overlay.id)
                    setSelectedOverlay(null)
                  }}
                  className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                >
                  Verwijderen
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {/* Instructions */}
      <div className="p-2 bg-workx-dark border-t border-white/10 text-center">
        <p className="text-xs text-gray-500">
          {editMode === 'view' && 'Kies een bewerkingsmodus om tekst toe te voegen'}
          {editMode === 'text' && 'Klik ergens op de PDF om tekst toe te voegen. Sleep om te verplaatsen. Dubbelklik om te bewerken.'}
          {editMode === 'whiteout' && 'Klik om tekst met whiteout achtergrond toe te voegen (voor het bewerken van bestaande tekst)'}
        </p>
      </div>
    </div>
  )
}
