'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CareerHighlight } from '@/lib/types'

interface Props {
  userId: string
  initialHighlights: CareerHighlight[]
}

const EMPTY_FORM = { title: '', description: '', keywords: '', includes_metrics: false }

export default function CareerHighlightsClient({ userId, initialHighlights }: Props) {
  const [highlights, setHighlights] = useState<CareerHighlight[]>(initialHighlights)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [generatingKeywords, setGeneratingKeywords] = useState(false)

  const supabase = createClient()

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
  const textareaCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y min-h-[80px]'

  const sorted = [...highlights].sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  async function persistIndices(ordered: CareerHighlight[]) {
    const withIndex = ordered.map((h, i) => ({ ...h, index: i + 1 }))
    setHighlights(prev => {
      const map = Object.fromEntries(withIndex.map(h => [h.id, h]))
      return prev.map(h => map[h.id] ?? h)
    })
    await Promise.all(withIndex.map(h =>
      supabase.from('career_highlights').update({ index: h.index }).eq('id', h.id)
    ))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSaving(true)
    const nextIndex = highlights.length + 1
    const { data, error } = await supabase
      .from('career_highlights')
      .insert({
        user_id: userId,
        title: form.title.trim(),
        description: form.description.trim(),
        keywords: form.keywords.trim() || null,
        includes_metrics: form.includes_metrics,
        index: nextIndex,
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setHighlights(prev => [...prev, data as CareerHighlight])
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
  }

  function startEdit(h: CareerHighlight) {
    setEditingId(h.id)
    setEditForm({ title: h.title, description: h.description, keywords: h.keywords ?? '', includes_metrics: h.includes_metrics })
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('career_highlights')
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        keywords: editForm.keywords.trim() || null,
        includes_metrics: editForm.includes_metrics,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setHighlights(prev => prev.map(h => h.id === id ? (data as CareerHighlight) : h))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this career highlight?')) return
    await supabase.from('career_highlights').delete().eq('id', id)
    const remaining = highlights.filter(h => h.id !== id)
    setHighlights(remaining)
    const reordered = [...remaining].sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
    await persistIndices(reordered)
  }

  async function handleDrop(targetId: string) {
    if (!dragSrcId || dragSrcId === targetId) return
    setDragSrcId(null)
    setDragOverId(null)
    const srcIdx = sorted.findIndex(h => h.id === dragSrcId)
    const tgtIdx = sorted.findIndex(h => h.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistIndices(reordered)
  }

  async function generateKeywords() {
    if (!highlights.length) return
    setGeneratingKeywords(true)
    const { data: kwData } = await supabase.from('keywords').select('keyword').eq('user_id', userId)
    const keywords = (kwData ?? []).map(k => k.keyword)
    const achievements = highlights.map(h => ({ id: h.id, description: `${h.title}: ${h.description}` }))
    const res = await fetch('/api/generate-achievement-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievements, keywords }),
    })
    if (res.ok) {
      const mapping: Record<string, string> = await res.json()
      await Promise.all(
        Object.entries(mapping).map(([id, kws]) =>
          supabase.from('career_highlights').update({ keywords: kws }).eq('id', id)
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
          <input
            value={values.keywords as string}
            onChange={e => onChange('keywords', e.target.value)}
            placeholder="e.g. leadership, revenue growth, cross-functional"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Highlight Title *</label>
          <input
            value={values.title}
            onChange={e => onChange('title', e.target.value)}
            placeholder="e.g. Grew ARR from $2M to $10M in 18 months"
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Highlight Description *</label>
          <textarea
            value={values.description}
            onChange={e => onChange('description', e.target.value)}
            placeholder="Describe the context, actions taken, and impact…"
            required
            className={textareaCls}
          />
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

  return (
    <div className="space-y-4">
      {!showAdd && (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Career Highlight
          </button>
          <button
            onClick={generateKeywords}
            disabled={generatingKeywords || highlights.length === 0}
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
          submitLabel="Add Career Highlight"
        />
      )}

      {highlights.length === 0 && !showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🌟</p>
          <p className="text-gray-500">No career highlights yet. Add your first one above.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {sorted.map(h => (
              <li
                key={h.id}
                draggable={editingId !== h.id}
                onDragStart={() => setDragSrcId(h.id)}
                onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== h.id) setDragOverId(h.id) }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={e => { e.preventDefault(); handleDrop(h.id) }}
                onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                className={`px-5 py-4 transition-colors ${dragOverId === h.id ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${dragSrcId === h.id ? 'opacity-40' : ''}`}
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
                        <div className="space-y-1 w-[65%]">
                          <p className="text-sm font-semibold text-gray-800">{h.title}</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{h.description}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => startEdit(h)}
                      className="text-xs text-gray-500 hover:text-gray-800 font-medium border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
