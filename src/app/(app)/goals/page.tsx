import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddGoalForm from './AddGoalForm'

const GOAL_STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  abandoned: 'bg-red-100 text-red-700',
}

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-gray-500">Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.</p>

  const { data: goals } = await supabase
    .from('career_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Career Goals</h2>

      <AddGoalForm userId={user.id} />

      {!goals?.length ? (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-500">No goals yet. Set your first career goal above.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{goal.title}</p>
                  {goal.description && <p className="text-sm text-gray-500 mt-1">{goal.description}</p>}
                  {goal.target_date && (
                    <p className="text-xs text-gray-400 mt-2">
                      Target: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${GOAL_STATUS_COLORS[goal.status]}`}>
                  {goal.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
