'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ApplicationStatus, RemoteType } from '@/lib/types'

export default function NewJobPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company: '', role: '', status: 'wishlist' as ApplicationStatus,
    url: '', location: '', remote_type: '' as RemoteType | '',
    salary_min: '', salary_max: '', notes: '', applied_at: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error } = await supabase.from('job_applications').insert({
      user_id: user.id,
      company: form.company, role: form.role, status: form.status,
      url: form.url || null, location: form.location || null,
      remote_type: form.remote_type || null,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      notes: form.notes || null,
      applied_at: form.applied_at || null,
    })
    if (!error) router.push('/jobs')
    else { alert(error.message); setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">New Application</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company *" value={form.company} onChange={v => set('company', v)} required />
          <Field label="Role *" value={form.role} onChange={v => set('role', v)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Status" value={form.status} onChange={v => set('status', v)}
            options={[
              { value: 'wishlist', label: 'Wishlist' }, { value: 'applied', label: 'Applied' },
              { value: 'phone_screen', label: 'Phone Screen' }, { value: 'interview', label: 'Interview' },
              { value: 'offer', label: 'Offer' }, { value: 'rejected', label: 'Rejected' }, { value: 'withdrawn', label: 'Withdrawn' },
            ]} />
          <SelectField label="Remote Type" value={form.remote_type} onChange={v => set('remote_type', v)}
            options={[{ value: '', label: 'Not specified' }, { value: 'remote', label: 'Remote' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'onsite', label: 'Onsite' }]} />
        </div>
        <Field label="Location" value={form.location} onChange={v => set('location', v)} />
        <Field label="Job URL" value={form.url} onChange={v => set('url', v)} type="url" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Salary Min ($)" value={form.salary_min} onChange={v => set('salary_min', v)} type="number" />
          <Field label="Salary Max ($)" value={form.salary_max} onChange={v => set('salary_max', v)} type="number" />
        </div>
        <Field label="Applied Date" value={form.applied_at} onChange={v => set('applied_at', v)} type="date" />
        <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Application'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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
