'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Job, JobStatus, Keyword } from '@/lib/types'
import { JOB_STATUS_DETAIL_OPTIONS } from '@/lib/types'
import AddEmployerDialog from '@/components/AddEmployerDialog'

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-amber-100 text-amber-700',
  open:           'bg-green-100 text-green-700',
  closed:         'bg-slate-300 text-slate-700',
}

type JobKeyword = { id: string; keyword_id: string; priority: 'must_have' | 'nice_to_have' }

type EmployerRef = { id: string; name: string; subsidiary?: string; location?: string; industry?: string; industry_segment?: string }

function employerLabel(emp: EmployerRef) {
  return emp.subsidiary ? `${emp.name} > ${emp.subsidiary}` : emp.name
}

function jobEmployerName(job: Job) {
  if (!job.employers) return null
  return job.employers.subsidiary
    ? `${job.employers.name} > ${job.employers.subsidiary}`
    : job.employers.name
}

type Draft = {
  id: string
  employer_id: string
  position: string
  role: string
  domain: string
  specialty: string
  status: JobStatus
  status_detail: string
  location: string
  date_opened: string
  date_applied: string
  date_closed: string
  linkedin_url: string
  career_site_url: string
  career_site_id: string
  next_step: string
  job_description: string
  notes: string
  active: boolean
  favorite: boolean
}

type AddForm = Omit<Draft, 'id'>

const defaultAddForm = (): AddForm => ({
  employer_id: '',
  position: '',
  role: '',
  domain: '',
  specialty: '',
  status: 'draft',
  status_detail: '',
  location: '',
  date_opened: new Date().toISOString().slice(0, 10),
  date_applied: '',
  date_closed: '',
  linkedin_url: '',
  career_site_url: '',
  career_site_id: '',
  next_step: '',
  job_description: '',
  notes: '',
  active: true,
  favorite: false,
})

function toDraft(job: Job): Draft {
  return {
    id: job.id,
    employer_id: job.employer_id ?? '',
    position: job.position,
    role: job.role ?? '',
    domain: job.domain ?? '',
    specialty: job.specialty ?? '',
    status: job.status,
    status_detail: job.status_detail ?? '',
    location: job.location ?? '',
    date_opened: job.date_opened ?? '',
    date_applied: job.date_applied ?? '',
    date_closed: job.date_closed ?? '',
    linkedin_url: job.linkedin_url ?? '',
    career_site_url: job.career_site_url ?? '',
    career_site_id: job.career_site_id ?? '',
    next_step: job.next_step ?? '',
    job_description: job.job_description ?? '',
    notes: job.notes ?? '',
    active: job.active ?? false,
    favorite: job.favorite ?? false,
  }
}

