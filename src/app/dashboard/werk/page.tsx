'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import WieDoetWat from '@/components/werk/WieDoetWat'
import TextReveal from '@/components/ui/TextReveal'

export default function WerkPage() {
  const [canEdit, setCanEdit] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const user = await res.json()
          const isManager = user.role === 'PARTNER' || user.role === 'ADMIN'
          setCanEdit(isManager)
          setCurrentUserId(user.id)
        }
      } catch (error) {
        console.error('Kon gebruiker niet laden')
      } finally {
        setIsLoading(false)
      }
    }
    checkPermission()
  }, [])

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-gray-400">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
            <Icons.users className="text-blue-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white"><TextReveal>Wie doet Wat</TextReveal></h1>
        </div>
      </div>

      {/* Wie doet Wat - zichtbaar voor iedereen */}
      <WieDoetWat canEdit={canEdit} currentUserId={currentUserId} />
    </div>
  )
}
