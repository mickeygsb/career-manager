'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmployerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: EmployerSize | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: '1-10', label: '1 - 10' },
  { value: '10-100', label: '10 - 100' },
  { value: '100-1000', label: '100 - 1000' },
  { value: '1000-10000', label: '1000 - 10000' },
  { value: '10000+', label: '10000+' },
]

function parseEmployer(name: string) {
  const idx = name.indexOf(' > ')
  return idx === -1
    ? { company: name, subsidiary: '' }
    : { company: name.slice(0, idx), subsidiary: name.slice(idx + 3) }
}

type EmployerRef = { id: string; name: string; subsidiary?: string; location?: string }

type Props = {
  userId: string
  onSave: (emp: EmployerRef) => void
  onClose: () => void
}

export default function AddEmployerDialog({ userId, onSave, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', aka: '', industry: '', location: 'TX-Austin',
    is_target: false, growing_company: false,
    size: '' as EmployerSize | '', fudge_factor: '3',
    career_site_url: '', website: '', linkedin_company_codes: '', address: '',
    employer_intro: '', notes: '',
  })
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const { company, subsidiary } = parseEmployer(form.name)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('employers').insert({
      user_id: userId,
      name: company || form.name.trim(),
      subsidiary: subsidiary || null,
      aka: form.aka || null,
      industry_segment: form.industry || null,
      location: form.location || null,
      is_target: form.is_target,
      growing_company: form.growing_company,
      size: form.size || null,
      fudge_factor: form.fudge_factor !== '' ? parseInt(form.fudge_factor) : null,
      career_site_url: form.career_site_url || null,
      website: form.website || null,
      linkedin_company_codes: form.linkedin_company_codes || null,
      address: form.address || null,
      employer_intro: form.employer_intro || null,
      notes: form.notes || null,
      active: true,
    }).select('id, name, subsidiary, location').single()
    if (!error && data) {
      onSave({ id: data.id, name: data.name, subsidiary: data.subsidiary ?? undefined, location: data.location ?? undefined })
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-lg font-semibold text-black px-6 pt-6 pb-2 shrink-0">Add Employer</h3>
        <div className="px-6 pb-4 space-y-3 overflow-y-auto flex-1">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Employer *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Acme Corp > Widget Division"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(company || subsidiary) && (
              <p className="mt-1 text-xs text-gray-400">
                {company}{subsidiary && <> › <em>{subsidiary}</em></>}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">AKA</label>
            <input
              value={form.aka}
              onChange={e => set('aka', e.target.value)}
              placeholder="e.g. Former name or abbreviation"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Industry Segment</label>
            <input
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              placeholder="e.g. Technology > SaaS"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <input
              value={form.location}
              onChange={e => set('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_target} onChange={e => set('is_target', e.target.checked)} className="rounded" />
            <span className="text-sm text-black">Evergreen Target</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.growing_company} onChange={e => set('growing_company', e.target.checked)} className="rounded" />
            <span className="text-sm text-black">Growing company</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
            <select
              value={form.size}
              onChange={e => set('size', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fudge (0–9)</label>
            <input
              type="number" min={0} max={9}
              value={form.fudge_factor}
              onChange={e => set('fudge_factor', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Career Site URL</label>
            <input
              value={form.career_site_url}
              onChange={e => set('career_site_url', e.target.value)}
              placeholder="https://"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
            <input
              value={form.website}
              onChange={e => set('website', e.target.value)}
              placeholder="https://"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn Company Codes</label>
            <input
              value={form.linkedin_company_codes}
              onChange={e => set('linkedin_company_codes', e.target.value)}
              placeholder="e.g. 1234,5678"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Employer Intro</label>
          <textarea
            value={form.employer_intro}
            onChange={e => set('employer_intro', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Employer'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-black rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
