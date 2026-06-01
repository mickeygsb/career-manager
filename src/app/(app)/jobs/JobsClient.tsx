'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Job, JobStatus } from '@/lib/types'
import { JOB_STATUS_DETAIL_OPTIONS } from '@/lib/types'

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<JobStatus, string> = {
  pending_review: 'bg-amber-100 text-amber-700',
  active:         'bg-green-100 text-green-700',
  closed:         'bg-slate-100 text-slate-600',
}

type EmployerRef = { id: string; name: string; business_unit?: string }

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
}

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
  const [dialog, setDialog] = useState<Draft | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  const employerMap = Object.fromEntries(employers.map(e => [e.id, e]))

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

  async function deleteJob(id: string) {
    closeDialog()
    const supabase = createClient()
    await supabase.from('jobs').delete().eq('id', id).eq('user_id', userId)
    setJobs(js => js.filter(j => j.id !== id))
  }

  if (!jobs.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-4xl mb-3">💼</p>
        <p className="text-gray-500">No jobs tracked yet. Add positions you're pursuing.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[22%]">Employer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[22%]">Position</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[11%]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[14%]">Status Detail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[10%]">Applied</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-[16%]">Next Step</th>
              <th className="px-4 py-3 w-[7%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map(job => (
              <tr key={job.id} className="group hover:bg-gray-50">
                <td className="px-4 py-2 text-black font-medium">
                  {jobEmployerName(job) ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-black">{job.position}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                    {STATUS_OPTIONS.find(o => o.value === job.status)?.label ?? job.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-black">
                  {job.status_detail || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-black tabular-nums">
                  {job.date_applied ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-black">
                  {job.next_step || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-1.5">
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
          </tbody>
        </table>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDialog} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold sticky top-0 bg-white pb-2">Edit Job</h3>

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
