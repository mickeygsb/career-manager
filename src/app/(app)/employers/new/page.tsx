'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EmployerSize } from '@/lib/types'

export default function NewEmployerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', aka: '', website: '', industry: '', size: '' as EmployerSize | '',
    location: 'TX-Austin', address: '', linkedin_company_codes: '', career_site_url: '',
    notes: '', is_target: false, growing_company: false, fudge_factor: '3',
  })
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const employerIdx = form.name.indexOf(' > ')
  const company = employerIdx === -1 ? form.name : form.name.slice(0, employerIdx)
  const subsidiary = employerIdx === -1 ? '' : form.name.slice(employerIdx + 3)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('employers').insert({
      user_id: user.id,
      name: company,
      subsidiary: subsidiary || null,
      aka: form.aka || null,
      website: form.website || null,
      industry_segment: form.industry || null,
      fudge_factor: form.fudge_factor !== '' ? parseInt(form.fudge_factor) : null,
      size: form.size || null,
      location: form.location || null,
      address: form.address || null,

      linkedin_company_codes: form.linkedin_company_codes || null,
      career_site_url: form.career_site_url || null,
      notes: form.notes || null,
      is_target: form.is_target,
      growing_company: form.growing_company,
      active: true,
    })
    if (!error) router.push('/employers')
    else { alert(error.message); setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">New Employer</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">

        {/* Employer / AKA */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Field label="Employer *" value={form.name} onChange={v => set('name', v)} required />
            {(company || subsidiary) && (
              <p className="mt-1 text-xs text-gray-400">
                {company}{subsidiary && <> › <em>{subsidiary}</em></>}
              </p>
            )}
          </div>
          <Field label="AKA" value={form.aka} onChange={v => set('aka', v)} />
        </div>

        {/* Industry Segment / Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Field label="Industry Segment" value={form.industry} onChange={v => set('industry', v)} />
          </div>
          <Field label="Location" value={form.location} onChange={v => set('location', v)} />
        </div>

        {/* Flags */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_target} onChange={e => set('is_target', e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Evergreen Target</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.growing_company} onChange={e => set('growing_company', e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Growing company</span>
          </label>
        </div>

        {/* Size / Fudge */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Company Size"
            value={form.size}
            onChange={v => set('size', v)}
            options={[
              { value: '', label: 'Not specified' },
              { value: '1-10', label: '1 - 10' },
              { value: '10-100', label: '10 - 100' },
              { value: '100-1000', label: '100 - 1000' },
              { value: '1000-10000', label: '1000 - 10000' },
              { value: '10000+', label: '10000+' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fudge Factor (0–9)</label>
            <input
              type="number" min={0} max={9}
              value={form.fudge_factor}
              onChange={e => set('fudge_factor', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Career Site URL / Website */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Career Site URL" value={form.career_site_url} onChange={v => set('career_site_url', v)} type="url" />
          <Field label="Website" value={form.website} onChange={v => set('website', v)} type="url" />
        </div>

        {/* LinkedIn Company Codes / Address */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="LinkedIn Company Codes" value={form.linkedin_company_codes} onChange={v => set('linkedin_company_codes', v)} />
          <Field label="Address" value={form.address} onChange={v => set('address', v)} />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Employer'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, required, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
