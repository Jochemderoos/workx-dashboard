'use client'

// Vast agendapunt in het partneroverleg: "Wie checkt deze week de Infobox?"
// Keuze uit de partners + Hanna. Slaat direct op voor de huidige week.

import { useEffect, useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import LabelDropdown from '@/components/ui/LabelDropdown'
import toast from 'react-hot-toast'

interface Person { id: string; name: string }

export default function InfoboxWeekCard() {
  const [eligible, setEligible] = useState<Person[]>([])
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/infobox-week')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setEligible(d.eligible || [])
          setAssigneeId(d.assignee?.userId || '')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (id: string) => {
    setAssigneeId(id)
    setSaving(true)
    try {
      const res = await fetch('/api/infobox-week', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assigneeId: id }),
      })
      if (!res.ok) throw new Error()
      toast.success(id ? 'Infobox-checker opgeslagen' : 'Toewijzing verwijderd')
    } catch {
      toast.error('Kon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 border border-amber-500/25">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Icons.mail className="text-amber-400" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Vast agendapunt</p>
          <h3 className="text-sm font-semibold text-white">Wie checkt deze week de Infobox?</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Diegene krijgt deze week dagelijks een melding op het dashboard en woensdagochtend een Slack-bericht.
          </p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Deze week:</span>
            {loading ? (
              <span className="text-sm text-gray-500">Laden…</span>
            ) : (
              <LabelDropdown
                value={assigneeId}
                onChange={save}
                size="md"
                tone="amber"
                options={[{ key: '', label: '— Niemand toegewezen —' }, ...eligible.map(p => ({ key: p.id, label: p.name }))]}
              />
            )}
            {saving && <span className="text-xs text-gray-500">Opslaan…</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
