'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddSkillForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [proficiency, setProficiency] = useState('')
  const [years, setYears] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('skills').insert({
      user_id: userId,
      name: name.trim(),
      category: category || null,
      proficiency: proficiency || null,
      years_experience: years ? parseFloat(years) : null,
    })
    setName(''); setCategory(''); setProficiency(''); setYears('')
    setSaving(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Skill *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. TypeScript" required
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Frontend"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Proficiency</label>
        <select value={proficiency} onChange={e => setProficiency(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Years</label>
        <input type="number" min="0" step="0.5" value={years} onChange={e => setYears(e.target.value)} placeholder="0"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <button type="submit" disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Adding…' : 'Add Skill'}
      </button>
    </form>
  )
}
