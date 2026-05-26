'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface Kantoor {
  id: string
  type: 'national' | 'international'
  category: string
  naam: string
  adres: string | null
  plaats: string | null
  email: string | null
  telefoon: string | null
  contactDaar: string | null
  contactWorkx: string | null
  bijzonderheden: string | null
  sortOrder: number
}

type EditableField = 'category' | 'naam' | 'adres' | 'plaats' | 'email' | 'telefoon' | 'contactDaar' | 'contactWorkx' | 'bijzonderheden'

interface NewRow {
  category: string
  naam: string
  adres: string
  plaats: string
  email: string
  telefoon: string
  contactDaar: string
  contactWorkx: string
  bijzonderheden: string
}

const emptyNew = (category = ''): NewRow => ({
  category, naam: '', adres: '', plaats: '', email: '', telefoon: '',
  contactDaar: '', contactWorkx: '', bijzonderheden: '',
})

// Land → vlag emoji (NL + EN spelling). Onbekende landen krijgen 📍.
const COUNTRY_FLAGS: Record<string, string> = {
  // België
  'belgië': '🇧🇪', 'belgie': '🇧🇪', 'belgium': '🇧🇪',
  // Duitsland
  'duitsland': '🇩🇪', 'germany': '🇩🇪', 'deutschland': '🇩🇪',
  // Frankrijk
  'frankrijk': '🇫🇷', 'france': '🇫🇷',
  // Italië
  'italië': '🇮🇹', 'italie': '🇮🇹', 'italy': '🇮🇹', 'italia': '🇮🇹',
  // Spanje
  'spanje': '🇪🇸', 'spain': '🇪🇸', 'españa': '🇪🇸', 'espana': '🇪🇸',
  // Portugal
  'portugal': '🇵🇹',
  // Polen
  'polen': '🇵🇱', 'poland': '🇵🇱', 'polska': '🇵🇱',
  // Finland
  'finland': '🇫🇮', 'suomi': '🇫🇮',
  // Saudi-Arabië
  'saudi-arabië': '🇸🇦', 'saudi-arabie': '🇸🇦', 'saudi arabië': '🇸🇦', 'saudi arabia': '🇸🇦', 'saoedi-arabië': '🇸🇦', 'saoedi-arabie': '🇸🇦',
  // Servië
  'servië': '🇷🇸', 'servie': '🇷🇸', 'serbia': '🇷🇸',
  // Zweden
  'zweden': '🇸🇪', 'sweden': '🇸🇪', 'sverige': '🇸🇪',
  // Zwitserland
  'zwitserland': '🇨🇭', 'switzerland': '🇨🇭', 'suisse': '🇨🇭', 'schweiz': '🇨🇭',
  // Veelvoorkomende uitbreidingen
  'verenigd koninkrijk': '🇬🇧', 'uk': '🇬🇧', 'united kingdom': '🇬🇧', 'engeland': '🇬🇧', 'england': '🇬🇧',
  'ierland': '🇮🇪', 'ireland': '🇮🇪',
  'denemarken': '🇩🇰', 'denmark': '🇩🇰',
  'noorwegen': '🇳🇴', 'norway': '🇳🇴',
  'oostenrijk': '🇦🇹', 'austria': '🇦🇹',
  'luxemburg': '🇱🇺', 'luxembourg': '🇱🇺',
  'tsjechië': '🇨🇿', 'tsjechie': '🇨🇿', 'czech republic': '🇨🇿', 'czechia': '🇨🇿',
  'verenigde staten': '🇺🇸', 'amerika': '🇺🇸', 'usa': '🇺🇸', 'united states': '🇺🇸', 'us': '🇺🇸',
  'canada': '🇨🇦',
  'australië': '🇦🇺', 'australie': '🇦🇺', 'australia': '🇦🇺',
  'japan': '🇯🇵',
  'china': '🇨🇳',
  'brazilië': '🇧🇷', 'brazilie': '🇧🇷', 'brazil': '🇧🇷',
  'griekenland': '🇬🇷', 'greece': '🇬🇷',
  'turkije': '🇹🇷', 'turkey': '🇹🇷', 'türkiye': '🇹🇷',
  'nederland': '🇳🇱', 'netherlands': '🇳🇱', 'holland': '🇳🇱',
}

