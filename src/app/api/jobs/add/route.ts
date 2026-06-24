import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

interface AddJobRequest {
  position: string
  company_name: string
  location?: string
  linkedin_url?: string | null
  career_site_url?: string | null
  career_site_id?: string | null
  job_description?: string
  notes?: string
  date_opened?: string | null  // ISO date (YYYY-MM-DD); falls back to today if omitted
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  const body: AddJobRequest = await request.json()
  const { position, company_name, location, linkedin_url, career_site_url, career_site_id, job_description, notes } = body

  if (!position || !company_name) {
    return NextResponse.json({ error: 'position and company_name are required' }, { status: 400, headers: CORS })
  }
  if (!linkedin_url && !career_site_url) {
    return NextResponse.json({ error: 'linkedin_url or career_site_url is required for dedup' }, { status: 400, headers: CORS })
  }

  // Dedup: check linkedin_url if present, otherwise career_site_url
  let existing = null
  if (linkedin_url) {
    const { data } = await supabase
      .from('jobs')
      .select('id, position')
      .eq('linkedin_url', linkedin_url)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    existing = data
  } else if (career_site_url) {
    const { data } = await supabase
      .from('jobs')
      .select('id, position')
      .eq('career_site_url', career_site_url)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    existing = data
  }

  if (existing) {
    return NextResponse.json({ duplicate: true, existing }, { status: 409, headers: CORS })
  }

  // Look up employer
  let employer_id: string | null = null
  const { data: employers } = await supabase
    .from('employers')
    .select('id, name, subsidiary')
    .or(`name.ilike.*${company_name}*,subsidiary.ilike.*${company_name}*`)
    .eq('user_id', user.id)
    .limit(5)

  if (employers && employers.length > 0) {
    employer_id = employers[0].id
  } else {
    const { data: newEmployer, error: empError } = await supabase
      .from('employers')
      .insert({
        user_id: user.id,
        name: company_name,
        location: location ?? null,
        is_target: false,
        growing_company: false,
        active: true,
      })
      .select('id')
      .single()

    if (empError) {
      return NextResponse.json({ error: 'Failed to create employer', details: empError.message }, { status: 500, headers: CORS })
    }
    employer_id = newEmployer.id
  }

  // Insert job
  const today = new Date().toISOString().split('T')[0]
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
  const dateOpened = body.date_opened && isValidDate(body.date_opened) ? body.date_opened : today
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      employer_id,
      position,
      location: location ?? null,
      status: 'draft',
      status_detail: 'Assess',
      date_opened: dateOpened,
      linkedin_url: linkedin_url ?? null,
      career_site_url: career_site_url ?? null,
      career_site_id: career_site_id ?? null,
      job_description: job_description ?? null,
      notes: notes ?? null,
      active: true,
    })
    .select('id, position, employer_id')
    .single()

  if (jobError) {
    return NextResponse.json({ error: 'Failed to insert job', details: jobError.message }, { status: 500, headers: CORS })
  }

  const employerCreated = !employers || employers.length === 0
  return NextResponse.json({ job, employer_id, employer_created: employerCreated }, { status: 201, headers: CORS })
}
