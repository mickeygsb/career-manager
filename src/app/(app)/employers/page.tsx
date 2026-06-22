import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import EmployersTable from './EmployersTable'

export default async function EmployersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: employers } = await supabase
    .from('employers')
    .select('*')
    .eq('user_id', user.id)
    .order('is_target', { ascending: false })
    .order('name', { ascending: true })

  const { data: jobs } = await supabase
    .from('jobs')
    .select('employer_id, status, status_detail')
    .eq('user_id', user.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Employers</h2>
        <Link href="/employers/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Employer
        </Link>
      </div>
      <EmployersTable initialEmployers={employers ?? []} initialJobs={jobs ?? []} userId={user.id} />
    </div>
  )
}
