'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Resume, CareerHighlight, Achievement, Position } from '@/lib/types'

type Job = { id: string; position: string; employers?: { name: string; business_unit?: string; industry?: string; industry_segment?: string } }

function jobLabel(job: Job) {
  const emp = job.employers
  if (!emp) return job.position
  const empName = emp.business_unit ? `${emp.name} > ${emp.business_unit}` : emp.name
  return `${empName} — ${job.position}`
}

function employerSegment(job: Job) {
  return job.employers?.industry_segment || job.employers?.industry || ''
}

type EditForm = {
  type: 'Template' | 'Job'
  job_id: string
  industry_segment: string
  headline: string
  role: string
  specialty: string
  domain: string
  effective_date: string
  career_highlights_intro: string
}

function toEditForm(r: Resume): EditForm {
  return {
    type: (r.type as 'Template' | 'Job') ?? 'Template',
    job_id: r.job_id ?? '',
    industry_segment: r.industry_segment ?? '',
    headline: r.headline ?? '',
    role: r.role ?? '',
    specialty: r.specialty ?? '',
    domain: r.domain ?? '',
    effective_date: r.effective_date ?? '',
    career_highlights_intro: r.career_highlights_intro ?? '',
  }
}

export default function ResumesClient({
  initialResumes,
  initialJobs,
  userId,
  initialHighlights,
  initialAchievements,
  initialPositions,
}: {
  initialResumes: Resume[]
  initialJobs: Job[]
  userId: string
  initialHighlights: CareerHighlight[]
  initialAchievements: Achievement[]
  initialPositions: Position[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [resumes, setResumes] = useState<Resume[]>(initialResumes)
  const [jobs] = useState<Job[]>(initialJobs)
  const [selectedId, setSelectedId] = useState<string>(initialResumes[0]?.id ?? '')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ type: 'Template', job_id: '', industry_segment: '', headline: '', role: '', specialty: '', domain: '', effective_date: '', career_highlights_intro: '' })
  const [saving, setSaving] = useState(false)

  const [allHighlights] = useState<CareerHighlight[]>(initialHighlights)
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [linkedOrder, setLinkedOrder] = useState<string[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [showHighlightsDialog, setShowHighlightsDialog] = useState(false)

  const [allAchievements] = useState<Achievement[]>(initialAchievements)
  const [allPositions] = useState<Position[]>(initialPositions)
  const [linkedAchievementIds, setLinkedAchievementIds] = useState<Set<string>>(new Set())
  const [linkedAchievementOrder, setLinkedAchievementOrder] = useState<string[]>([])
  const [togglingAchievementId, setTogglingAchievementId] = useState<string | null>(null)
  const [dragSrcAchievementId, setDragSrcAchievementId] = useState<string | null>(null)
  const [dragOverAchievementId, setDragOverAchievementId] = useState<string | null>(null)
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [showAchievementsDialog, setShowAchievementsDialog] = useState(false)

  const selected = resumes.find(r => r.id === selectedId) ?? null
  const selectedDisplaySegment = selected?.type === 'Job' && selected?.job_id
    ? employerSegment(jobs.find(j => j.id === selected.job_id) ?? {} as Job) || selected.industry_segment
    : selected?.industry_segment

  const set = (k: keyof EditForm, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  const selectedJob = jobs.find(j => j.id === editForm.job_id)
  const jobPart = selectedJob ? (editForm.type === 'Job' ? jobLabel(selectedJob) : selectedJob.position) : ''
  const templateParts = [editForm.role, editForm.domain, editForm.industry_segment]
  const templateBracket = templateParts.some(Boolean)
    ? `${editForm.role || ''}_${editForm.domain || ''}_${editForm.industry_segment || ''}`
    : ''
  const calculatedTitle = editForm.type === 'Template'
    ? (templateBracket ? `[${templateBracket}]` : '')
    : [jobPart, editForm.industry_segment ? `[${editForm.industry_segment}]` : ''].filter(Boolean).join(' ')

  useEffect(() => {
    if (!selectedId) { setLinkedIds(new Set()); setLinkedOrder([]); return }
    setHighlightsLoading(true)
    supabase
      .from('resume_career_highlights')
      .select('career_highlight_id, index')
      .eq('resume_id', selectedId)
      .order('index', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as { career_highlight_id: string; index: number }[]
        const orderedIds = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(r => r.career_highlight_id)
        setLinkedIds(new Set(orderedIds))
        setLinkedOrder(orderedIds)
        setHighlightsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) { setLinkedAchievementIds(new Set()); setLinkedAchievementOrder([]); return }
    setAchievementsLoading(true)
    supabase
      .from('resume_position_highlights')
      .select('position_highlight_id, index')
      .eq('resume_id', selectedId)
      .order('index', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as { position_highlight_id: string; index: number }[]
        const orderedIds = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(r => r.position_highlight_id)
        setLinkedAchievementIds(new Set(orderedIds))
        setLinkedAchievementOrder(orderedIds)
        setAchievementsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function startEdit() {
    if (!selected) return
    const form = toEditForm(selected)
    if (form.type === 'Job' && form.job_id) {
      const job = jobs.find(j => j.id === form.job_id)
      if (job) form.industry_segment = employerSegment(job)
    }
    setEditForm(form)
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const { data, error } = await supabase.from('resumes').update({
      type: editForm.type,
      job_id: editForm.job_id || null,
      industry_segment: editForm.industry_segment || null,
      headline: editForm.headline || null,
      role: editForm.role || null,
      specialty: editForm.specialty || null,
      domain: editForm.domain || null,
      effective_date: editForm.effective_date || null,
      career_highlights_intro: editForm.career_highlights_intro || null,
      title: calculatedTitle || '(untitled)',
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id).eq('user_id', userId).select().single()
    if (!error && data) {
      setResumes(rs => rs.map(r => r.id === selected.id ? (data as Resume) : r))
      setEditing(false)
    }
    setSaving(false)
  }

  async function deleteResume() {
    if (!selected || !confirm('Delete this resume?')) return
    await supabase.from('resumes').delete().eq('id', selected.id).eq('user_id', userId)
    const remaining = resumes.filter(r => r.id !== selected.id)
    setResumes(remaining)
    setSelectedId(remaining[0]?.id ?? '')
    setEditing(false)
  }

  async function toggleLink(highlightId: string) {
    if (!selectedId) return
    setTogglingId(highlightId)
    if (linkedIds.has(highlightId)) {
      await supabase.from('resume_career_highlights')
        .delete()
        .eq('resume_id', selectedId)
        .eq('career_highlight_id', highlightId)
      const newOrder = linkedOrder.filter(hid => hid !== highlightId)
      setLinkedIds(prev => { const s = new Set(prev); s.delete(highlightId); return s })
      setLinkedOrder(newOrder)
      await persistLinkIndices(newOrder)
    } else {
      const nextIndex = linkedOrder.length + 1
      await supabase.from('resume_career_highlights')
        .insert({ resume_id: selectedId, career_highlight_id: highlightId, index: nextIndex })
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
        .eq('resume_id', selectedId)
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

  async function toggleAchievementLink(achievementId: string) {
    if (!selectedId) return
    setTogglingAchievementId(achievementId)
    if (linkedAchievementIds.has(achievementId)) {
      await supabase.from('resume_position_highlights')
        .delete()
        .eq('resume_id', selectedId)
        .eq('position_highlight_id', achievementId)
      const newOrder = linkedAchievementOrder.filter(aid => aid !== achievementId)
      setLinkedAchievementIds(prev => { const s = new Set(prev); s.delete(achievementId); return s })
      setLinkedAchievementOrder(newOrder)
      await persistAchievementIndices(newOrder)
    } else {
      const nextIndex = linkedAchievementOrder.length + 1
      await supabase.from('resume_position_highlights')
        .insert({ resume_id: selectedId, position_highlight_id: achievementId, index: nextIndex })
      const newOrder = [...linkedAchievementOrder, achievementId]
      setLinkedAchievementIds(prev => new Set([...prev, achievementId]))
      setLinkedAchievementOrder(newOrder)
    }
    setTogglingAchievementId(null)
  }

  async function persistAchievementIndices(orderedIds: string[]) {
    await Promise.all(orderedIds.map((aid, i) =>
      supabase.from('resume_position_highlights')
        .update({ index: i + 1 })
        .eq('resume_id', selectedId)
        .eq('position_highlight_id', aid)
    ))
    setLinkedAchievementOrder(orderedIds)
  }

  async function handleAchievementDrop(targetId: string) {
    if (!dragSrcAchievementId || dragSrcAchievementId === targetId) return
    setDragSrcAchievementId(null)
    setDragOverAchievementId(null)
    const srcIdx = linkedAchievementOrder.indexOf(dragSrcAchievementId)
    const tgtIdx = linkedAchievementOrder.indexOf(targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const reordered = [...linkedAchievementOrder]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    await persistAchievementIndices(reordered)
  }

  const highlightMap = Object.fromEntries(allHighlights.map(h => [h.id, h]))
  const linkedHighlights = linkedOrder.map(hid => highlightMap[hid]).filter(Boolean)

  const achievementMap = Object.fromEntries(allAchievements.map(a => [a.id, a]))
  const linkedAchievements = linkedAchievementOrder.map(aid => achievementMap[aid]).filter(Boolean)
  const positionMap = Object.fromEntries(allPositions.map(p => [p.id, p]))
  const achievementsByPosition = allPositions
    .map(p => ({ position: p, achievements: allAchievements.filter(a => a.position_id === p.id) }))
    .filter(g => g.achievements.length > 0)

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500'
  const readonlyCls = 'w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-700 bg-gray-50 min-h-[38px]'

  function Field({ label, value }: { label: string; value?: string | null }) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selector row */}
      <div className="flex items-center gap-3">
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setEditing(false) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 max-w-xl"
        >
          <option value="">Select a resume…</option>
          {resumes.map(r => (
            <option key={r.id} value={r.id}>{r.title || '(untitled)'}</option>
          ))}
        </select>
        {(() => {
          const idx = resumes.findIndex(r => r.id === selectedId)
          const btnCls = (disabled: boolean) =>
            `px-3 py-2 border rounded-lg text-sm font-bold leading-none transition-colors ${
              disabled
                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-white'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white cursor-pointer'
            }`
          return (
            <div className="flex items-center gap-1">
              <button type="button" title="Previous" disabled={idx <= 0}
                className={btnCls(idx <= 0)}
                onClick={() => { const prev = resumes[idx - 1]; if (prev) { setSelectedId(prev.id); setEditing(false) } }}>
                ←
              </button>
              <button type="button" title="Next" disabled={idx >= resumes.length - 1}
                className={btnCls(idx >= resumes.length - 1)}
                onClick={() => { const next = resumes[idx + 1]; if (next) { setSelectedId(next.id); setEditing(false) } }}>
                →
              </button>
            </div>
          )
        })()}
        {selected && !editing && (
          <button onClick={startEdit}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
        )}
        <button onClick={() => router.push('/resumes/new')}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      {/* Detail panel */}
      {selected && !editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Resume Title" value={selected.title} />
            <Field label="Type" value={selected.type} />
            {selected.job_id && (
              <Field label="Job" value={jobs.find(j => j.id === selected.job_id) ? jobLabel(jobs.find(j => j.id === selected.job_id)!) : selected.job_id} />
            )}
            <Field label="Industry Segment" value={selectedDisplaySegment} />
            <Field label="Role" value={selected.role} />
            <Field label="Specialty" value={selected.specialty} />
            <Field label="Domain" value={selected.domain} />
            {selected.effective_date && (
              <Field label="Effective Date" value={selected.effective_date} />
            )}
            <div className="col-span-2"><Field label="Headline" value={selected.headline} /></div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-gray-400 mb-0.5">Career Intro</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.career_highlights_intro || <span className="text-gray-400">—</span>}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inline edit form */}
      {selected && editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={editForm.type} onChange={e => { set('type', e.target.value); if (e.target.value === 'Template') { set('job_id', ''); set('industry_segment', '') } }}
                className={inputCls + ' bg-white'}>
                <option value="Template">Template</option>
                <option value="Job">Job</option>
              </select>
            </div>
            {editForm.type === 'Job' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Job</label>
                <select value={editForm.job_id} onChange={e => {
                  const job = jobs.find(j => j.id === e.target.value)
                  setEditForm(f => ({ ...f, job_id: e.target.value, industry_segment: job ? employerSegment(job) : '' }))
                }} className={inputCls + ' bg-white'}>
                  <option value="">— Not linked —</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Industry Segment</label>
            {editForm.type === 'Job' ? (
              <div className={readonlyCls}>{editForm.industry_segment || <span className="text-gray-300">—</span>}</div>
            ) : (
              <input value={editForm.industry_segment} onChange={e => set('industry_segment', e.target.value)} className={inputCls} />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resume Title</label>
            <div className={readonlyCls}>{calculatedTitle || <span className="text-gray-300">—</span>}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input value={editForm.role} onChange={e => set('role', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Specialty</label>
              <input value={editForm.specialty} onChange={e => set('specialty', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Domain</label>
            <input value={editForm.domain} onChange={e => set('domain', e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Effective Date</label>
            <input type="date" value={editForm.effective_date} onChange={e => set('effective_date', e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Headline</label>
            <input value={editForm.headline} onChange={e => set('headline', e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Career Intro</label>
            <textarea value={editForm.career_highlights_intro} onChange={e => set('career_highlights_intro', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button onClick={deleteResume}
              className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
              Delete
            </button>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Career Highlights pane */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Career Highlights</h3>
            <button
              type="button"
              onClick={() => setShowHighlightsDialog(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
          </div>

          {highlightsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : linkedHighlights.length === 0 ? (
            <p className="text-sm text-gray-400">No highlights linked yet.</p>
          ) : (
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
                  <div className="flex gap-3 flex-1 min-w-0">
                    {h.keywords && (
                      <p className="text-xs text-gray-400 whitespace-pre-wrap w-[35%] shrink-0">
                        {h.keywords.split(',').map(k => k.trim()).join('\n')}
                      </p>
                    )}
                    <div className="min-w-0 w-[65%]">
                      <p className="text-sm font-medium text-gray-800">{h.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Career Highlights dialog */}
      {showHighlightsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowHighlightsDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-black">Career Highlights</h2>
              <button
                type="button"
                onClick={() => setShowHighlightsDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {allHighlights.length === 0 ? (
                <p className="text-sm text-gray-400 p-6">No career highlights found. Add some on the Career Highlights page first.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {allHighlights.map(h => {
                    const linked = linkedIds.has(h.id)
                    return (
                      <li key={h.id} className={`flex items-start gap-3 px-6 py-4 ${linked ? 'bg-blue-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{h.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{h.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLink(h.id)}
                          disabled={togglingId === h.id}
                          className={`shrink-0 text-xs font-medium rounded px-2 py-1 border disabled:opacity-50 ${
                            linked
                              ? 'text-red-500 hover:text-red-700 border-red-100 hover:bg-red-50'
                              : 'text-blue-600 hover:text-blue-800 border-blue-100 hover:bg-blue-50'
                          }`}
                        >
                          {linked ? 'Remove' : '+ Link'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHighlightsDialog(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Position Achievements pane */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Position Achievements</h3>
            <button
              type="button"
              onClick={() => setShowAchievementsDialog(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
          </div>

          {achievementsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : linkedAchievements.length === 0 ? (
            <p className="text-sm text-gray-400">No achievements linked yet.</p>
          ) : (() => {
            const groups: { positionId: string; label: string; items: { achievement: typeof linkedAchievements[0]; globalIndex: number }[] }[] = []
            const positionOrder: string[] = []
            linkedAchievements.forEach((a, i) => {
              const pos = positionMap[a.position_id]
              const positionId = a.position_id ?? 'unknown'
              const label = pos ? `${pos.employer} - ${pos.title}` : 'Unknown'
              if (!positionOrder.includes(positionId)) { positionOrder.push(positionId); groups.push({ positionId, label, items: [] }) }
              groups.find(g => g.positionId === positionId)!.items.push({ achievement: a, globalIndex: i })
            })
            return (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {groups.map(({ positionId, label, items }) => (
                  <div key={positionId}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600">{label}</p>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {items.map(({ achievement: a, globalIndex: i }) => {
                        const pos = positionMap[a.position_id]
                        return (
                          <li
                            key={a.id}
                            draggable
                            onDragStart={() => setDragSrcAchievementId(a.id)}
                            onDragOver={e => { e.preventDefault(); if (dragSrcAchievementId && dragSrcAchievementId !== a.id) setDragOverAchievementId(a.id) }}
                            onDragLeave={() => setDragOverAchievementId(null)}
                            onDrop={e => { e.preventDefault(); handleAchievementDrop(a.id) }}
                            onDragEnd={() => { setDragSrcAchievementId(null); setDragOverAchievementId(null) }}
                            className={`flex items-start gap-3 px-4 py-3 bg-blue-50 transition-colors ${dragOverAchievementId === a.id ? 'border-l-2 border-blue-500' : ''} ${dragSrcAchievementId === a.id ? 'opacity-40' : ''}`}
                          >
                            <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                            <span className="text-xs font-medium text-blue-400 shrink-0 pt-0.5 w-5">#{i + 1}</span>
                            <div className="flex gap-3 flex-1 min-w-0">
                              {a.keywords && (
                                <p className="text-xs text-gray-400 whitespace-pre-wrap w-[35%] shrink-0">
                                  {a.keywords.split(',').map(k => k.trim()).join('\n')}
                                </p>
                              )}
                              <div className="min-w-0 w-[65%]">
                                <p className="text-sm text-gray-800 line-clamp-2">{a.description}</p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Position Achievements dialog */}
      {showAchievementsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAchievementsDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-black">Position Achievements</h2>
              <button
                type="button"
                onClick={() => setShowAchievementsDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {achievementsByPosition.length === 0 ? (
                <p className="text-sm text-gray-400 p-6">No achievements found. Add some on the Achievements page first.</p>
              ) : (
                achievementsByPosition.map(({ position, achievements }) => (
                  <div key={position.id}>
                    <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                      <p className="text-xs font-semibold text-gray-600">{position.title} · {position.employer}</p>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {achievements.map(a => {
                        const linked = linkedAchievementIds.has(a.id)
                        return (
                          <li key={a.id} className={`flex items-start gap-3 px-6 py-4 ${linked ? 'bg-blue-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800">{a.description}</p>
                              {a.keywords && (
                                <p className="text-xs text-gray-400 mt-0.5">{a.keywords}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleAchievementLink(a.id)}
                              disabled={togglingAchievementId === a.id}
                              className={`shrink-0 text-xs font-medium rounded px-2 py-1 border disabled:opacity-50 ${
                                linked
                                  ? 'text-red-500 hover:text-red-700 border-red-100 hover:bg-red-50'
                                  : 'text-blue-600 hover:text-blue-800 border-blue-100 hover:bg-blue-50'
                              }`}
                            >
                              {linked ? 'Remove' : '+ Link'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAchievementsDialog(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {!selected && resumes.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500">No resumes yet.</p>
        </div>
      )}
    </div>
  )
}
