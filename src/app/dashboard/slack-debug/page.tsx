'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'

interface ChannelInfo {
  id: string
  name: string
  isPrivate: boolean
  isMember: boolean
  memberCount?: number
}

interface StatusResponse {
  tokenSet: boolean
  cronSecretSet: boolean
  nextauthUrl: string | null
  auth: { ok: boolean; team?: string; bot?: string; error?: string } | null
  channels: ChannelInfo[]
}

interface TestResult {
  ok: boolean
  step?: string
  channel?: { id: string; name: string; isMember?: boolean }
  ts?: string
  error?: string
  availableNames?: string[]
  raw?: unknown
}

interface CronResult {
  ok: boolean
  status?: number
  durationMs?: number
  payload?: unknown
  error?: string
}

const CRON_LIST = [
  { path: '/api/cron/werkoverleg-reminder', label: 'Werkoverleg reminder', schedule: 'Maandag 09:00 NL', channel: 'workx-algemeen' },
  { path: '/api/cron/week-intake-reminder', label: 'Mijn werkweek reminder', schedule: 'Maandag 08:45 NL', channel: 'workx-algemeen' },
  { path: '/api/cron/partneroverleg-reminder', label: 'Partneroverleg reminder', schedule: 'Vrijdag 10:00 NL', channel: '#mt-groot (DM partners)' },
  { path: '/api/cron/daily-tip', label: 'Wist je dat? (daily tip)', schedule: 'Ma–Do 09:00 NL', channel: 'workx-algemeen' },
  { path: '/api/cron/birthday-alert', label: 'Verjaardag alert', schedule: 'Dagelijks 08:00 NL', channel: 'workx-algemeen' },
  { path: '/api/cron/onboarding-status', label: 'Onboarding status', schedule: 'Donderdag 09:00 NL', channel: 'mt-groot' },
  { path: '/api/cron/weekly-personal-digest', label: 'Wekelijkse persoonlijke digest', schedule: 'Maandag 09:00 NL', channel: 'DM per user' },
  { path: '/api/cron/daily-personal-digest', label: 'Dagelijkse persoonlijke digest', schedule: 'Di–Vr 08:00 NL', channel: 'DM per user' },
]

