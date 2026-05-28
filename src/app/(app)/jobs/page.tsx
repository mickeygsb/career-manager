import { createClient } from '@/lib/supabase/server'
import { STATUS_COLORS, STATUS_LABELS, type ApplicationStatus } from '@/lib/types'
import Link from 'next/link'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link> to view your applications.</p>

  const { data: jobs } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Job Applications</h2>
        <Link href="/jobs/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Application
        </Link>
      </div>

      {!jobs?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">💼</p>
          <p className="text-gray-500">No applications yet. Start tracking your job search!</p>
          <Link href="/jobs/new" className="mt-4 inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Add your first application
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {jobs.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{job.role}</p>
                <p className="text-sm text-gray-500 truncate">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {job.remote_type && (
                  <span className="text-xs text-gray-400 capitalize">{job.remote_type}</span>
                )}
                {(job.salary_min || job.salary_max) && (
                  <span className="text-xs text-gray-400">
                    {job.salary_min ? `$${(job.salary_min / 1000).toFixed(0)}k` : ''}
                    {job.salary_min && job.salary_max ? '–' : ''}
                    {job.salary_max ? `$${(job.salary_max / 1000).toFixed(0)}k` : ''}
                  </span>
                )}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status as ApplicationStatus]}`}>
                  {STATUS_LABELS[job.status as ApplicationStatus]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
