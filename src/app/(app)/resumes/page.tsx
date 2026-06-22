import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { CareerHighlight, Achievement, Position, Keyword } from '@/lib/types'
import ResumesClient from './ResumesClient'

export default async function ResumesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const [{ data: resumes }, { data: jobs }, { data: highlights }, { data: achievements }, { data: positions }, { data: keywords }, { data: highlightKws }] = await Promise.all([
    supabase.from('resumes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('jobs').select('id, position, role, domain, specialty, industry, employers(name, subsidiary, industry, industry_segment)').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('career_highlights').select('*').eq('user_id', user.id).order('index', { ascending: true }),
    supabase.from('position_achievements').select('*').eq('user_id', user.id).order('index', { ascending: true }),
    supabase.from('positions').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
    supabase.from('keywords').select('*').eq('user_id', user.id).order('category').order('keyword'),
    supabase.from('career_highlight_keywords').select('career_highlight_id, keyword_id').eq('user_id', user.id),
  ])

  const initialHighlightKeywords: Record<string, string[]> = {}
  for (const row of (highlightKws ?? [])) {
    ;(initialHighlightKeywords[row.career_highlight_id] ??= []).push(row.keyword_id)
  }

  return (
    <div>
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
        initialKeywords={(keywords ?? []) as Keyword[]}
        initialHighlightKeywords={initialHighlightKeywords}
      />
    </div>
  )
}
