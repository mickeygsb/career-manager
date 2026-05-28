import { createClient } from '@/lib/supabase/server'
import { STATUS_COLORS, STATUS_LABELS, type ApplicationStatus } from '@/lib/types'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Welcome to Career Manager</h2>
        <p className="text-gray-500 mb-6">Sign in to track your job search, skills, and career goals.</p>
        <Link href="/auth" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Get started
        </Link>
      </div>
    )
  }

  const [{ data: jobs }, { data: skills }, { data: goals }] = await Promise.all([
    supabase.from('job_applications').select('status').eq('user_id', user.id),
    supabase.from('skills').select('id').eq('user_id', user.id),
    supabase.from('career_goals').select('id, status').eq('user_id', user.id),
  ])

  const statusCounts = (jobs ?? []).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1
    return acc
  }, {})

  const activeGoals = (goals ?? []).filter(g => g.status === 'active').length

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Applications" value={(jobs ?? []).length} href="/jobs" />
        <StatCard label="Skills Tracked" value={(skills ?? []).length} href="/skills" />
        <StatCard label="Active Goals" value={activeGoals} href="/goals" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold mb-4">Applications by Status</h3>
        {Object.keys(STATUS_LABELS).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(Object.entries(STATUS_LABELS) as [ApplicationStatus, string][]).map(([status, label]) => (
              <div key={status} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[status]}`}>
                <span>{label}</span>
                <span className="font-bold">{statusCounts[status] ?? 0}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No applications yet. <Link href="/jobs" className="text-blue-600 hover:underline">Add your first one.</Link></p>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </Link>
  )
}
