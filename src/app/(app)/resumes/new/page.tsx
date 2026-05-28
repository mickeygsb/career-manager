'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewResumePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('resumes').insert({
      user_id: user.id,
      title,
      content: { summary },
      is_default: isDefault,
    })
    if (!error) router.push('/resumes')
    else { alert(error.message); setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">New Resume</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Engineer - 2026" required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Professional Summary</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={5}
            placeholder="A brief summary of your professional background and key strengths..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Set as default resume</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Resume'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
