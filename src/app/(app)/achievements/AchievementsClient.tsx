'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Achievement, Position, Keyword } from '@/lib/types'

type PositionStub = Position

interface Props {
  userId: string
  initialAchievements: Achievement[]
  initialPositions: PositionStub[]
  employers: string[]
  employerIdsByName: Record<string, string>
  allKeywords: Keyword[]
  initialAchievementKeywords: Record<string, string[]>
}

type AddForm = {
  includes_metrics: boolean
  description: string
  description_alt1: string
  description_alt2: string
  keywordIds: string[]
}

const EMPTY_FORM: AddForm = { includes_metrics: false, description: '', description_alt1: '', description_alt2: '', keywordIds: [] }
const EMPTY_POSITION_FORM = { employer: '', title: '', start_date: '', end_date: '', resume_intro: '', linkedin_summary: '' }
const EMPTY_ADD_KW = { category: '', category_detail: '', keyword: '' }

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
const textareaCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y min-h-[80px]'

function positionLabel(p: PositionStub) {
  return p.employer ? `${p.employer} — ${p.title}` : p.title
}

function KeywordChipSelector({
  allKeywords,
  selectedIds,
  onToggle,
}: {
  allKeywords: Keyword[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const groups = allKeywords.reduce<Record<string, Keyword[]>>((acc, kw) => {
    ;(acc[kw.category] ??= []).push(kw)
    return acc
  }, {})

  return (
    <div className="space-y-2">
      {Object.entries(groups).map(([category, keywords]) => (
        <div key={category}>
          <p className="text-xs text-gray-400 mb-1">{category}</p>
          <div className="flex flex-wrap gap-1">
            {keywords.map(kw => {
              const selected = selectedIds.includes(kw.id)
              return (
                <button
                  key={kw.id}
                  type="button"
                  onClick={() => onToggle(kw.id)}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    selected ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {kw.keyword}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AchievementsClient({ userId, initialAchievements, initialPositions, employers, employerIdsByName, allKeywords, initialAchievementKeywords }: Props) {
  const [allPositions, setAllPositions] = useState<PositionStub[]>(initialPositions)
  const sortedPositions = [...allPositions].sort((a, b) => b.start_date.localeCompare(a.start_date))

  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements)
  const [achievementKeywords, setAchievementKeywords] = useState<Record<string, string[]>>(initialAchievementKeywords)
  const [keywords, setKeywords] = useState<Keyword[]>(allKeywords)

  const [selectedPositionId, setSelectedPositionId] = useState<string>(sortedPositions[0]?.id ?? '')
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [positionForm, setPositionForm] = useState(EMPTY_POSITION_FORM)
  const [savingPosition, setSavingPosition] = useState(false)
  const [editingPosition, setEditingPosition] = useState(false)
  const [positionEditForm, setPositionEditForm] = useState(EMPTY_POSITION_FORM)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ keywordIds: string[] }>({ keywordIds: [] })

  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'description' | 'description_alt1' | 'description_alt2'; value: string } | null>(null)

  const [kwFilterText, setKwFilterText] = useState('')
  const [kwFilterCategory, setKwFilterCategory] = useState('')
  const [kwFilterCategoryDetail, setKwFilterCategoryDetail] = useState('')
  const [showAddKw, setShowAddKw] = useState(false)
  const [addKwForm, setAddKwForm] = useState(EMPTY_ADD_KW)
  const [addKwSaving, setAddKwSaving] = useState(false)

  const supabase = createClient()

  const kwById = Object.fromEntries(keywords.map(k => [k.id, k]))
  const kwCategories = [...new Set(keywords.map(k => k.category).filter(Boolean))].sort()
  const kwCategoryDetails = [...new Set(
    keywords.filter(k => !kwFilterCategory || k.category === kwFilterCategory).map(k => k.category_detail).filter((v): v is string => !!v)
  )].sort()
  const filteredEditKeywords = keywords.filter(kw => {
    if (kwFilterCategory && kw.category !== kwFilterCategory) return false
    if (kwFilterCategoryDetail && kw.category_detail !== kwFilterCategoryDetail) return false
    if (kwFilterText && !kw.keyword.toLowerCase().includes(kwFilterText.toLowerCase())) return false
    return true
  }).sort((a, b) => a.keyword.localeCompare(b.keyword))

  async function saveJunctionRecords(achievementId: string, keywordIds: string[]) {
    await supabase.from('position_achievement_keywords').delete().eq('position_achievement_id', achievementId)
    if (keywordIds.length > 0) {
      await supabase.from('position_achievement_keywords').insert(
        keywordIds.map(kwId => ({ position_achievement_id: achievementId, keyword_id: kwId, user_id: userId }))
      )
    }
  }

  async function persistIndices(ordered: Achievement[]) {
    const withIndex = ordered.map((a, i) => ({ ...a, index: i + 1 }))
    setAchievements(prev => {
      const map = Object.fromEntries(withIndex.map(a => [a.id, a]))
      return prev.map(a => map[a.id] ?? a)
    })
    await Promise.all(withIndex.map(a =>
      supabase.from('position_achievements').update({ index: a.index }).eq('id', a.id)
    ))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPositionId || !form.description.trim()) return
    setSaving(true)
    const nextIndex = achievements.filter(a => a.position_id === selectedPositionId).length + 1
    const { data, error } = await supabase
      .from('position_achievements')
      .insert({
        user_id: userId,
        position_id: selectedPositionId,
        index: nextIndex,
        includes_metrics: form.includes_metrics,
        description: form.description.trim(),
        description_alt1: form.description_alt1.trim() || null,
        description_alt2: form.description_alt2.trim() || null,
      })
      .select()
      .single()
    if (!error && data) {
      await saveJunctionRecords(data.id, form.keywordIds)
      setAchievements(prev => [...prev, data as Achievement])
      setAchievementKeywords(prev => ({ ...prev, [data.id]: form.keywordIds }))
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
    setSaving(false)
  }

  function startEdit(a: Achievement) {
    setEditingId(a.id)
    setEditForm({ keywordIds: achievementKeywords[a.id] ?? [] })
    setKwFilterText('')
    setKwFilterCategory('')
    setKwFilterCategoryDetail('')
  }

  async function handleEdit(id: string) {
    setSaving(true)
    await saveJunctionRecords(id, editForm.keywordIds)
    setAchievementKeywords(prev => ({ ...prev, [id]: editForm.keywordIds }))
    setEditingId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this achievement?')) return
    const target = achievements.find(a => a.id === id)
    await supabase.from('position_achievements').delete().eq('id', id)
    const remaining = achievements.filter(a => a.id !== id)
    setAchievements(remaining)
    setAchievementKeywords(prev => { const n = { ...prev }; delete n[id]; return n })
    setEditingId(null)
    if (target) {
      const groupItems = remaining
        .filter(a => a.position_id === target.position_id)
        .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
      await persistIndices(groupItems)
    }
  }

  async function handleAddPosition(e: React.FormEvent) {
    e.preventDefault()
    if (!positionForm.employer.trim() || !positionForm.title.trim() || !positionForm.start_date) return
    setSavingPosition(true)
    const { data, error } = await supabase
      .from('positions')
      .insert({
        user_id: userId,
        employer: positionForm.employer.trim(),
        title: positionForm.title.trim(),
        start_date: positionForm.start_date,
        end_date: positionForm.end_date || null,
        resume_intro: positionForm.resume_intro.trim() || null,
        linkedin_summary: positionForm.linkedin_summary.trim() || null,
      })
      .select()
      .single()
    setSavingPosition(false)
    if (!error && data) {
      const newPos = data as PositionStub
      setAllPositions(prev => [...prev, newPos])
      setSelectedPositionId(newPos.id)
      setPositionForm(EMPTY_POSITION_FORM)
      setShowAddPosition(false)
    }
  }

  function startEditPosition() {
    if (!selectedPosition) return
    setPositionEditForm({
      employer: selectedPosition.employer,
      title: selectedPosition.title,
      start_date: selectedPosition.start_date,
      end_date: selectedPosition.end_date ?? '',
      resume_intro: selectedPosition.resume_intro ?? '',
      linkedin_summary: selectedPosition.linkedin_summary ?? '',
    })
    setEditingPosition(true)
  }

  async function handleSavePosition(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPositionId) return
    setSavingPosition(true)
    const { data, error } = await supabase
      .from('positions')
      .update({
        employer: positionEditForm.employer.trim(),
        title: positionEditForm.title.trim(),
        start_date: positionEditForm.start_date,
        end_date: positionEditForm.end_date || null,
        resume_intro: positionEditForm.resume_intro.trim() || null,
        linkedin_summary: positionEditForm.linkedin_summary.trim() || null,
      })
      .eq('id', selectedPositionId)
      .select()
      .single()
    setSavingPosition(false)
    if (!error && data) {
      setAllPositions(prev => prev.map(p => p.id === selectedPositionId ? (data as PositionStub) : p))
      setEditingPosition(false)
    }
  }

  async function handleDrop(targetId: string) {
    if (!dragSrcId || dragSrcId === targetId) return
    setDragSrcId(null)
    setDragOverId(null)
    const groupItems = achievements
      .filter(a => a.position_id === selectedPositionId)
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
    const srcIdx = groupItems.findIndex(a => a.id === dragSrcId)
    const tgtIdx = groupItems.findIndex(a => a.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...groupItems]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistIndices(reordered)
  }

  async function saveInlineField(id: string, field: 'description' | 'description_alt1' | 'description_alt2', value: string) {
    const trimmed = value.trim()
    if (field === 'description' && !trimmed) return
    const current = achievements.find(a => a.id === id)
    const newValue = field === 'description' ? trimmed : (trimmed || null)
    if (current && current[field] === newValue) return
    const { data, error } = await supabase.from('position_achievements').update({ [field]: newValue }).eq('id', id).select().single()
    if (!error && data) setAchievements(prev => prev.map(a => a.id === id ? (data as Achievement) : a))
  }

  async function handleAddKw(e: React.FormEvent) {
    e.preventDefault()
    if (!addKwForm.category.trim() || !addKwForm.keyword.trim()) return
    setAddKwSaving(true)
    const nextIndex = keywords.filter(k => k.category === addKwForm.category.trim()).length + 1
    const { data, error } = await supabase
      .from('keywords')
      .insert({
        user_id: userId,
        category: addKwForm.category.trim(),
        category_detail: addKwForm.category_detail.trim() || null,
        keyword: addKwForm.keyword.trim(),
        index: nextIndex,
      })
      .select()
      .single()
    setAddKwSaving(false)
    if (!error && data) {
      const newKw = data as Keyword
      setKeywords(prev => [...prev, newKw])
      setEditForm(f => ({ ...f, keywordIds: [...f.keywordIds, newKw.id] }))
      setShowAddKw(false)
    }
  }

  const selectedPosition = sortedPositions.find(p => p.id === selectedPositionId) ?? null
  const selectedAchievements = achievements
    .filter(a => a.position_id === selectedPositionId)
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }

  function navTo(id: string) {
    setSelectedPositionId(id)
    setShowAdd(false)
    setEditingId(null)
    setShowAddPosition(false)
    setEditingPosition(false)
  }

  return (
    <div className="space-y-4">
      {/* Position selector row */}
      <div className="flex items-center gap-3">
        <select
          value={selectedPositionId}
          onChange={e => navTo(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 max-w-xl"
        >
          <option value="">Select a position…</option>
          {sortedPositions.map(p => (
            <option key={p.id} value={p.id}>{positionLabel(p)}</option>
          ))}
        </select>
        {(() => {
          const idx = sortedPositions.findIndex(p => p.id === selectedPositionId)
          const btnCls = (disabled: boolean) =>
            `px-3 py-2 border rounded-lg text-sm font-bold leading-none transition-colors ${
              disabled
                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-white'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white cursor-pointer'
            }`
          return (
            <div className="flex items-center gap-1">
              <button type="button" title="Previous" disabled={idx <= 0}
                className={btnCls(idx <= 0)}
                onClick={() => { const prev = sortedPositions[idx - 1]; if (prev) navTo(prev.id) }}>
                ←
              </button>
              <button type="button" title="Next" disabled={idx >= sortedPositions.length - 1}
                className={btnCls(idx >= sortedPositions.length - 1)}
                onClick={() => { const next = sortedPositions[idx + 1]; if (next) navTo(next.id) }}>
                →
              </button>
            </div>
          )
        })()}
        {selectedPosition && !editingPosition && !showAddPosition && (
          <button onClick={startEditPosition}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
        )}
        {!showAddPosition && (
          <button onClick={() => { setShowAddPosition(true); setShowAdd(false) }}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        )}
      </div>

      {/* Add Position form */}
      {showAddPosition && (
        <form onSubmit={handleAddPosition} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">New Position</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employer *</label>
              <select value={positionForm.employer} onChange={e => setPositionForm(f => ({ ...f, employer: e.target.value }))}
                required className={inputCls}>
                <option value="">Select employer…</option>
                {employers.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={positionForm.title} onChange={e => setPositionForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Senior Engineer" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={positionForm.start_date} onChange={e => setPositionForm(f => ({ ...f, start_date: e.target.value }))}
                required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={positionForm.end_date} onChange={e => setPositionForm(f => ({ ...f, end_date: e.target.value }))}
                className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Position Intro</label>
            <textarea value={positionForm.resume_intro} onChange={e => setPositionForm(f => ({ ...f, resume_intro: e.target.value }))}
              placeholder="2–3 sentences summarizing this role for a resume…" className={textareaCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn Summary</label>
            <textarea value={positionForm.linkedin_summary} onChange={e => setPositionForm(f => ({ ...f, linkedin_summary: e.target.value }))}
              placeholder="Narrative summary for your LinkedIn experience section…" className={textareaCls} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAddPosition(false); setPositionForm(EMPTY_POSITION_FORM) }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={savingPosition}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {savingPosition ? 'Saving…' : 'Add Position'}
            </button>
          </div>
        </form>
      )}

      {/* Position detail panel */}
      {selectedPosition && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {editingPosition ? (
            <form onSubmit={handleSavePosition} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employer *</label>
                  <select value={positionEditForm.employer} onChange={e => setPositionEditForm(f => ({ ...f, employer: e.target.value }))}
                    required className={inputCls}>
                    <option value="">Select employer…</option>
                    {employers.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input value={positionEditForm.title} onChange={e => setPositionEditForm(f => ({ ...f, title: e.target.value }))}
                    required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
                  <input type="date" value={positionEditForm.start_date} onChange={e => setPositionEditForm(f => ({ ...f, start_date: e.target.value }))}
                    required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" value={positionEditForm.end_date} onChange={e => setPositionEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Position Intro</label>
                <textarea value={positionEditForm.resume_intro} onChange={e => setPositionEditForm(f => ({ ...f, resume_intro: e.target.value }))}
                  placeholder="2–3 sentences summarizing this role for a resume…" className={textareaCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn Summary</label>
                <textarea value={positionEditForm.linkedin_summary} onChange={e => setPositionEditForm(f => ({ ...f, linkedin_summary: e.target.value }))}
                  placeholder="Narrative summary for your LinkedIn experience section…" className={textareaCls} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditingPosition(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingPosition}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingPosition ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-0.5">Employer</p>
                {employerIdsByName[selectedPosition.employer] ? (
                  <Link href={`/employers?edit=${employerIdsByName[selectedPosition.employer]}`} className="text-sm text-blue-600 hover:underline">
                    {selectedPosition.employer}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-800">{selectedPosition.employer}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-0.5">Title</p>
                <p className="text-sm text-gray-800">{selectedPosition.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-0.5">Start Date</p>
                <p className="text-sm text-gray-800">{formatDate(selectedPosition.start_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-0.5">End Date</p>
                <p className="text-sm text-gray-800">{selectedPosition.end_date ? formatDate(selectedPosition.end_date) : <span className="text-gray-400">—</span>}</p>
              </div>
              {selectedPosition.resume_intro && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Position Intro</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedPosition.resume_intro}</p>
                </div>
              )}
              {selectedPosition.linkedin_summary && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-gray-400 mb-0.5">LinkedIn Summary</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedPosition.linkedin_summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedPositionId && (
        <>
          {!showAdd && (
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                + Add Achievement
              </button>
            </div>
          )}

          {/* Add Achievement form */}
          {showAdd && (
            <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="add_includes_metrics" checked={form.includes_metrics}
                  onChange={e => setForm(f => ({ ...f, includes_metrics: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="add_includes_metrics" className="text-sm font-medium text-gray-700">Includes Metrics</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe a key achievement, responsibility, or impact…" required className={textareaCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 1</label>
                <textarea value={form.description_alt1} onChange={e => setForm(f => ({ ...f, description_alt1: e.target.value }))}
                  placeholder="Alternative description…" className={textareaCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 2</label>
                <textarea value={form.description_alt2} onChange={e => setForm(f => ({ ...f, description_alt2: e.target.value }))}
                  placeholder="Alternative description…" className={textareaCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Keywords</label>
                {keywords.length > 0 ? (
                  <KeywordChipSelector
                    allKeywords={keywords}
                    selectedIds={form.keywordIds}
                    onToggle={id => setForm(f => ({
                      ...f,
                      keywordIds: f.keywordIds.includes(id) ? f.keywordIds.filter(x => x !== id) : [...f.keywordIds, id],
                    }))}
                  />
                ) : (
                  <p className="text-xs text-gray-400">No keywords defined yet.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Achievement'}
                </button>
              </div>
            </form>
          )}

          {selectedAchievements.length === 0 && !showAdd && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-gray-500">No achievements yet. Add your first one above.</p>
            </div>
          )}

          {selectedAchievements.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {selectedAchievements.map(a => {
                  const kwIds = achievementKeywords[a.id] ?? []
                  return (
                    <li
                      key={a.id}
                      draggable={!inlineEdit}
                      onDragStart={() => !inlineEdit && setDragSrcId(a.id)}
                      onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== a.id) setDragOverId(a.id) }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={e => { e.preventDefault(); handleDrop(a.id) }}
                      onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                      className={`px-5 py-1 transition-colors ${dragOverId === a.id ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${dragSrcId === a.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            {a.index != null && (
                              <span className="text-xs font-medium text-gray-400">#{a.index}</span>
                            )}
                            <button
                              type="button"
                              title="Toggle includes metrics"
                              onClick={async () => {
                                const next = !a.includes_metrics
                                const { data, error } = await supabase.from('position_achievements').update({ includes_metrics: next }).eq('id', a.id).select().single()
                                if (!error && data) setAchievements(prev => prev.map(x => x.id === a.id ? (data as Achievement) : x))
                              }}
                              className="focus:outline-none"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 ${a.includes_metrics ? 'text-blue-400' : 'text-gray-300'}`} aria-label="Includes metrics">
                                <rect x="1" y="9" width="3" height="6" rx="0.5" />
                                <rect x="6" y="5" width="3" height="10" rx="0.5" />
                                <rect x="11" y="1" width="3" height="14" rx="0.5" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Edit keywords"
                              onClick={() => startEdit(a)}
                              className="focus:outline-none text-gray-300 hover:text-gray-500"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                          </div>
                          <div className="flex gap-4 flex-1">
                            <div className="flex flex-wrap gap-1 content-start w-[30%]">
                              {kwIds.map(kwId => kwById[kwId]).filter(Boolean).map(kw => (
                                <span key={kw.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  {kw.keyword}
                                </span>
                              ))}
                            </div>
                            <div className="space-y-1 w-[65%]">
                              {inlineEdit?.id === a.id && inlineEdit.field === 'description' ? (
                                <textarea
                                  autoFocus
                                  className="w-full text-sm text-gray-800 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[60px]"
                                  value={inlineEdit.value}
                                  onChange={e => setInlineEdit(v => v && ({ ...v, value: e.target.value }))}
                                  onBlur={() => { saveInlineField(a.id, 'description', inlineEdit.value); setInlineEdit(null) }}
                                  onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null) }}
                                />
                              ) : (
                                <p
                                  className="text-sm text-gray-800 whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                                  onClick={() => setInlineEdit({ id: a.id, field: 'description', value: a.description })}
                                >{a.description}</p>
                              )}
                              {(a.description_alt1 || inlineEdit?.id === a.id) && (
                                <div>
                                  <span className="text-xs font-medium text-gray-400">Alt 1</span>
                                  {inlineEdit?.id === a.id && inlineEdit.field === 'description_alt1' ? (
                                    <textarea
                                      autoFocus
                                      className="w-full text-sm text-gray-600 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[60px]"
                                      value={inlineEdit.value}
                                      onChange={e => setInlineEdit(v => v && ({ ...v, value: e.target.value }))}
                                      onBlur={() => { saveInlineField(a.id, 'description_alt1', inlineEdit.value); setInlineEdit(null) }}
                                      onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null) }}
                                    />
                                  ) : (
                                    <p
                                      className="text-sm text-gray-600 whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                                      onClick={() => setInlineEdit({ id: a.id, field: 'description_alt1', value: a.description_alt1 ?? '' })}
                                    >{a.description_alt1 || <span className="text-gray-300 italic">click to add…</span>}</p>
                                  )}
                                </div>
                              )}
                              {(a.description_alt2 || inlineEdit?.id === a.id) && (
                                <div>
                                  <span className="text-xs font-medium text-gray-400">Alt 2</span>
                                  {inlineEdit?.id === a.id && inlineEdit.field === 'description_alt2' ? (
                                    <textarea
                                      autoFocus
                                      className="w-full text-sm text-gray-600 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[60px]"
                                      value={inlineEdit.value}
                                      onChange={e => setInlineEdit(v => v && ({ ...v, value: e.target.value }))}
                                      onBlur={() => { saveInlineField(a.id, 'description_alt2', inlineEdit.value); setInlineEdit(null) }}
                                      onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null) }}
                                    />
                                  ) : (
                                    <p
                                      className="text-sm text-gray-600 whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                                      onClick={() => setInlineEdit({ id: a.id, field: 'description_alt2', value: a.description_alt2 ?? '' })}
                                    >{a.description_alt2 || <span className="text-gray-300 italic">click to add…</span>}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Edit Keywords dialog */}
          {editingId && (() => {
            const a = achievements.find(x => x.id === editingId)
            if (!a) return null
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingId(null)}>
                <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
                    <h3 className="text-2xl font-semibold text-gray-800">Edit Keywords</h3>
                    <p className="text-xs font-medium text-gray-400 mt-5 uppercase tracking-wide">Description</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.description}</p>
                  </div>
                  <div className="overflow-y-auto flex-1 p-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={kwFilterText}
                        onChange={e => setKwFilterText(e.target.value)}
                        placeholder="contains…"
                        className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                      <select
                        value={kwFilterCategory}
                        onChange={e => { setKwFilterCategory(e.target.value); setKwFilterCategoryDetail('') }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${kwFilterCategory ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
                      >
                        <option value="">All Categories</option>
                        {kwCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={kwFilterCategoryDetail}
                        onChange={e => setKwFilterCategoryDetail(e.target.value)}
                        disabled={kwCategoryDetails.length === 0}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 ${kwFilterCategoryDetail ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
                      >
                        <option value="">All Details</option>
                        {kwCategoryDetails.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {(kwFilterText || kwFilterCategory || kwFilterCategoryDetail) && (
                        <button type="button" onClick={() => { setKwFilterText(''); setKwFilterCategory(''); setKwFilterCategoryDetail('') }}
                          title="Clear filters"
                          className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setAddKwForm({ category: kwFilterCategory, category_detail: kwFilterCategoryDetail, keyword: kwFilterText }); setShowAddKw(true) }}
                        title="Add keyword"
                        className="p-1.5 text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 ml-auto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {filteredEditKeywords.map(kw => {
                        const selected = editForm.keywordIds.includes(kw.id)
                        return (
                          <button
                            key={kw.id}
                            type="button"
                            onClick={() => setEditForm(f => ({
                              ...f,
                              keywordIds: f.keywordIds.includes(kw.id) ? f.keywordIds.filter(x => x !== kw.id) : [...f.keywordIds, kw.id],
                            }))}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {kw.keyword}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
                    <button type="button" onClick={() => handleDelete(editingId)}
                      className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-700 border border-red-100 rounded-lg hover:bg-red-50">
                      Delete
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button type="button" disabled={saving} onClick={() => handleEdit(editingId)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Add Keyword dialog */}
      {showAddKw && (() => {
        const addKwCategories = [...new Set(keywords.map(k => k.category))].sort()
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowAddKw(false)}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-0">
                <h3 className="text-2xl font-semibold text-gray-800">Add Keyword</h3>
              </div>
              <form onSubmit={handleAddKw} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
                    <input
                      list="add-kw-category-options"
                      value={addKwForm.category}
                      onChange={e => setAddKwForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Technical Skills"
                      required
                      className={inputCls}
                    />
                    <datalist id="add-kw-category-options">
                      {addKwCategories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category Detail</label>
                    <input
                      value={addKwForm.category_detail}
                      onChange={e => setAddKwForm(f => ({ ...f, category_detail: e.target.value }))}
                      placeholder="e.g. Programming Languages"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Keyword *</label>
                  <input
                    value={addKwForm.keyword}
                    onChange={e => setAddKwForm(f => ({ ...f, keyword: e.target.value }))}
                    placeholder="e.g. React"
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddKw(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={addKwSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {addKwSaving ? 'Saving…' : 'Add Keyword'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
