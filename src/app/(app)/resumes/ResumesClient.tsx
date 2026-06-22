'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Resume, CareerHighlight, Achievement, Position, Keyword } from '@/lib/types'

type ResumeKeyword = { id: string; keyword_id: string; priority: 'must_have' | 'nice_to_have' }

type Job = { id: string; position: string; role?: string; domain?: string; specialty?: string; industry?: string; employers?: { name: string; subsidiary?: string; industry?: string; industry_segment?: string } }

function code(val: string) { return val.includes(' - ') ? val.split(' - ')[0] : val }

function templateTitle(r: { role?: string; domain?: string; industry?: string; specialty?: string }) {
  const parts = [r.role, r.domain, r.industry]
  if (!parts.some(Boolean)) return ''
  const base = `[${code(r.role || '')}_${code(r.domain || '')}_${code(r.industry || '')}]`
  return r.specialty ? `${base} (${r.specialty})` : base
}

function jobLabel(job: Job) {
  const emp = job.employers
  if (!emp) return job.position
  const empName = emp.subsidiary ? `${emp.name} > ${emp.subsidiary}` : emp.name
  return `${empName} — ${job.position}`
}

function employerSegment(job: Job) {
  return job.employers?.industry_segment || ''
}

type EditForm = {
  type: 'Template' | 'Job'
  job_id: string
  industry: string
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
    industry: r.industry ?? '',
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
  initialKeywords,
  initialHighlightKeywords,
}: {
  initialResumes: Resume[]
  initialJobs: Job[]
  userId: string
  initialHighlights: CareerHighlight[]
  initialAchievements: Achievement[]
  initialPositions: Position[]
  initialKeywords: Keyword[]
  initialHighlightKeywords: Record<string, string[]>
}) {
  const router = useRouter()
  const supabase = createClient()

  const [resumes, setResumes] = useState<Resume[]>(initialResumes)
  const [jobs] = useState<Job[]>(initialJobs)
  const [typeFilter, setTypeFilter] = useState<'Job' | 'Template'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('resumeTypeFilter')
      if (saved === 'Job' || saved === 'Template') return saved
    }
    return 'Template'
  })
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('resumeSelectedId')
      if (saved && initialResumes.some(r => r.id === saved)) return saved
    }
    return initialResumes[0]?.id ?? ''
  })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ type: 'Template', job_id: '', industry: '', headline: '', role: '', specialty: '', domain: '', effective_date: '', career_highlights_intro: '' })
  const [saving, setSaving] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [allHighlights, setAllHighlights] = useState<CareerHighlight[]>(initialHighlights)
  const [highlightKeywords] = useState<Record<string, string[]>>(initialHighlightKeywords)
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [linkedOrder, setLinkedOrder] = useState<string[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [dragSrcId, setDragSrcId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [showHighlightsDialog, setShowHighlightsDialog] = useState(false)
  const [editingHighlight, setEditingHighlight] = useState<CareerHighlight | null>(null)
  const [highlightEditForm, setHighlightEditForm] = useState({ title: '', description: '', keywords: '', includes_metrics: false })
  const [savingHighlight, setSavingHighlight] = useState(false)

  const [allAchievements, setAllAchievements] = useState<Achievement[]>(initialAchievements)
  const [allPositions] = useState<Position[]>(initialPositions)
  const [allKeywords] = useState<Keyword[]>(initialKeywords)
  const [resumeKeywords, setResumeKeywords] = useState<ResumeKeyword[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [selectedAddKeywordId, setSelectedAddKeywordId] = useState('')
  const [keywordSearch, setKeywordSearch] = useState('')
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false)
  const [addingKeyword, setAddingKeyword] = useState(false)
  const [dragKwState, setDragKwState] = useState<{ source: 'must_have' | 'nice_to_have' | 'available'; rkId?: string; kwId: string } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<'must_have' | 'nice_to_have' | 'available' | null>(null)
  const [filterKeywordId, setFilterKeywordId] = useState<string | null>(null)
  const [filterKwCategory, setFilterKwCategory] = useState('')
  const [filterKwCategoryDetail, setFilterKwCategoryDetail] = useState('')
  const [filterKwText, setFilterKwText] = useState('')
  const keywordDropdownRef = useRef<HTMLDivElement>(null)
  const [linkedAchievementIds, setLinkedAchievementIds] = useState<Set<string>>(new Set())
  const [linkedAchievementOrder, setLinkedAchievementOrder] = useState<string[]>([])
  const [togglingAchievementId, setTogglingAchievementId] = useState<string | null>(null)
  const [dragSrcAchievementId, setDragSrcAchievementId] = useState<string | null>(null)
  const [dragOverAchievementId, setDragOverAchievementId] = useState<string | null>(null)
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [showAchievementsDialog, setShowAchievementsDialog] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null)
  const [achievementEditForm, setAchievementEditForm] = useState({ description: '', description_alt1: '', description_alt2: '', keywords: '', includes_metrics: false })
  const [savingAchievement, setSavingAchievement] = useState(false)

  const filteredResumes = resumes.filter(r => r.type === typeFilter)
    .sort((a, b) => {
      const aTitle = a.type === 'Template' ? templateTitle(a) : (a.title || '')
      const bTitle = b.type === 'Template' ? templateTitle(b) : (b.title || '')
      return aTitle.localeCompare(bTitle)
    })
  const selected = resumes.find(r => r.id === selectedId) ?? null
  const selectedDisplaySegment = selected?.type === 'Job' && selected?.job_id
    ? (jobs.find(j => j.id === selected.job_id)?.industry ?? selected.industry)
    : selected?.industry

  const set = (k: keyof EditForm, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  const selectedJob = jobs.find(j => j.id === editForm.job_id)
  const jobPart = selectedJob ? (editForm.type === 'Job' ? jobLabel(selectedJob) : selectedJob.position) : ''
  const calculatedTitle = editForm.type === 'Template'
    ? templateTitle(editForm)
    : [jobPart, editForm.industry ? `[${editForm.industry}]` : ''].filter(Boolean).join(' ')

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
    localStorage.setItem('resumeSelectedId', selectedId)
  }, [selectedId])

  useEffect(() => {
    localStorage.setItem('resumeTypeFilter', typeFilter)
  }, [typeFilter])

  useEffect(() => {
    setFilterKeywordId(null)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) { setResumeKeywords([]); return }
    setKeywordsLoading(true)
    supabase
      .from('resume_keywords')
      .select('id, keyword_id, priority')
      .eq('resume_id', selectedId)
      .then(({ data }) => {
        setResumeKeywords((data ?? []) as ResumeKeyword[])
        setKeywordsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) { setLinkedAchievementIds(new Set()); setLinkedAchievementOrder([]); return }
    setAchievementsLoading(true)
    supabase
      .from('resume_position_achievements')
      .select('position_achievement_id, index')
      .eq('resume_id', selectedId)
      .order('index', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as { position_achievement_id: string; index: number }[]
        const orderedIds = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(r => r.position_achievement_id)
        setLinkedAchievementIds(new Set(orderedIds))
        setLinkedAchievementOrder(orderedIds)
        setAchievementsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  async function handleExportMarkdown() {
    if (!selected) return
    setExporting(true)

    const { data: employers } = await supabase
      .from('employers')
      .select('name, subsidiary, employer_intro')
      .eq('user_id', userId)

    const employerIntroMap: Record<string, string> = {}
    for (const emp of (employers ?? [])) {
      if (!emp.employer_intro) continue
      employerIntroMap[emp.name] = emp.employer_intro
      if (emp.subsidiary) {
        employerIntroMap[`${emp.name} > ${emp.subsidiary}`] = emp.employer_intro
      }
    }

    const lines: string[] = []

    lines.push(`# ${selected.title || '(untitled)'}`)
    lines.push('')

    if (selected.type) lines.push(`**Type:** ${selected.type}`)
    if (selectedDisplaySegment) lines.push(`**Industry:** ${selectedDisplaySegment}`)
    if (selected.role) lines.push(`**Role:** ${selected.role}`)
    if (selected.specialty) lines.push(`**Specialty:** ${selected.specialty}`)
    if (selected.domain) lines.push(`**Domain:** ${selected.domain}`)
    if (selected.effective_date) lines.push(`**Effective Date:** ${selected.effective_date}`)
    if (selected.headline) lines.push(`**Headline:** ${selected.headline}`)
    lines.push('')

    if (selected.career_highlights_intro) {
      lines.push(selected.career_highlights_intro)
      lines.push('')
    }

    if (linkedHighlights.length > 0) {
      lines.push('## Career Highlights')
      lines.push('')
      for (const h of linkedHighlights) {
        lines.push(`- **${h.title}**: ${h.description}`)
      }
      lines.push('')
    }

    const sortedPositions = [...allPositions].sort((a, b) => b.start_date.localeCompare(a.start_date))
    if (sortedPositions.length > 0) {
      lines.push('## Experience')
      lines.push('')
      const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

      for (const pos of sortedPositions) {
        const dateRange = `${fmt(pos.start_date)} – ${pos.end_date ? fmt(pos.end_date) : 'Present'}`
        lines.push(`### ${pos.employer} — ${pos.title}`)
        lines.push(`*${dateRange}*`)
        lines.push('')

        const empIntro = employerIntroMap[pos.employer]
        if (empIntro) {
          lines.push('**Employer Intro:**')
          lines.push('')
          lines.push(empIntro)
          lines.push('')
        }

        if (pos.resume_intro) {
          lines.push('**Position Intro:**')
          lines.push('')
          lines.push(pos.resume_intro)
          lines.push('')
        }

        const posAchievements = linkedAchievements.filter(a => a.position_id === pos.id)
        if (posAchievements.length > 0) {
          lines.push('**Achievements:**')
          lines.push('')
          for (const a of posAchievements) {
            lines.push(`- ${a.description}`)
            if (a.description_alt1) lines.push(`  - *(Alt 1)* ${a.description_alt1}`)
            if (a.description_alt2) lines.push(`  - *(Alt 2)* ${a.description_alt2}`)
          }
          lines.push('')
        }
      }
    }

    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(selected.title || 'resume').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  function startEdit() {
    if (!selected) return
    const form = toEditForm(selected)
    if (form.type === 'Job' && form.job_id) {
      const job = jobs.find(j => j.id === form.job_id)
      if (job) {
        form.industry = job.industry ?? ''
        form.role = job.role ?? ''
        form.domain = job.domain ?? ''
        form.specialty = job.specialty ?? ''
      }
    }
    setEditForm(form)
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const jobForSave = editForm.type === 'Job' && editForm.job_id ? jobs.find(j => j.id === editForm.job_id) : null
    const { data, error } = await supabase.from('resumes').update({
      type: editForm.type,
      job_id: editForm.job_id || null,
      industry: jobForSave ? (jobForSave.industry ?? null) : (editForm.industry || null),
      headline: editForm.headline || null,
      role: jobForSave ? (jobForSave.role ?? null) : (editForm.role || null),
      specialty: jobForSave ? (jobForSave.specialty ?? null) : (editForm.specialty || null),
      domain: jobForSave ? (jobForSave.domain ?? null) : (editForm.domain || null),
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

  async function cloneResume() {
    if (!selected) return
    setCloning(true)
    const clonedTitle = `${selected.title || '(untitled)'} (copy)`
    const { data: newResume, error } = await supabase.from('resumes').insert({
      user_id: userId,
      type: selected.type,
      job_id: selected.job_id ?? null,
      industry: selected.industry ?? null,
      headline: selected.headline ?? null,
      role: selected.role ?? null,
      specialty: selected.specialty ?? null,
      domain: selected.domain ?? null,
      effective_date: selected.effective_date ?? null,
      career_highlights_intro: selected.career_highlights_intro ?? null,
      title: clonedTitle,
    }).select().single()
    if (!error && newResume) {
      const newId = (newResume as Resume).id
      if (linkedOrder.length > 0) {
        await supabase.from('resume_career_highlights').insert(
          linkedOrder.map((hid, i) => ({ resume_id: newId, career_highlight_id: hid, index: i + 1 }))
        )
      }
      if (linkedAchievementOrder.length > 0) {
        await supabase.from('resume_position_achievements').insert(
          linkedAchievementOrder.map((aid, i) => ({ resume_id: newId, position_achievement_id: aid, index: i + 1 }))
        )
      }
      if (resumeKeywords.length > 0) {
        await supabase.from('resume_keywords').insert(
          resumeKeywords.map(rk => ({ resume_id: newId, keyword_id: rk.keyword_id, priority: rk.priority }))
        )
      }
      setResumes(rs => [...rs, newResume as Resume])
      setSelectedId(newId)
      setEditing(false)
    }
    setCloning(false)
  }

  async function addResumeKeyword(priority: 'must_have' | 'nice_to_have') {
    if (!selectedId || !selectedAddKeywordId) return
    setAddingKeyword(true)
    const { data, error } = await supabase.from('resume_keywords')
      .insert({ resume_id: selectedId, keyword_id: selectedAddKeywordId, priority })
      .select('id, keyword_id, priority')
      .single()
    if (!error && data) {
      setResumeKeywords(prev => [...prev, data as ResumeKeyword])
      setSelectedAddKeywordId('')
      setKeywordSearch('')
    }
    setAddingKeyword(false)
  }

  async function removeResumeKeyword(rkId: string) {
    await supabase.from('resume_keywords').delete().eq('id', rkId)
    setResumeKeywords(prev => prev.filter(rk => rk.id !== rkId))
  }

  async function handleKwDrop(targetCol: 'must_have' | 'nice_to_have' | 'available') {
    setDragOverCol(null)
    if (!dragKwState || dragKwState.source === targetCol) { setDragKwState(null); return }
    const { source, rkId, kwId } = dragKwState
    setDragKwState(null)
    if (source === 'available' && targetCol !== 'available') {
      const { data, error } = await supabase.from('resume_keywords')
        .insert({ resume_id: selectedId, keyword_id: kwId, priority: targetCol })
        .select('id, keyword_id, priority').single()
      if (!error && data) setResumeKeywords(prev => [...prev, data as ResumeKeyword])
    } else if (targetCol === 'available' && rkId) {
      await supabase.from('resume_keywords').delete().eq('id', rkId)
      setResumeKeywords(prev => prev.filter(rk => rk.id !== rkId))
    } else if (rkId) {
      await supabase.from('resume_keywords').update({ priority: targetCol as 'must_have' | 'nice_to_have' }).eq('id', rkId)
      setResumeKeywords(prev => prev.map(rk => rk.id === rkId ? { ...rk, priority: targetCol as 'must_have' | 'nice_to_have' } : rk))
    }
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
      await supabase.from('resume_position_achievements')
        .delete()
        .eq('resume_id', selectedId)
        .eq('position_achievement_id', achievementId)
      const newOrder = linkedAchievementOrder.filter(aid => aid !== achievementId)
      setLinkedAchievementIds(prev => { const s = new Set(prev); s.delete(achievementId); return s })
      setLinkedAchievementOrder(newOrder)
      await persistAchievementIndices(newOrder)
    } else {
      const nextIndex = linkedAchievementOrder.length + 1
      await supabase.from('resume_position_achievements')
        .insert({ resume_id: selectedId, position_achievement_id: achievementId, index: nextIndex })
      const newOrder = [...linkedAchievementOrder, achievementId]
      setLinkedAchievementIds(prev => new Set([...prev, achievementId]))
      setLinkedAchievementOrder(newOrder)
    }
    setTogglingAchievementId(null)
  }

  async function persistAchievementIndices(orderedIds: string[]) {
    await Promise.all(orderedIds.map((aid, i) =>
      supabase.from('resume_position_achievements')
        .update({ index: i + 1 })
        .eq('resume_id', selectedId)
        .eq('position_achievement_id', aid)
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

  function openHighlightEdit(h: CareerHighlight) {
    setEditingHighlight(h)
    setHighlightEditForm({ title: h.title, description: h.description, keywords: h.keywords ?? '', includes_metrics: h.includes_metrics })
  }

  async function handleHighlightSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingHighlight) return
    setSavingHighlight(true)
    const { data, error } = await supabase
      .from('career_highlights')
      .update({
        title: highlightEditForm.title.trim(),
        description: highlightEditForm.description.trim(),
        keywords: highlightEditForm.keywords.trim() || null,
        includes_metrics: highlightEditForm.includes_metrics,
      })
      .eq('id', editingHighlight.id)
      .select()
      .single()
    setSavingHighlight(false)
    if (!error && data) {
      setAllHighlights(prev => prev.map(h => h.id === editingHighlight.id ? (data as CareerHighlight) : h))
      setEditingHighlight(null)
    }
  }

  function openAchievementEdit(a: Achievement) {
    setEditingAchievement(a)
    setAchievementEditForm({ description: a.description, description_alt1: a.description_alt1 ?? '', description_alt2: a.description_alt2 ?? '', keywords: a.keywords ?? '', includes_metrics: a.includes_metrics })
  }

  async function handleAchievementSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAchievement) return
    setSavingAchievement(true)
    const { data, error } = await supabase
      .from('position_achievements')
      .update({
        description: achievementEditForm.description.trim(),
        description_alt1: achievementEditForm.description_alt1.trim() || null,
        description_alt2: achievementEditForm.description_alt2.trim() || null,
        keywords: achievementEditForm.keywords.trim() || null,
        includes_metrics: achievementEditForm.includes_metrics,
      })
      .eq('id', editingAchievement.id)
      .select()
      .single()
    setSavingAchievement(false)
    if (!error && data) {
      setAllAchievements(prev => prev.map(a => a.id === editingAchievement.id ? (data as Achievement) : a))
      setEditingAchievement(null)
    }
  }

  const highlightMap = Object.fromEntries(allHighlights.map(h => [h.id, h]))
  const linkedHighlights = linkedOrder.map(hid => highlightMap[hid]).filter(Boolean)

  const achievementMap = Object.fromEntries(allAchievements.map(a => [a.id, a]))
  const linkedAchievements = linkedAchievementOrder.map(aid => achievementMap[aid]).filter(Boolean)
  const positionMap = Object.fromEntries(allPositions.map(p => [p.id, p]))

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (keywordDropdownRef.current && !keywordDropdownRef.current.contains(e.target as Node)) {
        setShowKeywordDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const keywordMap = Object.fromEntries(allKeywords.map(k => [k.id, k]))
  const linkedKeywordIds = new Set(resumeKeywords.map(rk => rk.keyword_id))
  const availableKeywords = allKeywords.filter(k => !linkedKeywordIds.has(k.id))
  const filteredKeywords = keywordSearch.trim()
    ? availableKeywords.filter(k => k.keyword.toLowerCase().includes(keywordSearch.toLowerCase().trim())).slice(0, 60)
    : []

  function isKeywordIncluded(kwId: string): boolean {
    const kw = keywordMap[kwId]
    if (!kw) return false
    const name = kw.keyword.toLowerCase().trim()
    return linkedHighlights.some(h =>
      (highlightKeywords[h.id] ?? []).some(kwId => keywordMap[kwId]?.keyword.toLowerCase().trim() === name)
    ) || linkedAchievements.some(a =>
      a.keywords?.split(',').some(k => k.trim().toLowerCase() === name)
    )
  }

  const kwPassesFilter = (kw: Keyword | undefined) => {
    if (!kw) return true
    if (filterKwCategory && kw.category !== filterKwCategory) return false
    if (filterKwCategoryDetail && kw.category_detail !== filterKwCategoryDetail) return false
    if (filterKwText && !kw.keyword.toLowerCase().includes(filterKwText.toLowerCase())) return false
    return true
  }
  const kwCategories = [...new Set(allKeywords.map(k => k.category).filter(Boolean))].sort()
  const kwCategoryDetails = [...new Set(
    allKeywords
      .filter(k => !filterKwCategory || k.category === filterKwCategory)
      .map(k => k.category_detail)
      .filter((v): v is string => !!v)
  )].sort()

  const kwSort = (a: ResumeKeyword, b: ResumeKeyword) =>
    (keywordMap[a.keyword_id]?.keyword ?? '').localeCompare(keywordMap[b.keyword_id]?.keyword ?? '')
  const mustHaveIncluded = resumeKeywords.filter(rk => rk.priority === 'must_have' && isKeywordIncluded(rk.keyword_id) && kwPassesFilter(keywordMap[rk.keyword_id])).sort(kwSort)
  const mustHaveMissing  = resumeKeywords.filter(rk => rk.priority === 'must_have' && !isKeywordIncluded(rk.keyword_id) && kwPassesFilter(keywordMap[rk.keyword_id])).sort(kwSort)
  const niceIncluded     = resumeKeywords.filter(rk => rk.priority === 'nice_to_have' && isKeywordIncluded(rk.keyword_id) && kwPassesFilter(keywordMap[rk.keyword_id])).sort(kwSort)
  const niceMissing      = resumeKeywords.filter(rk => rk.priority === 'nice_to_have' && !isKeywordIncluded(rk.keyword_id) && kwPassesFilter(keywordMap[rk.keyword_id])).sort(kwSort)
  const availableIncluded = availableKeywords.filter(k => isKeywordIncluded(k.id) && kwPassesFilter(k)).sort((a, b) => a.keyword.localeCompare(b.keyword))
  const availableMissing  = availableKeywords.filter(k => !isKeywordIncluded(k.id) && kwPassesFilter(k)).sort((a, b) => a.keyword.localeCompare(b.keyword))

  const filterKeyword = filterKeywordId ? keywordMap[filterKeywordId] : null
  const displayedHighlights = filterKeyword
    ? linkedHighlights.filter(h => (highlightKeywords[h.id] ?? []).includes(filterKeyword.id))
    : linkedHighlights
  const displayedAchievements = filterKeyword
    ? linkedAchievements.filter(a => a.keywords?.split(',').some(k => k.trim().toLowerCase() === filterKeyword.keyword.toLowerCase().trim()))
    : linkedAchievements
  const achievementsByPosition = allPositions
    .map(p => ({ position: p, achievements: allAchievements.filter(a => a.position_id === p.id) }))
    .filter(g => g.achievements.length > 0)

  const selectedJobRecord = selected?.type === 'Job' && selected?.job_id ? jobs.find(j => j.id === selected.job_id) : null
  const displayRole = selectedJobRecord ? (selectedJobRecord.role ?? '') : (selected?.role ?? '')
  const displayDomain = selectedJobRecord ? (selectedJobRecord.domain ?? '') : (selected?.domain ?? '')
  const displaySpecialty = selectedJobRecord ? (selectedJobRecord.specialty ?? '') : (selected?.specialty ?? '')

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
      {/* Type filter + Selector row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm shrink-0">
          {(['Templates', 'Jobs'] as const).map((label, i) => {
            const type = label === 'Jobs' ? 'Job' : 'Template'
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setTypeFilter(type)
                  const filtered = resumes.filter(r => r.type === type)
                  const match = filtered.find(r => r.id === selectedId)
                  if (!match) { setSelectedId(filtered[0]?.id ?? ''); setEditing(false) }
                }}
                className={`w-[100px] py-2 font-medium transition-colors text-center ${
                  typeFilter === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                } ${i > 0 ? 'border-l border-gray-200' : ''}`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setEditing(false) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 max-w-xl"
        >
          <option value="">Select a resume…</option>
          {filteredResumes.map(r => (
            <option key={r.id} value={r.id}>{r.type === 'Template' ? (templateTitle(r) || '(untitled)') : (r.title || '(untitled)')}</option>
          ))}
        </select>
        {(() => {
          const idx = filteredResumes.findIndex(r => r.id === selectedId)
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
                onClick={() => { const prev = filteredResumes[idx - 1]; if (prev) { setSelectedId(prev.id); setEditing(false) } }}>
                ←
              </button>
              <button type="button" title="Next" disabled={idx >= filteredResumes.length - 1}
                className={btnCls(idx >= filteredResumes.length - 1)}
                onClick={() => { const next = filteredResumes[idx + 1]; if (next) { setSelectedId(next.id); setEditing(false) } }}>
                →
              </button>
            </div>
          )
        })()}
        {selected && !editing && (
          <button onClick={handleExportMarkdown} disabled={exporting} title="Export .md"
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {exporting
              ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }
          </button>
        )}
        {selected && !editing && (
          <button onClick={startEdit}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
        )}
        {selected && !editing && (
          <button onClick={cloneResume} disabled={cloning} title="Clone resume"
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {cloning
              ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            }
          </button>
        )}
        <button onClick={() => router.push('/resumes/new')}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      {/* Detail panel */}
      {selected && !editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Row 1: Job (conditional) */}
          {selected.job_id && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-0.5">Job</p>
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline text-left"
                onClick={() => {
                  localStorage.setItem('jobAutoOpenId', selected.job_id!)
                  router.push('/jobs')
                }}
              >
                {jobs.find(j => j.id === selected.job_id) ? jobLabel(jobs.find(j => j.id === selected.job_id)!) : selected.job_id}
              </button>
            </div>
          )}
          {/* Row 3: Role | Domain | Specialty */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Role" value={displayRole} />
            <Field label="Domain" value={displayDomain} />
            <Field label="Specialty" value={displaySpecialty} />
          </div>
          {/* Row 4: Industry | Effective Date */}
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <Field label="Industry" value={selectedDisplaySegment} />
            </div>
            <div style={{ width: 200, flexShrink: 0 }}>
              <Field label="Effective Date" value={selected.effective_date} />
            </div>
          </div>
          {/* Row 5: Headline */}
          <Field label="Headline" value={selected.headline} />
          {/* Row 6: Career Intro */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-0.5">Career Intro</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.career_highlights_intro || <span className="text-gray-400">—</span>}</p>
          </div>
        </div>
      )}

      {/* Inline edit form */}
      {selected && editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex gap-4 items-end">
            <div style={{ width: 200, flexShrink: 0 }}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={editForm.type} onChange={e => { set('type', e.target.value); if (e.target.value === 'Template') { set('job_id', ''); set('industry', '') } }}
                className={inputCls + ' bg-white'}>
                <option value="Template">Template</option>
                <option value="Job">Job</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Resume Title</label>
              <div className={readonlyCls}>{calculatedTitle || <span className="text-gray-300">—</span>}</div>
            </div>
          </div>
          {editForm.type === 'Job' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job</label>
              <select value={editForm.job_id} onChange={e => {
                const job = jobs.find(j => j.id === e.target.value)
                setEditForm(f => ({ ...f, job_id: e.target.value, industry: job?.industry ?? '', role: job?.role ?? '', domain: job?.domain ?? '', specialty: job?.specialty ?? '' }))
              }} className={inputCls + ' bg-white'}>
                <option value="">— Not linked —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role{editForm.type === 'Job' && <span className="ml-1 text-gray-400 font-normal">(from job)</span>}</label>
              {editForm.type === 'Job'
                ? <div className={readonlyCls}>{editForm.role || <span className="text-gray-300">—</span>}</div>
                : <input value={editForm.role} onChange={e => set('role', e.target.value)} className={inputCls} />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Domain{editForm.type === 'Job' && <span className="ml-1 text-gray-400 font-normal">(from job)</span>}</label>
              {editForm.type === 'Job'
                ? <div className={readonlyCls}>{editForm.domain || <span className="text-gray-300">—</span>}</div>
                : <input value={editForm.domain} onChange={e => set('domain', e.target.value)} className={inputCls} />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Specialty{editForm.type === 'Job' && <span className="ml-1 text-gray-400 font-normal">(from job)</span>}</label>
              {editForm.type === 'Job'
                ? <div className={readonlyCls}>{editForm.specialty || <span className="text-gray-300">—</span>}</div>
                : <input value={editForm.specialty} onChange={e => set('specialty', e.target.value)} className={inputCls} />}
            </div>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Industry{editForm.type === 'Job' && <span className="ml-1 text-gray-400 font-normal">(from job)</span>}</label>
              {editForm.type === 'Job'
                ? <div className={readonlyCls}>{editForm.industry || <span className="text-gray-300">—</span>}</div>
                : <input value={editForm.industry} onChange={e => set('industry', e.target.value)} className={inputCls} />}
            </div>
            <div style={{ width: 200, flexShrink: 0 }}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Effective Date</label>
              <input type="date" value={editForm.effective_date} onChange={e => set('effective_date', e.target.value)} className={inputCls} />
            </div>
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

      {/* Keywords pane */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Keywords label + filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-[100px]">Keywords</h3>
            <input
              type="text"
              value={filterKwText}
              onChange={e => setFilterKwText(e.target.value)}
              placeholder="Filter keywords…"
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
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
              <button
                type="button"
                onClick={() => { setFilterKwText(''); setFilterKwCategory(''); setFilterKwCategoryDetail('') }}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>

          {/* 2×2 grid */}
          {keywordsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="grid grid-cols-[60px_1fr_1fr_2fr] gap-x-3 gap-y-2">
              {/* Column headers */}
              <div />
              <div className="text-xs font-semibold text-center text-blue-700 pb-1">Must Have</div>
              <div className="text-xs font-semibold text-center text-purple-700 pb-1">Nice to Have</div>
              <div className="text-xs font-semibold text-center text-gray-500 pb-1">Not Needed</div>

              {/* Included row */}
              <div className="text-xs font-semibold text-green-700 pt-2 leading-tight">Included</div>
              {[mustHaveIncluded, niceIncluded].map((bucket, bi) => {
                const col = bi === 0 ? 'must_have' : 'nice_to_have' as const
                const isDropTarget = dragOverCol === col && dragKwState?.source !== col
                return (
                  <div key={bi}
                    className={`min-h-[64px] max-h-[200px] overflow-y-auto border border-green-200 bg-green-50 rounded-lg p-2 flex flex-wrap gap-1 content-start transition-shadow ${isDropTarget ? 'ring-2 ring-blue-400' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                    onDrop={e => { e.preventDefault(); handleKwDrop(col) }}
                  >
                    {bucket.map(rk => {
                      const kw = keywordMap[rk.keyword_id]
                      if (!kw) return null
                      const isActive = filterKeywordId === rk.keyword_id
                      return (
                        <span key={rk.id}
                          draggable
                          onDragStart={() => setDragKwState({ source: rk.priority as 'must_have' | 'nice_to_have', rkId: rk.id, kwId: rk.keyword_id })}
                          onDragEnd={() => { setDragKwState(null); setDragOverCol(null) }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-grab transition-all bg-green-100 text-green-800 hover:bg-green-200 ${isActive ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
                          onClick={() => { setFilterKeywordId(isActive ? null : rk.keyword_id); setKeywordSearch(kw.keyword); setSelectedAddKeywordId(rk.keyword_id) }}>
                          {kw.keyword}
                          <button type="button" onClick={e => { e.stopPropagation(); removeResumeKeyword(rk.id) }} className="opacity-50 hover:opacity-100 leading-none">×</button>
                        </span>
                      )
                    })}
                  </div>
                )
              })}
              <div
                className={`min-h-[64px] max-h-[200px] overflow-y-auto border border-gray-200 bg-gray-50 rounded-lg p-2 flex flex-wrap gap-1 content-start transition-shadow ${dragOverCol === 'available' && dragKwState?.source !== 'available' ? 'ring-2 ring-blue-400' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol('available') }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                onDrop={e => { e.preventDefault(); handleKwDrop('available') }}
              >
                {availableIncluded.map(kw => {
                  const isActive = filterKeywordId === kw.id
                  return (
                    <span key={kw.id}
                      draggable
                      onDragStart={() => setDragKwState({ source: 'available', kwId: kw.id })}
                      onDragEnd={() => { setDragKwState(null); setDragOverCol(null) }}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-grab transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ${isActive ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
                      onClick={() => { setFilterKeywordId(isActive ? null : kw.id); setKeywordSearch(kw.keyword); setSelectedAddKeywordId(kw.id) }}>
                      {kw.keyword}
                    </span>
                  )
                })}
              </div>

              {/* Missing row */}
              <div className="text-xs font-semibold text-red-600 pt-2 leading-tight">Missing</div>
              {[mustHaveMissing, niceMissing].map((bucket, bi) => {
                const col = bi === 0 ? 'must_have' : 'nice_to_have' as const
                const isDropTarget = dragOverCol === col && dragKwState?.source !== col
                return (
                  <div key={bi}
                    className={`min-h-[64px] max-h-[200px] overflow-y-auto border rounded-lg p-2 flex flex-wrap gap-1 content-start transition-shadow ${bi === 1 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'} ${isDropTarget ? 'ring-2 ring-blue-400' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                    onDrop={e => { e.preventDefault(); handleKwDrop(col) }}
                  >
                    {bucket.map(rk => {
                      const kw = keywordMap[rk.keyword_id]
                      if (!kw) return null
                      const isActive = filterKeywordId === rk.keyword_id
                      return (
                        <span key={rk.id}
                          draggable
                          onDragStart={() => setDragKwState({ source: rk.priority as 'must_have' | 'nice_to_have', rkId: rk.id, kwId: rk.keyword_id })}
                          onDragEnd={() => { setDragKwState(null); setDragOverCol(null) }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-grab transition-all ${bi === 1 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} ${isActive ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
                          onClick={() => { setFilterKeywordId(isActive ? null : rk.keyword_id); setKeywordSearch(kw.keyword); setSelectedAddKeywordId(rk.keyword_id) }}>
                          {kw.keyword}
                          <button type="button" onClick={e => { e.stopPropagation(); removeResumeKeyword(rk.id) }} className="opacity-50 hover:opacity-100 leading-none">×</button>
                        </span>
                      )
                    })}
                  </div>
                )
              })}
              <div
                className={`min-h-[64px] max-h-[200px] overflow-y-auto border border-green-200 bg-green-50 rounded-lg p-2 flex flex-wrap gap-1 content-start transition-shadow ${dragOverCol === 'available' && dragKwState?.source !== 'available' ? 'ring-2 ring-blue-400' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol('available') }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                onDrop={e => { e.preventDefault(); handleKwDrop('available') }}
              >
                {availableMissing.map(kw => {
                  const isActive = filterKeywordId === kw.id
                  return (
                    <span key={kw.id}
                      draggable
                      onDragStart={() => setDragKwState({ source: 'available', kwId: kw.id })}
                      onDragEnd={() => { setDragKwState(null); setDragOverCol(null) }}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-grab transition-all bg-green-100 text-green-800 hover:bg-green-200 ${isActive ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
                      onClick={() => { setFilterKeywordId(isActive ? null : kw.id); setKeywordSearch(kw.keyword); setSelectedAddKeywordId(kw.id) }}>
                      {kw.keyword}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
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
              + Add
            </button>
          </div>

          {filterKeyword && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filtered by:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {filterKeyword.keyword}
                <button type="button" onClick={() => setFilterKeywordId(null)} className="opacity-60 hover:opacity-100 leading-none">×</button>
              </span>
            </div>
          )}
          {highlightsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : linkedHighlights.length === 0 ? (
            <p className="text-sm text-gray-400">No highlights linked yet.</p>
          ) : displayedHighlights.length === 0 ? (
            <p className="text-sm text-gray-400">No highlights match this keyword.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {displayedHighlights.map((h) => {
                const globalIdx = linkedHighlights.indexOf(h)
                return (
                <li
                  key={h.id}
                  draggable
                  onDragStart={() => setDragSrcId(h.id)}
                  onDragOver={e => { e.preventDefault(); if (dragSrcId && dragSrcId !== h.id) setDragOverId(h.id) }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={e => { e.preventDefault(); handleDrop(h.id) }}
                  onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                  className={`flex items-start gap-3 px-4 py-0.5 bg-blue-50 transition-colors ${dragOverId === h.id ? 'border-l-2 border-blue-500' : ''} ${dragSrcId === h.id ? 'opacity-40' : ''}`}
                >
                  <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                  <span className="text-xs font-medium text-blue-400 shrink-0 pt-0.5 w-5">#{globalIdx + 1}</span>
                  <div className="flex gap-3 flex-1 min-w-0">
                    {(highlightKeywords[h.id] ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 content-start w-[30%] shrink-0">
                        {(highlightKeywords[h.id] ?? []).map(kwId => keywordMap[kwId]).filter(Boolean).map(kw => (
                          <span key={kw.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {kw.keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="min-w-0 w-[65%]">
                      <p className="text-sm font-medium text-gray-800">{h.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openHighlightEdit(h)}
                    className="shrink-0 text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
                    title="Edit highlight"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLink(h.id)}
                    disabled={togglingId === h.id}
                    className="shrink-0 text-red-400 hover:text-red-600 border border-red-100 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                    title="Remove highlight"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </li>
              )})}
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
              {(() => {
                const available = allHighlights.filter(h => !linkedIds.has(h.id))
                return available.length === 0 ? (
                  <p className="text-sm text-gray-400 p-6">
                    {allHighlights.length === 0
                      ? 'No career highlights found. Add some on the Career Highlights page first.'
                      : 'All career highlights are already linked.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {available.map(h => (
                      <li key={h.id} className="flex items-start gap-3 px-6 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{h.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{h.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLink(h.id)}
                          disabled={togglingId === h.id}
                          className="shrink-0 text-xs font-medium rounded px-2 py-1 border disabled:opacity-50 text-blue-600 hover:text-blue-800 border-blue-100 hover:bg-blue-50"
                        >
                          + Link
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              })()}
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

      {/* Career Highlight edit dialog */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingHighlight(null)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-0">
              <h3 className="text-base font-semibold text-gray-800">Edit Career Highlight</h3>
            </div>
            <form onSubmit={handleHighlightSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Highlight Title *</label>
                <input value={highlightEditForm.title} required
                  onChange={e => setHighlightEditForm(f => ({ ...f, title: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Highlight Description *</label>
                <textarea value={highlightEditForm.description} required rows={4}
                  onChange={e => setHighlightEditForm(f => ({ ...f, description: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Keywords</label>
                <input value={highlightEditForm.keywords}
                  onChange={e => setHighlightEditForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="e.g. leadership, revenue growth, cross-functional"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="hl_includes_metrics" checked={highlightEditForm.includes_metrics}
                  onChange={e => setHighlightEditForm(f => ({ ...f, includes_metrics: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="hl_includes_metrics" className="text-sm font-medium text-gray-700">Includes Metrics</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditingHighlight(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingHighlight}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingHighlight ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
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
              + Add
            </button>
          </div>

          {filterKeyword && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filtered by:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {filterKeyword.keyword}
                <button type="button" onClick={() => setFilterKeywordId(null)} className="opacity-60 hover:opacity-100 leading-none">×</button>
              </span>
            </div>
          )}
          {achievementsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : linkedAchievements.length === 0 ? (
            <p className="text-sm text-gray-400">No achievements linked yet.</p>
          ) : displayedAchievements.length === 0 ? (
            <p className="text-sm text-gray-400">No achievements match this keyword.</p>
          ) : (() => {
            const groups: { positionId: string; label: string; items: { achievement: typeof linkedAchievements[0]; globalIndex: number }[] }[] = []
            const positionOrder: string[] = []
            displayedAchievements.forEach((a) => {
              const pos = positionMap[a.position_id]
              const positionId = a.position_id ?? 'unknown'
              const label = pos ? `${pos.employer} - ${pos.title}` : 'Unknown'
              if (!positionOrder.includes(positionId)) { positionOrder.push(positionId); groups.push({ positionId, label, items: [] }) }
              groups.find(g => g.positionId === positionId)!.items.push({ achievement: a, globalIndex: linkedAchievements.indexOf(a) })
            })
            return (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {groups.map(({ positionId, label, items }) => (
                  <div key={positionId}>
                    <div className="px-4 py-2 bg-blue-600 border-b border-blue-500">
                      <p className="text-sm font-semibold text-white">{label}</p>
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
                            className={`flex items-start gap-3 px-4 py-0.5 bg-blue-50 transition-colors ${dragOverAchievementId === a.id ? 'border-l-2 border-blue-500' : ''} ${dragSrcAchievementId === a.id ? 'opacity-40' : ''}`}
                          >
                            <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-0.5 shrink-0">⠿</span>
                            <span className="text-xs font-medium text-blue-400 shrink-0 pt-0.5 w-5">#{i + 1}</span>
                            <div className="flex gap-3 flex-1 min-w-0">
                              {a.keywords && (
                                <p className="text-xs text-gray-400 whitespace-pre-wrap w-[30%] shrink-0">
                                  {a.keywords.split(',').map(k => k.trim()).join('\n')}
                                </p>
                              )}
                              <div className="min-w-0 w-[65%]">
                                <p className="text-sm text-gray-800 line-clamp-2">{a.description}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAchievementEdit(a)}
                              className="shrink-0 text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
                              title="Edit achievement"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAchievementLink(a.id)}
                              disabled={togglingAchievementId === a.id}
                              className="shrink-0 text-red-400 hover:text-red-600 border border-red-100 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                              title="Remove achievement"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
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

      {/* Position Achievement edit dialog */}
      {editingAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingAchievement(null)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-0">
              <h3 className="text-base font-semibold text-gray-800">Edit Position Achievement</h3>
            </div>
            <form onSubmit={handleAchievementSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <textarea value={achievementEditForm.description} required rows={3}
                  onChange={e => setAchievementEditForm(f => ({ ...f, description: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 1</label>
                <textarea value={achievementEditForm.description_alt1} rows={2}
                  onChange={e => setAchievementEditForm(f => ({ ...f, description_alt1: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description - Alt 2</label>
                <textarea value={achievementEditForm.description_alt2} rows={2}
                  onChange={e => setAchievementEditForm(f => ({ ...f, description_alt2: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-y" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Keywords</label>
                <input value={achievementEditForm.keywords}
                  onChange={e => setAchievementEditForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="e.g. leadership, data analysis, cost reduction"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ach_includes_metrics" checked={achievementEditForm.includes_metrics}
                  onChange={e => setAchievementEditForm(f => ({ ...f, includes_metrics: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="ach_includes_metrics" className="text-sm font-medium text-gray-700">Includes Metrics</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditingAchievement(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingAchievement}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingAchievement ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
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
              {(() => {
                const unlinkedGroups = achievementsByPosition
                  .map(({ position, achievements }) => ({
                    position,
                    achievements: achievements.filter(a => !linkedAchievementIds.has(a.id)),
                  }))
                  .filter(g => g.achievements.length > 0)
                return unlinkedGroups.length === 0 ? (
                  <p className="text-sm text-gray-400 p-6">
                    {achievementsByPosition.length === 0
                      ? 'No achievements found. Add some on the Achievements page first.'
                      : 'All achievements are already linked.'}
                  </p>
                ) : (
                  unlinkedGroups.map(({ position, achievements }) => (
                    <div key={position.id}>
                      <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                        <p className="text-xs font-semibold text-gray-600">{position.title} · {position.employer}</p>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {achievements.map(a => (
                          <li key={a.id} className="flex items-start gap-3 px-6 py-4">
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
                              className="shrink-0 text-xs font-medium rounded px-2 py-1 border disabled:opacity-50 text-blue-600 hover:text-blue-800 border-blue-100 hover:bg-blue-50"
                            >
                              + Link
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )
              })()}
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