export default function JobsClient({
  initialJobs,
  employers,
  userId,
}: {
  initialJobs: Job[]
  employers: EmployerRef[]
  userId: string
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [filter, setFilter] = useState('')
  const [filterEmployer, setFilterEmployer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStatusDetail, setFilterStatusDetail] = useState('')
  const [filterSegment, setFilterSegment] = useState('')
  const [filterActive, setFilterActive] = useState(false)
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [filterNextStep, setFilterNextStep] = useState(false)
  const [dialog, setDialog] = useState<Draft | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(defaultAddForm)
  const [addSaving, setAddSaving] = useState(false)
  const [sortOrder, setSortOrder] = useState<{ key: string; dir: 'asc' | 'desc' }[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [employersList, setEmployersList] = useState<EmployerRef[]>(employers)
  const [showAddEmployerDialog, setShowAddEmployerDialog] = useState(false)

  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [allKwLoaded, setAllKwLoaded] = useState(false)
  const [jobKeywords, setJobKeywords] = useState<JobKeyword[]>([])
  const [kwSearch, setKwSearch] = useState('')
  const [kwSelectedId, setKwSelectedId] = useState('')
  const [kwShowDropdown, setKwShowDropdown] = useState(false)
  const [kwLoading, setKwLoading] = useState(false)
  const [kwAdding, setKwAdding] = useState(false)
  const kwDropdownRef = useRef<HTMLDivElement>(null)
  const [filterKwText, setFilterKwText] = useState('')
  const [filterKwCategory, setFilterKwCategory] = useState('')
  const [filterKwCategoryDetail, setFilterKwCategoryDetail] = useState('')
  const [dragJobKwState, setDragJobKwState] = useState<{ source: 'must_have' | 'nice_to_have' | 'not_needed'; jkId?: string; kwId: string } | null>(null)
  const [dragOverJobKwCol, setDragOverJobKwCol] = useState<'must_have' | 'nice_to_have' | 'not_needed' | null>(null)

  type ResumeRef = { id: string; title: string; type: string }
  const [allResumes, setAllResumes] = useState<ResumeRef[]>([])
  const [resumesLoaded, setResumesLoaded] = useState(false)
  const [dialogResumeId, setDialogResumeId] = useState('')
  const [dialogOrigResumeId, setDialogOrigResumeId] = useState('')
  const [dialogOrig, setDialogOrig] = useState<Draft | null>(null)
  const pendingResumeNavRef = useRef<(() => void) | null>(null)
  const [showResumeNavConfirm, setShowResumeNavConfirm] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [cloningResume, setCloningResume] = useState(false)
  const [updatingAllKwToResume, setUpdatingAllKwToResume] = useState(false)
  const [allKwToResumeUpdated, setAllKwToResumeUpdated] = useState(false)

  useEffect(() => {
    try {
      setFilter(localStorage.getItem('jobFilter') ?? '')
      setFilterEmployer(localStorage.getItem('jobFilterEmployer') ?? '')
      setFilterStatus(localStorage.getItem('jobFilterStatus') ?? '')
      setFilterStatusDetail(localStorage.getItem('jobFilterStatusDetail') ?? '')
      setFilterSegment(localStorage.getItem('jobFilterSegment') ?? '')
      setFilterActive(localStorage.getItem('jobFilterActive') === 'true')
      setFilterFavorite(localStorage.getItem('jobFilterFavorite') === 'true')
      setFilterNextStep(localStorage.getItem('jobFilterNextStep') === 'true')
      const stored = localStorage.getItem('jobSortOrder')
      if (stored) {
        setSortOrder(JSON.parse(stored))
      } else {
        const key = localStorage.getItem('jobSortKey')
        const dir = (localStorage.getItem('jobSortDir') as 'asc' | 'desc') || 'asc'
        if (key) setSortOrder([{ key, dir }])
      }
      const autoOpenId = localStorage.getItem('jobAutoOpenId')
      if (autoOpenId) {
        localStorage.removeItem('jobAutoOpenId')
        const job = initialJobs.find(j => j.id === autoOpenId)
        if (job) openDialog(job)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [editing, setEditing] = useState<{ jobId: string; field: string } | null>(null)

  const router = useRouter()
  const employerMap = Object.fromEntries(employersList.map(e => [e.id, e]))
  const isDirty = !!(dialog && dialogOrig && (
    JSON.stringify(dialog) !== JSON.stringify(dialogOrig) ||
    dialogResumeId !== dialogOrigResumeId
  ))

  function startEdit(jobId: string, field: string) { setEditing({ jobId, field }) }
  function cancelEdit() { setEditing(null) }
  function setAF(k: keyof AddForm, v: string | boolean) { setAddForm(f => ({ ...f, [k]: v })) }

  async function saveAdd() {
    if (!addForm.position) return
    setAddSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('jobs').insert({
      user_id: userId,
      employer_id: addForm.employer_id || null,
      position: addForm.position,
      industry: addForm.employer_id ? (employers.find(em => em.id === addForm.employer_id)?.industry || null) : null,
      role: addForm.role || null,
      domain: addForm.domain || null,
      specialty: addForm.specialty || null,
      status: addForm.status,
      status_detail: addForm.status_detail || null,
      location: addForm.location || null,
      date_opened: addForm.date_opened || null,
      date_applied: addForm.date_applied || null,
      date_closed: addForm.date_closed || null,
      linkedin_url: addForm.linkedin_url || null,
      career_site_url: addForm.career_site_url || null,
      career_site_id: addForm.career_site_id || null,
      next_step: addForm.next_step || null,
      job_description: addForm.job_description || null,
      notes: addForm.notes || null,
      active: addForm.active,
    }).select('*, employers(name, subsidiary, industry, industry_segment)').single()
    if (!error && data) {
      setJobs(js => [data, ...js])
      setShowAdd(false)
      setAddForm(defaultAddForm())
    }
    setAddSaving(false)
  }

  async function commitEdit(jobId: string, field: string, value: string) {
    setEditing(null)
    const supabase = createClient()
    const payload: Record<string, string | boolean | null> = { [field]: value || null, updated_at: new Date().toISOString() }
    if (field === 'status') payload.status_detail = null
    if (field === 'status_detail' && value === "Didn't Apply") payload.active = false
    const { error } = await supabase.from('jobs').update(payload).eq('id', jobId).eq('user_id', userId)
    if (!error) {
      setJobs(js => js.map(j => {
        if (j.id !== jobId) return j
        if (field === 'status') return { ...j, status: value as JobStatus, status_detail: undefined }
        if (field === 'status_detail' && value === "Didn't Apply") return { ...j, status_detail: value, active: false }
        return { ...j, [field]: value || undefined }
      }))
    }
  }

  useEffect(() => {
    if (!dialog) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeDialog(); return }
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault()
        saveDialog()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, dialogSaving])

  useEffect(() => {
    if (!showAdd) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowAdd(false); return }
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault()
        saveAdd()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, addForm, addSaving])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (kwDropdownRef.current && !kwDropdownRef.current.contains(e.target as Node)) {
        setKwShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  async function loadAllKeywords() {
    const supabase = createClient()
    const { data } = await supabase.from('keywords').select('*').order('keyword')
    if (data) { setAllKeywords(data as Keyword[]); setAllKwLoaded(true) }
  }

  async function loadJobKeywords(jobId: string) {
    setKwLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('job_keywords').select('id, keyword_id, priority').eq('job_id', jobId)
    if (data) setJobKeywords(data as JobKeyword[])
    setKwLoading(false)
  }

  async function addJobKeyword(priority: 'must_have' | 'nice_to_have') {
    if (!dialog || !kwSelectedId) return
    setKwAdding(true)
    const supabase = createClient()
    const existing = jobKeywords.find(jk => jk.keyword_id === kwSelectedId)
    if (existing) {
      if (existing.priority === priority) { setKwAdding(false); return }
      const { error } = await supabase.from('job_keywords').update({ priority }).eq('id', existing.id)
      if (!error) {
        setJobKeywords(prev => prev.map(jk => jk.id === existing.id ? { ...jk, priority } : jk))
        setKwSelectedId('')
        setKwSearch('')
      }
    } else {
      const { data, error } = await supabase.from('job_keywords')
        .insert({ job_id: dialog.id, keyword_id: kwSelectedId, priority, user_id: userId })
        .select('id, keyword_id, priority')
        .single()
      if (!error && data) {
        setJobKeywords(prev => [...prev, data as JobKeyword])
        setKwSelectedId('')
        setKwSearch('')
      }
    }
    setKwAdding(false)
  }

  async function removeJobKeyword(id: string) {
    const supabase = createClient()
    await supabase.from('job_keywords').delete().eq('id', id)
    setJobKeywords(prev => prev.filter(jk => jk.id !== id))
  }

  async function addJobKeywordById(kwId: string, priority: 'must_have' | 'nice_to_have') {
    if (!dialog || kwAdding) return
    setKwAdding(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('job_keywords')
      .insert({ job_id: dialog.id, keyword_id: kwId, priority, user_id: userId })
      .select('id, keyword_id, priority')
      .single()
    if (!error && data) setJobKeywords(prev => [...prev, data as JobKeyword])
    setKwAdding(false)
  }

  async function handleJobKwDrop(targetCol: 'must_have' | 'nice_to_have' | 'not_needed') {
    setDragOverJobKwCol(null)
    if (!dragJobKwState || dragJobKwState.source === targetCol) { setDragJobKwState(null); return }
    const { source, jkId, kwId } = dragJobKwState
    setDragJobKwState(null)
    if (source === 'not_needed' && targetCol !== 'not_needed') {
      await addJobKeywordById(kwId, targetCol as 'must_have' | 'nice_to_have')
    } else if (targetCol === 'not_needed' && jkId) {
      await removeJobKeyword(jkId)
    } else if (jkId) {
      const supabase = createClient()
      await supabase.from('job_keywords').update({ priority: targetCol as 'must_have' | 'nice_to_have' }).eq('id', jkId)
      setJobKeywords(prev => prev.map(jk => jk.id === jkId ? { ...jk, priority: targetCol as 'must_have' | 'nice_to_have' } : jk))
    }
  }

  async function openDialog(job: Job) {
    const draft = toDraft(job)
    if (!draft.location && draft.employer_id) {
      draft.location = employerMap[draft.employer_id]?.location ?? ''
    }
    setDialog(draft)
    setDialogOrig(draft)
    setJobKeywords([])
    setKwSearch('')
    setKwSelectedId('')
    setFilterKwText('')
    setFilterKwCategory('')
    setFilterKwCategoryDetail('')
    setDialogResumeId('')
    setDialogOrigResumeId('')
    loadJobKeywords(job.id)
    if (!allKwLoaded) loadAllKeywords()
    const supabase = createClient()
    const [resumesResult, linkedResult] = await Promise.all([
      resumesLoaded ? null : supabase.from('resumes').select('id, title, type').eq('user_id', userId).order('title'),
      supabase.from('resumes').select('id').eq('user_id', userId).eq('job_id', job.id).maybeSingle(),
    ])
    if (resumesResult?.data) { setAllResumes(resumesResult.data as ResumeRef[]); setResumesLoaded(true) }
    const rid = linkedResult?.data?.id ?? ''
    setDialogResumeId(rid)
    setDialogOrigResumeId(rid)
  }

  function closeDialog() {
    setDialog(null)
    setDialogOrig(null)
    setDialogError('')
    setShowResumeNavConfirm(false)
    pendingResumeNavRef.current = null
  }

  async function updateAllKwsToResume() {
    if (!dialogResumeId || (!mustHaveKws.length && !niceToHaveKws.length)) return
    setUpdatingAllKwToResume(true)
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('resume_keywords')
      .select('keyword_id')
      .eq('resume_id', dialogResumeId)
    const existingIds = new Set((existing ?? []).map((r: { keyword_id: string }) => r.keyword_id))
    const toInsert = [
      ...mustHaveKws.filter(jk => !existingIds.has(jk.keyword_id)).map(jk => ({ resume_id: dialogResumeId, keyword_id: jk.keyword_id, priority: 'must_have' })),
      ...niceToHaveKws.filter(jk => !existingIds.has(jk.keyword_id)).map(jk => ({ resume_id: dialogResumeId, keyword_id: jk.keyword_id, priority: 'nice_to_have' })),
    ]
    if (toInsert.length) await supabase.from('resume_keywords').insert(toInsert)
    setUpdatingAllKwToResume(false)
    setAllKwToResumeUpdated(true)
    setTimeout(() => setAllKwToResumeUpdated(false), 2000)
  }

  async function cloneResume() {
    if (!dialog || !dialogResumeId) return
    setCloningResume(true)
    const supabase = createClient()
    const [{ data: src }, { data: srcHighlights }, { data: srcAchievements }] = await Promise.all([
      supabase.from('resumes').select('*').eq('id', dialogResumeId).single(),
      supabase.from('resume_career_highlights').select('career_highlight_id, index').eq('resume_id', dialogResumeId).order('index'),
      supabase.from('resume_position_achievements').select('position_achievement_id, index').eq('resume_id', dialogResumeId).order('index'),
    ])
    if (src) {
      const emp = dialog.employer_id ? employerMap[dialog.employer_id] : undefined
      const empName = emp ? employerLabel(emp) : ''
      const newTitle = empName ? `${empName} — ${dialog.position}` : dialog.position
      const { data: clone } = await supabase.from('resumes').insert({
        user_id: userId,
        title: newTitle,
        type: 'Job',
        job_id: dialog.id,
        industry: src.industry ?? null,
        headline: src.headline ?? null,
        role: src.role ?? null,
        specialty: src.specialty ?? null,
        domain: src.domain ?? null,
        effective_date: src.effective_date ?? null,
        career_highlights_intro: src.career_highlights_intro ?? null,
        content: src.content ?? {},
        is_default: false,
      }).select('id, title, type').single()
      if (clone) {
        const allKws = [
          ...mustHaveKws.map(jk => ({ resume_id: clone.id, keyword_id: jk.keyword_id, priority: 'must_have' as const })),
          ...niceToHaveKws.map(jk => ({ resume_id: clone.id, keyword_id: jk.keyword_id, priority: 'nice_to_have' as const })),
        ]
        await Promise.all([
          srcHighlights?.length
            ? supabase.from('resume_career_highlights').insert(
                srcHighlights.map(r => ({ resume_id: clone.id, career_highlight_id: r.career_highlight_id, index: r.index }))
              )
            : Promise.resolve(),
          srcAchievements?.length
            ? supabase.from('resume_position_achievements').insert(
                srcAchievements.map(r => ({ resume_id: clone.id, position_achievement_id: r.position_achievement_id, index: r.index }))
              )
            : Promise.resolve(),
          allKws.length
            ? supabase.from('resume_keywords').insert(allKws)
            : Promise.resolve(),
        ])
        setAllResumes(prev => [...prev, clone as ResumeRef].sort((a, b) => a.title.localeCompare(b.title)))
        setDialogResumeId(clone.id)
        setDialogError('')
      }
    }
    setCloningResume(false)
  }

  function setD(k: keyof Draft, v: string) {
    setDialog(d => d ? { ...d, [k]: v } : d)
  }

  async function saveDialog() {
    if (!dialog) return
    if (dialogResumeId) {
      const resume = allResumes.find(r => r.id === dialogResumeId)
      if (resume && resume.type !== 'Job') {
        setDialogError(`"${resume.title}" is a Template. Only resumes of Type = Job can be linked to a job.`)
        return
      }
    }
    setDialogError('')
    setDialogSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('jobs').update({
      employer_id: dialog.employer_id || null,
      position: dialog.position,
      industry: dialog.employer_id ? (employerMap[dialog.employer_id]?.industry || null) : null,
      role: dialog.role || null,
      domain: dialog.domain || null,
      specialty: dialog.specialty || null,
      status: dialog.status,
      status_detail: dialog.status_detail || null,
      location: dialog.location || null,
      date_opened: dialog.date_opened || null,
      date_applied: dialog.date_applied || null,
      date_closed: dialog.date_closed || null,
      linkedin_url: dialog.linkedin_url || null,
      career_site_url: dialog.career_site_url || null,
      career_site_id: dialog.career_site_id || null,
      next_step: dialog.next_step || null,
      job_description: dialog.job_description || null,
      notes: dialog.notes || null,
      active: dialog.active,
      updated_at: new Date().toISOString(),
    }).eq('id', dialog.id).eq('user_id', userId)

    if (!error) {
      if (dialogResumeId !== dialogOrigResumeId) {
        const supabase2 = createClient()
        if (dialogOrigResumeId) await supabase2.from('resumes').update({ job_id: null }).eq('id', dialogOrigResumeId)
        if (dialogResumeId) await supabase2.from('resumes').update({ job_id: dialog.id }).eq('id', dialogResumeId)
      }
      const emp = dialog.employer_id ? employerMap[dialog.employer_id] : undefined
      setJobs(js => js.map(j => j.id === dialog.id ? {
        ...j,
        ...dialog,
        employer_id: dialog.employer_id || undefined,
        employers: emp ? { name: emp.name, subsidiary: emp.subsidiary } : undefined,
      } : j))
      if (pendingResumeNavRef.current) {
        const nav = pendingResumeNavRef.current
        pendingResumeNavRef.current = null
        setShowResumeNavConfirm(false)
        nav()
      } else {
        closeDialog()
      }
    }
    setDialogSaving(false)
  }

  async function commitActive(jobId: string, checked: boolean) {
    setJobs(js => js.map(j => j.id === jobId ? { ...j, active: checked } : j))
    const supabase = createClient()
    await supabase.from('jobs').update({ active: checked }).eq('id', jobId).eq('user_id', userId)
  }

  async function commitFavorite(jobId: string, value: boolean) {
    setJobs(js => js.map(j => j.id === jobId ? { ...j, favorite: value } : j))
    const supabase = createClient()
    await supabase.from('jobs').update({ favorite: value }).eq('id', jobId).eq('user_id', userId)
  }

  async function deleteJob(id: string) {
    closeDialog()
    const supabase = createClient()
    await supabase.from('jobs').delete().eq('id', id).eq('user_id', userId)
    setJobs(js => js.filter(j => j.id !== id))
  }

  useEffect(() => { if (hydrated) localStorage.setItem('jobFilter', filter) }, [filter, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterEmployer', filterEmployer) }, [filterEmployer, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterStatus', filterStatus) }, [filterStatus, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterStatusDetail', filterStatusDetail) }, [filterStatusDetail, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterSegment', filterSegment) }, [filterSegment, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterActive', String(filterActive)) }, [filterActive, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterFavorite', String(filterFavorite)) }, [filterFavorite, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('jobFilterNextStep', String(filterNextStep)) }, [filterNextStep, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (sortOrder.length) localStorage.setItem('jobSortOrder', JSON.stringify(sortOrder))
    else localStorage.removeItem('jobSortOrder')
  }, [sortOrder, hydrated])

  function handleSort(key: string, multi: boolean) {
    setSortOrder(prev => {
      if (multi) {
        const existing = prev.find(s => s.key === key)
        const rest = prev.filter(s => s.key !== key)
        const dir = existing ? (existing.dir === 'asc' ? 'desc' : 'asc') : 'asc'
        return [{ key, dir }, ...rest]
      }
      const existing = prev.find(s => s.key === key)
      if (existing && prev.length === 1) return [{ key, dir: existing.dir === 'asc' ? 'desc' : 'asc' }]
      return [{ key, dir: 'asc' }]
    })
  }

  function sortIndicator(key: string) {
    const idx = sortOrder.findIndex(s => s.key === key)
    if (idx === -1) return <span className="ml-1 text-gray-300">↕</span>
    const arrow = sortOrder[idx].dir === 'asc' ? '↑' : '↓'
    if (sortOrder.length > 1) return <span className="ml-1">{arrow}<sup>{idx + 1}</sup></span>
    return <span className="ml-1">{arrow}</span>
  }

  function jobSortValue(job: Job, key: string): string {
    switch (key) {
      case 'employer': return jobEmployerName(job) ?? ''
      case 'position': return job.position
      case 'status': return job.status
      case 'status_detail': return job.status_detail ?? ''
      case 'date_opened': return job.date_opened ?? ''
      case 'date_applied': return job.date_applied ?? ''
      case 'next_step': return job.next_step ?? ''
      case 'career_site_id': return job.career_site_id ?? ''
      case 'industry_segment': return job.employers?.industry_segment ?? ''
      default: return ''
    }
  }

  const segments = [...new Set(
    jobs.map(j => j.employers?.industry_segment ?? '').filter(Boolean)
  )].sort()

  const q = filter.trim().toLowerCase()
  const filteredJobs = jobs.filter(j => {
    if (q && !(
      (jobEmployerName(j) ?? '').toLowerCase().includes(q) ||
      j.position.toLowerCase().includes(q) ||
      (j.status_detail ?? '').toLowerCase().includes(q) ||
      (j.next_step ?? '').toLowerCase().includes(q) ||
      (j.location ?? '').toLowerCase().includes(q)
    )) return false
    if (filterEmployer && j.employer_id !== filterEmployer) return false
    if (filterStatus && j.status !== filterStatus) return false
    if (filterStatusDetail && (j.status_detail ?? '') !== filterStatusDetail) return false
    if (filterSegment && (j.employers?.industry_segment ?? '') !== filterSegment) return false
    if (filterActive && !j.active) return false
    if (filterFavorite && !j.favorite) return false
    if (filterNextStep && !j.next_step) return false
    return true
  })

  const sortedJobs = sortOrder.length ? [...filteredJobs].sort((a, b) => {
    for (const { key, dir } of sortOrder) {
      const av = jobSortValue(a, key)
      const bv = jobSortValue(b, key)
      if (!av && !bv) continue
      if (!av) return dir === 'asc' ? 1 : -1
      if (!bv) return dir === 'asc' ? -1 : 1
      const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    }
    return 0
  }) : filteredJobs

  const kwMap = Object.fromEntries(allKeywords.map(k => [k.id, k]))
  const linkedKwIds = new Set(jobKeywords.map(jk => jk.keyword_id))
  const mustHaveKws = jobKeywords.filter(jk => jk.priority === 'must_have')
  const niceToHaveKws = jobKeywords.filter(jk => jk.priority === 'nice_to_have')
  const kwCategories = [...new Set(allKeywords.map(k => k.category).filter(Boolean))].sort()
  const kwCategoryDetails = [...new Set(
    allKeywords
      .filter(k => !filterKwCategory || k.category === filterKwCategory)
      .map(k => k.category_detail)
      .filter((v): v is string => !!v)
  )].sort()
  const kwPassesFilter = (kw: Keyword | undefined) => {
    if (!kw) return true
    if (filterKwCategory && kw.category !== filterKwCategory) return false
    if (filterKwCategoryDetail && kw.category_detail !== filterKwCategoryDetail) return false
    if (filterKwText && !kw.keyword.toLowerCase().includes(filterKwText.toLowerCase())) return false
    return true
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="search"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by position, status detail, next step…"
              className="w-full sm:w-80 px-3 py-2 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filterEmployer}
              onChange={e => setFilterEmployer(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterEmployer ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
            >
              <option value="">All Employers</option>
              {employers.map(emp => (
                <option key={emp.id} value={emp.id}>{employerLabel(emp)}</option>
              ))}
            </select>
            <select
              value={filterSegment}
              onChange={e => setFilterSegment(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterSegment ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
            >
              <option value="">All Segments</option>
              {segments.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setAddForm(defaultAddForm()); setShowAdd(true) }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            + Add Job
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setFilterStatusDetail('') }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterStatus ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={filterStatusDetail}
            onChange={e => setFilterStatusDetail(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterStatusDetail ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
          >
            <option value="">All Status Details</option>
            {Object.values(JOB_STATUS_DETAIL_OPTIONS).flat().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={() => setFilterNextStep(v => !v)}
            title="Has Next Step"
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center ${filterNextStep ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
          <button
            onClick={() => setFilterFavorite(v => !v)}
            title="Favorite"
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterFavorite ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            ★
          </button>
          <button
            onClick={() => setFilterActive(v => !v)}
            title="Active"
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-1.5 ${filterActive ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
          {(filter || filterEmployer || filterStatus || filterStatusDetail || filterSegment || filterActive || filterFavorite || filterNextStep) && (
            <button
              onClick={() => { setFilter(''); setFilterEmployer(''); setFilterStatus(''); setFilterStatusDetail(''); setFilterSegment(''); setFilterActive(false); setFilterFavorite(false); setFilterNextStep(false) }}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      {!jobs.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">💼</p>
          <p className="text-gray-500">No jobs tracked yet. Add positions you're pursuing.</p>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[150px] min-w-[150px] sticky left-0 z-10 bg-gray-50 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('employer', e.ctrlKey)}>Employer{sortIndicator('employer')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[150px] min-w-[150px] sticky left-[150px] z-10 bg-gray-50 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('industry_segment', e.ctrlKey)}>Segment{sortIndicator('industry_segment')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 min-w-[240px] sticky left-[300px] z-10 bg-gray-50 border-r border-gray-200 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('position', e.ctrlKey)}>Position{sortIndicator('position')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 min-w-[120px] cursor-pointer select-none hover:text-gray-800 whitespace-nowrap" onClick={(e) => handleSort('career_site_id', e.ctrlKey)}>Career Site ID{sortIndicator('career_site_id')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[11%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('status', e.ctrlKey)}>Status{sortIndicator('status')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[14%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('status_detail', e.ctrlKey)}>Status Detail{sortIndicator('status_detail')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[10%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('date_opened', e.ctrlKey)}>Opened{sortIndicator('date_opened')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[10%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('date_applied', e.ctrlKey)}>Applied{sortIndicator('date_applied')}</th>
              <th className="text-center px-2 py-2 font-medium text-gray-500 w-[40px]" title="Next Step">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </th>
              <th className="px-2 py-2 w-[40px] text-center text-gray-400" title="Favorite">★</th>
              <th className="text-center px-2 py-2 font-medium text-gray-500 w-[40px]" title="Active">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
              </th>
              <th className="px-2 py-2 w-[52px] sticky right-0 bg-gray-50" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedJobs.map(job => {
              const dim = job.status === 'closed' ? 'opacity-30' : '';
              return (
              <tr key={job.id} className="group hover:bg-gray-50 cursor-pointer" onClick={() => openDialog(job)}>
                <td className={`px-4 py-1.5 text-black font-medium w-[150px] min-w-[150px] sticky left-0 z-[1] bg-white group-hover:bg-gray-50 ${dim}`}>
                  {job.employer_id
                    ? <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={e => { e.stopPropagation(); setFilterEmployer(job.employer_id!) }}>{jobEmployerName(job)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-4 py-1.5 text-black text-sm w-[150px] min-w-[150px] sticky left-[150px] z-[1] bg-white group-hover:bg-gray-50 ${dim}`}>
                  {(() => {
                    const seg = job.employers?.industry_segment ?? ''
                    return seg
                      ? <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={e => { e.stopPropagation(); setFilterSegment(seg) }}>{seg}</span>
                      : <span className="text-gray-300">—</span>
                  })()}
                </td>
                <td className={`px-4 py-1.5 text-black sticky left-[300px] z-[1] bg-white group-hover:bg-gray-50 border-r border-gray-200 ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'position') }}>
                  {editing?.jobId === job.id && editing.field === 'position'
                    ? <InlineEdit value={job.position} onCommit={v => commitEdit(job.id, 'position', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.position}</span>}
                </td>
                <td className={`px-4 py-1.5 text-black font-mono text-xs ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'career_site_id') }}>
                  {editing?.jobId === job.id && editing.field === 'career_site_id'
                    ? <InlineEdit value={job.career_site_id ?? ''} onCommit={v => commitEdit(job.id, 'career_site_id', v)} onCancel={cancelEdit} />
                    : job.career_site_id
                      ? job.career_site_url
                        ? <a href={job.career_site_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-blue-600 hover:underline">{job.career_site_id}</a>
                        : <span className="cursor-text">{job.career_site_id}</span>
                      : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-4 py-1.5 ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'status') }}>
                  {editing?.jobId === job.id && editing.field === 'status'
                    ? <InlineSelect value={job.status} options={STATUS_OPTIONS} onCommit={v => commitEdit(job.id, 'status', v)} onCancel={cancelEdit} />
                    : <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${STATUS_COLORS[job.status]}`}>
                        {STATUS_OPTIONS.find(o => o.value === job.status)?.label ?? job.status}
                      </span>}
                </td>
                <td className={`px-4 py-1.5 text-black ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'status_detail') }}>
                  {editing?.jobId === job.id && editing.field === 'status_detail'
                    ? <InlineSelect
                        value={job.status_detail ?? ''}
                        options={[{ value: '', label: '— None —' }, ...(JOB_STATUS_DETAIL_OPTIONS[job.status] ?? []).map(o => ({ value: o, label: o }))]}
                        onCommit={v => commitEdit(job.id, 'status_detail', v)}
                        onCancel={cancelEdit}
                      />
                    : <span className="cursor-text">{job.status_detail || <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className={`px-4 py-1.5 text-black tabular-nums ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'date_opened') }}>
                  {editing?.jobId === job.id && editing.field === 'date_opened'
                    ? <InlineEdit value={job.date_opened ?? ''} type="date" onCommit={v => commitEdit(job.id, 'date_opened', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.date_opened ?? <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className={`px-4 py-1.5 text-black tabular-nums ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'date_applied') }}>
                  {editing?.jobId === job.id && editing.field === 'date_applied'
                    ? <InlineEdit value={job.date_applied ?? ''} type="date" onCommit={v => commitEdit(job.id, 'date_applied', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.date_applied ?? <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className={`px-4 py-1.5 text-black ${dim}`} onClick={e => { e.stopPropagation(); startEdit(job.id, 'next_step') }}>
                  {editing?.jobId === job.id && editing.field === 'next_step'
                    ? <InlineEdit value={job.next_step ?? ''} onCommit={v => commitEdit(job.id, 'next_step', v)} onCancel={cancelEdit} />
                    : job.next_step
                      ? <span title={job.next_step} className="cursor-text inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </span>
                      : null}
                </td>
                <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => commitFavorite(job.id, !job.favorite)}
                    className={`text-lg leading-none transition-colors ${job.favorite ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                    title={job.favorite ? 'Remove favorite' : 'Add to favorites'}
                  >
                    ★
                  </button>
                </td>
                <td className="px-4 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => commitActive(job.id, !(job.active ?? false))} title={job.active ? 'Active' : 'Inactive'}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${job.active ? 'text-green-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                  </button>
                </td>
                <td className="px-2 py-1 sticky right-0 bg-white group-hover:bg-gray-50">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDialog(job)}
                      className="px-2.5 py-1 border border-gray-200 text-black rounded text-xs font-medium hover:bg-gray-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!sortedJobs.length && q && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">No jobs match "{filter}"</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDialog} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-semibold text-black px-6 pt-6 pb-2 shrink-0">Edit Job</h3>
            <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">

            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Employer</label>
                  <button type="button" onClick={() => setShowAddEmployerDialog(true)}
                    title="Add Employer"
                    className="text-gray-400 hover:text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <select value={dialog.employer_id} onChange={e => {
                  const emp = employerMap[e.target.value]
                  setDialog(d => d ? { ...d, employer_id: e.target.value, location: emp?.location ?? d.location } : d)
                }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Not linked —</option>
                  {employersList.map(emp => (
                    <option key={emp.id} value={emp.id}>{employerLabel(emp)}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-700 bg-gray-50 min-h-[38px]">
                  {dialog.employer_id ? (employerMap[dialog.employer_id]?.industry ?? '') : <span className="text-gray-300">—</span>}
                </div>
              </div>
            </div>

            <div>
              <DField label="Position *" value={dialog.position} onChange={v => setD('position', v)} required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <DField label="Role" value={dialog.role} onChange={v => setD('role', v)} />
              <DField label="Domain" value={dialog.domain} onChange={v => setD('domain', v)} />
              <DField label="Specialty" value={dialog.specialty} onChange={v => setD('specialty', v)} />
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={dialog.status} onChange={e => { setD('status', e.target.value); setD('status_detail', '') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-end gap-4">
                {JOB_STATUS_DETAIL_OPTIONS[dialog.status] && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status Detail</label>
                    <select value={dialog.status_detail} onChange={e => setDialog(d => d ? { ...d, status_detail: e.target.value, active: e.target.value === "Didn't Apply" ? false : d.active } : d)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Select —</option>
                      {JOB_STATUS_DETAIL_OPTIONS[dialog.status]!.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-3 pb-1.5 ml-auto">
                <button type="button" onClick={() => setDialog(d => d ? { ...d, favorite: !d.favorite } : d)}
                  title={dialog.favorite ? 'Remove favorite' : 'Add to favorites'}
                  className={`text-xl leading-none transition-colors ${dialog.favorite ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}>
                  ★
                </button>
                <button type="button" onClick={() => setDialog(d => d ? { ...d, active: !d.active } : d)}
                  title={dialog.active ? 'Active' : 'Inactive'}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${dialog.active ? 'text-green-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                </button>
              </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <DField label="Date Opened" value={dialog.date_opened} onChange={v => setD('date_opened', v)} type="date" />
              <DField label="Date Applied" value={dialog.date_applied} onChange={v => setD('date_applied', v)} type="date" />
              <DField label="Date Closed" value={dialog.date_closed} onChange={v => setD('date_closed', v)} type="date" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DField label="Next Step" value={dialog.next_step} onChange={v => setD('next_step', v)} />
              <DField label="Location" value={dialog.location} onChange={v => setD('location', v)} />
            </div>

            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-1"><DField label="Career Site ID" value={dialog.career_site_id} onChange={v => setD('career_site_id', v)} /></div>
              <div className="col-span-2"><DField label="Career Site URL" value={dialog.career_site_url} onChange={v => setD('career_site_url', v)} type="url" /></div>
              <div className="col-span-2"><DField label="LinkedIn URL" value={dialog.linkedin_url} onChange={v => setD('linkedin_url', v)} type="url" /></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Resume</label>
              <div className="flex gap-2 items-center">
                <select
                  value={dialogResumeId}
                  onChange={e => { setDialogResumeId(e.target.value); setDialogError('') }}
                  className={`w-[90%] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${dialogError ? 'border-red-400' : 'border-gray-200'}`}
                >
                  <option value="">— None —</option>
                  {allResumes.filter(r => r.type === 'Template' || r.id === dialogOrigResumeId || r.id === dialogResumeId).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                {dialogResumeId && (
                  <button
                    type="button"
                    onClick={() => {
                      const navFn = () => {
                        const resume = allResumes.find(r => r.id === dialogResumeId)
                        if (resume) localStorage.setItem('resumeTypeFilter', resume.type === 'Job' ? 'Job' : 'Template')
                        localStorage.setItem('resumeSelectedId', dialogResumeId)
                        router.push('/resumes')
                      }
                      if (isDirty) {
                        pendingResumeNavRef.current = navFn
                        setShowResumeNavConfirm(true)
                      } else {
                        navFn()
                      }
                    }}
                    title="Open resume"
                    className="text-gray-400 hover:text-blue-600 shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={cloneResume}
                  disabled={!dialogResumeId || cloningResume}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap disabled:opacity-40"
                >
                  {cloningResume ? 'Cloning…' : 'Add from Template'}
                </button>
              </div>
              {dialogError && <p className="mt-1 text-xs text-red-600">{dialogError}</p>}
            </div>

            {showResumeNavConfirm && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <span className="text-amber-800 flex-1">You have unsaved changes. Save before navigating?</span>
                <button type="button" onClick={saveDialog} disabled={dialogSaving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                  {dialogSaving ? 'Saving…' : 'Save & Go'}
                </button>
                <button type="button"
                  onClick={() => {
                    const nav = pendingResumeNavRef.current
                    pendingResumeNavRef.current = null
                    setShowResumeNavConfirm(false)
                    nav?.()
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 whitespace-nowrap">
                  Discard & Go
                </button>
                <button type="button"
                  onClick={() => { setShowResumeNavConfirm(false); pendingResumeNavRef.current = null }}
                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
                  Cancel
                </button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="block text-xs font-medium text-gray-500 shrink-0">Keywords</label>
                <input
                  type="text"
                  value={filterKwText}
                  onChange={e => setFilterKwText(e.target.value)}
                  placeholder="contains…"
                  className="ml-[72px] px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                />
                <select
                  value={filterKwCategory}
                  onChange={e => { setFilterKwCategory(e.target.value); setFilterKwCategoryDetail('') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterKwCategory ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
                >
                  <option value="">All Categories</option>
                  {kwCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filterKwCategoryDetail}
                  onChange={e => setFilterKwCategoryDetail(e.target.value)}
                  disabled={kwCategoryDetails.length === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 ${filterKwCategoryDetail ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
                >
                  <option value="">All Details</option>
                  {kwCategoryDetails.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {(filterKwText || filterKwCategory || filterKwCategoryDetail) && (
                  <button type="button" onClick={() => { setFilterKwText(''); setFilterKwCategory(''); setFilterKwCategoryDetail('') }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Clear
                  </button>
                )}
                <button type="button" onClick={updateAllKwsToResume}
                  disabled={!dialogResumeId || updatingAllKwToResume || (!mustHaveKws.length && !niceToHaveKws.length)}
                  className={`ml-auto px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40 ${allKwToResumeUpdated ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {updatingAllKwToResume ? 'Updating…' : allKwToResumeUpdated ? 'Updated ✓' : 'Update Resume'}
                </button>
              </div>
              {kwLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {/* Headers */}
                  <div className="text-xs font-semibold text-blue-700 text-center">Must Have</div>
                  <div className="text-xs font-semibold text-purple-700 text-center">Nice to Have</div>
                  <div className="text-xs font-semibold text-gray-500 text-center">Not Needed</div>

                  {/* Must Have cell */}
                  <div
                    className={`min-h-[80px] max-h-[200px] overflow-y-auto border border-green-200 rounded-lg p-2 flex flex-wrap gap-1 bg-green-50 content-start transition-shadow ${dragOverJobKwCol === 'must_have' && dragJobKwState?.source !== 'must_have' ? 'ring-2 ring-blue-400' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverJobKwCol('must_have') }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverJobKwCol(null) }}
                    onDrop={e => { e.preventDefault(); handleJobKwDrop('must_have') }}
                  >
                    {mustHaveKws
                      .filter(jk => kwPassesFilter(kwMap[jk.keyword_id]))
                      .sort((a, b) => (kwMap[a.keyword_id]?.keyword ?? '').localeCompare(kwMap[b.keyword_id]?.keyword ?? ''))
                      .map(jk => {
                        const kw = kwMap[jk.keyword_id]
                        if (!kw) return null
                        return (
                          <span key={jk.id}
                            draggable
                            onDragStart={() => setDragJobKwState({ source: 'must_have', jkId: jk.id, kwId: jk.keyword_id })}
                            onDragEnd={() => { setDragJobKwState(null); setDragOverJobKwCol(null) }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-grab bg-green-100 text-green-800 hover:bg-green-200">
                            {kw.keyword}
                            <button type="button" onClick={e => { e.stopPropagation(); removeJobKeyword(jk.id) }} className="opacity-50 hover:opacity-100 leading-none">×</button>
                          </span>
                        )
                      })}
                  </div>

                  {/* Nice to Have cell */}
                  <div
                    className={`min-h-[80px] max-h-[200px] overflow-y-auto border border-green-200 rounded-lg p-2 flex flex-wrap gap-1 bg-green-50 content-start transition-shadow ${dragOverJobKwCol === 'nice_to_have' && dragJobKwState?.source !== 'nice_to_have' ? 'ring-2 ring-blue-400' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverJobKwCol('nice_to_have') }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverJobKwCol(null) }}
                    onDrop={e => { e.preventDefault(); handleJobKwDrop('nice_to_have') }}
                  >
                    {niceToHaveKws
                      .filter(jk => kwPassesFilter(kwMap[jk.keyword_id]))
                      .sort((a, b) => (kwMap[a.keyword_id]?.keyword ?? '').localeCompare(kwMap[b.keyword_id]?.keyword ?? ''))
                      .map(jk => {
                        const kw = kwMap[jk.keyword_id]
                        if (!kw) return null
                        return (
                          <span key={jk.id}
                            draggable
                            onDragStart={() => setDragJobKwState({ source: 'nice_to_have', jkId: jk.id, kwId: jk.keyword_id })}
                            onDragEnd={() => { setDragJobKwState(null); setDragOverJobKwCol(null) }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-grab bg-green-100 text-green-800 hover:bg-green-200">
                            {kw.keyword}
                            <button type="button" onClick={e => { e.stopPropagation(); removeJobKeyword(jk.id) }} className="opacity-50 hover:opacity-100 leading-none">×</button>
                          </span>
                        )
                      })}
                  </div>

                  {/* Not Needed cell — drag to link, or drag linked chips here to unlink */}
                  <div
                    className={`min-h-[80px] max-h-[200px] overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-wrap gap-1 bg-gray-50 content-start transition-shadow ${dragOverJobKwCol === 'not_needed' && dragJobKwState?.source !== 'not_needed' ? 'ring-2 ring-blue-400' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverJobKwCol('not_needed') }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverJobKwCol(null) }}
                    onDrop={e => { e.preventDefault(); handleJobKwDrop('not_needed') }}
                  >
                    {allKeywords.filter(k => !linkedKwIds.has(k.id) && kwPassesFilter(k)).map(k => (
                      <span key={k.id}
                        draggable
                        onDragStart={() => setDragJobKwState({ source: 'not_needed', kwId: k.id })}
                        onDragEnd={() => { setDragJobKwState(null); setDragOverJobKwCol(null) }}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-grab bg-gray-100 text-gray-600 hover:bg-gray-200">
                        {k.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Description</label>
              <textarea value={dialog.job_description} onChange={e => setD('job_description', e.target.value)} rows={10}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea value={dialog.notes} onChange={e => setD('notes', e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => deleteJob(dialog.id)}
                disabled={dialogSaving}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={saveDialog}
                  disabled={dialogSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {dialogSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 border border-gray-200 text-black rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddEmployerDialog && (
        <AddEmployerDialog
          userId={userId}
          onSave={emp => {
            setEmployersList(list => [...list, emp].sort((a, b) => employerLabel(a).localeCompare(employerLabel(b))))
            setD('employer_id', emp.id)
            setShowAddEmployerDialog(false)
          }}
          onClose={() => setShowAddEmployerDialog(false)}
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-semibold text-black px-6 pt-6 pb-2 shrink-0">Add Job</h3>
            <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employer</label>
              <select value={addForm.employer_id} onChange={e => {
                const emp = employers.find(em => em.id === e.target.value)
                setAddForm(f => ({ ...f, employer_id: e.target.value, location: emp?.location ?? f.location }))
              }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Not linked —</option>
                {employers.map(emp => (
                  <option key={emp.id} value={emp.id}>{employerLabel(emp)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
              <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-700 bg-gray-50 min-h-[38px]">
                {addForm.employer_id ? (employers.find(em => em.id === addForm.employer_id)?.industry ?? '') : <span className="text-gray-300">—</span>}
              </div>
            </div>

            <DField label="Position *" value={addForm.position} onChange={v => setAF('position', v)} required />

            <div className="grid grid-cols-3 gap-4">
              <DField label="Role" value={addForm.role} onChange={v => setAF('role', v)} />
              <DField label="Domain" value={addForm.domain} onChange={v => setAF('domain', v)} />
              <DField label="Specialty" value={addForm.specialty} onChange={v => setAF('specialty', v)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={addForm.status} onChange={e => { setAF('status', e.target.value); setAF('status_detail', '') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {JOB_STATUS_DETAIL_OPTIONS[addForm.status] && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status Detail</label>
                  <select value={addForm.status_detail} onChange={e => setAddForm(f => ({ ...f, status_detail: e.target.value, active: e.target.value === "Didn't Apply" ? false : f.active }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {JOB_STATUS_DETAIL_OPTIONS[addForm.status]!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DField label="Next Step" value={addForm.next_step} onChange={v => setAF('next_step', v)} />
              <DField label="Location" value={addForm.location} onChange={v => setAF('location', v)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <DField label="Date Opened" value={addForm.date_opened} onChange={v => setAF('date_opened', v)} type="date" />
              <DField label="Date Applied" value={addForm.date_applied} onChange={v => setAF('date_applied', v)} type="date" />
              <DField label="Date Closed" value={addForm.date_closed} onChange={v => setAF('date_closed', v)} type="date" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <DField label="Career Site ID" value={addForm.career_site_id} onChange={v => setAF('career_site_id', v)} />
              <DField label="Career Site URL" value={addForm.career_site_url} onChange={v => setAF('career_site_url', v)} type="url" />
              <DField label="LinkedIn URL" value={addForm.linkedin_url} onChange={v => setAF('linkedin_url', v)} type="url" />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addForm.active} onChange={e => setAF('active', e.target.checked)} className="rounded" />
                <span className="text-sm text-black">Active</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Description</label>
              <textarea value={addForm.job_description} onChange={e => setAF('job_description', e.target.value)} rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea value={addForm.notes} onChange={e => setAF('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={saveAdd}
                disabled={addSaving || !addForm.position}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {addSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-gray-200 text-black rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DField({ label, value, onChange, required, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function InlineEdit({ value, type = 'text', onCommit, onCancel }: {
  value: string; type?: string; onCommit: (v: string) => void; onCancel: () => void
}) {
  const [v, setV] = useState(value)
  return (
    <input
      autoFocus
      type={type}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(v) }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      }}
      onClick={e => e.stopPropagation()}
      className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-black bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )
}

function InlineSelect({ value, options, onCommit, onCancel }: {
  value: string; options: { value: string; label: string }[]; onCommit: (v: string) => void; onCancel: () => void
}) {
  return (
    <select
      autoFocus
      value={value}
      onChange={e => onCommit(e.target.value)}
      onBlur={onCancel}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
      onClick={e => e.stopPropagation()}
      className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-black bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
