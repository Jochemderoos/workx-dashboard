'use client'

import { useRef, useState, useEffect } from 'react'

/**
 * Official Workx logo rendered from the logo PDF via PDF.js.
 * Transparent background (white pixels removed).
 * Use this EVERYWHERE instead of /workx-logo.png.
 */
export default function WorkxLogo({ height = 56, className = '' }: { height?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const response = await fetch('/workx-logo.pdf')
        if (!response.ok || cancelled) return
        const data = await response.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data }).promise
        const page = await pdf.getPage(1)
        // Scale based on desired height
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = (height * 2) / baseViewport.height // 2x for retina
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        // Remove white/light pixels for transparency
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imgData.data
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 190 && pixels[i + 1] > 190 && pixels[i + 2] > 170) pixels[i + 3] = 0
        }
        ctx.putImageData(imgData, 0, 0)
        if (!cancelled) setLoaded(true)
      } catch { /* fallback: canvas stays hidden */ }
    }
    render()
    return () => { cancelled = true }
  }, [height])

  return (
    <canvas
      ref={canvasRef}
      className={`transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      style={{ height, width: 'auto', imageRendering: 'auto' }}
    />
  )
}
