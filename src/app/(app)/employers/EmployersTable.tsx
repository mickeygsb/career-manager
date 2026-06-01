'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employer, EmployerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: EmployerSize | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: '1-10', label: '1 - 10' },
  { value: '10-100', label: '10 - 100' },
  { value: '100-1000', label: '100 - 1000' },
  { value: '1000-10000', label: '1000 - 10000' },
  { value: '10000+', label: '10000+' },
]

type Row = Omit<Employer, 'user_id' | 'created_at' | 'updated_at'>
type TextField = 'name' | 'business_unit' | 'industry' | 'industry_segment' | 'location' | 'website'

function toRow(e: Employer): Row {
  return {
    id: e.id,
    name: [e.name, e.business_unit].filter(Boolean).join(' > '),
    business_unit: e.business_unit ?? '',
    aka: e.aka ?? '',
    industry: [e.industry, e.industry_segment].filter(Boolean).join(' > '),
    industry_segment: e.industry_segment ?? '',
    fudge_factor: e.fudge_factor,
    size: e.size,
    location: e.location ?? '',
    website: e.website ?? '',
    notes: e.notes ?? '',
    is_target: e.is_target,
  }
}

function parseEmployer(name: string) {
  const idx = name.indexOf(' > ')
  if (idx === -1) return { company: name, subsidiary: '' }
  return { company: name.slice(0, idx), subsidiary: name.slice(idx + 3) }
}

function parseIndustry(industrySegment: string) {
  const idx = industrySegment.indexOf(' > ')
  if (idx === -1) return { industry: industrySegment, segment: '' }
  return { industry: industrySegment.slice(0, idx), segment: industrySegment.slice(idx + 3) }
}

