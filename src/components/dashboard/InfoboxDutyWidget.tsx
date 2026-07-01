'use client'

// Homepage-widget: wie checkt deze week de infobox. Iedereen ziet wie het is;
// is het de ingelogde gebruiker, dan een opvallende "vergeet niet"-melding.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'

interface Assignee { name: string; userId: string | null }

export default function InfoboxDutyWidget() {
  const { data: session } = useSession()
  const [assignee, setAssignee] = useState<Assignee | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/infobox-week')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAssignee(d.assignee) })
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || !assignee) return null

  const isMe = !!session?.user?.id && assignee.userId === session.user.id
  const firstName = assignee.name.split(' ')[0]

  if (isMe) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Icons.mail className="text-amber-300" size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Jij checkt deze week de infobox</p>
          <p className="text-xs text-amber-200/80">Vergeet niet 'm vandaag even te checken.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icons.mail className="text-gray-300" size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">Infobox deze week: {firstName}</p>
        <p className="text-xs text-gray-400">{firstName} checkt deze week de infobox.</p>
      </div>
    </div>
  )
}
