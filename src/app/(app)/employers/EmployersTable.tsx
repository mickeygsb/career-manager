'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Employer, EmployerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: EmployerSize | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: '1-10', label: '1 - 10' },
  { value: '10-100', label: '10 - 100' },
  { value: '100-1000', label: '100 - 1000' },
  { value: '1000-10000', label: '1000 - 10000' },
  { value: '10000+', label: '10000+' },
]

type Row = Omit<Employer, 'user_id' | 'created_at' | 'updated_at'> & { open_jobs: number; applied_jobs: number }
type TextField = 'name' | 'subsidiary' | 'industry' | 'industry_segment' | 'location' | 'website' | 'linkedin_company_codes' | 'career_site_url'

function toRow(e: Employer, open_jobs = 0, applied_jobs = 0): Row {
  return {
    id: e.id,
    name: [e.name, e.subsidiary].filter(Boolean).join(' > '),
    subsidiary: e.subsidiary ?? '',
    aka: e.aka ?? '',
    industry: e.industry_segment ?? '',
    industry_segment: e.industry ?? '',
    fudge_factor: e.fudge_factor,
    size: e.size,
    location: e.location ?? '',
    address: e.address ?? '',
    linkedin_company_codes: e.linkedin_company_codes ?? '',
    career_site_url: e.career_site_url ?? '',
    status: e.status ?? '',
    website: e.website ?? '',
    employer_intro: e.employer_intro ?? '',
    notes: e.notes ?? '',
    is_target: e.is_target ?? false,
    growing_company: e.growing_company ?? false,
    active: e.active ?? false,
    open_jobs,
    applied_jobs,
  }
}

function parseEmployer(name: string) {
  const idx = name.indexOf(' > ')
  if (idx === -1) return { company: name, subsidiary: '' }
  return { company: name.slice(0, idx), subsidiary: name.slice(idx + 3) }
}

type JobStub = { employer_id: string | null; status: string; status_detail: string | null }

