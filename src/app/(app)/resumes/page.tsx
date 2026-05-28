import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ResumesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Resumes</h2>
        <Link href="/resumes/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Resume
        </Link>
      </div>

      {!resumes?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500">No resumes yet. Create your first resume to get started.</p>
          <Link href="/resumes/new" className="mt-4 inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Create resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {resumes.map(r => (
            <Link key={r.id} href={`/resumes/${r.id}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between">
                <p className="font-medium">{r.title}</p>
                {r.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Default</span>}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Updated {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
