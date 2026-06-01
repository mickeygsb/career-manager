import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Keyword } from '@/lib/types'
import KeywordsClient from './KeywordsClient'

export default async function KeywordsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>
  }

  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', user.id)
    .order('index', { ascending: true })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Keywords</h2>
      </div>
      <KeywordsClient
        userId={user.id}
        initialKeywords={(keywords ?? []) as Keyword[]}
      />
    </div>
  )
}
