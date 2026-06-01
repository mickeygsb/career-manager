import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { CareerHighlight, Achievement, Position } from '@/lib/types'
import ResumesClient from './ResumesClient'

export default async function ResumesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const [{ data: resumes }, { data: jobs }, { data: highlights }, { data: achievements }, { data: positions }] = await Promise.all([
    supabase.from('resumes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('jobs').select('id, position, employers(name, business_unit, industry, industry_segment)').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('career_highlights').select('*').eq('user_id', user.id).order('index', { ascending: true }),
    supabase.from('position_highlights').select('*').eq('user_id', user.id).order('index', { ascending: true }),
    supabase.from('positions').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
  ])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Resumes</h2>
      </div>
      <ResumesClient
        initialResumes={resumes ?? []}
        initialJobs={(jobs as unknown as Parameters<typeof ResumesClient>[0]['initialJobs']) ?? []}
        userId={user.id}
        initialHighlights={(highlights ?? []) as CareerHighlight[]}
        initialAchievements={(achievements ?? []) as Achievement[]}
        initialPositions={(positions ?? []) as Position[]}
      />
    </div>
  )
}
