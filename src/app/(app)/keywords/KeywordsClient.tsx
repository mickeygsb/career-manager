'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Keyword } from '@/lib/types'

interface Props {
  userId: string
  initialKeywords: Keyword[]
}

const EMPTY_FORM = { category: '', category_detail: '', keyword: '' }

export default function KeywordsClient({ userId, initialKeywords }: Props) {
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string>('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const supabase = createClient()

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'

  // Sorted unique categories
  const categories = [...new Set(keywords.map(k => k.category))].sort((a, b) => a.localeCompare(b))

  // Auto-select first category if none selected
  const effectiveCategory = selectedCategory || categories[0] || ''

  // Sorted unique category details for the selected category (excluding null/empty)
  const categoryDetails = [...new Set(
    keywords.filter(k => k.category === effectiveCategory && k.category_detail).map(k => k.category_detail as string)
  )].sort((a, b) => a.localeCompare(b))

  const categoryKeywords = keywords
    .filter(k => {
      if (k.category !== effectiveCategory) return false
      if (selectedCategoryDetail && k.category_detail !== selectedCategoryDetail) return false
      return true
    })
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  async function persistIndices(ordered: Keyword[]) {
    const withIndex = ordered.map((k, i) => ({ ...k, index: i + 1 }))
    setKeywords(prev => {
      const map = Object.fromEntries(withIndex.map(k => [k.id, k]))
      return prev.map(k => map[k.id] ?? k)
    })
    await Promise.all(withIndex.map(k =>
      supabase.from('keywords').update({ index: k.index }).eq('id', k.id)
    ))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category.trim() || !form.keyword.trim()) return
    setSaving(true)
    const nextIndex = keywords.filter(k => k.category === form.category.trim()).length + 1
    const { data, error } = await supabase
      .from('keywords')
      .insert({
        user_id: userId,
        category: form.category.trim(),
        category_detail: form.category_detail.trim() || null,
        index: nextIndex,
        keyword: form.keyword.trim(),
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      const newKeyword = data as Keyword
      setKeywords(prev => [...prev, newKeyword])
      setSelectedCategory(newKeyword.category)
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
  }

  function startEdit(k: Keyword) {
    setEditingId(k.id)
    setEditForm({ category: k.category, category_detail: k.category_detail ?? '', keyword: k.keyword })
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('keywords')
      .update({
        category: editForm.category.trim(),
        category_detail: editForm.category_detail.trim() || null,
        keyword: editForm.keyword.trim(),
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setKeywords(prev => prev.map(k => k.id === id ? (data as Keyword) : k))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this keyword?')) return
    const target = keywords.find(k => k.id === id)
    await supabase.from('keywords').delete().eq('id', id)
    const remaining = keywords.filter(k => k.id !== id)
    setKeywords(remaining)
    if (target) {
      const groupItems = remaining
        .filter(k => k.category === target.category)
        .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
      await persistIndices(groupItems)
    }
  }

  async function handleDrop(targetId: string) {
    if (!dragSrcId || dragSrcId === targetId) return
    setDragSrcId(null)
    setDragOverId(null)
    const groupItems = keywords
      .filter(k => k.category === effectiveCategory)
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
    const srcIdx = groupItems.findIndex(k => k.id === dragSrcId)
    const tgtIdx = groupItems.findIndex(k => k.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...groupItems]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistIndices(reordered)
  }

  function KeywordForm({
    values,
    onChange,
    onSubmit,
    onCancel,
    onDelete,
    submitLabel,
  }: {
    values: typeof EMPTY_FORM
    onChange: (k: keyof typeof EMPTY_FORM, v: string) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    onDelete?: () => void
    submitLabel: string
  }) {
    return (
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <input
              list="category-options"
              value={values.category}
              onChange={e => onChange('category', e.target.value)}
              placeholder="e.g. Technical Skills"
              required
              className={inputCls}
            />
            <datalist id="category-options">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category Detail</label>
            <input
              value={values.category_detail}
              onChange={e => onChange('category_detail', e.target.value)}
              placeholder="e.g. Programming Languages"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Keyword *</label>
          <input
            value={values.keyword}
            onChange={e => onChange('keyword', e.target.value)}
            placeholder="e.g. React"
            required
            className={inputCls}
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
      {/* Category selector + Add button */}
      <div className="flex items-center gap-3">
        <select
          value={effectiveCategory}
          onChange={e => { setSelectedCategory(e.target.value); setSelectedCategoryDetail(''); setShowAdd(false); setEditingId(null) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 max-w-xs"
        >
          {categories.length === 0 && <option value="">No categories yet</option>}
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {categoryDetails.length > 0 && (
          <select
            value={selectedCategoryDetail}
            onChange={e => { setSelectedCategoryDetail(e.target.value); setShowAdd(false); setEditingId(null) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 max-w-xs"
          >
            <option value="">All</option>
            {categoryDetails.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Keyword
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <KeywordForm
          values={{ ...form, category: form.category || effectiveCategory }}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleAdd}
          onCancel={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
          submitLabel="Add Keyword"
        />
      )}

      {/* Empty state */}
      {keywords.length === 0 && !showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="text-gray-500">No keywords yet. Add your first one above.</p>
        </div>
      )}

      {/* Keyword list */}
      {categoryKeywords.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {categoryKeywords.map(k => (
              <li
                key={k.id}
                draggable={editingId !== k.id}
                onDragStart={() => setDragSrcId(k.id)}
                onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== k.id) setDragOverId(k.id) }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={e => { e.preventDefault(); handleDrop(k.id) }}
                onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                className={`px-5 py-2 transition-colors ${dragOverId === k.id ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${dragSrcId === k.id ? 'opacity-40' : ''}`}
              >
                {editingId === k.id ? (
                  <KeywordForm
                    values={editForm}
                    onChange={(key, v) => setEditForm(f => ({ ...f, [key]: v }))}
                    onSubmit={e => handleEdit(e, k.id)}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => handleDelete(k.id)}
                    submitLabel="Save"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none shrink-0">⠿</span>
                      {k.index != null && (
                        <span className="text-xs font-medium text-gray-400 shrink-0 w-6">#{k.index}</span>
                      )}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{k.keyword}</span>
                        {k.category_detail && (
                          <span className="text-xs text-gray-400">{k.category_detail}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => startEdit(k)}
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
