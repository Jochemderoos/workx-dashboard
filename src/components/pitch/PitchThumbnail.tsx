'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PitchThumbnailProps {
  pageNumber: number
  language?: 'nl' | 'en'
  width?: number
  label?: string
  type?: 'intro' | 'cv' | 'bijlage'
  showLogo?: boolean
  logoPosition?: { x: number; y: number }
  logoSize?: number // percentage, default 100
  onClick?: () => void
}

export default function PitchThumbnail({
  pageNumber,
  language = 'nl',
  width = 150,
  label,
  type = 'intro',
  showLogo = false,
  logoPosition,
  logoSize = 100,
  onClick,
}: PitchThumbnailProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const pdfUrl = `/api/pitch/preview?language=${language}`

  const typeColors = {
    intro: { bg: 'bg-blue-600/80', border: 'border-blue-500/50' },
    cv: { bg: 'bg-green-600/80', border: 'border-green-500/50' },
    bijlage: { bg: 'bg-purple-600/80', border: 'border-purple-500/50' },
  }

  const colors = typeColors[type]

  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-md cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${colors.border} border-2`}
      onClick={onClick}
      style={{ width }}
    >
      <Document
        file={pdfUrl}
        loading={null}
        error={null}
        onLoadSuccess={() => setLoading(false)}
        onLoadError={() => {
          setLoading(false)
          setError(true)
        }}
      >
        {!error && (
          <Page
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={
              <div
                className="bg-gray-800 animate-pulse flex items-center justify-center"
                style={{ width, height: width * 0.707 }}
              >
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            }
          />
        )}
      </Document>

      {error && (
        <div
          className="bg-gray-800 flex items-center justify-center"
          style={{ width, height: width * 0.707 }}
        >
          <span className="text-gray-500 text-xs">Laden mislukt</span>
        </div>
      )}

      {/* Logo overlay indicator */}
      {showLogo && logoPosition && pageNumber === 1 && (
        <div
          className="absolute border-2 border-dashed border-orange-400 bg-orange-400/20 rounded flex items-center justify-center"
          style={{
            left: `${(logoPosition.x / 210) * 100}%`,
            top: `${(logoPosition.y / 148) * 100}%`,
            width: `${(50 * logoSize / 100 / 210) * 100}%`,
            height: `${(30 * logoSize / 100 / 148) * 100}%`,
          }}
        >
          <span className="text-[6px] text-orange-300 font-medium">LOGO</span>
        </div>
      )}

      {/* Label */}
      {label && (
        <div className={`absolute bottom-0 left-0 right-0 ${colors.bg} p-1`}>
          <p className="text-[8px] text-white text-center truncate font-medium">{label}</p>
        </div>
      )}

      {/* Page number badge */}
      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
        <span className="text-[9px] text-white font-medium">{pageNumber}</span>
      </div>
    </div>
  )
}
