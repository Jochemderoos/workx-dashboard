'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface Task {
  id: string
  title: string
  dueDate: string | null
}

function isTodayOrOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() <= today.getTime()
}

export default function TodayTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/personal-tasks')
      if (res.ok) setTasks(await res.json())
    } catch {
      /* silent */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const todayTasks = tasks.filter(t => isTodayOrOverdue(t.dueDate))

  const completeTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    try { await fetch(`/api/personal-tasks/${id}`, { method: 'DELETE' }) } catch { fetchTasks() }
  }

  if (!loaded) return null

  return (
    <div className="rounded-2xl border border-workx-lime/20 bg-gradient-to-br from-workx-lime/10 via-workx-lime/5 to-transparent p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-workx-lime/20 flex items-center justify-center">
            <Icons.check size={14} className="text-workx-lime" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Mijn taken vandaag</h3>
            <p className="text-[10px] text-gray-500">
              {todayTasks.length === 0 ? 'Lekker leeg' : `${todayTasks.length} ${todayTasks.length === 1 ? 'taak' : 'taken'} te doen`}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/eigen-taken"
          className="text-[11px] text-workx-lime hover:underline flex items-center gap-1"
        >
          Alles <Icons.chevronDown size={10} className="-rotate-90" />
        </Link>
      </div>

      {todayTasks.length === 0 ? (
        <Link
          href="/dashboard/eigen-taken"
          className="block text-center py-3 text-xs text-gray-500 hover:text-workx-lime border border-dashed border-white/10 rounded-lg transition-colors"
        >
          + Voeg een taak toe
        </Link>
      ) : (
        <div className="space-y-1">
          {todayTasks.slice(0, 5).map(t => (
            <div key={t.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
              <button
                onClick={() => completeTask(t.id)}
                className="w-4 h-4 rounded border border-white/20 hover:border-workx-lime hover:bg-workx-lime/10 flex items-center justify-center shrink-0"
                title="Klaar"
              >
                <Icons.check size={9} className="text-transparent group-hover:text-workx-lime" />
              </button>
              <span className="text-xs text-white flex-1 truncate">{t.title}</span>
            </div>
          ))}
          {todayTasks.length > 5 && (
            <Link
              href="/dashboard/eigen-taken"
              className="block text-[10px] text-gray-500 hover:text-workx-lime text-center pt-1"
            >
              + {todayTasks.length - 5} meer
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
