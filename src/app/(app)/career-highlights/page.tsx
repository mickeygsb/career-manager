import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { CareerHighlight, Keyword } from '@/lib/types'
import CareerHighlightsClient from './CareerHighlightsClient'

export default async function CareerHighlightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>
  }

  const [{ data: highlights }, { data: keywords }, { data: highlightKws }] = await Promise.all([
    supabase.from('career_highlights').select('*').eq('user_id', user.id).order('index', { ascending: true }),
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
        <h2 className="text-2xl font-bold text-blue-900">Career Highlights</h2>
      </div>
      <CareerHighlightsClient
        userId={user.id}
        initialHighlights={(highlights ?? []) as CareerHighlight[]}
        allKeywords={(keywords ?? []) as Keyword[]}
        initialHighlightKeywords={initialHighlightKeywords}
      />
    </div>
  )
}
