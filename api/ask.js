export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing question' });
  }

  const systemPrompt = `You are Tombot, a warm, patient voice helper for young special-needs primary pupils (roughly ages 4-8, many non-readers) in a UK classroom on Guernsey. A child has just asked a question aloud. Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"spoken": "short answer to read aloud, max about 15 words, plain UK English, warm and encouraging tone", "emoji": "one single emoji representing the answer", "letters": []}

Rules:
- If the child asks how to spell a word, put each letter of that word as separate uppercase strings in "letters" in order (e.g. ["B","I","K","E"]), and make "spoken" something like "Let's spell it: B, I, K, E. Bike!"
- If not a spelling question, leave "letters" as an empty array.
- If asked for a sentence starter, give exactly one short simple example.
- If the question is unclear or you can't make it out, gently ask them in "spoken" to try again - never sound harsh or confused.
- Keep "spoken" short. It will be read aloud by text-to-speech to a young child with a short attention span.
- Never include anything except the JSON object.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();
    const clean = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Tombot ask.js error:', err);
    return res.status(500).json({ error: 'Failed to get an answer' });
  }
}
