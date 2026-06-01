'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewResumePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [jobs, setJobs] = useState<{ id: string; position: string; employers?: { name: string; business_unit?: string; industry?: string; industry_segment?: string } }[]>([])
  const [form, setForm] = useState({
    title: '',
    type: 'Template' as 'Template' | 'Job',
    job_id: '',
    industry_segment: '',
    headline: '',
    role: '',
    specialty: '',
    domain: '',
    effective_date: '',
    career_highlights_intro: '',
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const selectedJob = jobs.find(j => j.id === form.job_id)
  const jobPart = selectedJob ? (form.type === 'Job' ? jobLabel(selectedJob) : selectedJob.position) : ''
  const templateParts = [form.role, form.domain, form.industry_segment]
  const templateBracket = templateParts.some(Boolean)
    ? `${form.role || ''}_${form.domain || ''}_${form.industry_segment || ''}`
    : ''
  const calculatedName = form.type === 'Template'
    ? (templateBracket ? `[${templateBracket}]` : '')
    : [jobPart, form.industry_segment ? `[${form.industry_segment}]` : ''].filter(Boolean).join(' ')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('jobs')
        .select('id, position, employers(name, business_unit, industry, industry_segment)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setJobs((data as typeof jobs) ?? []))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('resumes').insert({
      user_id: user.id,
      title: calculatedName || '(untitled)',
      type: form.type,
      job_id: form.job_id || null,
      industry_segment: form.industry_segment || null,
      headline: form.headline || null,
      role: form.role || null,
      specialty: form.specialty || null,
      domain: form.domain || null,
      effective_date: form.effective_date || null,
      career_highlights_intro: form.career_highlights_intro || null,
      content: {},
    })
    if (!error) router.push('/resumes')
    else { alert(error.message); setSaving(false) }
  }

  function jobLabel(job: typeof jobs[number]) {
    const emp = job.employers
    if (!emp) return job.position
    const empName = emp.business_unit ? `${emp.name} > ${emp.business_unit}` : emp.name
    return `${empName} — ${job.position}`
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">New Resume</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={e => { set('type', e.target.value); if (e.target.value === 'Template') { set('job_id', ''); set('industry_segment', '') } }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="Template">Template</option>
              <option value="Job">Job</option>
            </select>
          </div>
          {form.type === 'Job' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
              <select value={form.job_id} onChange={e => {
                const job = jobs.find(j => j.id === e.target.value)
                setForm(f => ({ ...f, job_id: e.target.value, industry_segment: job?.employers?.industry_segment || job?.employers?.industry || '' }))
              }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Not linked —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
              </select>
            </div>
          )}
        </div>

        {form.type === 'Job' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry Segment</label>
            <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-700 bg-gray-50 min-h-[38px]">
              {form.industry_segment || <span className="text-gray-300">—</span>}
            </div>
          </div>
        ) : (
          <Field label="Industry Segment" value={form.industry_segment} onChange={v => set('industry_segment', v)} />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume Title</label>
          <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-700 bg-gray-50 min-h-[38px]">
            {calculatedName || <span className="text-gray-300">—</span>}
          </div>
        </div>
        <Field label="Headline" value={form.headline} onChange={v => set('headline', v)} />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Role" value={form.role} onChange={v => set('role', v)} />
          <Field label="Specialty" value={form.specialty} onChange={v => set('specialty', v)} />
        </div>

        <Field label="Domain" value={form.domain} onChange={v => set('domain', v)} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
          <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Career Intro</label>
          <textarea value={form.career_highlights_intro} onChange={e => set('career_highlights_intro', e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Resume'}
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

function Field({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
