'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Achievement, Position } from '@/lib/types'

type PositionStub = Position

interface Props {
  userId: string
  initialHighlights: Achievement[]
  initialPositions: PositionStub[]
  employers: string[]
}

const EMPTY_FORM = { includes_metrics: false, keywords: '', description: '', description_alt1: '', description_alt2: '' }
const EMPTY_POSITION_FORM = { employer: '', title: '', start_date: '', end_date: '', resume_intro: '', linkedin_summary: '' }

function positionLabel(p: PositionStub) {
  return p.employer ? `${p.employer} — ${p.title}` : p.title
}

export default function HighlightsClient({ userId, initialHighlights, initialPositions, employers }: Props) {
  const [allPositions, setAllPositions] = useState<PositionStub[]>(initialPositions)
  const sortedPositions = [...allPositions].sort((a, b) => positionLabel(a).localeCompare(positionLabel(b)))

  const [highlights, setHighlights] = useState<Achievement[]>(initialHighlights)
  const [selectedPositionId, setSelectedPositionId] = useState<string>(sortedPositions[0]?.id ?? '')
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [positionForm, setPositionForm] = useState(EMPTY_POSITION_FORM)
  const [savingPosition, setSavingPosition] = useState(false)
  const [editingPosition, setEditingPosition] = useState(false)
  const [positionEditForm, setPositionEditForm] = useState(EMPTY_POSITION_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [generatingKeywords, setGeneratingKeywords] = useState(false)

  const supabase = createClient()

  const textareaCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y min-h-[80px]'

  async function persistIndices(ordered: Achievement[]) {
    const withIndex = ordered.map((h, i) => ({ ...h, index: i + 1 }))
    setHighlights(prev => {
      const map = Object.fromEntries(withIndex.map(h => [h.id, h]))
      return prev.map(h => map[h.id] ?? h)
    })
    await Promise.all(withIndex.map(h =>
      supabase.from('position_highlights').update({ index: h.index }).eq('id', h.id)
    ))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPositionId || !form.description.trim()) return
    setSaving(true)
    const nextIndex = highlights.filter(h => h.position_id === selectedPositionId).length + 1
    const { data, error } = await supabase
      .from('position_highlights')
      .insert({ user_id: userId, position_id: selectedPositionId, index: nextIndex, includes_metrics: form.includes_metrics, keywords: form.keywords.trim() || null, description: form.description.trim(), description_alt1: form.description_alt1.trim() || null, description_alt2: form.description_alt2.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setHighlights(prev => [...prev, data as Achievement])
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
  }

  function startEdit(h: Achievement) {
    setEditingId(h.id)
    setEditForm({ includes_metrics: h.includes_metrics, keywords: h.keywords ?? '', description: h.description, description_alt1: h.description_alt1 ?? '', description_alt2: h.description_alt2 ?? '' })
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('position_highlights')
      .update({ includes_metrics: editForm.includes_metrics, keywords: editForm.keywords.trim() || null, description: editForm.description.trim(), description_alt1: editForm.description_alt1.trim() || null, description_alt2: editForm.description_alt2.trim() || null })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setHighlights(prev => prev.map(h => h.id === id ? (data as Achievement) : h))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this achievement?')) return
    const target = highlights.find(h => h.id === id)
    await supabase.from('position_highlights').delete().eq('id', id)
    const remaining = highlights.filter(h => h.id !== id)
    setHighlights(remaining)
    if (target) {
      const groupItems = remaining
        .filter(h => h.position_id === target.position_id)
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
    const groupItems = highlights
      .filter(h => h.position_id === selectedPositionId)
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
    const srcIdx = groupItems.findIndex(h => h.id === dragSrcId)
    const tgtIdx = groupItems.findIndex(h => h.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...groupItems]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistIndices(reordered)
  }

  async function generateKeywords() {
    if (!selectedHighlights.length) return
    setGeneratingKeywords(true)
    const { data: kwData } = await supabase.from('keywords').select('keyword').eq('user_id', userId)
    const keywords = (kwData ?? []).map(k => k.keyword)
    const achievements = selectedHighlights.map(h => ({ id: h.id, description: h.description }))
    const res = await fetch('/api/generate-achievement-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievements, keywords }),
    })
    if (res.ok) {
      const mapping: Record<string, string> = await res.json()
      await Promise.all(
        Object.entries(mapping).map(([id, kws]) =>
          supabase.from('position_highlights').update({ keywords: kws }).eq('id', id)
        )
      )
      setHighlights(prev => prev.map(h => mapping[h.id] !== undefined ? { ...h, keywords: mapping[h.id] } : h))
    }
    setGeneratingKeywords(false)
  }

  function HighlightForm({
    values,
    onChange,
    onSubmit,
    onCancel,
    onDelete,
    submitLabel,
  }: {
    values: typeof EMPTY_FORM
    onChange: (k: keyof typeof EMPTY_FORM, v: string | boolean) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    onDelete?: () => void
    submitLabel: string
  }) {
    return (
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="includes_metrics" checked={values.includes_metrics as boolean} onChange={e => onChange('includes_metrics', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <label htmlFor="includes_metrics" className="text-sm font-medium text-gray-700">Includes Metrics</label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Keywords</label>
          <input type="text" value={values.keywords as string} onChange={e => onChange('keywords', e.target.value)}
            placeholder="e.g. leadership, data analysis, cost reduction"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
          <textarea value={values.description} onChange={e => onChange('description', e.target.value)}
            placeholder="Describe a key achievement, responsibility, or impact…" required className={textareaCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 1</label>
          <textarea value={values.description_alt1} onChange={e => onChange('description_alt1', e.target.value)}
            placeholder="Alternative description…" className={textareaCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 2</label>
          <textarea value={values.description_alt2} onChange={e => onChange('description_alt2', e.target.value)}
            placeholder="Alternative description…" className={textareaCls} />
        </div>
        <div className="flex items-center justify-between">
          {onDelete ? (
            <button type="button" onClick={onDelete}
              className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-700 border border-red-100 rounded-lg hover:bg-red-50">
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </div>
      </form>
    )
  }

  const selectedPosition = sortedPositions.find(p => p.id === selectedPositionId) ?? null

  const selectedHighlights = highlights
    .filter(h => h.position_id === selectedPositionId)
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Position selector row */}
      <div className="flex items-center gap-3">
        <select
          value={selectedPositionId}
          onChange={e => { setSelectedPositionId(e.target.value); setShowAdd(false); setEditingId(null); setShowAddPosition(false); setEditingPosition(false) }}
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
          const nav = (id: string) => { setSelectedPositionId(id); setShowAdd(false); setEditingId(null); setShowAddPosition(false); setEditingPosition(false) }
          return (
            <div className="flex items-center gap-1">
              <button type="button" title="Previous" disabled={idx <= 0}
                className={btnCls(idx <= 0)}
                onClick={() => { const prev = sortedPositions[idx - 1]; if (prev) nav(prev.id) }}>
                ←
              </button>
              <button type="button" title="Next" disabled={idx >= sortedPositions.length - 1}
                className={btnCls(idx >= sortedPositions.length - 1)}
                onClick={() => { const next = sortedPositions[idx + 1]; if (next) nav(next.id) }}>
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
                required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white">
                <option value="">Select employer…</option>
                {employers.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={positionForm.title} onChange={e => setPositionForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Senior Engineer" required
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={positionForm.start_date} onChange={e => setPositionForm(f => ({ ...f, start_date: e.target.value }))}
                required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={positionForm.end_date} onChange={e => setPositionForm(f => ({ ...f, end_date: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Position Intro</label>
            <textarea value={positionForm.resume_intro} onChange={e => setPositionForm(f => ({ ...f, resume_intro: e.target.value }))}
              placeholder="2–3 sentences summarizing this role for a resume…"
              className={textareaCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn Summary</label>
            <textarea value={positionForm.linkedin_summary} onChange={e => setPositionForm(f => ({ ...f, linkedin_summary: e.target.value }))}
              placeholder="Narrative summary for your LinkedIn experience section…"
              className={textareaCls} />
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

      {selectedPosition && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {editingPosition ? (
            <form onSubmit={handleSavePosition} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employer *</label>
                  <select value={positionEditForm.employer} onChange={e => setPositionEditForm(f => ({ ...f, employer: e.target.value }))}
                    required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white">
                    <option value="">Select employer…</option>
                    {employers.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input value={positionEditForm.title} onChange={e => setPositionEditForm(f => ({ ...f, title: e.target.value }))}
                    required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
                  <input type="date" value={positionEditForm.start_date} onChange={e => setPositionEditForm(f => ({ ...f, start_date: e.target.value }))}
                    required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" value={positionEditForm.end_date} onChange={e => setPositionEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
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
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Employer</p>
                  <p className="text-sm text-gray-800">{selectedPosition.employer}</p>
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
            </>
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
              <button
                onClick={generateKeywords}
                disabled={generatingKeywords || selectedHighlights.length === 0}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingKeywords ? 'Generating…' : 'Generate Keywords'}
              </button>
            </div>
          )}

          {showAdd && (
            <HighlightForm
              values={form}
              onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
              onSubmit={handleAdd}
              onCancel={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
              submitLabel="Add Achievement"
            />
          )}

          {selectedHighlights.length === 0 && !showAdd && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-gray-500">No positions yet. Add your first one above.</p>
            </div>
          )}

          {selectedHighlights.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {selectedHighlights.map(h => (
                  <li
                    key={h.id}
                    draggable={editingId !== h.id}
                    onDragStart={() => setDragSrcId(h.id)}
                    onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== h.id) setDragOverId(h.id) }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={e => { e.preventDefault(); handleDrop(h.id) }}
                    onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                    className={`px-5 py-3 transition-colors ${dragOverId === h.id ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${dragSrcId === h.id ? 'opacity-40' : ''}`}
                  >
                    {editingId === h.id ? (
                      <HighlightForm
                        values={editForm}
                        onChange={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
                        onSubmit={e => handleEdit(e, h.id)}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(h.id)}
                        submitLabel="Save"
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            {h.index != null && (
                              <span className="text-xs font-medium text-gray-400">#{h.index}</span>
                            )}
                            {h.includes_metrics && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-blue-400" title="Includes metrics">
                                <rect x="1" y="9" width="3" height="6" rx="0.5" />
                                <rect x="6" y="5" width="3" height="10" rx="0.5" />
                                <rect x="11" y="1" width="3" height="14" rx="0.5" />
                              </svg>
                            )}
                          </div>
                          <div className="flex gap-4 flex-1">
                            {h.keywords && (
                              <p className="text-xs text-gray-400 whitespace-pre-wrap w-[35%]">
                                {h.keywords.split(',').map(k => k.trim()).join('\n')}
                              </p>
                            )}
                            <div className="space-y-2 w-[65%]">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{h.description}</p>
                              {h.description_alt1 && (
                                <div>
                                  <span className="text-xs font-medium text-gray-400">Alt 1</span>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{h.description_alt1}</p>
                                </div>
                              )}
                              {h.description_alt2 && (
                                <div>
                                  <span className="text-xs font-medium text-gray-400">Alt 2</span>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{h.description_alt2}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEdit(h)}
                            className="text-xs text-gray-500 hover:text-gray-800 font-medium border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