export default function EmployersTable({ initialEmployers, initialJobs, userId }: { initialEmployers: Employer[]; initialJobs: JobStub[]; userId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<Row[]>(() => {
    const openMap = new Map<string, number>()
    const appliedMap = new Map<string, number>()
    for (const j of initialJobs) {
      if (!j.employer_id) continue
      if (j.status === 'open') openMap.set(j.employer_id, (openMap.get(j.employer_id) ?? 0) + 1)
      if ((j.status === 'open' || j.status === 'closed') && j.status_detail !== "Didn't Apply")
        appliedMap.set(j.employer_id, (appliedMap.get(j.employer_id) ?? 0) + 1)
    }
    return initialEmployers.map(e => toRow(e, openMap.get(e.id) ?? 0, appliedMap.get(e.id) ?? 0))
  })
  const [filter, setFilter] = useState('')
  const [filterTarget, setFilterTarget] = useState(false)
  const [filterGrowing, setFilterGrowing] = useState(false)
  const [filterActive, setFilterActive] = useState(false)
  const [filterApplied, setFilterApplied] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterFudge, setFilterFudge] = useState<number | null>(null)
  const [sortOrder, setSortOrder] = useState<{ key: keyof Row; dir: 'asc' | 'desc' }[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupOrder, setGroupOrder] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setFilter(localStorage.getItem('employerFilter') ?? '')
      setFilterTarget(localStorage.getItem('employerFilterTarget') === 'true')
      setFilterGrowing(localStorage.getItem('employerFilterGrowing') === 'true')
      setFilterActive(localStorage.getItem('employerFilterActive') === 'true')
      const fv = localStorage.getItem('employerFilterFudge')
      setFilterFudge(fv === null || fv === '' ? null : parseInt(fv))
      const stored = localStorage.getItem('employerSortOrder')
      if (stored) {
        setSortOrder(JSON.parse(stored))
      } else {
        const key = localStorage.getItem('employerSortKey') as keyof Row | null
        const dir = (localStorage.getItem('employerSortDir') as 'asc' | 'desc') || 'asc'
        if (key) setSortOrder([{ key, dir }])
      }
      const cg = localStorage.getItem('employerCollapsedGroups')
      if (cg) setCollapsedGroups(new Set(JSON.parse(cg)))
      const go = localStorage.getItem('employerGroupOrder')
      if (go) setGroupOrder(JSON.parse(go))
    } catch {}
    setHydrated(true)
  }, [])
  const [dragSrcGroup, setDragSrcGroup] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<{ rowId: string; field: TextField } | null>(null)
  const [cellDraft, setCellDraft] = useState('')
  const [dialogRow, setDialogRow] = useState<Row | null>(null)
  const [dialogDraft, setDialogDraft] = useState<Row | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!dialogDraft) return
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
  }, [dialogDraft, dialogSaving])

  // ── per-cell helpers ─────────────────────────────────────────────────────

  function activateCell(rowId: string, field: TextField, current: string) {
    setActiveCell({ rowId, field })
    setCellDraft(current)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function commitCell(rowId: string, field: TextField, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, [field]: trimmed } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ [field]: trimmed || null }).eq('id', rowId).eq('user_id', userId)
  }

  function handleCellKey(e: React.KeyboardEvent, rowId: string, field: TextField) {
    if (e.key === 'Enter') commitCell(rowId, field, cellDraft)
    if (e.key === 'Escape') setActiveCell(null)
  }

  async function commitSize(rowId: string, value: string) {
    const v = value as EmployerSize | ''
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, size: v || undefined } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ size: v || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitEmployer(rowId: string, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, name: trimmed } : r))
    const { company, subsidiary } = parseEmployer(trimmed)
    const supabase = createClient()
    await supabase.from('employers').update({ name: company, subsidiary: subsidiary || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitIndustrySegment(rowId: string, value: string) {
    setActiveCell(null)
    const trimmed = value.trim()
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, industry: trimmed } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ industry_segment: trimmed || null }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitTarget(rowId: string, checked: boolean) {
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, is_target: checked } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ is_target: checked }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitGrowing(rowId: string, checked: boolean) {
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, growing_company: checked } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ growing_company: checked }).eq('id', rowId).eq('user_id', userId)
  }

  async function commitActive(rowId: string, checked: boolean) {
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, active: checked } : r))
    const supabase = createClient()
    await supabase.from('employers').update({ active: checked }).eq('id', rowId).eq('user_id', userId)
  }


  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return
    const row = rows.find(r => r.id === editId)
    if (row) {
      openDialog(row)
      router.replace('/employers')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── dialog helpers ────────────────────────────────────────────────────────

  function openDialog(row: Row) {
    setDialogRow(row)
    setDialogDraft({ ...row })
  }

  function closeDialog() {
    setDialogRow(null)
    setDialogDraft(null)
  }

  async function saveDialog() {
    if (!dialogDraft) return
    setDialogSaving(true)
    const supabase = createClient()
    const { company, subsidiary } = parseEmployer(dialogDraft.name)
    const { error } = await supabase.from('employers').update({
      name: company,
      subsidiary: subsidiary || null,
      aka: dialogDraft.aka || null,
      industry: dialogDraft.industry_segment || null,
      industry_segment: dialogDraft.industry || null,
      fudge_factor: dialogDraft.fudge_factor ?? null,
      size: dialogDraft.size || null,
      location: dialogDraft.location || null,
      address: dialogDraft.address || null,
      linkedin_company_codes: dialogDraft.linkedin_company_codes || null,
      career_site_url: dialogDraft.career_site_url || null,
      status: dialogDraft.status || null,
      website: dialogDraft.website || null,
      employer_intro: dialogDraft.employer_intro || null,
      notes: dialogDraft.notes || null,
      is_target: dialogDraft.is_target,
      growing_company: dialogDraft.growing_company,
      active: dialogDraft.active,
    }).eq('id', dialogDraft.id).eq('user_id', userId)
    if (!error) {
      setRows(rs => rs.map(r => r.id === dialogDraft.id ? { ...dialogDraft } : r))
      closeDialog()
    }
    setDialogSaving(false)
  }

  function setDialog(k: keyof Row, v: string | boolean | number) {
    setDialogDraft(d => d ? { ...d, [k]: v } : d)
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async function deleteRow(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('employers').delete().eq('id', id).eq('user_id', userId)
    setRows(rs => rs.filter(r => r.id !== id))
    setDeletingId(null)
  }

  // ── render ────────────────────────────────────────────────────────────────

  useEffect(() => { if (hydrated) localStorage.setItem('employerFilter', filter) }, [filter, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('employerFilterTarget', String(filterTarget)) }, [filterTarget, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('employerFilterGrowing', String(filterGrowing)) }, [filterGrowing, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem('employerFilterActive', String(filterActive)) }, [filterActive, hydrated])
  useEffect(() => {
    if (!hydrated) return
    if (filterFudge !== null) localStorage.setItem('employerFilterFudge', String(filterFudge))
    else localStorage.removeItem('employerFilterFudge')
  }, [filterFudge, hydrated])

  useEffect(() => {
    if (hydrated && groupOrder.length) localStorage.setItem('employerGroupOrder', JSON.stringify(groupOrder))
  }, [groupOrder, hydrated])

  useEffect(() => {
    if (hydrated) localStorage.setItem('employerCollapsedGroups', JSON.stringify([...collapsedGroups]))
  }, [collapsedGroups, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (sortOrder.length) localStorage.setItem('employerSortOrder', JSON.stringify(sortOrder))
    else localStorage.removeItem('employerSortOrder')
  }, [sortOrder, hydrated])

  function handleGroupDrop(targetLabel: string) {
    if (!dragSrcGroup || dragSrcGroup === targetLabel) return
    // Build the effective order the same way orderedGroups does: known order first,
    // then any new groups not yet in groupOrder appended at the end.
    const known = groupOrder.length ? groupOrder : grouped.map(g => g.label)
    const base = [
      ...known.filter(l => grouped.some(g => g.label === l)),
      ...grouped.map(g => g.label).filter(l => !known.includes(l)),
    ]
    const src = base.indexOf(dragSrcGroup)
    const tgt = base.indexOf(targetLabel)
    if (src === -1 || tgt === -1) return
    const next = [...base]
    const [moved] = next.splice(src, 1)
    next.splice(tgt, 0, moved)
    setGroupOrder(next)
    setDragSrcGroup(null)
    setDragOverGroup(null)
  }

  function toggleGroup(label: string) {
    setCollapsedGroups(s => {
      const next = new Set(s)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function handleSort(key: keyof Row, multi: boolean) {
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

  function sortIndicator(key: keyof Row) {
    const idx = sortOrder.findIndex(s => s.key === key)
    if (idx === -1) return <span className="ml-1 text-gray-300">↕</span>
    const arrow = sortOrder[idx].dir === 'asc' ? '↑' : '↓'
    if (sortOrder.length > 1) return <span className="ml-1">{arrow}<sup>{idx + 1}</sup></span>
    return <span className="ml-1">{arrow}</span>
  }

  const q = filter.trim().toLowerCase()
  const visibleRows = rows.filter(r => {
    if (q && !(
      r.name.toLowerCase().includes(q) ||
      (r.aka ?? '').toLowerCase().includes(q) ||
      (r.industry ?? '').toLowerCase().includes(q) ||
      (r.location ?? '').toLowerCase().includes(q)
    )) return false
    if (filterTarget && !r.is_target) return false
    if (filterGrowing && !r.growing_company) return false
    if (filterActive && !r.active) return false
    if (filterApplied && r.applied_jobs <= 0) return false
    if (filterOpen && r.open_jobs <= 0) return false
    if (filterFudge !== null && (r.fudge_factor == null || r.fudge_factor < filterFudge)) return false
    return true
  })

  const sortedRows = sortOrder.length ? [...visibleRows].sort((a, b) => {
    for (const { key, dir } of sortOrder) {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) continue
      if (av == null) return dir === 'asc' ? 1 : -1
      if (bv == null) return dir === 'asc' ? -1 : 1
      let cmp: number
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        cmp = av === bv ? 0 : av ? -1 : 1
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      }
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    }
    return 0
  }) : visibleRows

  const groupMap = new Map<string, Row[]>()
  for (const row of sortedRows) {
    const label = row.industry || '—'
    if (!groupMap.has(label)) groupMap.set(label, [])
    groupMap.get(label)!.push(row)
  }
  const grouped = [...groupMap.entries()]
    .map(([label, rows]) => ({ label, rows }))
    .sort((a, b) => {
      if (a.label === '—') return 1
      if (b.label === '—') return -1
      return a.label.localeCompare(b.label)
    })

  // apply manual group ordering, appending any new groups at the end
  const orderedGroups = (() => {
    const base = groupOrder.length ? groupOrder : grouped.map(g => g.label)
    const labels = [
      ...base.filter(l => groupMap.has(l)),
      ...grouped.map(g => g.label).filter(l => !base.includes(l)),
    ]
    return labels.map(l => ({ label: l, rows: groupMap.get(l)! }))
  })()

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="text-gray-500">No employers tracked yet. Add companies you're interested in.</p>
      </div>
    )
  }

  const isActive = (rowId: string, field: TextField) =>
    activeCell?.rowId === rowId && activeCell?.field === field

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name, industry, or location…"
          className="w-full sm:w-80 px-3 py-2 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterFudge ?? ''}
          onChange={e => setFilterFudge(e.target.value === '' ? null : parseInt(e.target.value))}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterFudge !== null ? 'border-purple-300 text-purple-800 bg-purple-50' : 'border-gray-200 text-gray-600'}`}
        >
          <option value="">Fudge: Any</option>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <option key={n} value={n}>Fudge ≥ {n}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterOpen(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterOpen ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Open
        </button>
        <button
          onClick={() => setFilterApplied(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterApplied ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Applied
        </button>
        <button
          onClick={() => setFilterGrowing(v => !v)}
          title="Growing"
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center ${filterGrowing ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </button>
        <button
          onClick={() => setFilterTarget(v => !v)}
          title="Target"
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center ${filterTarget ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </button>
        <button
          onClick={() => setFilterActive(v => !v)}
          title="Active"
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center ${filterActive ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
        </button>
        {(filter || filterTarget || filterGrowing || filterActive || filterFudge !== null || filterApplied || filterOpen) && (
          <button
            onClick={() => { setFilter(''); setFilterTarget(false); setFilterGrowing(false); setFilterActive(false); setFilterFudge(null); setFilterApplied(false); setFilterOpen(false) }}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium text-gray-500 w-[26%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('name', e.ctrlKey)}>Employer{sortIndicator('name')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[6%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('open_jobs', e.ctrlKey)}>Open{sortIndicator('open_jobs')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[6%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('applied_jobs', e.ctrlKey)}>Applied{sortIndicator('applied_jobs')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[7%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('career_site_url', e.ctrlKey)}>Link{sortIndicator('career_site_url')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[8%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('fudge_factor', e.ctrlKey)}>Fudge{sortIndicator('fudge_factor')}</th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[7%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('growing_company', e.ctrlKey)} title="Growing"><span className="inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>{sortIndicator('growing_company')}</span></th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[7%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('is_target', e.ctrlKey)} title="Target"><span className="inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>{sortIndicator('is_target')}</span></th>
              <th className="text-center px-4 py-2 font-medium text-gray-500 w-[7%] cursor-pointer select-none hover:text-gray-800" onClick={(e) => handleSort('active', e.ctrlKey)} title="Active"><span className="inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>{sortIndicator('active')}</span></th>
              <th className="px-4 py-2 w-[8%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">No employers match "{filter}"</td></tr>
            )}
            {orderedGroups.map(group => {
              const collapsed = collapsedGroups.has(group.label)
              const isDragOver = dragOverGroup === group.label
              const isDragging = dragSrcGroup === group.label
              return (<React.Fragment key={group.label}>
              <tr
                draggable
                onDragStart={() => setDragSrcGroup(group.label)}
                onDragOver={e => { e.preventDefault(); if (dragSrcGroup && dragSrcGroup !== group.label) setDragOverGroup(group.label) }}
                onDragLeave={() => setDragOverGroup(null)}
                onDrop={e => { e.preventDefault(); handleGroupDrop(group.label) }}
                onDragEnd={() => { setDragSrcGroup(null); setDragOverGroup(null) }}
                className={`select-none ${isDragOver ? 'border-t-2 border-blue-400' : ''} ${isDragging ? 'opacity-40' : ''}`}
              >
                <td colSpan={9} className="px-4 pt-2 pb-2 bg-blue-900 border-b border-blue-950">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wide">
                    <span className="text-blue-300 cursor-grab active:cursor-grabbing">⠿</span>
                    <span className="cursor-pointer" onClick={() => toggleGroup(group.label)}>{collapsed ? '▶' : '▼'}</span>
                    <span className="cursor-pointer" onClick={() => toggleGroup(group.label)}>{group.label}</span>
                    <span className="font-normal normal-case tracking-normal text-blue-300">({group.rows.length})</span>
                  </span>
                </td>
              </tr>
              {!collapsed && group.rows.map(row => (
              <tr key={row.id} className="group hover:bg-gray-50">

                {/* Employer */}
                <td className="px-4 py-1.5" onClick={() => {
                  localStorage.setItem('jobFilterEmployer', row.id)
                  router.push('/jobs')
                }}>
                  <span className="font-medium text-black cursor-pointer hover:text-blue-600 hover:underline">{row.name}</span>
                </td>


                {/* Open / Closed job counts */}
                <td className="px-4 py-1.5 text-center text-sm text-black">{row.open_jobs || <span className="text-gray-300">0</span>}</td>
                <td className="px-4 py-1.5 text-center text-sm text-black">{row.applied_jobs || <span className="text-gray-300">0</span>}</td>

                {/* Career Site URL */}
                <td className="px-4 py-1 text-center">
                  {row.career_site_url ? (
                    <a
                      href={row.career_site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={row.career_site_url}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded text-xs font-medium text-black hover:bg-gray-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* Fudge Factor — spinner 0–9, saves on change */}
                <td className="px-2 py-1 text-center">
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={row.fudge_factor ?? ''}
                    onChange={async e => {
                      const v = e.target.value === '' ? undefined : parseInt(e.target.value)
                      setRows(rs => rs.map(r => r.id === row.id ? { ...r, fudge_factor: v } : r))
                      const supabase = createClient()
                      await supabase.from('employers').update({ fudge_factor: v ?? null }).eq('id', row.id).eq('user_id', userId)
                    }}
                    className="w-14 px-1 py-1 border border-transparent rounded text-sm text-black bg-transparent hover:border-gray-200 hover:bg-gray-100 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500 text-center"
                  />
                </td>

                {/* Growing — immediate toggle */}
                <td className="px-4 py-1 text-center">
                  <button onClick={() => commitGrowing(row.id, !row.growing_company)} title={row.growing_company ? 'Growing' : 'Not growing'}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${row.growing_company ? 'text-blue-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </button>
                </td>

                {/* Target — immediate toggle */}
                <td className="px-4 py-1 text-center">
                  <button onClick={() => commitTarget(row.id, !row.is_target)} title={row.is_target ? 'Target' : 'Not a target'}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${row.is_target ? 'text-amber-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  </button>
                </td>

                {/* Active — immediate toggle */}
                <td className="px-4 py-1 text-center">
                  <button onClick={() => commitActive(row.id, !row.active)} title={row.active ? 'Active' : 'Inactive'}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${row.active ? 'text-green-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                  </button>
                </td>

                {/* Actions */}
                <td className="px-4 py-1">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDialog(row)}
                      className="px-2.5 py-1 border border-gray-200 text-black rounded text-xs font-medium hover:bg-gray-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              ))}
            </React.Fragment>)})}

          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {dialogDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDialog} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-semibold text-black px-6 pt-6 pb-2 shrink-0">Edit Employer</h3>
            <div className="px-6 pb-4 space-y-3 overflow-y-auto flex-1">

            {/* Employer name / AKA */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employer</label>
                <input
                  value={dialogDraft.name}
                  onChange={e => setDialog('name', e.target.value)}
                  placeholder="e.g. Acme Corp > Widget Division"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">AKA</label>
                <input
                  value={dialogDraft.aka ?? ''}
                  onChange={e => setDialog('aka', e.target.value)}
                  placeholder="e.g. Former name or abbreviation"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Industry / Industry Segment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                <input
                  value={dialogDraft.industry_segment ?? ''}
                  onChange={e => setDialog('industry_segment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry Segment</label>
                <input
                  value={dialogDraft.industry ?? ''}
                  onChange={e => setDialog('industry', e.target.value)}
                  placeholder="e.g. Technology > SaaS"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <input
                value={dialogDraft.location ?? ''}
                onChange={e => setDialog('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Flags */}
            <div className="flex gap-5">
              <button type="button" onClick={() => setDialog('is_target', !dialogDraft.is_target)}
                className="flex items-center gap-1.5 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${dialogDraft.is_target ? 'text-amber-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <span className={dialogDraft.is_target ? 'text-black' : 'text-gray-400'}>Evergreen Target</span>
              </button>
              <button type="button" onClick={() => setDialog('growing_company', !dialogDraft.growing_company)}
                className="flex items-center gap-1.5 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${dialogDraft.growing_company ? 'text-blue-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <span className={dialogDraft.growing_company ? 'text-black' : 'text-gray-400'}>Growing Company</span>
              </button>
              <button type="button" onClick={() => setDialog('active', !dialogDraft.active)}
                className="flex items-center gap-1.5 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${dialogDraft.active ? 'text-green-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                <span className={dialogDraft.active ? 'text-black' : 'text-gray-400'}>Active</span>
              </button>
            </div>

            {/* Size / Fudge / Open Jobs / Closed Jobs */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
                <select
                  value={dialogDraft.size ?? ''}
                  onChange={e => setDialog('size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fudge (0–9)</label>
                <input
                  type="number" min={0} max={9}
                  value={dialogDraft.fudge_factor ?? ''}
                  onChange={e => setDialog('fudge_factor', e.target.value === '' ? ('' as unknown as number) : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Open Jobs</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {initialJobs.filter(j => j.employer_id === dialogDraft.id && j.status !== 'closed').length}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Applied Jobs</label>
                <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-black bg-gray-50">
                  {initialJobs.filter(j => j.employer_id === dialogDraft.id && (j.status === 'open' || j.status === 'closed') && j.status_detail !== "Didn't Apply").length}
                </div>
              </div>
            </div>

            {/* Career Site URL / Website */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Career Site URL</label>
                <input
                  value={dialogDraft.career_site_url ?? ''}
                  onChange={e => setDialog('career_site_url', e.target.value)}
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
                <input
                  value={dialogDraft.website ?? ''}
                  onChange={e => setDialog('website', e.target.value)}
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* LinkedIn Company Codes / Address */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn Company Codes</label>
                <input
                  value={dialogDraft.linkedin_company_codes ?? ''}
                  onChange={e => setDialog('linkedin_company_codes', e.target.value)}
                  placeholder="e.g. 1234,5678"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input
                  value={dialogDraft.address ?? ''}
                  onChange={e => setDialog('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Employer Intro */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employer Intro</label>
              <textarea
                value={dialogDraft.employer_intro ?? ''}
                onChange={e => setDialog('employer_intro', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                value={dialogDraft.notes ?? ''}
                onChange={e => setDialog('notes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => { closeDialog(); deleteRow(dialogDraft.id) }}
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
    </>
  )
}
