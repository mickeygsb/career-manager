import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import JobsClient from './JobsClient'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const [{ data: jobs }, { data: employers }] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, employers(name, business_unit, industry, industry_segment)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('employers')
      .select('id, name, business_unit, location')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Jobs</h2>
      <JobsClient initialJobs={jobs ?? []} employers={employers ?? []} userId={user.id} />
    </div>
  )
}
