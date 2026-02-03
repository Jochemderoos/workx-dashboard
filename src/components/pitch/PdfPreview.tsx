'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Icons } from '@/components/ui/Icons'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PdfPreviewProps {
  pdfUrl: string
  selectedPages: number[] // 1-indexed page numbers
  onClose?: () => void
}

export default function PdfPreview({ pdfUrl, selectedPages, onClose }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPreview, setSelectedPreview] = useState<number | null>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }

  const onDocumentLoadError = (err: Error) => {
    console.error('Error loading PDF:', err)
    setError('Kon PDF niet laden')
    setLoading(false)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icons.alertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (selectedPages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icons.file className="mx-auto mb-3 text-gray-600" size={32} />
          <p className="text-sm text-gray-400">Selecteer pagina's om preview te zien</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          Preview ({selectedPages.length} pagina's)
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icons.x size={16} />
          </button>
        )}
      </div>

      {/* Document loader (hidden) */}
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center py-12">
            <span className="w-6 h-6 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        {/* Thumbnail grid */}
        {!loading && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {selectedPages.map((pageNum, index) => (
              <button
                key={`${pageNum}-${index}`}
                onClick={() => setSelectedPreview(pageNum)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 bg-white ${
                  selectedPreview === pageNum
                    ? 'border-workx-lime ring-2 ring-workx-lime/30'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <Page
                  pageNumber={pageNum}
                  width={80}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center">
                  <span className="text-[10px] text-white">{index + 1}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Large preview modal */}
        {selectedPreview !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedPreview(null)}
          >
            <div
              className="relative max-w-3xl max-h-[90vh] overflow-auto bg-workx-gray rounded-2xl border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-workx-gray/95 backdrop-blur border-b border-white/10">
                <span className="text-sm text-white">
                  Pagina {selectedPages.indexOf(selectedPreview) + 1} van {selectedPages.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const currentIndex = selectedPages.indexOf(selectedPreview)
                      if (currentIndex > 0) {
                        setSelectedPreview(selectedPages[currentIndex - 1])
                      }
                    }}
                    disabled={selectedPages.indexOf(selectedPreview) === 0}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                  >
                    <Icons.chevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      const currentIndex = selectedPages.indexOf(selectedPreview)
                      if (currentIndex < selectedPages.length - 1) {
                        setSelectedPreview(selectedPages[currentIndex + 1])
                      }
                    }}
                    disabled={selectedPages.indexOf(selectedPreview) === selectedPages.length - 1}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                  >
                    <Icons.chevronRight size={18} />
                  </button>
                  <button
                    onClick={() => setSelectedPreview(null)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icons.x size={18} />
                  </button>
                </div>
              </div>

              {/* Page */}
              <div className="p-4 flex justify-center bg-gray-100">
                <Page
                  pageNumber={selectedPreview}
                  width={600}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            </div>
          </div>
        )}
      </Document>
    </div>
  )
}