export default function EmployersTable({ initialEmployers, userId }: { initialEmployers: Employer[]; userId: string }) {
  const [rows, setRows] = useState<Row[]>(initialEmployers.map(toRow))
  const [activeCell, setActiveCell] = useState<{ rowId: string; field: TextField } | null>(null)
  const [cellDraft, setCellDraft] = useState('')
  const [dialogRow, setDialogRow] = useState<Row | null>(null)
  const [dialogDraft, setDialogDraft] = useState<Row | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── per-cell helpers ─────────────────────────────────────────────────────

  function activateCell(rowId: string, field: TextField, current: string) {
    setActiveCell({ rowId, field })
    setCellDraft(current)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function commitCell(rowId: string, field: TextField, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, [field]: trimmed } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ [field]: trimmed || null }).eq('id', rowId).eq('user_id', userId)
  }

  function handleCellKey(e: React.KeyboardEvent, rowId: string, field: TextField) {
    if (e.key === 'Enter') commitCell(rowId, field, cellDraft)
    if (e.key === 'Escape') setActiveCell(null)
  }

  async function commitSize(rowId: string, value: string) {
    const v = value as EmployerSize | ''
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, size: v || undefined } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ size: v || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitEmployer(rowId: string, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, name: trimmed } : r))
    const { company, subsidiary } = parseEmployer(trimmed)
    const supabase = createClient()
    await supabase.from('employers').update({ name: company, business_unit: subsidiary || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitIndustrySegment(rowId: string, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, industry: trimmed } : r))
    const { industry, segment } = parseIndustry(trimmed)
    const supabase = createClient()
    await supabase.from('employers').update({ industry: industry || null, industry_segment: segment || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitTarget(rowId: string, checked: boolean) {
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, is_target: checked } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ is_target: checked }).eq('id', rowId).eq('user_id', userId)
  }

  // ── dialog helpers ────────────────────────────────────────────────────────

  function openDialog(row: Row) {
    setDialogRow(row)
    setDialogDraft({ ...row })
  }

  function closeDialog() {
    setDialogRow(null)
    setDialogDraft(null)
  }

  async function saveDialog() {
    if (!dialogDraft) return
    setDialogSaving(true)
    const supabase = createClient()
    const { company, subsidiary } = parseEmployer(dialogDraft.name)
    const { industry, segment } = parseIndustry(dialogDraft.industry ?? '')
    const { error } = await supabase.from('employers').update({
      name: company,
      business_unit: subsidiary || null,
      aka: dialogDraft.aka || null,
      industry: industry || null,
      industry_segment: segment || null,
      fudge_factor: dialogDraft.fudge_factor ?? null,
      size: dialogDraft.size || null,
      location: dialogDraft.location || null,
      website: dialogDraft.website || null,
      notes: dialogDraft.notes || null,
      is_target: dialogDraft.is_target,
    }).eq('id', dialogDraft.id).eq('user_id', userId)
    if (!error) {
      setRows(rs => rs.map(r => r.id === dialogDraft.id ? { ...dialogDraft } : r))
      closeDialog()
    }
    setDialogSaving(false)
  }

  function setDialog(k: keyof Row, v: string | boolean) {
    setDialogDraft(d => d ? { ...d, [k]: v } : d)
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async function deleteRow(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('employers').delete().eq('id', id).eq('user_id', userId)
    setRows(rs => rs.filter(r => r.id !== id))
    setDeletingId(null)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="text-gray-500">No employers tracked yet. Add companies you're interested in.</p>
      </div>
    )
  }

  const isActive = (rowId: string, field: TextField) =>
    activeCell?.rowId === rowId && activeCell?.field === field

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[28%]">Employer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[22%]">Industry Segment</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-[10%]">Fudge</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-[8%]">Target</th>
              <th className="px-4 py-3 w-[13%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.id} className="group hover:bg-gray-50">

                {/* Employer */}
                <td className="px-4 py-2" onClick={() => !isActive(row.id, 'name') && activateCell(row.id, 'name', row.name)}>
                  {isActive(row.id, 'name') ? (
                    <input
                      ref={inputRef}
                      value={cellDraft}
                      onChange={e => setCellDraft(e.target.value)}
                      onBlur={() => commitEmployer(row.id, cellDraft)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEmployer(row.id, cellDraft); if (e.key === 'Escape') setActiveCell(null) }}
                      className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  ) : (
                    <div className="flex items-center gap-2 cursor-pointer">
                      <span className="font-medium text-black">{row.name}</span>
                      {row.is_target && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Target</span>
                      )}
                    </div>
                  )}
                </td>

                {/* Industry Segment */}
                <td className="px-4 py-2 text-black" onClick={() => !isActive(row.id, 'industry') && activateCell(row.id, 'industry', row.industry ?? '')}>
                  {isActive(row.id, 'industry') ? (
                    <input
                      ref={inputRef}
                      value={cellDraft}
                      onChange={e => setCellDraft(e.target.value)}
                      onBlur={() => commitIndustrySegment(row.id, cellDraft)}
                      onKeyDown={e => { if (e.key === 'Enter') commitIndustrySegment(row.id, cellDraft); if (e.key === 'Escape') setActiveCell(null) }}
                      className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="cursor-pointer">{row.industry || <span className="text-gray-300">—</span>}</span>
                  )}
                </td>

                {/* Fudge Factor — spinner 0–9, saves on change */}
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={row.fudge_factor ?? ''}
                    onChange={e => {
                      const v = e.target.value === '' ? undefined : parseInt(e.target.value)
                      setRows(rs => rs.map(r => r.id === row.id ? { ...r, fudge_factor: v } : r))
                      const supabase = createClient()
                      supabase.from('employers').update({ fudge_factor: v ?? null }).eq('id', row.id).eq('user_id', userId)
                    }}
                    className="w-14 px-1 py-1 border border-transparent rounded text-sm text-black bg-transparent hover:border-gray-200 hover:bg-gray-100 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500 text-center"
                  />
                </td>

                {/* Target — immediate toggle */}
                <td className="px-4 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={row.is_target}
                    onChange={e => commitTarget(row.id, e.target.checked)}
                    className="rounded"
                  />
                </td>

                {/* Actions */}
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDialog(row)}
                      className="px-2.5 py-1 border border-gray-200 text-black rounded text-xs font-medium hover:bg-gray-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {dialogDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDialog} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Employer</h3>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employer</label>
              <input
                value={dialogDraft.name}
                onChange={e => setDialog('name', e.target.value)}
                placeholder="e.g. Acme Corp - Widget Division"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {parseEmployer(dialogDraft.name).company || '—'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subsidiary</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {parseEmployer(dialogDraft.name).subsidiary || '—'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">AKA</label>
              <input
                value={dialogDraft.aka ?? ''}
                onChange={e => setDialog('aka', e.target.value)}
                placeholder="e.g. Former name or common abbreviation"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Industry Segment</label>
              <input
                value={dialogDraft.industry ?? ''}
                onChange={e => setDialog('industry', e.target.value)}
                placeholder="e.g. Technology > SaaS"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {parseIndustry(dialogDraft.industry ?? '').industry || '—'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Segment</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {parseIndustry(dialogDraft.industry ?? '').segment || '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
                <select
                  value={dialogDraft.size ?? ''}
                  onChange={e => setDialog('size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fudge Factor (0–9)</label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={dialogDraft.fudge_factor ?? ''}
                  onChange={e => setDialog('fudge_factor', e.target.value === '' ? ('' as unknown as number) : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <input
                  value={dialogDraft.location ?? ''}
                  onChange={e => setDialog('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
              <input
                value={dialogDraft.website ?? ''}
                onChange={e => setDialog('website', e.target.value)}
                placeholder="https://"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                value={dialogDraft.notes ?? ''}
                onChange={e => setDialog('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dialogDraft.is_target}
                onChange={e => setDialog('is_target', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-black">Mark as target employer</span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { closeDialog(); deleteRow(dialogDraft.id) }}
                disabled={dialogSaving}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={saveDialog}
                  disabled={dialogSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {dialogSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 border border-gray-200 text-black rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
