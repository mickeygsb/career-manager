'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CareerHighlight, Keyword } from '@/lib/types'

interface Props {
  userId: string
  initialHighlights: CareerHighlight[]
  allKeywords: Keyword[]
  initialHighlightKeywords: Record<string, string[]>
}

type FormValues = { title: string; description: string; keywordIds: string[]; includes_metrics: boolean }

const EMPTY_FORM: FormValues = { title: '', description: '', keywordIds: [], includes_metrics: false }

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
const textareaCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y min-h-[80px]'

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
                    selected
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

function HighlightForm({
  values,
  onChange,
  onToggleKeyword,
  allKeywords,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
  saving,
  formClassName,
}: {
  values: FormValues
  onChange: (k: keyof Omit<FormValues, 'keywordIds'>, v: string | boolean) => void
  onToggleKeyword: (id: string) => void
  allKeywords: Keyword[]
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  onDelete?: () => void
  submitLabel: string
  saving: boolean
  formClassName?: string
}) {
  return (
    <form onSubmit={onSubmit} className={formClassName ?? 'bg-white rounded-xl border border-gray-200 p-5 space-y-4'}>
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
      <div className="flex items-center gap-2">
        <input type="checkbox" id="includes_metrics" checked={values.includes_metrics} onChange={e => onChange('includes_metrics', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <label htmlFor="includes_metrics" className="text-sm font-medium text-gray-700">Includes Metrics</label>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Keywords</label>
        {allKeywords.length > 0 ? (
          <KeywordChipSelector
            allKeywords={allKeywords}
            selectedIds={values.keywordIds}
            onToggle={onToggleKeyword}
          />
        ) : (
          <p className="text-xs text-gray-400">No keywords defined yet.</p>
        )}
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

const EMPTY_ADD_KW = { category: '', category_detail: '', keyword: '' }

export default function CareerHighlightsClient({ userId, initialHighlights, allKeywords, initialHighlightKeywords }: Props) {
  const [highlights, setHighlights] = useState<CareerHighlight[]>(initialHighlights)
  const [highlightKeywords, setHighlightKeywords] = useState<Record<string, string[]>>(initialHighlightKeywords)
  const [keywords, setKeywords] = useState<Keyword[]>(allKeywords)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormValues>(EMPTY_FORM)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'title' | 'description'; value: string } | null>(null)
  const [kwFilterText, setKwFilterText] = useState('')
  const [kwFilterCategory, setKwFilterCategory] = useState('')
  const [kwFilterCategoryDetail, setKwFilterCategoryDetail] = useState('')
  const [showAddKw, setShowAddKw] = useState(false)
  const [addKwForm, setAddKwForm] = useState(EMPTY_ADD_KW)
  const [addKwSaving, setAddKwSaving] = useState(false)

  const supabase = createClient()
  const sorted = [...highlights].sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
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

  async function saveJunctionRecords(highlightId: string, keywordIds: string[]) {
    await supabase.from('career_highlight_keywords').delete().eq('career_highlight_id', highlightId)
    if (keywordIds.length > 0) {
      await supabase.from('career_highlight_keywords').insert(
        keywordIds.map(kwId => ({ career_highlight_id: highlightId, keyword_id: kwId, user_id: userId }))
      )
    }
  }

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
        includes_metrics: form.includes_metrics,
        index: nextIndex,
      })
      .select()
      .single()
    if (!error && data) {
      await saveJunctionRecords(data.id, form.keywordIds)
      setHighlights(prev => [...prev, data as CareerHighlight])
      setHighlightKeywords(prev => ({ ...prev, [data.id]: form.keywordIds }))
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
    setSaving(false)
  }

  function startEdit(h: CareerHighlight) {
    setEditingId(h.id)
    setEditForm({ title: h.title, description: h.description, keywordIds: highlightKeywords[h.id] ?? [], includes_metrics: h.includes_metrics })
    setKwFilterText('')
    setKwFilterCategory('')
    setKwFilterCategoryDetail('')
  }

  async function handleEdit(id: string) {
    setSaving(true)
    await saveJunctionRecords(id, editForm.keywordIds)
    setHighlightKeywords(prev => ({ ...prev, [id]: editForm.keywordIds }))
    setEditingId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this career highlight?')) return
    await supabase.from('career_highlights').delete().eq('id', id)
    const remaining = highlights.filter(h => h.id !== id)
    setHighlights(remaining)
    setHighlightKeywords(prev => { const n = { ...prev }; delete n[id]; return n })
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

  async function saveInlineField(id: string, field: 'title' | 'description', value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    const current = highlights.find(h => h.id === id)
    if (current && current[field] === trimmed) return
    const { data, error } = await supabase.from('career_highlights').update({ [field]: trimmed }).eq('id', id).select().single()
    if (!error && data) setHighlights(prev => prev.map(h => h.id === id ? (data as CareerHighlight) : h))
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


  return (
    <div className="space-y-4">
      {!showAdd && (
        <div className="flex justify-end">
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Career Highlight
          </button>
        </div>
      )}

      {showAdd && (
        <HighlightForm
          values={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onToggleKeyword={id => setForm(f => ({
            ...f,
            keywordIds: f.keywordIds.includes(id) ? f.keywordIds.filter(x => x !== id) : [...f.keywordIds, id],
          }))}
          allKeywords={keywords}
          onSubmit={handleAdd}
          onCancel={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
          submitLabel="Add Career Highlight"
          saving={saving}
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
            {sorted.map(h => {
              const kwIds = highlightKeywords[h.id] ?? []
              return (
                <li
                  key={h.id}
                  draggable={!inlineEdit}
                  onDragStart={() => !inlineEdit && setDragSrcId(h.id)}
                  onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== h.id) setDragOverId(h.id) }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={e => { e.preventDefault(); handleDrop(h.id) }}
                  onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                  className={`px-5 py-1 transition-colors ${dragOverId === h.id ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${dragSrcId === h.id ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {h.index != null && (
                          <span className="text-xs font-medium text-gray-400">#{h.index}</span>
                        )}
                        <button
                          type="button"
                          title="Toggle includes metrics"
                          onClick={async () => {
                            const next = !h.includes_metrics
                            const { data, error } = await supabase.from('career_highlights').update({ includes_metrics: next }).eq('id', h.id).select().single()
                            if (!error && data) setHighlights(prev => prev.map(x => x.id === h.id ? (data as CareerHighlight) : x))
                          }}
                          className="focus:outline-none"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 ${h.includes_metrics ? 'text-blue-400' : 'text-gray-300'}`} aria-label="Includes metrics">
                            <rect x="1" y="9" width="3" height="6" rx="0.5" />
                            <rect x="6" y="5" width="3" height="10" rx="0.5" />
                            <rect x="11" y="1" width="3" height="14" rx="0.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Edit keywords"
                          onClick={() => startEdit(h)}
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
                          {inlineEdit?.id === h.id && inlineEdit.field === 'title' ? (
                            <input
                              autoFocus
                              className="w-full text-sm font-semibold text-gray-800 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={inlineEdit.value}
                              onChange={e => setInlineEdit(v => v && ({ ...v, value: e.target.value }))}
                              onBlur={() => { saveInlineField(h.id, 'title', inlineEdit.value); setInlineEdit(null) }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); saveInlineField(h.id, 'title', inlineEdit.value); setInlineEdit(null) }
                                if (e.key === 'Escape') setInlineEdit(null)
                              }}
                            />
                          ) : (
                            <p
                              className="text-sm font-semibold text-gray-800 cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                              onClick={() => setInlineEdit({ id: h.id, field: 'title', value: h.title })}
                            >{h.title}</p>
                          )}
                          {inlineEdit?.id === h.id && inlineEdit.field === 'description' ? (
                            <textarea
                              autoFocus
                              className="w-full text-sm text-gray-600 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[60px]"
                              value={inlineEdit.value}
                              onChange={e => setInlineEdit(v => v && ({ ...v, value: e.target.value }))}
                              onBlur={() => { saveInlineField(h.id, 'description', inlineEdit.value); setInlineEdit(null) }}
                              onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null) }}
                            />
                          ) : (
                            <p
                              className="text-sm text-gray-600 whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                              onClick={() => setInlineEdit({ id: h.id, field: 'description', value: h.description })}
                            >{h.description}</p>
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

      {editingId && (() => {
        const h = highlights.find(x => x.id === editingId)
        if (!h) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingId(null)}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
                <h3 className="text-2xl font-semibold text-gray-800">Edit Keywords</h3>
                <p className="text-xs font-medium text-gray-400 mt-5 uppercase tracking-wide">Description</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2"><span className="font-medium text-gray-800">{h.title}</span> - {h.description}</p>
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
              <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-2">
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
        )
      })()}

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
