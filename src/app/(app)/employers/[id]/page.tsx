import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { EmployerSize } from '@/lib/types'

const SIZE_LABELS: Record<EmployerSize, string> = {
  '1-10': '1 - 10',
  '10-100': '10 - 100',
  '100-1000': '100 - 1000',
  '1000-10000': '1000 - 10000',
  '10000+': '10000+',
}

export default async function EmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: employer } = await supabase.from('employers').select('*').eq('id', id).eq('user_id', user.id).single()

  if (!employer) notFound()

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/employers" className="text-sm text-gray-400 hover:text-gray-600">← Employers</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-blue-900">{employer.name}</h2>
              {employer.is_target && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Target</span>
              )}
            </div>
            <p className="text-gray-500 mt-1">{[employer.industry, employer.location].filter(Boolean).join(' · ')}</p>
          </div>
          {employer.website && (
            <a href={employer.website} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline">
              Visit website ↗
            </a>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4">
          {employer.size && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Size</dt>
              <dd className="mt-1 text-sm">{SIZE_LABELS[employer.size as EmployerSize]}</dd>
            </div>
          )}
          {employer.industry && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</dt>
              <dd className="mt-1 text-sm">{employer.industry}</dd>
            </div>
          )}
          {employer.location && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</dt>
              <dd className="mt-1 text-sm">{employer.location}</dd>
            </div>
          )}
        </dl>

        {employer.notes && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{employer.notes}</p>
          </div>
        )}
      </div>

    </div>
  )
}