function getFlagFor(country: string): string {
  const key = country.toLowerCase().trim()
  return COUNTRY_FLAGS[key] || '📍'
}

export default function BevriendeKantorenPage() {
  const [kantoren, setKantoren] = useState<Kantoor[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'national' | 'international'>('national')
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [adding, setAdding] = useState<string | null>(null) // category waarin toegevoegd wordt, of '__new__' voor nieuwe categorie
  const [newRow, setNewRow] = useState<NewRow>(emptyNew())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/bevriende-kantoren')
      if (res.ok) {
        const data = await res.json()
        setKantoren(data)
      }
    } catch {
      toast.error('Kon kantoren niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Groepeer per categorie binnen actieve tab
  const grouped = useMemo(() => {
    const filtered = kantoren.filter(k => k.type === activeTab)
    const map = new Map<string, Kantoor[]>()
    filtered.forEach(k => {
      if (!map.has(k.category)) map.set(k.category, [])
      map.get(k.category)!.push(k)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'nl'))
  }, [kantoren, activeTab])

  const totals = useMemo(() => ({
    national: kantoren.filter(k => k.type === 'national').length,
    international: kantoren.filter(k => k.type === 'international').length,
  }), [kantoren])

  const saveField = async (id: string, field: EditableField, value: string) => {
    const v = value.trim() || null
    setKantoren(prev => prev.map(k => k.id === id ? { ...k, [field]: v } : k))
    try {
      const res = await fetch(`/api/bevriende-kantoren/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: v }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Kon niet opslaan')
      fetchData()
    }
  }

  const deleteKantoor = async (id: string) => {
    if (!confirm('Dit kantoor verwijderen?')) return
    try {
      const res = await fetch(`/api/bevriende-kantoren/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setKantoren(prev => prev.filter(k => k.id !== id))
      toast.success('Kantoor verwijderd')
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const addKantoor = async () => {
    const cat = newRow.category.trim()
    const naam = newRow.naam.trim()
    if (!cat || !naam) {
      toast.error(`${!cat ? 'Categorie' : 'Naam'} is verplicht`)
      return
    }
    try {
      const res = await fetch('/api/bevriende-kantoren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          category: cat,
          naam,
          adres: newRow.adres || undefined,
          plaats: newRow.plaats || undefined,
          email: newRow.email || undefined,
          telefoon: newRow.telefoon || undefined,
          contactDaar: newRow.contactDaar || undefined,
          contactWorkx: newRow.contactWorkx || undefined,
          bijzonderheden: newRow.bijzonderheden || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setKantoren(prev => [...prev, created])
      setAdding(null)
      setNewRow(emptyNew())
      toast.success('Kantoor toegevoegd')
    } catch {
      toast.error('Kon niet toevoegen')
    }
  }

  const startEdit = (id: string, field: EditableField, current: string | null) => {
    setEditing({ id, field })
    setEditValue(current || '')
  }

  const commitEdit = () => {
    if (!editing) return
    saveField(editing.id, editing.field, editValue)
    setEditing(null)
    setEditValue('')
  }

  const renderEditableCell = (k: Kantoor, field: EditableField, options?: { multiline?: boolean; placeholder?: string }) => {
    const isEditing = editing?.id === k.id && editing?.field === field
    const value = (k[field] as string | null) || ''
    if (isEditing) {
      const Cmp = options?.multiline ? 'textarea' : 'input'
      return (
        <Cmp
          autoFocus
          value={editValue}
          onChange={e => setEditValue((e.target as HTMLInputElement | HTMLTextAreaElement).value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !options?.multiline && !e.shiftKey) (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setEditing(null); setEditValue('') }
          }}
          className="w-full bg-white/5 border border-workx-lime/50 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-workx-lime"
          rows={options?.multiline ? 2 : undefined}
        />
      )
    }
    return (
      <button
        onClick={() => startEdit(k.id, field, value)}
        className={`text-left w-full text-xs leading-relaxed transition-colors min-h-[20px] ${
          value ? 'text-white/80 hover:text-workx-lime' : 'text-gray-600 hover:text-workx-lime italic'
        }`}
        title="Klik om te bewerken"
      >
        {value
          ? value.split('\n').map((line, i) => <span key={i} className="block">{line}</span>)
          : <span>{options?.placeholder || '—'}</span>
        }
      </button>
    )
  }

  return (
    <div className="min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-workx-lime/10 flex items-center justify-center text-2xl">
            🤝
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bevriende kantoren</h1>
            <p className="text-sm text-white/40">
              Overzicht van advocatenkantoren waarmee wij samenwerken. Klik op een veld om te bewerken.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('national')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-medium text-sm transition-all ${
            activeTab === 'national'
              ? 'bg-workx-lime/10 text-workx-lime border-b-2 border-workx-lime'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🇳🇱</span>
          <span>Nationaal</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{totals.national}</span>
        </button>
        <button
          onClick={() => setActiveTab('international')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-medium text-sm transition-all ${
            activeTab === 'international'
              ? 'bg-workx-lime/10 text-workx-lime border-b-2 border-workx-lime'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🌍</span>
          <span>Internationaal</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{totals.international}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.length === 0 && !adding && (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40 text-sm mb-3">Nog geen kantoren voor {activeTab === 'national' ? 'Nederland' : 'Internationaal'}</p>
              <button
                onClick={() => { setAdding('__new__'); setNewRow(emptyNew()) }}
                className="px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
              >
                + Eerste kantoor toevoegen
              </button>
            </div>
          )}

          {grouped.map(([category, items]) => (
            <section key={category} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <header className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-workx-lime/5 to-transparent">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="text-lg leading-none">{activeTab === 'national' ? '⚖️' : getFlagFor(category)}</span>
                  {category}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'kantoor' : 'kantoren'}</span>
                  <button
                    onClick={() => { setAdding(category); setNewRow(emptyNew(category)) }}
                    className="px-2.5 py-1 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium hover:bg-workx-lime/20 transition-colors"
                  >
                    + Toevoegen
                  </button>
                </div>
              </header>
              <div className="divide-y divide-white/5">
                {items.map(k => (
                  <article key={k.id} className="px-5 py-4 hover:bg-white/[0.02] group">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white mb-0.5">
                          {renderEditableCell(k, 'naam', { placeholder: 'Naam kantoor' })}
                        </h3>
                      </div>
                      <button
                        onClick={() => deleteKantoor(k.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        title="Verwijderen"
                      >
                        <Icons.trash size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Adres</p>
                        {renderEditableCell(k, 'adres', { placeholder: '+ adres' })}
                        {renderEditableCell(k, 'plaats', { placeholder: '+ plaats' })}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Contact</p>
                        {renderEditableCell(k, 'email', { placeholder: '+ e-mail' })}
                        {renderEditableCell(k, 'telefoon', { placeholder: '+ telefoon' })}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Personen</p>
                        {renderEditableCell(k, 'contactDaar', { placeholder: '+ contactpersonen daar', multiline: true })}
                        {k.contactWorkx || editing?.id === k.id ? (
                          <p className="text-[10px] text-workx-lime/60 mt-0.5">
                            Via Workx: {renderEditableCell(k, 'contactWorkx', { placeholder: '+ contactpersoon Workx' })}
                          </p>
                        ) : (
                          <button
                            onClick={() => startEdit(k.id, 'contactWorkx', '')}
                            className="text-[10px] text-gray-600 hover:text-workx-lime italic mt-0.5"
                          >
                            + contactpersoon Workx
                          </button>
                        )}
                      </div>
                    </div>
                    {(k.bijzonderheden || editing?.id === k.id) && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Bijzonderheden</p>
                        {renderEditableCell(k, 'bijzonderheden', { placeholder: '+ bijzonderheden', multiline: true })}
                      </div>
                    )}
                    {!k.bijzonderheden && editing?.id !== k.id && (
                      <button
                        onClick={() => startEdit(k.id, 'bijzonderheden', '')}
                        className="mt-2 text-[10px] text-gray-600 hover:text-workx-lime italic"
                      >
                        + bijzonderheden
                      </button>
                    )}
                  </article>
                ))}
                {adding === category && (
                  <AddRow
                    newRow={newRow}
                    setNewRow={setNewRow}
                    onAdd={addKantoor}
                    onCancel={() => { setAdding(null); setNewRow(emptyNew()) }}
                    showCategoryInput={false}
                  />
                )}
              </div>
            </section>
          ))}

          {/* Nieuwe categorie toevoegen */}
          {adding === '__new__' ? (
            <section className="bg-white/[0.03] border border-dashed border-workx-lime/30 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Nieuw {activeTab === 'national' ? 'rechtsgebied' : 'land'} + kantoor</h3>
              <AddRow
                newRow={newRow}
                setNewRow={setNewRow}
                onAdd={addKantoor}
                onCancel={() => { setAdding(null); setNewRow(emptyNew()) }}
                showCategoryInput
                categoryLabel={activeTab === 'national' ? 'Rechtsgebied' : 'Land'}
              />
            </section>
          ) : (
            <button
              onClick={() => { setAdding('__new__'); setNewRow(emptyNew()) }}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-white/10 rounded-2xl text-sm text-gray-500 hover:text-workx-lime hover:border-workx-lime/30 transition-colors"
            >
              <Icons.plus size={14} />
              Nieuw {activeTab === 'national' ? 'rechtsgebied' : 'land'} toevoegen
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddRow({
  newRow, setNewRow, onAdd, onCancel, showCategoryInput, categoryLabel,
}: {
  newRow: NewRow
  setNewRow: (r: NewRow) => void
  onAdd: () => void
  onCancel: () => void
  showCategoryInput: boolean
  categoryLabel?: string
}) {
  const set = (k: keyof NewRow, v: string) => setNewRow({ ...newRow, [k]: v })
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50"
  return (
    <div className={showCategoryInput ? '' : 'px-5 py-4 bg-workx-lime/[0.03] border-t border-workx-lime/20'}>
      {showCategoryInput && (
        <input
          value={newRow.category}
          onChange={e => set('category', e.target.value)}
          placeholder={categoryLabel || 'Categorie'}
          className={inputClass + ' mb-3 font-medium'}
          autoFocus
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <input value={newRow.naam} onChange={e => set('naam', e.target.value)} placeholder="Naam kantoor *" className={inputClass} autoFocus={!showCategoryInput} />
        <input value={newRow.adres} onChange={e => set('adres', e.target.value)} placeholder="Adres" className={inputClass} />
        <input value={newRow.plaats} onChange={e => set('plaats', e.target.value)} placeholder="Plaats" className={inputClass} />
        <input value={newRow.email} onChange={e => set('email', e.target.value)} placeholder="E-mail" className={inputClass} />
        <input value={newRow.telefoon} onChange={e => set('telefoon', e.target.value)} placeholder="Telefoon" className={inputClass} />
        <input value={newRow.contactWorkx} onChange={e => set('contactWorkx', e.target.value)} placeholder="Contact binnen Workx" className={inputClass} />
        <textarea value={newRow.contactDaar} onChange={e => set('contactDaar', e.target.value)} placeholder="Contactpersonen daar" className={inputClass + ' sm:col-span-2 lg:col-span-3'} rows={2} />
        <textarea value={newRow.bijzonderheden} onChange={e => set('bijzonderheden', e.target.value)} placeholder="Bijzonderheden" className={inputClass + ' sm:col-span-2 lg:col-span-3'} rows={2} />
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">Annuleer</button>
        <button onClick={onAdd} className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors">Toevoegen</button>
      </div>
    </div>
  )
}
