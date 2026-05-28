import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddSkillForm from './AddSkillForm'

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-600',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
  expert: 'bg-green-100 text-green-700',
}

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: skills } = await supabase
    .from('skills')
    .select('*')
    .eq('user_id', user.id)
    .order('category', { ascending: true })

  const byCategory = (skills ?? []).reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(s)
    return acc
  }, {})

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Skills</h2>
      </div>

      <AddSkillForm userId={user.id} />

      {Object.keys(byCategory).length === 0 ? (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-gray-500">No skills tracked yet. Add your first skill above.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(byCategory).map(([category, catSkills]) => (
            <div key={category} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category}</h3>
              <div className="flex flex-wrap gap-2">
                {catSkills!.map(skill => (
                  <div key={skill.id} className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium">{skill.name}</span>
                    {skill.proficiency && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROFICIENCY_COLORS[skill.proficiency] ?? ''}`}>
                        {skill.proficiency}
                      </span>
                    )}
                    {skill.years_experience && (
                      <span className="text-xs text-gray-400">{skill.years_experience}y</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
