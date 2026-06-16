'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Job, JobStatus } from '@/lib/types'
import { JOB_STATUS_DETAIL_OPTIONS } from '@/lib/types'

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-amber-100 text-amber-700',
  open:           'bg-green-100 text-green-700',
  closed:         'bg-slate-100 text-slate-600',
}

type EmployerRef = { id: string; name: string; business_unit?: string; location?: string }

function employerLabel(emp: EmployerRef) {
  return emp.business_unit ? `${emp.name} > ${emp.business_unit}` : emp.name
}

function jobEmployerName(job: Job) {
  if (!job.employers) return null
  return job.employers.business_unit
    ? `${job.employers.name} > ${job.employers.business_unit}`
    : job.employers.name
}

type Draft = {
  id: string
  employer_id: string
  position: string
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
  const [dialog, setDialog] = useState<Draft | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(defaultAddForm)
  const [addSaving, setAddSaving] = useState(false)
  const [sortOrder, setSortOrder] = useState<{ key: string; dir: 'asc' | 'desc' }[]>([])

  useEffect(() => {
    try {
      setFilter(localStorage.getItem('jobFilter') ?? '')
      setFilterEmployer(localStorage.getItem('jobFilterEmployer') ?? '')
      setFilterStatus(localStorage.getItem('jobFilterStatus') ?? '')
      setFilterStatusDetail(localStorage.getItem('jobFilterStatusDetail') ?? '')
      setFilterSegment(localStorage.getItem('jobFilterSegment') ?? '')
      const stored = localStorage.getItem('jobSortOrder')
      if (stored) { setSortOrder(JSON.parse(stored)); return }
      const key = localStorage.getItem('jobSortKey')
      const dir = (localStorage.getItem('jobSortDir') as 'asc' | 'desc') || 'asc'
      if (key) setSortOrder([{ key, dir }])
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [editing, setEditing] = useState<{ jobId: string; field: string } | null>(null)

  const router = useRouter()
  const employerMap = Object.fromEntries(employers.map(e => [e.id, e]))

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
    }).select('*, employers(name, business_unit, industry, industry_segment)').single()
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
    const payload: Record<string, string | null> = { [field]: value || null, updated_at: new Date().toISOString() }
    if (field === 'status') payload.status_detail = null
    const { error } = await supabase.from('jobs').update(payload).eq('id', jobId).eq('user_id', userId)
    if (!error) {
      setJobs(js => js.map(j => {
        if (j.id !== jobId) return j
        if (field === 'status') return { ...j, status: value as JobStatus, status_detail: undefined }
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

  function openDialog(job: Job) {
    setDialog(toDraft(job))
  }

  function closeDialog() {
    setDialog(null)
  }

  function setD(k: keyof Draft, v: string) {
    setDialog(d => d ? { ...d, [k]: v } : d)
  }

  async function saveDialog() {
    if (!dialog) return
    setDialogSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('jobs').update({
      employer_id: dialog.employer_id || null,
      position: dialog.position,
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
      const emp = dialog.employer_id ? employerMap[dialog.employer_id] : undefined
      setJobs(js => js.map(j => j.id === dialog.id ? {
        ...j,
        ...dialog,
        employer_id: dialog.employer_id || undefined,
        employers: emp ? { name: emp.name, business_unit: emp.business_unit } : undefined,
      } : j))
      closeDialog()
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

  useEffect(() => { localStorage.setItem('jobFilter', filter) }, [filter])
  useEffect(() => { localStorage.setItem('jobFilterEmployer', filterEmployer) }, [filterEmployer])
  useEffect(() => { localStorage.setItem('jobFilterStatus', filterStatus) }, [filterStatus])
  useEffect(() => { localStorage.setItem('jobFilterStatusDetail', filterStatusDetail) }, [filterStatusDetail])
  useEffect(() => { localStorage.setItem('jobFilterSegment', filterSegment) }, [filterSegment])

  useEffect(() => {
    if (sortOrder.length) localStorage.setItem('jobSortOrder', JSON.stringify(sortOrder))
    else localStorage.removeItem('jobSortOrder')
  }, [sortOrder])

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
      case 'industry_segment': return [job.employers?.industry, job.employers?.industry_segment].filter(Boolean).join(' > ')
      default: return ''
    }
  }

  const segments = [...new Set(
    jobs.map(j => [j.employers?.industry, j.employers?.industry_segment].filter(Boolean).join(' > ')).filter(Boolean)
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
    if (filterSegment && [j.employers?.industry, j.employers?.industry_segment].filter(Boolean).join(' > ') !== filterSegment) return false
    if (filterActive && !j.active) return false
    if (filterFavorite && !j.favorite) return false
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

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2 items-center justify-between">
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
        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterSegment ? 'border-blue-300 text-blue-800 bg-blue-50' : 'border-gray-200 text-gray-600'}`}
        >
          <option value="">All Segments</option>
          {segments.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setFilterActive(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterActive ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Active
        </button>
        <button
          onClick={() => setFilterFavorite(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterFavorite ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          ★ Favorites
        </button>
        {(filter || filterEmployer || filterStatus || filterStatusDetail || filterSegment || filterActive || filterFavorite) && (
          <button
            onClick={() => { setFilter(''); setFilterEmployer(''); setFilterStatus(''); setFilterStatusDetail(''); setFilterSegment(''); setFilterActive(false); setFilterFavorite(false) }}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
        )}
        </div>
        <button
          onClick={() => { setAddForm(defaultAddForm()); setShowAdd(true) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
        >
          + Add Job
        </button>
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
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[140px] sticky left-0 z-10 bg-gray-50 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('employer', e.ctrlKey)}>Employer{sortIndicator('employer')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[90px] sticky left-[140px] z-10 bg-gray-50 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('industry_segment', e.ctrlKey)}>Segment{sortIndicator('industry_segment')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[160px] sticky left-[230px] z-10 bg-gray-50 border-r border-gray-200 cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('position', e.ctrlKey)}>Position{sortIndicator('position')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[8%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('career_site_id', e.ctrlKey)}>Career Site ID{sortIndicator('career_site_id')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[11%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('status', e.ctrlKey)}>Status{sortIndicator('status')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[14%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('status_detail', e.ctrlKey)}>Status Detail{sortIndicator('status_detail')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[10%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('date_opened', e.ctrlKey)}>Opened{sortIndicator('date_opened')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[10%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('date_applied', e.ctrlKey)}>Applied{sortIndicator('date_applied')}</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[10%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('next_step', e.ctrlKey)}>Next Step{sortIndicator('next_step')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[5%]">Active</th>
              <th className="px-2 py-2 w-[40px] sticky right-[52px] bg-gray-50" />
              <th className="px-2 py-2 w-[52px] sticky right-0 bg-gray-50" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedJobs.map(job => (
              <tr key={job.id} className="group hover:bg-gray-50">
                <td className="px-4 py-1.5 text-black font-medium sticky left-0 z-[1] bg-white group-hover:bg-gray-50">
                  {job.employer_id
                    ? <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={() => setFilterEmployer(job.employer_id!)}>{jobEmployerName(job)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-1.5 text-black text-sm sticky left-[140px] z-[1] bg-white group-hover:bg-gray-50">
                  {[job.employers?.industry, job.employers?.industry_segment].filter(Boolean).join(' > ') || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-1.5 text-black sticky left-[230px] z-[1] bg-white group-hover:bg-gray-50 border-r border-gray-200" onClick={() => startEdit(job.id, 'position')}>
                  {editing?.jobId === job.id && editing.field === 'position'
                    ? <InlineEdit value={job.position} onCommit={v => commitEdit(job.id, 'position', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.position}</span>}
                </td>
                <td className="px-4 py-1.5 text-black font-mono text-xs" onClick={() => startEdit(job.id, 'career_site_id')}>
                  {editing?.jobId === job.id && editing.field === 'career_site_id'
                    ? <InlineEdit value={job.career_site_id ?? ''} onCommit={v => commitEdit(job.id, 'career_site_id', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.career_site_id || <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className="px-4 py-1.5" onClick={() => startEdit(job.id, 'status')}>
                  {editing?.jobId === job.id && editing.field === 'status'
                    ? <InlineSelect value={job.status} options={STATUS_OPTIONS} onCommit={v => commitEdit(job.id, 'status', v)} onCancel={cancelEdit} />
                    : <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${STATUS_COLORS[job.status]}`}>
                        {STATUS_OPTIONS.find(o => o.value === job.status)?.label ?? job.status}
                      </span>}
                </td>
                <td className="px-4 py-1.5 text-black" onClick={() => startEdit(job.id, 'status_detail')}>
                  {editing?.jobId === job.id && editing.field === 'status_detail'
                    ? <InlineSelect
                        value={job.status_detail ?? ''}
                        options={[{ value: '', label: '— None —' }, ...(JOB_STATUS_DETAIL_OPTIONS[job.status] ?? []).map(o => ({ value: o, label: o }))]}
                        onCommit={v => commitEdit(job.id, 'status_detail', v)}
                        onCancel={cancelEdit}
                      />
                    : <span className="cursor-text">{job.status_detail || <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className="px-4 py-1.5 text-black tabular-nums" onClick={() => startEdit(job.id, 'date_opened')}>
                  {editing?.jobId === job.id && editing.field === 'date_opened'
                    ? <InlineEdit value={job.date_opened ?? ''} type="date" onCommit={v => commitEdit(job.id, 'date_opened', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.date_opened ?? <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className="px-4 py-1.5 text-black tabular-nums" onClick={() => startEdit(job.id, 'date_applied')}>
                  {editing?.jobId === job.id && editing.field === 'date_applied'
                    ? <InlineEdit value={job.date_applied ?? ''} type="date" onCommit={v => commitEdit(job.id, 'date_applied', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.date_applied ?? <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className="px-4 py-1.5 text-black" onClick={() => startEdit(job.id, 'next_step')}>
                  {editing?.jobId === job.id && editing.field === 'next_step'
                    ? <InlineEdit value={job.next_step ?? ''} onCommit={v => commitEdit(job.id, 'next_step', v)} onCancel={cancelEdit} />
                    : <span className="cursor-text">{job.next_step || <span className="text-gray-300">—</span>}</span>}
                </td>
                <td className="px-4 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={job.active ?? false}
                    onChange={e => commitActive(job.id, e.target.checked)}
                    className="rounded"
                  />
                </td>
                <td className="px-2 py-1 sticky right-[52px] z-[1] bg-white group-hover:bg-gray-50 text-center before:content-[''] before:absolute before:top-0 before:bottom-0 before:right-full before:w-6 before:bg-white group-hover:before:bg-gray-50">
                  <button
                    onClick={() => commitFavorite(job.id, !job.favorite)}
                    className={`text-lg leading-none transition-colors ${job.favorite ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                    title={job.favorite ? 'Remove favorite' : 'Add to favorites'}
                  >
                    ★
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
            ))}
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
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-black sticky top-0 bg-white pb-2">Edit Job</h3>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employer</label>
              <select value={dialog.employer_id} onChange={e => setD('employer_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Not linked —</option>
                {employers.map(emp => (
                  <option key={emp.id} value={emp.id}>{employerLabel(emp)}</option>
                ))}
              </select>
            </div>

            <DField label="Position *" value={dialog.position} onChange={v => setD('position', v)} required />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={dialog.status} onChange={e => { setD('status', e.target.value); setD('status_detail', '') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {JOB_STATUS_DETAIL_OPTIONS[dialog.status] && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status Detail</label>
                  <select value={dialog.status_detail} onChange={e => setD('status_detail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {JOB_STATUS_DETAIL_OPTIONS[dialog.status]!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DField label="Location" value={dialog.location} onChange={v => setD('location', v)} />

            <div className="grid grid-cols-3 gap-4">
              <DField label="Date Opened" value={dialog.date_opened} onChange={v => setD('date_opened', v)} type="date" />
              <DField label="Date Applied" value={dialog.date_applied} onChange={v => setD('date_applied', v)} type="date" />
              <DField label="Date Closed" value={dialog.date_closed} onChange={v => setD('date_closed', v)} type="date" />
            </div>

            <DField label="LinkedIn URL" value={dialog.linkedin_url} onChange={v => setD('linkedin_url', v)} type="url" />

            <div className="grid grid-cols-2 gap-4">
              <DField label="Career Site URL" value={dialog.career_site_url} onChange={v => setD('career_site_url', v)} type="url" />
              <DField label="Career Site ID" value={dialog.career_site_id} onChange={v => setD('career_site_id', v)} />
            </div>

            <DField label="Next Step" value={dialog.next_step} onChange={v => setD('next_step', v)} />

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dialog.active} onChange={e => setDialog(d => d ? { ...d, active: e.target.checked } : d)} className="rounded" />
                <span className="text-sm text-black">Active</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Description</label>
              <textarea value={dialog.job_description} onChange={e => setD('job_description', e.target.value)} rows={5}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea value={dialog.notes} onChange={e => setD('notes', e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex items-center justify-between pt-2 sticky bottom-0 bg-white">
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

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-black sticky top-0 bg-white pb-2">Add Job</h3>

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

            <DField label="Position *" value={addForm.position} onChange={v => setAF('position', v)} required />

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
                  <select value={addForm.status_detail} onChange={e => setAF('status_detail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {JOB_STATUS_DETAIL_OPTIONS[addForm.status]!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>

            <DField label="Location" value={addForm.location} onChange={v => setAF('location', v)} />

            <div className="grid grid-cols-3 gap-4">
              <DField label="Date Opened" value={addForm.date_opened} onChange={v => setAF('date_opened', v)} type="date" />
              <DField label="Date Applied" value={addForm.date_applied} onChange={v => setAF('date_applied', v)} type="date" />
              <DField label="Date Closed" value={addForm.date_closed} onChange={v => setAF('date_closed', v)} type="date" />
            </div>

            <DField label="LinkedIn URL" value={addForm.linkedin_url} onChange={v => setAF('linkedin_url', v)} type="url" />

            <div className="grid grid-cols-2 gap-4">
              <DField label="Career Site URL" value={addForm.career_site_url} onChange={v => setAF('career_site_url', v)} type="url" />
              <DField label="Career Site ID" value={addForm.career_site_id} onChange={v => setAF('career_site_id', v)} />
            </div>

            <DField label="Next Step" value={addForm.next_step} onChange={v => setAF('next_step', v)} />

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

            <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white">
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
