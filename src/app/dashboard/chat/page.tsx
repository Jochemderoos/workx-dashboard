'use client'

import { useSession } from 'next-auth/react'
import { SlackWidget } from '@/components/SlackWidget'

export default function ChatPage() {
  const { data: session } = useSession()

  return (
    <div className="p-6 max-w-4xl mx-auto relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Team Chat</h1>
        <p className="text-workx-muted">
          Chat direct met je collega&apos;s via Slack
        </p>
      </div>

      <SlackWidget currentUserName={session?.user?.name || undefined} />

      <div className="mt-4 p-4 bg-workx-gray/20 rounded-lg">
        <p className="text-sm text-workx-muted">
          <span className="text-workx-lime">Tip:</span> Je kunt ook direct Slack openen voor meer functies zoals threads, reacties en file sharing.
        </p>
      </div>
    </div>
  )
}
