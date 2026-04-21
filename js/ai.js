const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-5';

async function callClaude(apiKey, system, user, maxTokens = 800) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-api-key':      apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status}: ${e?.error?.message || res.statusText}`);
  }
  return (await res.json()).content?.[0]?.text || '';
}

window.AI = {
  async scoreJob(job, profile, apiKey) {
    const system = `You are a recruitment fit scorer. Return ONLY valid JSON (no markdown):
{"score":0-100,"matches":["up to 5 short strings"],"gaps":["up to 3 short strings"],"summary":"1 sentence"}
Score = % probability candidate gets shortlisted based on overlap.`;
    const user = `CANDIDATE:\n${profile}\n\nJOB: ${job.title} at ${job.company} (${job.location})\nTYPE: ${job.type} | LEVEL: ${job.seniority}\nDESC:\n${job.description}`;
    const raw = await callClaude(apiKey, system, user, 400);
    try {
      return JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return { score: 50, matches: ['Score parse error'], gaps: [], summary: raw.slice(0,120) };
    }
  },

  async generateCoverLetter(job, profile, name, tone, apiKey) {
    const tones = {
      professional: 'formal and professional',
      friendly:     'warm, personable and enthusiastic',
      concise:      'brief, punchy and direct (under 300 words)',
      executive:    'executive-level, strategic and authoritative',
    };
    const system = `You are an expert cover letter writer. Tone: ${tones[tone]||'professional'}.
Output ONLY the cover letter text — no subject line, no commentary, no markdown.`;
    const user = `Write a tailored cover letter for:
CANDIDATE: ${name||'the applicant'}
PROFILE: ${profile}
JOB: ${job.title} at ${job.company} (${job.location})
TYPE: ${job.type}
DESCRIPTION:\n${job.description.slice(0,2000)}
Be specific to this role. Highlight relevant experience. End with a confident call to action.`;
    return callClaude(apiKey, system, user, 900);
  },
};