export default function SlackDebugPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [testChannel, setTestChannel] = useState('workx-algemeen')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [cronResults, setCronResults] = useState<Record<string, CronResult>>({})
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const u = await res.json()
          if (['PARTNER', 'ADMIN'].includes(u.role)) setHasAccess(true)
        }
      } catch { /* ignore */ }
    }
    check()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/slack-debug/status')
      if (!res.ok) throw new Error()
      setStatus(await res.json())
    } catch {
      toast.error('Kon Slack-status niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/slack-debug/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: testChannel }),
      })
      const data: TestResult = await res.json()
      setTestResult(data)
      if (data.ok) toast.success(`Bericht verstuurd in #${data.channel?.name}`)
      else toast.error(`Mislukt: ${data.error || 'onbekend'}`)
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Netwerk-fout' })
    } finally {
      setTesting(false)
    }
  }

  const triggerCron = async (path: string) => {
    setTriggering(path)
    try {
      const res = await fetch('/api/slack-debug/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data: CronResult = await res.json()
      setCronResults(prev => ({ ...prev, [path]: data }))
      if (data.ok) toast.success(`Cron gedraaid (${data.status})`)
      else toast.error(`Mislukt: ${data.status || data.error}`)
    } catch (err) {
      setCronResults(prev => ({ ...prev, [path]: { ok: false, error: err instanceof Error ? err.message : 'Netwerk-fout' } }))
    } finally {
      setTriggering(null)
    }
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
          <p className="text-sm text-gray-400">Alleen voor partners en admin.</p>
        </div>
      </div>
    )
  }

  if (loading || !status) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span className="text-gray-400">Laden…</span>
        </div>
      </div>
    )
  }

  const tokenOk = status.tokenSet && status.auth?.ok
  const cronOk = status.cronSecretSet

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center text-xl">
          🔧
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white"><TextReveal>Slack diagnose</TextReveal></h1>
          <p className="text-sm text-gray-400">
            Check waarom Slack-berichten niet aankomen + handmatig cron-jobs draaien.
          </p>
        </div>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusTile
          label="SLACK_BOT_TOKEN"
          ok={!!status.tokenSet}
          detail={status.tokenSet ? 'Geconfigureerd' : 'Ontbreekt — voeg toe in Vercel env vars'}
        />
        <StatusTile
          label="Slack auth.test"
          ok={!!tokenOk}
          detail={tokenOk ? `Team: ${status.auth?.team || '?'} · Bot: ${status.auth?.bot || '?'}` : status.auth?.error || 'Token ongeldig of geen scope'}
        />
        <StatusTile
          label="CRON_SECRET"
          ok={!!cronOk}
          detail={cronOk ? 'Geconfigureerd (handmatig triggeren werkt)' : 'Ontbreekt — handmatig triggeren faalt'}
        />
      </div>

      {/* Channels */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Icons.users size={14} className="text-workx-lime" />
          Channels waar bot in zit ({status.channels.length})
        </h2>
        {status.channels.length === 0 ? (
          <p className="text-sm text-gray-500">
            {!tokenOk
              ? 'Niet beschikbaar — token werkt niet.'
              : 'De bot is in 0 channels. Type in een Slack-channel: /invite @Workx Dashboard'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {status.channels.map(c => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  c.name === 'workx-algemeen'
                    ? 'bg-workx-lime/10 text-workx-lime border-workx-lime/30'
                    : 'bg-white/5 text-gray-300 border-white/10'
                }`}
              >
                <span>{c.isPrivate ? '🔒' : '#'}</span>
                {c.name}
                {c.memberCount && <span className="text-gray-500 text-[10px]">({c.memberCount})</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Test message */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icons.send size={14} className="text-workx-lime" />
          Stuur test-bericht
        </h2>
        <p className="text-xs text-gray-400">
          Verstuurt een test-bericht naar de opgegeven channel en toont de exacte Slack-respons.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">#</span>
          <input
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value)}
            placeholder="workx-algemeen"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
          />
          <button
            onClick={runTest}
            disabled={testing || !testChannel.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
            style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
          >
            {testing ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Icons.send size={14} /> Test</>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg p-3 border text-xs ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}>
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              {testResult.ok ? <Icons.check size={12} /> : <Icons.alertTriangle size={12} />}
              {testResult.ok ? `Geslaagd — bericht ge-post in #${testResult.channel?.name}` : `Mislukt (stap: ${testResult.step})`}
            </p>
            {!testResult.ok && testResult.error && (
              <p className="text-white/80">{testResult.error}</p>
            )}
            {testResult.step === 'lookup' && testResult.availableNames && testResult.availableNames.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-white/60">Toon zichtbare channels ({testResult.availableNames.length})</summary>
                <p className="mt-1 text-white/70 font-mono">{testResult.availableNames.join(', ')}</p>
              </details>
            )}
            {testResult.raw != null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-white/60">Raw Slack response</summary>
                <pre className="mt-1 text-[10px] overflow-x-auto text-white/70">{JSON.stringify(testResult.raw, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Cron triggers */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icons.refresh size={14} className="text-workx-lime" />
          Handmatig cron-jobs draaien
        </h2>
        <p className="text-xs text-gray-400">
          Klik op "Nu draaien" om een cron job direct te triggeren. Het resultaat (status + payload) wordt onder de knop getoond. Bij Slack-fouten zie je hier de exacte oorzaak.
        </p>

        <div className="space-y-2">
          {CRON_LIST.map(c => {
            const result = cronResults[c.path]
            const busy = triggering === c.path
            return (
              <div key={c.path} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{c.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {c.schedule} · {c.channel}
                    </p>
                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">{c.path}</p>
                  </div>
                  <button
                    onClick={() => triggerCron(c.path)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5"
                    style={{ background: 'rgba(249, 255, 133, 0.15)', color: 'rgb(249, 255, 133)', border: '1px solid rgba(249, 255, 133, 0.3)' }}
                  >
                    {busy ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Icons.refresh size={12} /> Nu draaien</>
                    )}
                  </button>
                </div>

                {result && (
                  <div className={`mt-3 rounded-lg p-2.5 text-[11px] border ${
                    result.ok
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/20 text-red-200'
                  }`}>
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      {result.ok ? <Icons.check size={11} /> : <Icons.alertTriangle size={11} />}
                      Status {result.status || '—'} {result.durationMs && `· ${result.durationMs}ms`}
                    </p>
                    {result.payload != null && (
                      <pre className="mt-1 text-[10px] overflow-x-auto text-white/70 whitespace-pre-wrap">
                        {JSON.stringify(result.payload, null, 2)}
                      </pre>
                    )}
                    {result.error && (
                      <p className="text-white/80">{result.error}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Help */}
      <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
        <h3 className="text-sm font-semibold text-white mb-2">Veelvoorkomende oorzaken</h3>
        <ul className="text-xs text-gray-400 space-y-1.5">
          <li>• <strong className="text-white">not_in_channel</strong> → bot is geen lid van het channel. Fix: in dat channel typen <code className="text-workx-lime">/invite @Workx Dashboard</code>.</li>
          <li>• <strong className="text-white">invalid_auth</strong> → SLACK_BOT_TOKEN is verlopen of revoked. Fix: nieuwe bot-token in Slack genereren en in Vercel env vars zetten.</li>
          <li>• <strong className="text-white">missing_scope</strong> → bot heeft niet de juiste scopes (chat:write, channels:read). Fix: in Slack app config scopes toevoegen + opnieuw installeren.</li>
          <li>• <strong className="text-white">channel_not_found</strong> → channel-naam fout, of private channel waar bot niet in zit.</li>
          <li>• <strong className="text-white">Vercel cron heeft niet gedraaid</strong> → check Vercel Logs → Cron Jobs voor het pad. Free-plan = max 2 cron jobs.</li>
        </ul>
      </div>
    </div>
  )
}

function StatusTile({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`card p-4 border ${ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</span>
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      </div>
      <p className={`text-sm font-medium ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
        {ok ? 'OK' : 'Probleem'}
      </p>
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{detail}</p>
    </div>
  )
}
