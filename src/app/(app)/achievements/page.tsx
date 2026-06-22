import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Achievement, Position, Keyword } from '@/lib/types'
import AchievementsClient from './AchievementsClient'

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>
  }

  const [{ data: achievements }, { data: positions }, { data: employers }, { data: keywordsData }, { data: achKwData }] = await Promise.all([
    supabase.from('position_achievements').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('positions').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
    supabase.from('employers').select('id, name, subsidiary').eq('user_id', user.id).order('name'),
    supabase.from('keywords').select('*').eq('user_id', user.id).order('category').order('index'),
    supabase.from('position_achievement_keywords').select('position_achievement_id, keyword_id').eq('user_id', user.id),
  ])

  const employerNames = (employers ?? [])
    .map(e => [e.name, e.subsidiary].filter(Boolean).join(' > '))
    .sort((a, b) => a.localeCompare(b))

  const employerIdsByName = Object.fromEntries(
    (employers ?? []).map(e => [[e.name, e.subsidiary].filter(Boolean).join(' > '), e.id])
  )

  const initialAchievementKeywords: Record<string, string[]> = {}
  for (const row of (achKwData ?? [])) {
    ;(initialAchievementKeywords[row.position_achievement_id] ??= []).push(row.keyword_id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Position Achievements</h2>
      </div>
      <AchievementsClient
        userId={user.id}
        initialAchievements={(achievements ?? []) as Achievement[]}
        initialPositions={(positions ?? []) as Position[]}
        employers={employerNames}
        employerIdsByName={employerIdsByName}
        allKeywords={(keywordsData ?? []) as Keyword[]}
        initialAchievementKeywords={initialAchievementKeywords}
      />
    </div>
  )
}
