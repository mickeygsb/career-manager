import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { CareerHighlight } from '@/lib/types'
import CareerHighlightsClient from './CareerHighlightsClient'

export default async function CareerHighlightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>
  }

  const { data: highlights } = await supabase
    .from('career_highlights')
    .select('*')
    .eq('user_id', user.id)
    .order('index', { ascending: true })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Career Highlights</h2>
      </div>
      <CareerHighlightsClient
        userId={user.id}
        initialHighlights={(highlights ?? []) as CareerHighlight[]}
      />
    </div>
  )
}
