'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Resume, CareerHighlight } from '@/lib/types'

type Job = { id: string; position: string; employers?: { name: string; business_unit?: string; industry?: string; industry_segment?: string } }

function jobLabel(job: Job) {
  const emp = job.employers
  if (!emp) return job.position
  const empName = emp.business_unit ? `${emp.name} > ${emp.business_unit}` : emp.name
  return `${empName} — ${job.position}`
}

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [form, setForm] = useState({
    type: 'Template' as 'Template' | 'Job',
    job_id: '',
    industry_segment: '',
    headline: '',
    career_highlights_intro: '',
  })

  const [allHighlights, setAllHighlights] = useState<CareerHighlight[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [linkedOrder, setLinkedOrder] = useState<string[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const selectedJob = jobs.find(j => j.id === form.job_id)
  const jobPart = selectedJob ? (form.type === 'Job' ? jobLabel(selectedJob) : selectedJob.position) : ''
  const templateParts = [form.role, form.domain, form.industry_segment]
  const templateBracket = templateParts.some(Boolean)
    ? `${form.role || ''}_${form.domain || ''}_${form.industry_segment || ''}`
    : ''
  const calculatedTitle = form.type === 'Template'
    ? (templateBracket ? `[${templateBracket}]` : '')
    : [jobPart, form.industry_segment ? `[${form.industry_segment}]` : ''].filter(Boolean).join(' ')

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }

      const [{ data: resume }, { data: jobsData }, { data: highlights }, { data: linked }] = await Promise.all([
        supabase.from('resumes').select('*').eq('id', id).eq('user_id', user.id).single(),
        supabase.from('jobs').select('id, position, employers(name, business_unit, industry, industry_segment)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('career_highlights').select('*').eq('user_id', user.id).order('index', { ascending: true }),
        supabase.from('resume_career_highlights').select('career_highlight_id, index').eq('resume_id', id).order('index', { ascending: true }),
      ])

      if (!resume) { router.push('/resumes'); return }

      const jobsList = (jobsData as Job[]) ?? []
      setJobs(jobsList)

      const r = resume as Resume
      const resumeType = (r.type as 'Template' | 'Job') ?? 'Template'
      const linkedJob = jobsList.find(j => j.id === r.job_id)
      const derivedSegment = resumeType === 'Job'
        ? (linkedJob?.employers?.industry_segment || linkedJob?.employers?.industry || '')
        : (r.industry_segment ?? '')
      setForm({
        type: resumeType,
        job_id: r.job_id ?? '',
        industry_segment: derivedSegment,
        headline: r.headline ?? '',
        career_highlights_intro: r.career_highlights_intro ?? '',
        summary: (r.content as Record<string, string>)?.summary ?? '',
      })

      setAllHighlights((highlights ?? []) as CareerHighlight[])

      const linkedRows = (linked ?? []) as { career_highlight_id: string; index: number }[]
      const orderedIds = [...linkedRows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(r => r.career_highlight_id)
      setLinkedIds(new Set(orderedIds))
      setLinkedOrder(orderedIds)

      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { error } = await supabase.from('resumes').update({
      title: calculatedTitle || '(untitled)',
      type: form.type,
      job_id: form.job_id || null,
      industry_segment: form.industry_segment || null,
      headline: form.headline || null,
      career_highlights_intro: form.career_highlights_intro || null,
      content: {},
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', user.id)
    if (!error) router.push('/resumes')
    else { alert(error.message); setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm('Delete this resume?')) return
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('resumes').delete().eq('id', id).eq('user_id', user.id)
    router.push('/resumes')
  }

  async function toggleLink(highlightId: string) {
    setTogglingId(highlightId)
    if (linkedIds.has(highlightId)) {
      await supabase.from('resume_career_highlights')
        .delete()
        .eq('resume_id', id)
        .eq('career_highlight_id', highlightId)
      const newOrder = linkedOrder.filter(hid => hid !== highlightId)
      setLinkedIds(prev => { const s = new Set(prev); s.delete(highlightId); return s })
      setLinkedOrder(newOrder)
      await persistLinkIndices(newOrder)
    } else {
      const nextIndex = linkedOrder.length + 1
      await supabase.from('resume_career_highlights')
        .insert({ resume_id: id, career_highlight_id: highlightId, index: nextIndex })
      const newOrder = [...linkedOrder, highlightId]
      setLinkedIds(prev => new Set([...prev, highlightId]))
      setLinkedOrder(newOrder)
    }
    setTogglingId(null)
  }

  async function persistLinkIndices(orderedIds: string[]) {
    await Promise.all(orderedIds.map((hid, i) =>
      supabase.from('resume_career_highlights')
        .update({ index: i + 1 })
        .eq('resume_id', id)
        .eq('career_highlight_id', hid)
    ))
    setLinkedOrder(orderedIds)
  }

  async function handleDrop(targetId: string) {
    if (!dragSrcId || dragSrcId === targetId) return
    setDragSrcId(null)
    setDragOverId(null)
    const srcIdx = linkedOrder.indexOf(dragSrcId)
    const tgtIdx = linkedOrder.indexOf(targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...linkedOrder]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistLinkIndices(reordered)
  }

  const highlightMap = Object.fromEntries(allHighlights.map(h => [h.id, h]))
  const linkedHighlights = linkedOrder.map(hid => highlightMap[hid]).filter(Boolean)
  const availableHighlights = allHighlights.filter(h => !linkedIds.has(h.id))

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-blue-900">Edit Resume</h2>

      {/* Main resume form */}
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
            {calculatedTitle || <span className="text-gray-300">—</span>}
          </div>
        </div>

        <Field label="Headline" value={form.headline} onChange={v => set('headline', v)} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Career Intro</label>
          <textarea value={form.career_highlights_intro} onChange={e => set('career_highlights_intro', e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => router.push('/resumes')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Career Highlights pane */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="text-base font-semibold text-gray-800">Career Highlights</h3>

        {allHighlights.length === 0 ? (
          <p className="text-sm text-gray-400">No career highlights found. Add some on the Career Highlights page first.</p>
        ) : (
          <>
            {/* Linked highlights */}
            {linkedHighlights.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Linked ({linkedHighlights.length})</p>
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                  {linkedHighlights.map((h, i) => (
                    <li
                      key={h.id}
                      draggable
                      onDragStart={() => setDragSrcId(h.id)}
                      onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== h.id) setDragOverId(h.id) }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={e => { e.preventDefault(); handleDrop(h.id) }}
                      onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                      className={`flex items-start gap-3 px-4 py-3 bg-blue-50 transition-colors ${dragOverId === h.id ? 'border-l-2 border-blue-500' : ''} ${dragSrcId === h.id ? 'opacity-40' : ''}`}
                    >
                      <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                      <span className="text-xs font-medium text-blue-400 shrink-0 pt-0.5 w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{h.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLink(h.id)}
                        disabled={togglingId === h.id}
                        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 border border-red-100 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Available highlights */}
            {availableHighlights.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available</p>
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                  {availableHighlights.map(h => (
                    <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{h.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLink(h.id)}
                        disabled={togglingId === h.id}
                        className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-100 rounded px-2 py-1 hover:bg-blue-50 disabled:opacity-50"
                      >
                        + Link
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
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
