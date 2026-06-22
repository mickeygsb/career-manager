export type EmployerSize = '1-10' | '10-100' | '100-1000' | '1000-10000' | '10000+'

export type JobStatus = 'draft' | 'open' | 'closed'

export const JOB_STATUS_DETAIL_OPTIONS: Partial<Record<JobStatus, string[]>> = {
  draft: ['Assess', 'Apply'],
  open: ['Applied', 'Interviewing'],
  closed: ["Didn't Apply", 'Withdrawn', 'Rejected Without Reply', 'Rejected Without Interview', 'Rejected After Interview', 'Accepted'],
}

export interface Job {
  id: string
  user_id: string
  employer_id?: string
  position: string
  date_opened?: string
  date_applied?: string
  date_closed?: string
  status: JobStatus
  status_detail?: string
  job_description?: string
  linkedin_url?: string
  career_site_url?: string
  career_site_id?: string
  next_step?: string
  notes?: string
  location?: string
  industry?: string
  role?: string
  domain?: string
  specialty?: string
  active: boolean
  favorite: boolean
  created_at: string
  updated_at: string
  employers?: { name: string; subsidiary?: string; industry?: string; industry_segment?: string }
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

export interface Resume {
  id: string
  user_id: string
  title: string
  type?: 'Template' | 'Job'
  job_id?: string
  industry?: string
  headline?: string
  role?: string
  specialty?: string
  domain?: string
  effective_date?: string
  career_highlights_intro?: string
  content: Record<string, unknown>
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Employer {
  id: string
  user_id: string
  name: string
  subsidiary?: string
  aka?: string
  website?: string
  industry?: string
  industry_segment?: string
  fudge_factor?: number
  size?: EmployerSize
  location?: string
  address?: string
  linkedin_company_codes?: string
  career_site_url?: string
  status?: string
  notes?: string
  employer_intro?: string
  is_target: boolean
  growing_company: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface Achievement {
  id: string
  user_id: string
  position_id: string
  index?: number
  includes_metrics: boolean
  keywords?: string
  description: string
  description_alt1?: string
  description_alt2?: string
  created_at: string
  updated_at: string
}

export interface CareerHighlight {
  id: string
  user_id: string
  title: string
  description: string
  keywords?: string
  includes_metrics: boolean
  index?: number
  created_at: string
  updated_at: string
}

export interface CareerHighlightKeyword {
  id: string
  career_highlight_id: string
  keyword_id: string
  user_id: string
  created_at: string
}

export interface AchievementKeyword {
  id: string
  position_achievement_id: string
  keyword_id: string
  user_id: string
  created_at: string
}

export interface Keyword {
  id: string
  user_id: string
  category: string
  category_detail?: string
  index?: number
  keyword: string
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  user_id: string
  employer: string
  title: string
  start_date: string
  end_date?: string
  resume_intro?: string
  linkedin_summary?: string
  created_at: string
  updated_at: string
}

