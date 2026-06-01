'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { JobStatus } from '@/lib/types'
import { JOB_STATUS_DETAIL_OPTIONS } from '@/lib/types'

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

export default function NewJobPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [employers, setEmployers] = useState<{ id: string; name: string; business_unit?: string }[]>([])
  const [form, setForm] = useState({
    employer_id: '',
    position: '',
    status: 'pending_review' as JobStatus,
    status_detail: '',
    location: 'Austin, TX',
    date_opened: new Date().toISOString().slice(0, 10),
    date_applied: '',
    date_closed: '',
    linkedin_url: '',
    career_site_url: '',
    career_site_id: '',
    next_step: '',
    job_description: '',
    notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('employers').select('id, name, business_unit').eq('user_id', user.id).order('name')
        .then(({ data }) => setEmployers(data ?? []))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('jobs').insert({
      user_id: user.id,
      employer_id: form.employer_id || null,
      position: form.position,
      status: form.status,
      status_detail: form.status_detail || null,
      location: form.location || null,
      date_opened: form.date_opened || null,
      date_applied: form.date_applied || null,
      date_closed: form.date_closed || null,
      linkedin_url: form.linkedin_url || null,
      career_site_url: form.career_site_url || null,
      career_site_id: form.career_site_id || null,
      next_step: form.next_step || null,
      job_description: form.job_description || null,
      notes: form.notes || null,
    })
    if (!error) router.push('/jobs')
    else { alert(error.message); setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">New Job</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employer</label>
          <select value={form.employer_id} onChange={e => set('employer_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">— Not linked —</option>
            {employers.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.business_unit ? `${emp.name} > ${emp.business_unit}` : emp.name}
              </option>
            ))}
          </select>
        </div>

        <Field label="Position *" value={form.position} onChange={v => set('position', v)} required />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => { set('status', e.target.value); set('status_detail', '') }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {JOB_STATUS_DETAIL_OPTIONS[form.status] && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status Detail</label>
              <select value={form.status_detail} onChange={e => set('status_detail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Select —</option>
                {JOB_STATUS_DETAIL_OPTIONS[form.status]!.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
        </div>
        <Field label="Location" value={form.location} onChange={v => set('location', v)} />

        <div className="grid grid-cols-3 gap-4">
          <Field label="Date Opened" value={form.date_opened} onChange={v => set('date_opened', v)} type="date" />
          <Field label="Date Applied" value={form.date_applied} onChange={v => set('date_applied', v)} type="date" />
          <Field label="Date Closed" value={form.date_closed} onChange={v => set('date_closed', v)} type="date" />
        </div>

        <Field label="LinkedIn URL" value={form.linkedin_url} onChange={v => set('linkedin_url', v)} type="url" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Career Site URL" value={form.career_site_url} onChange={v => set('career_site_url', v)} type="url" />
          <Field label="Career Site ID" value={form.career_site_id} onChange={v => set('career_site_id', v)} />
        </div>

        <Field label="Next Step" value={form.next_step} onChange={v => set('next_step', v)} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
          <textarea value={form.job_description} onChange={e => set('job_description', e.target.value)} rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Job'}
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
