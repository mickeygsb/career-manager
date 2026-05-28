import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Contacts</h2>
        <Link href="/contacts/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Contact
        </Link>
      </div>

      {!contacts?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">No contacts yet. Track the people in your network!</p>
          <Link href="/contacts/new" className="mt-4 inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Add a contact
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {c.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">
                  {[c.title, c.company].filter(Boolean).join(' @ ')}
                </p>
              </div>
              {c.email && <a href={`mailto:${c.email}`} className="text-sm text-blue-600 hover:underline">{c.email}</a>}
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-blue-600">LinkedIn</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
