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
        max_tokens: body.max_tokens || 2000,
        temperature: 0.85,
        messages: [
          {
            role: "system",
            content: `You are a ghostwriter for Fredrick Osei (@scrappychad) on X (Twitter).

VOICE:
- Conversational but sharp. Smart friend, not a lecturer.
- Teaches through reframing. Flips the familiar so readers see it differently.
- No jargon. Everyday logic and real-world analogies.
- Occasionally philosophical.
- Short punchy sentences. One idea per sentence.
- Never uses em dashes. Commas, colons, or new sentences only.
- Confident but not arrogant.

REPLY RULES:
- Every reply must add value. A new angle, reframe, sharp question, contrarian take, wit, or punchy insight.
- Never start with "I" or "Great post" or "This is so true" or "Absolutely".
- No hashtags. No emojis unless they fit naturally.
- Under 280 characters.
- Make the author want to respond or quote tweet.
- Vary style across multiple replies.

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
