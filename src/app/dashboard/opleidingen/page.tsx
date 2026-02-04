'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'

interface TrainingSession {
  id: string
  title: string
  speaker: string
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  description: string | null
  points: number
  createdBy: { id: string; name: string }
}

interface Certificate {
  id: string
  trainingName: string
  provider: string | null
  completedDate: string
  points: number
  certificateUrl: string | null
  note: string | null
}

interface PointsSummary {
  year: number
  certificates: Certificate[]
  totalPoints: number
  requiredPoints: number
  remainingPoints: number
  isComplete: boolean
}

export default function OpleidingenPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'workx' | 'certificaten'>('workx')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Training sessions state
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({
    title: '',
    speaker: '',
    date: null as Date | null,
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    points: 1,
  })

  // Certificates state
  const [pointsSummary, setPointsSummary] = useState<PointsSummary | null>(null)
  const [showCertificateForm, setShowCertificateForm] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [certificateForm, setCertificateForm] = useState({
    trainingName: '',
    provider: '',
    completedDate: null as Date | null,
    points: 1,
    note: '',
  })
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Certificate selection state for bulk print
  const [selectedCertificates, setSelectedCertificates] = useState<Set<string>>(new Set())
  const [isPrintingBulk, setIsPrintingBulk] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

  useEffect(() => {
    if (activeTab === 'workx') {
      fetchSessions()
    } else {
      fetchCertificates()
    }
  }, [activeTab, selectedYear])

  const fetchSessions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/sessions?year=${selectedYear}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCertificates = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/certificates?year=${selectedYear}`)
      if (res.ok) {
        const data = await res.json()
        setPointsSummary(data)
      }
    } catch (error) {
      console.error('Error fetching certificates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSession = async () => {
    if (!sessionForm.title || !sessionForm.speaker || !sessionForm.date) {
      toast.error('Vul titel, spreker en datum in')
      return
    }

    try {
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          date: formatDateForAPI(sessionForm.date),
        }),
      })

      if (!res.ok) throw new Error('Failed to create session')

      toast.success('Opleidingssessie toegevoegd')
      setShowSessionForm(false)
      setSessionForm({
        title: '',
        speaker: '',
        date: null,
        startTime: '',
        endTime: '',
        location: '',
        description: '',
        points: 1,
      })
      fetchSessions()
    } catch (error) {
      toast.error('Kon sessie niet toevoegen')
    }
  }

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze sessie wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/training/sessions?id=${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete session')

      toast.success('Sessie verwijderd')
      fetchSessions()
    } catch (error) {
      toast.error('Kon sessie niet verwijderen')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setPreviewImage(base64)

      // Try OCR analysis
      setIsAnalyzing(true)
      try {
        const res = await fetch('/api/training/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        })

        const data = await res.json()

        if (data.success && data.data) {
          setCertificateForm({
            trainingName: data.data.trainingName || '',
            provider: data.data.provider || '',
            completedDate: data.data.completedDate ? new Date(data.data.completedDate) : null,
            points: data.data.points || 1,
            note: '',
          })
          toast.success('Certificaat geanalyseerd! Controleer de gegevens.')
        } else if (data.fallback) {
          toast('OCR niet beschikbaar - vul handmatig in', { icon: 'ℹ️' })
        }
      } catch (error) {
        console.error('OCR error:', error)
        toast('Kon certificaat niet analyseren - vul handmatig in', { icon: 'ℹ️' })
      } finally {
        setIsAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleCreateCertificate = async () => {
    if (!certificateForm.trainingName || !certificateForm.completedDate) {
      toast.error('Vul opleidingsnaam en datum in')
      return
    }

    setIsUploading(true)
    try {
      const res = await fetch('/api/training/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...certificateForm,
          completedDate: formatDateForAPI(certificateForm.completedDate),
          certificateUrl: previewImage, // Store base64 for now
        }),
      })

      if (!res.ok) throw new Error('Failed to create certificate')

      toast.success('Certificaat toegevoegd')
      setShowCertificateForm(false)
      setCertificateForm({
        trainingName: '',
        provider: '',
        completedDate: null,
        points: 1,
        note: '',
      })
      setPreviewImage(null)
      fetchCertificates()
    } catch (error) {
      toast.error('Kon certificaat niet toevoegen')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteCertificate = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit certificaat wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/training/certificates?id=${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete certificate')

      toast.success('Certificaat verwijderd')
      fetchCertificates()
    } catch (error) {
      toast.error('Kon certificaat niet verwijderen')
    }
  }

  const handlePrintOverview = () => {
    if (!pointsSummary || pointsSummary.certificates.length === 0) {
      toast.error('Geen certificaten om te printen')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Kon printvenster niet openen')
      return
    }

    const userName = session?.user?.name || 'Onbekend'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PO-punten Overzicht ${selectedYear} - ${userName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
          .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f9ff85; }
          .logo { font-size: 24px; font-weight: 600; margin-bottom: 5px; }
          .logo span { background: #f9ff85; padding: 2px 8px; border-radius: 4px; }
          .subtitle { color: #666; font-size: 12px; letter-spacing: 2px; }
          h1 { font-size: 20px; margin-top: 20px; }
          .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 32px; font-weight: 700; color: #333; }
          .summary-label { font-size: 12px; color: #666; margin-top: 4px; }
          .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; margin-top: 15px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #f9ff85, #c5e600); border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th { text-align: left; padding: 12px; background: #f5f5f5; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: none; }
          .points { text-align: right; font-weight: 600; }
          .total-row { background: #f9ff85; font-weight: 700; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 11px; }
          @media print {
            body { padding: 20px; }
            @page { margin: 20mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo"><span>Workx</span></div>
          <div class="subtitle">ADVOCATEN</div>
          <h1>PO-punten Overzicht ${selectedYear}</h1>
          <p style="color: #666; margin-top: 5px;">${userName}</p>
        </div>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${pointsSummary.totalPoints}</div>
              <div class="summary-label">Behaalde punten</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${pointsSummary.requiredPoints}</div>
              <div class="summary-label">Vereiste punten</div>
            </div>
            <div class="summary-item">
              <div class="summary-value" style="color: ${pointsSummary.isComplete ? '#22c55e' : '#f59e0b'}">
                ${pointsSummary.isComplete ? '✓' : pointsSummary.remainingPoints}
              </div>
              <div class="summary-label">${pointsSummary.isComplete ? 'Voldaan' : 'Nog te behalen'}</div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(100, (pointsSummary.totalPoints / pointsSummary.requiredPoints) * 100)}%"></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Opleiding</th>
              <th>Aanbieder</th>
              <th>Datum</th>
              <th class="points">Punten</th>
            </tr>
          </thead>
          <tbody>
            ${pointsSummary.certificates.map(cert => `
              <tr>
                <td>${cert.trainingName}</td>
                <td>${cert.provider || '-'}</td>
                <td>${new Date(cert.completedDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                <td class="points">${cert.points}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Totaal</strong></td>
              <td class="points"><strong>${pointsSummary.totalPoints}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p>Workx Advocaten - PO-punten Registratie</p>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handlePrintCertificate = (cert: Certificate) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Kon printvenster niet openen')
      return
    }

    const userName = session?.user?.name || 'Onbekend'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificaat - ${cert.trainingName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 60px; color: #333; }
          .certificate { max-width: 600px; margin: 0 auto; text-align: center; border: 3px solid #f9ff85; padding: 50px; border-radius: 12px; }
          .logo { font-size: 28px; font-weight: 600; margin-bottom: 5px; }
          .logo span { background: #f9ff85; padding: 4px 12px; border-radius: 6px; }
          .subtitle { color: #666; font-size: 10px; letter-spacing: 3px; margin-bottom: 40px; }
          h1 { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
          .training-name { font-size: 24px; font-weight: 700; margin-bottom: 30px; line-height: 1.3; }
          .name { font-size: 20px; font-weight: 600; margin-bottom: 5px; }
          .details { margin-top: 30px; padding-top: 30px; border-top: 1px solid #eee; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .detail-label { color: #666; }
          .detail-value { font-weight: 500; }
          .points-badge { display: inline-block; background: #f9ff85; padding: 10px 25px; border-radius: 50px; font-size: 18px; font-weight: 700; margin-top: 25px; }
          .footer { margin-top: 40px; color: #999; font-size: 11px; }
          ${cert.certificateUrl ? `
          .original-cert { margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; }
          .original-cert img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          ` : ''}
          @media print {
            body { padding: 20px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="logo"><span>Workx</span></div>
          <div class="subtitle">ADVOCATEN</div>

          <h1>Certificaat Permanente Opleiding</h1>
          <div class="training-name">${cert.trainingName}</div>

          <p style="color: #666; margin-bottom: 10px;">Dit certificeert dat</p>
          <div class="name">${userName}</div>
          <p style="color: #666;">deze opleiding heeft afgerond</p>

          <div class="details">
            ${cert.provider ? `
            <div class="detail-row">
              <span class="detail-label">Aanbieder</span>
              <span class="detail-value">${cert.provider}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Datum afgerond</span>
              <span class="detail-value">${new Date(cert.completedDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <div class="points-badge">${cert.points} PO-${cert.points === 1 ? 'punt' : 'punten'}</div>

          ${cert.certificateUrl ? `
          <div class="original-cert">
            <p style="color: #666; margin-bottom: 15px; font-size: 12px;">Origineel certificaat:</p>
            <img src="${cert.certificateUrl}" alt="Origineel certificaat" />
          </div>
          ` : ''}

          <div class="footer">
            <p>Workx Advocaten - PO-punten Registratie</p>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Toggle certificate selection
  const toggleCertificateSelection = (id: string) => {
    setSelectedCertificates(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select all certificates
  const selectAllCertificates = () => {
    if (pointsSummary) {
      setSelectedCertificates(new Set(pointsSummary.certificates.map(c => c.id)))
    }
  }

  // Clear selection
  const clearCertificateSelection = () => {
    setSelectedCertificates(new Set())
  }

  // Print multiple certificates as one PDF
  const handlePrintBulkCertificates = (certificatesToPrint: Certificate[]) => {
    if (certificatesToPrint.length === 0) {
      toast.error('Geen certificaten geselecteerd')
      return
    }

    setIsPrintingBulk(true)

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Kon printvenster niet openen')
      setIsPrintingBulk(false)
      return
    }

    const userName = session?.user?.name || 'Onbekend'

    // Generate HTML for all certificates
    const certificatesHtml = certificatesToPrint.map((cert, index) => `
      <div class="certificate ${index > 0 ? 'page-break' : ''}">
        <div class="certificate-inner">
          <div class="header">
            <div class="logo"><span>Workx</span></div>
            <div class="subtitle">ADVOCATEN</div>
          </div>
          <div class="badge">CERTIFICAAT</div>
          <div class="name">${userName}</div>
          <p class="label">heeft succesvol deelgenomen aan</p>
          <div class="training">${cert.trainingName}</div>
          ${cert.provider ? `<p class="provider">${cert.provider}</p>` : ''}
          <div class="details">
            <div class="detail">
              <div class="detail-value">${new Date(cert.completedDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div class="detail-label">Datum</div>
            </div>
            <div class="detail">
              <div class="detail-value">${cert.points}</div>
              <div class="detail-label">PO-punten</div>
            </div>
          </div>
          ${cert.certificateUrl ? `
          <div class="original">
            <p style="color: #666; margin-bottom: 15px; font-size: 12px;">Origineel certificaat:</p>
            <img src="${cert.certificateUrl}" alt="Origineel certificaat" />
          </div>
          ` : ''}
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificaten - ${userName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
          .certificate { padding: 40px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .certificate-inner { max-width: 600px; width: 100%; text-align: center; border: 3px solid #f9ff85; padding: 50px; border-radius: 12px; background: white; }
          .page-break { page-break-before: always; }
          .header { margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 600; margin-bottom: 5px; }
          .logo span { background: #f9ff85; padding: 2px 10px; border-radius: 4px; }
          .subtitle { color: #666; font-size: 11px; letter-spacing: 3px; }
          .badge { display: inline-block; background: linear-gradient(135deg, #f9ff85, #e8f060); padding: 8px 24px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 3px; margin: 30px 0 20px; }
          .name { font-size: 28px; font-weight: 700; margin: 20px 0 10px; }
          .label { color: #666; margin-bottom: 15px; }
          .training { font-size: 20px; font-weight: 600; color: #333; margin: 15px 0; }
          .provider { color: #666; margin-bottom: 30px; }
          .details { display: flex; justify-content: center; gap: 60px; margin: 30px 0; }
          .detail { text-align: center; }
          .detail-value { font-size: 18px; font-weight: 600; }
          .detail-label { font-size: 11px; color: #999; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
          .original { margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; }
          .original img { max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .certificate { padding: 20px; min-height: auto; }
            .certificate-inner { border: 2px solid #f9ff85; padding: 30px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${certificatesHtml}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
    setIsPrintingBulk(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Opleidingen</h1>
          <p className="text-gray-400 text-sm mt-1">Beheer opleidingen en certificaten</p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedYear === year
                  ? 'bg-workx-lime text-workx-dark font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveTab('workx')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'workx'
              ? 'bg-workx-lime text-workx-dark font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icons.users size={16} />
            Workx Opleiding
          </div>
        </button>
        <button
          onClick={() => setActiveTab('certificaten')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'certificaten'
              ? 'bg-workx-lime text-workx-dark font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icons.file size={16} />
            Mijn Certificaten
          </div>
        </button>
      </div>

      {/* WORKX OPLEIDING TAB */}
      {activeTab === 'workx' && (
        <div className="space-y-4">
          {/* Add session button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSessionForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Icons.plus size={16} />
              Sessie toevoegen
            </button>
          </div>

          {/* Session form */}
          {showSessionForm && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Nieuwe opleidingssessie</h3>
                <button
                  onClick={() => setShowSessionForm(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  <Icons.x size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Onderwerp *</label>
                  <input
                    type="text"
                    value={sessionForm.title}
                    onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                    className="input-field"
                    placeholder="Bijv. Actualiteiten Arbeidsrecht"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Spreker *</label>
                  <input
                    type="text"
                    value={sessionForm.speaker}
                    onChange={(e) => setSessionForm({ ...sessionForm, speaker: e.target.value })}
                    className="input-field"
                    placeholder="Naam van de spreker"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Datum *</label>
                  <DatePicker
                    selected={sessionForm.date}
                    onChange={(date) => setSessionForm({ ...sessionForm, date })}
                    placeholder="Selecteer datum..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Starttijd</label>
                    <input
                      type="time"
                      value={sessionForm.startTime}
                      onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Eindtijd</label>
                    <input
                      type="time"
                      value={sessionForm.endTime}
                      onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Locatie</label>
                  <input
                    type="text"
                    value={sessionForm.location}
                    onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                    className="input-field"
                    placeholder="Bijv. Kantoor Amsterdam"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">PO-punten</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={sessionForm.points || ''}
                    onChange={(e) => setSessionForm({ ...sessionForm, points: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Beschrijving</label>
                <textarea
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="Optionele beschrijving..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSessionForm(false)}
                  className="btn-secondary"
                >
                  Annuleren
                </button>
                <button onClick={handleCreateSession} className="btn-primary">
                  Toevoegen
                </button>
              </div>
            </div>
          )}

          {/* Sessions list */}
          {isLoading ? (
            <div className="card p-8 text-center">
              <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin mx-auto" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="card p-8 text-center">
              <Icons.calendar className="mx-auto text-gray-600 mb-3" size={40} />
              <p className="text-gray-400">Geen opleidingssessies in {selectedYear}</p>
              <p className="text-gray-500 text-sm mt-1">Voeg een nieuwe sessie toe om te beginnen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="card p-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Icons.presentation className="text-blue-400" size={20} />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{session.title}</h3>
                        <p className="text-sm text-gray-400 mt-0.5">
                          <span className="text-workx-lime">{session.speaker}</span>
                          {session.location && ` • ${session.location}`}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Icons.calendar size={12} />
                            {new Date(session.date).toLocaleDateString('nl-NL', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </span>
                          {session.startTime && (
                            <span className="flex items-center gap-1">
                              <Icons.clock size={12} />
                              {session.startTime}
                              {session.endTime && ` - ${session.endTime}`}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-workx-lime/10 text-workx-lime rounded">
                            {session.points} {session.points === 1 ? 'punt' : 'punten'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Icons.trash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CERTIFICATEN TAB */}
      {activeTab === 'certificaten' && (
        <div className="space-y-4">
          {/* Points progress */}
          {pointsSummary && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white">PO-punten {selectedYear}</h3>
                  <p className="text-sm text-gray-400">
                    {pointsSummary.isComplete ? (
                      <span className="text-green-400">✓ Voldaan aan jaarlijkse verplichting</span>
                    ) : (
                      <span>Nog {pointsSummary.remainingPoints} punten nodig</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-workx-lime">{pointsSummary.totalPoints}</p>
                  <p className="text-sm text-gray-400">van {pointsSummary.requiredPoints} punten</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pointsSummary.isComplete
                      ? 'bg-gradient-to-r from-green-400 to-green-500'
                      : 'bg-gradient-to-r from-workx-lime to-yellow-400'
                  }`}
                  style={{
                    width: `${Math.min(100, (pointsSummary.totalPoints / pointsSummary.requiredPoints) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Selection controls - left side */}
            {pointsSummary && pointsSummary.certificates.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedCertificates.size === pointsSummary.certificates.length ? clearCertificateSelection : selectAllCertificates}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {selectedCertificates.size === pointsSummary.certificates.length ? 'Niets selecteren' : 'Alles selecteren'}
                </button>
                {selectedCertificates.size > 0 && (
                  <span className="text-xs text-gray-500">
                    {selectedCertificates.size} geselecteerd
                  </span>
                )}
              </div>
            )}

            {/* Action buttons - right side */}
            <div className="flex gap-2 ml-auto">
              {/* Print selected */}
              {selectedCertificates.size > 0 && pointsSummary && (
                <button
                  onClick={() => {
                    const selected = pointsSummary.certificates.filter(c => selectedCertificates.has(c.id))
                    handlePrintBulkCertificates(selected)
                  }}
                  disabled={isPrintingBulk}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Icons.download size={16} />
                  Print selectie ({selectedCertificates.size})
                </button>
              )}
              {/* Print all certificates */}
              {pointsSummary && pointsSummary.certificates.length > 0 && selectedCertificates.size === 0 && (
                <>
                  <button
                    onClick={() => handlePrintBulkCertificates(pointsSummary.certificates)}
                    disabled={isPrintingBulk}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Icons.download size={16} />
                    Alle certificaten
                  </button>
                  <button
                    onClick={handlePrintOverview}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Icons.file size={16} />
                    Overzicht
                  </button>
                </>
              )}
              <button
                onClick={() => setShowCertificateForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Icons.plus size={16} />
                Certificaat toevoegen
              </button>
            </div>
          </div>

          {/* Certificate form */}
          {showCertificateForm && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Nieuw certificaat</h3>
                <button
                  onClick={() => {
                    setShowCertificateForm(false)
                    setPreviewImage(null)
                    setCertificateForm({
                      trainingName: '',
                      provider: '',
                      completedDate: null,
                      points: 1,
                      note: '',
                    })
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  <Icons.x size={18} />
                </button>
              </div>

              {/* File upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  previewImage
                    ? 'border-workx-lime/50 bg-workx-lime/5'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {isAnalyzing ? (
                  <div>
                    <div className="w-10 h-10 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400">Certificaat wordt geanalyseerd...</p>
                  </div>
                ) : previewImage ? (
                  <div>
                    <img
                      src={previewImage}
                      alt="Certificate preview"
                      className="max-h-32 mx-auto rounded-lg mb-3"
                    />
                    <p className="text-sm text-gray-400">Klik om een ander bestand te selecteren</p>
                  </div>
                ) : (
                  <div>
                    <Icons.upload className="mx-auto text-gray-500 mb-3" size={32} />
                    <p className="text-gray-400">Klik om certificaat te uploaden</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Het certificaat wordt automatisch geanalyseerd
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Opleiding *</label>
                  <input
                    type="text"
                    value={certificateForm.trainingName}
                    onChange={(e) => setCertificateForm({ ...certificateForm, trainingName: e.target.value })}
                    className="input-field"
                    placeholder="Naam van de opleiding"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Aanbieder</label>
                  <input
                    type="text"
                    value={certificateForm.provider}
                    onChange={(e) => setCertificateForm({ ...certificateForm, provider: e.target.value })}
                    className="input-field"
                    placeholder="Opleidingsinstituut"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Datum afgerond *</label>
                  <DatePicker
                    selected={certificateForm.completedDate}
                    onChange={(date) => setCertificateForm({ ...certificateForm, completedDate: date })}
                    placeholder="Selecteer datum..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">PO-punten *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={certificateForm.points || ''}
                    onChange={(e) => setCertificateForm({ ...certificateForm, points: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notitie</label>
                <input
                  type="text"
                  value={certificateForm.note}
                  onChange={(e) => setCertificateForm({ ...certificateForm, note: e.target.value })}
                  className="input-field"
                  placeholder="Optionele notitie..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCertificateForm(false)
                    setPreviewImage(null)
                  }}
                  className="btn-secondary"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreateCertificate}
                  disabled={isUploading}
                  className="btn-primary flex items-center gap-2"
                >
                  {isUploading ? (
                    <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                  ) : (
                    <Icons.check size={16} />
                  )}
                  Opslaan
                </button>
              </div>
            </div>
          )}

          {/* Certificates list */}
          {isLoading ? (
            <div className="card p-8 text-center">
              <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin mx-auto" />
            </div>
          ) : !pointsSummary || pointsSummary.certificates.length === 0 ? (
            <div className="card p-8 text-center">
              <Icons.file className="mx-auto text-gray-600 mb-3" size={40} />
              <p className="text-gray-400">Geen certificaten in {selectedYear}</p>
              <p className="text-gray-500 text-sm mt-1">Upload je eerste certificaat om te beginnen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pointsSummary.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className={`card p-4 transition-colors group cursor-pointer ${
                    selectedCertificates.has(cert.id)
                      ? 'bg-workx-lime/5 border-workx-lime/30'
                      : 'hover:bg-white/[0.02]'
                  }`}
                  onClick={() => toggleCertificateSelection(cert.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 mt-1 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedCertificates.has(cert.id)
                            ? 'bg-workx-lime'
                            : 'border-2 border-white/20 group-hover:border-white/40'
                        }`}
                      >
                        {selectedCertificates.has(cert.id) && (
                          <Icons.check size={12} className="text-workx-dark" />
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                        <Icons.award className="text-green-400" size={20} />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{cert.trainingName}</h3>
                        {cert.provider && (
                          <p className="text-sm text-gray-400">{cert.provider}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Icons.calendar size={12} />
                            {new Date(cert.completedDate).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded">
                            {cert.points} {cert.points === 1 ? 'punt' : 'punten'}
                          </span>
                        </div>
                        {cert.note && (
                          <p className="text-xs text-gray-500 mt-2">{cert.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePrintCertificate(cert)
                        }}
                        className="p-2 text-gray-500 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-colors"
                        title="Exporteer naar PDF"
                      >
                        <Icons.download size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCertificate(cert.id)
                        }}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Verwijderen"
                      >
                        <Icons.trash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
