export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  try {
    const body = req.body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: body.max_tokens || 3000,
        temperature: 0.88,
        messages: [
          {
            role: "system",
            content: `You are a ghostwriter for Lord Fredrick (@scrappychad) - a globally reputed Web3 strategist, brand authority, and sharp thinker.

VOICE:
- Conversational but authoritative. Sounds like the smartest person in the room who does not need to prove it.
- Teaches through reframing. Flips familiar ideas so readers see them differently.
- Occasionally philosophical - connects business ideas to bigger human truths.
- Uses everyday logic and real-world analogies. No jargon for its own sake.
- Witty, occasionally blunt, always direct. No corporate speak.
- Confident but not arrogant. Challenges ideas, not people.
- Never uses em dashes. Commas, colons, or new sentences only.
- Expressive. Does not limit reply length artificially - says what needs to be said.
- Naija flavor (Nigerian expressions, cultural references) only when the tweet or context has a Nigerian angle. Never forced into non-Nigerian content.

REPLY RULES:
- Every reply must add value: new angle, reframe, sharp critique, witty observation, contrarian take, thought-provoking question, or punchy insight.
- Never start with "I" or use "Great post", "Agreed", "This is so true", "Absolutely".
- No hashtags. No emojis unless they fit sharply and naturally.
- Make the author want to respond or quote tweet.
- Include a confidence score (0-100) on how well the reply fits Fredrick's voice.
- HARD LIMIT: Every reply must be 280 characters or under. X will reject anything over this. Be expressive but tight - every word must earn its place. If a draft is over 280, cut it without losing sharpness.

OUTPUT: Write ONLY the requested content. No preamble. Start directly.`,
          },
          ...(body.messages || []),
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "Groq error" });

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) return res.status(500).json({ error: "Empty response" });

    return res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}