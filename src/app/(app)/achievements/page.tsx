import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Achievement, Position } from '@/lib/types'
import HighlightsClient from './HighlightsClient'

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>
  }

  const [{ data: highlights }, { data: positions }, { data: employers }] = await Promise.all([
    supabase.from('position_highlights').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('positions').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
    supabase.from('employers').select('name, business_unit').eq('user_id', user.id).order('name'),
  ])

  const employerNames = (employers ?? [])
    .map(e => [e.name, e.business_unit].filter(Boolean).join(' > '))
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Positions</h2>
      </div>
      <HighlightsClient
        userId={user.id}
        initialHighlights={(highlights ?? []) as Achievement[]}
        initialPositions={(positions ?? []) as Position[]}
        employers={employerNames}
      />
    </div>
  )
}
