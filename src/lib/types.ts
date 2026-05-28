export type ApplicationStatus = 'wishlist' | 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
export type RemoteType = 'remote' | 'hybrid' | 'onsite'
export type InterviewType = 'phone' | 'technical' | 'behavioral' | 'system_design' | 'onsite' | 'other'
export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned'

export interface JobApplication {
  id: string
  user_id: string
  company: string
  role: string
  status: ApplicationStatus
  url?: string
  salary_min?: number
  salary_max?: number
  location?: string
  remote_type?: RemoteType
  notes?: string
  applied_at?: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  name: string
  title?: string
  company?: string
  email?: string
  linkedin_url?: string
  notes?: string
  created_at: string
}

export interface Interview {
  id: string
  application_id: string
  type: InterviewType
  scheduled_at?: string
  notes?: string
  outcome?: string
  created_at: string
}

export interface Resume {
  id: string
  user_id: string
  title: string
  content: Record<string, unknown>
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Skill {
  id: string
  user_id: string
  name: string
  category?: string
  proficiency?: SkillProficiency
  years_experience?: number
  created_at: string
}

export interface CareerGoal {
  id: string
  user_id: string
  title: string
  description?: string
  target_date?: string
  status: GoalStatus
  created_at: string
  updated_at: string
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  wishlist: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-700',
  phone_screen: 'bg-yellow-100 text-yellow-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-orange-100 text-orange-700',
}
