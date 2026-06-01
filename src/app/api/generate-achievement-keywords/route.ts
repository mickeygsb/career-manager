import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

type Achievement = { id: string; description: string }

export async function POST(request: Request) {
  const { achievements, keywords }: { achievements: Achievement[]; keywords: string[] } = await request.json()

  if (!achievements?.length || !keywords?.length) {
    return NextResponse.json({ error: 'Missing achievements or keywords' }, { status: 400 })
  }

  const client = new Anthropic()

  const prompt = `Select exactly 3 keywords from the provided list for each achievement. Choose keywords that best match the themes, skills, and impact described.

Available keywords:
${keywords.join(', ')}

Achievements:
${achievements.map(a => `ID: ${a.id}\n${a.description}`).join('\n\n')}

Respond with only a JSON object mapping each achievement ID to a comma-separated string of exactly 3 keywords chosen from the list above. No explanation.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse Claude response' }, { status: 500 })
  }

  return NextResponse.json(JSON.parse(jsonMatch[0]))
}
