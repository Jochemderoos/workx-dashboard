'use client'

import { SlackWidget } from '@/components/SlackWidget'

export default function ChatPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Team Chat</h1>
        <p className="text-workx-muted">
          Chat direct met je collega&apos;s via Slack
        </p>
      </div>

      <SlackWidget />

      <div className="mt-4 p-4 bg-workx-gray/20 rounded-lg">
        <p className="text-sm text-workx-muted">
          <span className="text-workx-lime">Tip:</span> Je kunt ook direct Slack openen voor meer functies zoals threads, reacties en file sharing.
        </p>
      </div>
    </div>
  )
}
