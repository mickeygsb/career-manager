'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewContactPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', company: '', email: '', linkedin_url: '', notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('contacts').insert({
      user_id: user.id, name: form.name,
      title: form.title || null, company: form.company || null,
      email: form.email || null, linkedin_url: form.linkedin_url || null,
      notes: form.notes || null,
    })
    if (!error) router.push('/contacts')
    else { alert(error.message); setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold mb-6">New Contact</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Field label="Name *" value={form.name} onChange={v => set('name', v)} required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" value={form.title} onChange={v => set('title', v)} />
          <Field label="Company" value={form.company} onChange={v => set('company', v)} />
        </div>
        <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
        <Field label="LinkedIn URL" value={form.linkedin_url} onChange={v => set('linkedin_url', v)} type="url" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Contact'}
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
