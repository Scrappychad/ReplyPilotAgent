import { useState, useEffect } from "react";

const G = {
  bg: "#06060a", surface: "#0f0f15", surface2: "#14141c",
  border: "#1c1c28", accent: "#34d399", accent2: "#10b981",
  text: "#e8e8f0", muted: "#4a4a6a", radius: 14,
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#1c1c28;border-radius:4px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
`;

function cleanText(t) {
  return t.replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

async function askGroq(messages, maxTokens = 3000) {
  const res = await fetch("/api/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  if (!text) throw new Error("Empty response");
  return cleanText(text);
}

function Spinner() {
  return <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${G.border}`, borderTopColor: G.accent, animation: "spin 0.8s linear infinite" }} />;
}

const baseInput = {
  width: "100%", background: G.surface2, border: `1px solid ${G.border}`,
  borderRadius: G.radius, padding: "10px 13px", color: G.text,
  fontFamily: "Outfit, sans-serif", fontSize: "0.87rem", outline: "none",
};

function TArea({ label, value, onChange, placeholder, rows = 4, hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: "0.67rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: G.muted, marginBottom: 5 }}>{label}</div>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ ...baseInput, resize: "vertical", lineHeight: 1.6, borderColor: f ? G.accent : G.border, transition: "border-color 0.2s" }}
        onFocus={() => setF(true)} onBlur={() => setF(false)} />
      {hint && <div style={{ fontSize: "0.65rem", color: G.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function TInput({ label, value, onChange, placeholder, hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: "0.67rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: G.muted, marginBottom: 5 }}>{label}</div>}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...baseInput, borderColor: f ? G.accent : G.border, transition: "border-color 0.2s" }}
        onFocus={() => setF(true)} onBlur={() => setF(false)} />
      {hint && <div style={{ fontSize: "0.65rem", color: G.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// ── APPROVAL LEARNING SYSTEM ──────────────────────────────────────────────────

function useApprovalSystem() {
  const [approvals, setApprovals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rp_approvals") || "[]"); } catch { return []; }
  });

  const addApproval = (entry) => {
    const updated = [{ ...entry, approvedAt: new Date().toISOString() }, ...approvals].slice(0, 100);
    setApprovals(updated);
    try { localStorage.setItem("rp_approvals", JSON.stringify(updated)); } catch {}
  };

  const getStyleInsights = () => {
    if (approvals.length < 3) return null;
    const styleCounts = {};
    approvals.forEach(a => {
      const s = a.style || "Unknown";
      styleCounts[s] = (styleCounts[s] || 0) + 1;
    });
    const sorted = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
    const topStyles = sorted.slice(0, 3).map(([s]) => s);
    const avgConf = Math.round(approvals.reduce((acc, a) => acc + (a.confidence || 70), 0) / approvals.length);
    return { topStyles, avgConf, total: approvals.length };
  };

  return { approvals, addApproval, getStyleInsights };
}

// ── SENT LOG ──────────────────────────────────────────────────────────────────

function useSentLog() {
  const [log, setLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rp_sent_log") || "[]"); } catch { return []; }
  });

  const addEntry = (entry) => {
    const updated = [{ ...entry, sentAt: new Date().toISOString() }, ...log];
    setLog(updated);
    try { localStorage.setItem("rp_sent_log", JSON.stringify(updated)); } catch {}
  };

  const exportCSV = () => {
    const headers = ["Sent At", "Author", "Original Tweet", "Reply Used", "Style", "Confidence"];
    const rows = log.map(e => [
      new Date(e.sentAt).toLocaleString(),
      `"${(e.author || "").replace(/"/g, "'")}"`,
      `"${(e.tweet || "").replace(/"/g, "'")}"`,
      `"${(e.reply || "").replace(/"/g, "'")}"`,
      e.style || "",
      e.confidence || "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reply-log-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return { log, addEntry, exportCSV };
}

// ── PROMPTS ───────────────────────────────────────────────────────────────────

function buildStyleContext(insights) {
  if (!insights) return "";
  return `\n\nLEARNED STYLE PREFERENCES (based on ${insights.total} approved replies):
- Fredrick most approves replies in these styles: ${insights.topStyles.join(", ")}
- Average confidence of approved replies: ${insights.avgConf}/100
- Lean into these styles first, but still offer variety.`;
}

function buildRepliesPrompt(tweet, author, context, tone, insights) {
  const styleContext = buildStyleContext(insights);
  const isNaija = context && /naija|nigeria|nigerian|lagos|abuja|9ja|oga|shey|wahala|japa|sapa|gbas gbos/i.test(context + " " + tweet + " " + (author || ""));

  return `You are an AI trained to write in the voice of Lord Fredrick - a globally reputed Web3 strategist, brand authority, and sharp thinker known as @scrappychad on X.

VOICE & IDENTITY:
- Lord Fredrick is conversational but authoritative. He sounds like the smartest person in the room who doesn't need to prove it.
- He teaches through reframing. He flips familiar ideas so readers see them differently.
- He is occasionally philosophical, connecting business ideas to bigger human truths.
- He uses everyday logic and real-world analogies - never jargon for the sake of it.
- He is witty, occasionally blunt, and always direct. No corporate speak.
- He is confident but never arrogant. He challenges ideas, not people.
- He never uses em dashes. He uses commas, colons, or new sentences.
- His replies feel like they were written by someone who actually thought about the tweet, not a bot.
- He is expressive. He does not limit himself artificially. A reply can be one line or several - whatever the idea demands.
${isNaija ? "- This tweet has a Nigerian/Naija context. Fredrick can bring in occasional Naija flavor, expressions, or cultural references where it feels natural and sharp. Not forced. Not every line. Just where it adds flavor." : "- This is not a Naija-context tweet. Do NOT use Nigerian slang or expressions."}
${styleContext}

RULES:
1. Generate exactly 3 reply options.
2. Each reply must add something: a new angle, a reframe, a sharp critique, a witty observation, a contrarian take, a thought-provoking question, or a punchy insight.
3. Avoid generic phrases like "Great post", "Agreed", "This is so true", "Absolutely".
4. Never start a reply with "I".
5. No hashtags. No emojis unless they fit naturally and sharply.
6. Each reply should feel like it could spark a discussion or make the author want to respond.
7. Be expressive. Let the idea breathe. Do not cut a reply short if it has more to say.
8. Every reply gets a confidence score (0-100) based on how well it fits Fredrick's voice and the tweet context.
9. HARD CHARACTER LIMIT: Every reply MUST be 280 characters or under. This is non-negotiable - X will reject anything over 280. Count carefully before outputting. If a draft exceeds 280, trim it down without losing the sharpness.

TARGET TWEET:
Author: ${author || "Unknown"}
Tweet: ${tweet}
${context ? "Context / Thread: " + context : ""}
${tone ? "Desired Tone: " + tone : ""}

OUTPUT FORMAT - follow exactly:

REPLY 1
Style: [e.g. Contrarian / Insight / Witty / Reframe / Sharp Question / Philosophical / Analytical / Humorous]
Confidence: [0-100]
---
[reply text - max 280 characters. Be expressive but tight. Every word must earn its place.]

REPLY 2
Style: [style]
Confidence: [0-100]
---
[reply text]

REPLY 3
Style: [style]
Confidence: [0-100]
---
[reply text]`;
}

function buildScanPrompt(tweets, niche, insights) {
  const styleContext = buildStyleContext(insights);
  return `You are a growth operator helping Lord Fredrick (@scrappychad) identify the best reply opportunities from a batch of tweets.

WHAT MAKES A GOOD REPLY OPPORTUNITY:
- The tweet has a clear point of view Fredrick can add to, challenge, or reframe
- Replying would be visible to the right audience: Web3, growth, startups, thought leadership
- The tweet invites engagement: question, controversial claim, insight gap, story, bold take
- The author has influence or is growing in the right niche
${styleContext}

NICHE CONTEXT: ${niche || "Web3, growth strategy, brand building, startups, thought leadership"}

TWEETS TO ANALYZE:
${tweets}

Return a JSON array of the best opportunities only. Skip weak or generic tweets. No markdown, just JSON:
[
  {
    "tweet_preview": "First 100 chars of the tweet",
    "author": "@handle",
    "opportunity_score": 8,
    "why_reply": "Specific reason this is a good opportunity for Fredrick",
    "angle": "The specific angle or approach Fredrick should take",
    "naija_context": false
  }
]`;
}

function buildAccountPrompt(handle, niche) {
  return `You are a growth operator helping Lord Fredrick (@scrappychad) find high-value X accounts to engage with.

CRITERIA:
- High follower count with genuine engagement
- Niche Web3, growth, brand, or startup thought leadership accounts
- Their content invites smart replies - bold takes, questions, insights, debates
- Engaging would give Fredrick visibility with the right audience

NICHE: ${niche || "Web3, growth strategy, brand building, startups, thought leadership"}
HANDLE TO ANALYZE: ${handle || "Not provided - suggest based on niche"}

Return JSON only, no markdown:
[
  {
    "handle": "@handle",
    "name": "Display Name",
    "niche": "What they post about",
    "why_engage": "Why Fredrick should engage with them specifically",
    "engagement_tip": "What angle or style works best on their content",
    "score": 8
  }
]`;
}

// ── PARSERS ───────────────────────────────────────────────────────────────────

function parseReplies(raw) {
  const replies = [];
  const blocks = raw.split(/REPLY \d+/i).slice(1);
  for (const block of blocks) {
    const styleMatch = block.match(/Style:\s*(.+)/i);
    const confMatch = block.match(/Confidence:\s*(\d+)/i);
    const divider = block.indexOf("---");
    const text = divider !== -1 ? block.slice(divider + 3).trim() : block.replace(/Style:.+/i, "").replace(/Confidence:.+/i, "").trim();
    const style = styleMatch ? styleMatch[1].trim() : "Reply";
    const confidence = confMatch ? parseInt(confMatch[1]) : 70;
    if (text.length > 5) replies.push({ style, confidence, text });
  }
  return replies.length > 0 ? replies : null;
}

function parseJSON(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    return JSON.parse(clean.slice(start, end + 1));
  } catch { return null; }
}

// ── CONFIDENCE BADGE ──────────────────────────────────────────────────────────

function ConfBadge({ score }) {
  const color = score >= 85 ? "#22c55e" : score >= 70 ? G.accent : score >= 55 ? "#f97316" : "#ef4444";
  const label = score >= 85 ? "High fit" : score >= 70 ? "Good fit" : score >= 55 ? "Moderate" : "Low fit";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color, fontFamily: "JetBrains Mono, monospace" }}>{score}</div>
      <div style={{ fontSize: "0.62rem", color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

// ── REPLY CARD ────────────────────────────────────────────────────────────────

function ReplyCard({ reply, tweet, author, onApprove, onSent, index }) {
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const [sent, setSent] = useState(false);

  const copy = () => { navigator.clipboard.writeText(reply.text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const approve = () => {
    onApprove({ tweet, author, reply: reply.text, style: reply.style, confidence: reply.confidence });
    setApproved(true);
  };

  const markSent = () => {
    onSent({ tweet, author, reply: reply.text, style: reply.style, confidence: reply.confidence });
    setSent(true);
    if (!approved) approve();
  };

  const borderColor = sent ? G.accent + "88" : approved ? G.accent + "44" : G.border;

  return (
    <div style={{ background: G.surface2, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "16px 18px", marginBottom: 12, animation: `fadeUp 0.3s ease ${index * 0.08}s both`, transition: "border-color 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12 }}>
        <div>
          <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: G.accent, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", display: "block", marginBottom: 4 }}>{reply.style}</span>
          {approved && <span style={{ fontSize: "0.58rem", color: G.accent, background: G.accent + "15", padding: "2px 7px", borderRadius: 20 }}>Approved</span>}
          {sent && <span style={{ fontSize: "0.58rem", color: "#22c55e", background: "#22c55e15", padding: "2px 7px", borderRadius: 20, marginLeft: 4 }}>Logged</span>}
        </div>
        <ConfBadge score={reply.confidence} />
      </div>
      <div style={{ fontSize: "0.91rem", lineHeight: 1.8, color: "#ddddf0", fontFamily: "Outfit, sans-serif", marginBottom: 14 }}>{reply.text}</div>
      <div style={{ fontSize: "0.62rem", fontFamily: "JetBrains Mono, monospace", color: reply.text.length > 280 ? "#ef4444" : reply.text.length > 240 ? "#f97316" : G.muted, marginBottom: 10 }}>
        {reply.text.length}/280 chars {reply.text.length > 280 ? "- OVER LIMIT, trim before posting" : ""}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${G.border}`, background: "transparent", color: copied ? "#22c55e" : G.muted, fontFamily: "Outfit, sans-serif", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>
          {copied ? "Copied" : "Copy"}
        </button>
        {!approved && (
          <button onClick={approve} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${G.accent}44`, background: `${G.accent}10`, color: G.accent, fontFamily: "Outfit, sans-serif", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>
            Approve Style
          </button>
        )}
        <button onClick={markSent} disabled={sent} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sent ? "#22c55e44" : "#22c55e"}`, background: sent ? "#22c55e15" : "transparent", color: sent ? "#22c55e" : "#22c55e", fontFamily: "Outfit, sans-serif", fontSize: "0.68rem", fontWeight: 600, cursor: sent ? "default" : "pointer" }}>
          {sent ? "Sent + Logged" : "Mark as Sent"}
        </button>
      </div>
    </div>
  );
}

// ── MODE: REPLY ───────────────────────────────────────────────────────────────

function ReplyMode({ approvalSystem, sentLog }) {
  const [tweet, setTweet] = useState("");
  const [author, setAuthor] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("");
  const [replies, setReplies] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const insights = approvalSystem.getStyleInsights();

  const generate = async () => {
    if (!tweet.trim()) { setError("Paste a tweet first."); return; }
    setError(""); setLoading(true);
    try {
      const raw = await askGroq([{ role: "user", content: buildRepliesPrompt(tweet, author, context, tone, insights) }], 3000);
      const parsed = parseReplies(raw);
      if (!parsed) throw new Error("Could not parse replies. Try again.");
      setReplies(parsed);
    } catch (err) { setError("Failed: " + err.message); }
    setLoading(false);
  };

  const reset = () => { setReplies(null); setTweet(""); setAuthor(""); setContext(""); setTone(""); setError(""); };

  return (
    <div>
      {insights && (
        <div style={{ background: `${G.accent}0a`, border: `1px solid ${G.accent}22`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: "0.72rem", color: G.muted, lineHeight: 1.6 }}>
          <span style={{ color: G.accent }}>◈ Learning active</span> - {insights.total} approvals logged. Top styles: {insights.topStyles.join(", ")}. Avg confidence: {insights.avgConf}/100.
        </div>
      )}

      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "20px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 16, fontWeight: 600 }}>Tweet to Reply To</div>
        <TArea label="Tweet *" value={tweet} onChange={setTweet} rows={4} placeholder="Paste the tweet you want to reply to..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <TInput label="Author Handle" value={author} onChange={setAuthor} placeholder="@handle" />
          <TInput label="Desired Tone (optional)" value={tone} onChange={setTone} placeholder="e.g. witty, analytical, blunt" />
        </div>
        <TArea label="Context / Thread (optional)" value={context} onChange={setContext} rows={2}
          placeholder="Add thread context or notes. Mention 'Naija' or Nigerian references if the tweet has that context."
          hint="Naija flavor only activates when the tweet or context has Nigerian references" />
      </div>

      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.8rem", color: "#ff8888" }}>{error}</div>}

      {replies ? (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", color: G.muted }}>{replies.length} replies generated - approve styles to train ReplyPilot</div>
            <button onClick={reset} style={{ padding: "6px 14px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>New Tweet</button>
          </div>
          <div style={{ background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: "0.82rem", color: G.muted, fontStyle: "italic", lineHeight: 1.6 }}>
            "{tweet.slice(0, 140)}{tweet.length > 140 ? "..." : ""}"
          </div>
          {replies.map((r, i) => (
            <ReplyCard key={i} index={i} reply={r} tweet={tweet} author={author}
              onApprove={approvalSystem.addApproval} onSent={sentLog.addEntry} />
          ))}
          <button onClick={generate} style={{ width: "100%", marginTop: 4, padding: "11px", borderRadius: G.radius, border: `1px dashed ${G.border}`, background: "transparent", color: G.accent, fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
            Regenerate Replies
          </button>
        </div>
      ) : (
        <button onClick={generate} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: G.radius, background: loading ? G.surface2 : G.accent, border: "none", color: loading ? G.muted : "#000", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <><Spinner /><span>Generating replies...</span></> : "Generate 3 Replies"}
        </button>
      )}
    </div>
  );
}

// ── MODE: SCAN ────────────────────────────────────────────────────────────────

function ScanMode({ approvalSystem, sentLog }) {
  const [tweets, setTweets] = useState("");
  const [niche, setNiche] = useState("");
  const [opportunities, setOpportunities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [replies, setReplies] = useState({});
  const [replyLoading, setReplyLoading] = useState(null);
  const insights = approvalSystem.getStyleInsights();

  const scan = async () => {
    if (!tweets.trim()) { setError("Paste some tweets first."); return; }
    setError(""); setLoading(true);
    try {
      const raw = await askGroq([{ role: "user", content: buildScanPrompt(tweets, niche, insights) }], 2000);
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Could not parse opportunities. Try again.");
      setOpportunities(parsed);
    } catch (err) { setError("Failed: " + err.message); }
    setLoading(false);
  };

  const generateRepliesFor = async (opp, idx) => {
    setReplyLoading(idx);
    try {
      const context = opp.naija_context ? "Naija context - Nigerian audience" : "";
      const raw = await askGroq([{ role: "user", content: buildRepliesPrompt(opp.tweet_preview, opp.author, opp.angle + " " + context, "", insights) }], 3000);
      const parsed = parseReplies(raw);
      if (parsed) setReplies(r => ({ ...r, [idx]: parsed }));
    } catch {}
    setReplyLoading(null);
  };

  const scoreColor = s => s >= 8 ? "#22c55e" : s >= 6 ? G.accent : G.muted;

  return (
    <div>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "20px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 16, fontWeight: 600 }}>Paste Tweets to Scan</div>
        <TArea label="Tweets *" value={tweets} onChange={setTweets} rows={8}
          placeholder={"Paste multiple tweets here:\n\n@handle: tweet text\n\n@handle: tweet text\n\nOr paste raw tweets one after another."}
          hint="Copy tweets from X and paste them here. AI surfaces the best opportunities." />
        <TInput label="Your Niche Context" value={niche} onChange={setNiche} placeholder="e.g. Web3, growth strategy, brand building, startups" />
      </div>

      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.8rem", color: "#ff8888" }}>{error}</div>}

      {opportunities ? (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", color: G.muted }}>{opportunities.length} opportunities found</div>
            <button onClick={() => { setOpportunities(null); setTweets(""); setReplies({}); }} style={{ padding: "6px 14px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>New Scan</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {opportunities.map((opp, i) => (
              <div key={i} style={{ background: G.surface, border: `1px solid ${expanded === i ? G.accent + "55" : G.border}`, borderRadius: G.radius, overflow: "hidden" }}>
                <div onClick={() => setExpanded(expanded === i ? null : i)} style={{ padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: G.accent }}>{opp.author}</span>
                        <span style={{ fontSize: "0.62rem", color: scoreColor(opp.opportunity_score), fontFamily: "JetBrains Mono, monospace" }}>{opp.opportunity_score}/10</span>
                        {opp.naija_context && <span style={{ fontSize: "0.58rem", color: "#f97316", background: "#f9731615", padding: "1px 6px", borderRadius: 20 }}>Naija</span>}
                      </div>
                      <div style={{ fontSize: "0.83rem", color: "#ccc", lineHeight: 1.6, marginBottom: 6 }}>"{opp.tweet_preview}"</div>
                      <div style={{ fontSize: "0.71rem", color: G.muted }}><span style={{ color: G.accent }}>Why: </span>{opp.why_reply}</div>
                      <div style={{ fontSize: "0.71rem", color: G.muted, marginTop: 3 }}><span style={{ color: G.accent }}>Angle: </span>{opp.angle}</div>
                    </div>
                    <span style={{ color: G.muted, fontSize: "0.75rem", flexShrink: 0, display: "inline-block", transition: "transform 0.2s", transform: expanded === i ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                  </div>
                </div>
                {expanded === i && (
                  <div style={{ borderTop: `1px solid ${G.border}`, padding: "14px 16px", animation: "fadeIn 0.2s ease" }}>
                    {replies[i] ? (
                      replies[i].map((r, j) => <ReplyCard key={j} index={j} reply={r} tweet={opp.tweet_preview} author={opp.author} onApprove={approvalSystem.addApproval} onSent={sentLog.addEntry} />)
                    ) : (
                      <button onClick={() => generateRepliesFor(opp, i)} disabled={replyLoading === i}
                        style={{ width: "100%", padding: "10px", borderRadius: 10, background: replyLoading === i ? G.surface2 : `${G.accent}12`, border: `1px solid ${G.accent}44`, color: G.accent, fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: replyLoading === i ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {replyLoading === i ? <><Spinner /><span>Generating...</span></> : "Generate Replies for This"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={scan} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: G.radius, background: loading ? G.surface2 : G.accent, border: "none", color: loading ? G.muted : "#000", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <><Spinner /><span>Scanning...</span></> : "Scan for Opportunities"}
        </button>
      )}
    </div>
  );
}

// ── MODE: ACCOUNTS ────────────────────────────────────────────────────────────

function AccountsMode() {
  const [handle, setHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [accounts, setAccounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const find = async () => {
    setError(""); setLoading(true);
    try {
      const raw = await askGroq([{ role: "user", content: buildAccountPrompt(handle, niche) }], 2000);
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Could not parse accounts. Try again.");
      setAccounts(parsed);
    } catch (err) { setError("Failed: " + err.message); }
    setLoading(false);
  };

  const scoreColor = s => s >= 8 ? "#22c55e" : s >= 6 ? G.accent : G.muted;

  return (
    <div>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "20px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 16, fontWeight: 600 }}>Find Accounts to Engage</div>
        <TInput label="X Handle to Analyze (optional)" value={handle} onChange={setHandle} placeholder="@handle" hint="Leave blank to get niche-based suggestions" />
        <TInput label="Niche / Context" value={niche} onChange={setNiche} placeholder="e.g. Web3 founders, growth strategists, DeFi builders" />
      </div>
      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.8rem", color: "#ff8888" }}>{error}</div>}
      {accounts ? (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", color: G.muted }}>{accounts.length} accounts found</div>
            <button onClick={() => setAccounts(null)} style={{ padding: "6px 14px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>New Search</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {accounts.map((acc, i) => (
              <div key={i} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{acc.name}</div>
                    <div style={{ fontSize: "0.72rem", color: G.accent }}>{acc.handle}</div>
                  </div>
                  <div style={{ fontSize: "0.62rem", color: scoreColor(acc.score), fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{acc.score}/10</div>
                </div>
                <div style={{ fontSize: "0.72rem", color: G.muted, marginBottom: 6 }}>{acc.niche}</div>
                <div style={{ fontSize: "0.75rem", color: "#ccc", lineHeight: 1.55, marginBottom: 8 }}><span style={{ color: G.accent, fontSize: "0.62rem", textTransform: "uppercase" }}>Why: </span>{acc.why_engage}</div>
                <div style={{ background: G.surface2, borderRadius: 8, padding: "8px 10px", fontSize: "0.72rem", color: G.muted, lineHeight: 1.5 }}><span style={{ color: G.accent, fontSize: "0.62rem", textTransform: "uppercase" }}>Tip: </span>{acc.engagement_tip}</div>
                <a href={"https://x.com/" + acc.handle.replace("@", "")} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: "0.65rem", color: G.accent, textDecoration: "none" }}>View on X ↗</a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={find} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: G.radius, background: loading ? G.surface2 : G.accent, border: "none", color: loading ? G.muted : "#000", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <><Spinner /><span>Finding accounts...</span></> : "Find Accounts"}
        </button>
      )}
    </div>
  );
}

// ── MODE: SENT LOG ────────────────────────────────────────────────────────────

function SentLogMode({ sentLog, approvalSystem }) {
  const { log, exportCSV } = sentLog;
  const insights = approvalSystem.getStyleInsights();

  return (
    <div>
      {insights && (
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "16px 20px", marginBottom: 14 }}>
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 12, fontWeight: 600 }}>Style Learning Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div style={{ background: G.surface2, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: G.accent }}>{insights.total}</div>
              <div style={{ fontSize: "0.65rem", color: G.muted, marginTop: 2 }}>Approvals logged</div>
            </div>
            <div style={{ background: G.surface2, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: G.accent }}>{insights.avgConf}</div>
              <div style={{ fontSize: "0.65rem", color: G.muted, marginTop: 2 }}>Avg confidence</div>
            </div>
            <div style={{ background: G.surface2, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: G.accent, lineHeight: 1.4 }}>{insights.topStyles[0] || "-"}</div>
              <div style={{ fontSize: "0.65rem", color: G.muted, marginTop: 2 }}>Top style</div>
            </div>
          </div>
          {insights.topStyles.length > 0 && (
            <div style={{ marginTop: 10, fontSize: "0.72rem", color: G.muted }}>
              Preferred styles: <span style={{ color: G.accent }}>{insights.topStyles.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {log.length === 0 ? (
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>◎</div>
          <div style={{ fontSize: "0.85rem", color: G.muted }}>No replies logged yet.</div>
          <div style={{ fontSize: "0.75rem", color: G.muted, marginTop: 6 }}>Mark replies as sent from the Reply or Scan modes.</div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", color: G.muted }}>{log.length} replies logged</div>
            <button onClick={exportCSV} style={{ padding: "7px 16px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Export CSV</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((entry, i) => (
              <div key={i} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.72rem", color: G.accent, fontWeight: 600 }}>{entry.author || "Unknown"}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {entry.confidence && <span style={{ fontSize: "0.6rem", color: G.muted, fontFamily: "JetBrains Mono, monospace" }}>{entry.confidence}/100</span>}
                    <span style={{ fontSize: "0.6rem", color: G.muted, fontFamily: "JetBrains Mono, monospace" }}>{new Date(entry.sentAt).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ fontSize: "0.74rem", color: G.muted, marginBottom: 8, fontStyle: "italic" }}>"{(entry.tweet || "").slice(0, 100)}{(entry.tweet || "").length > 100 ? "..." : ""}"</div>
                <div style={{ fontSize: "0.86rem", color: "#d0d0e8", lineHeight: 1.7, background: G.surface2, borderRadius: 8, padding: "10px 12px" }}>{entry.reply}</div>
                <div style={{ fontSize: "0.62rem", color: G.muted, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>Style: {entry.style}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function ReplyPilot() {
  const [mode, setMode] = useState("reply");
  const approvalSystem = useApprovalSystem();
  const sentLog = useSentLog();

  const MODES = [
    { id: "reply",    label: "Reply",    icon: "◎" },
    { id: "scan",     label: "Scan",     icon: "◈" },
    { id: "accounts", label: "Accounts", icon: "◆" },
    { id: "log",      label: "Sent Log", icon: "▣" },
  ];

  const modeDesc = {
    reply: "Paste a tweet, get 3 replies in your voice with confidence scores",
    scan: "Paste tweets, surface the best reply opportunities",
    accounts: "Find high-value accounts worth engaging with",
    log: "Track sent replies and view your style learning summary",
  };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Outfit, sans-serif", padding: "22px 18px 40px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-0.03em" }}>Reply<span style={{ color: G.accent }}>Pilot</span></div>
            <div style={{ fontSize: "0.75rem", color: G.muted, marginTop: 3 }}>{modeDesc[mode]}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.65rem", color: G.muted, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: G.accent, animation: "pulse 2s infinite" }} />
            Live
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 50, padding: 4 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 50, border: "none",
              background: mode === m.id ? G.accent : "transparent",
              color: mode === m.id ? "#000" : G.muted,
              fontFamily: "Outfit, sans-serif", fontWeight: mode === m.id ? 700 : 500,
              fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              <span style={{ fontSize: "0.7rem" }}>{m.icon}</span>{m.label}
              {m.id === "log" && sentLog.log.length > 0 && (
                <span style={{ background: mode === m.id ? "#00000033" : G.accent, color: "#000", borderRadius: 20, fontSize: "0.6rem", padding: "1px 6px", fontWeight: 700 }}>{sentLog.log.length}</span>
              )}
            </button>
          ))}
        </div>

        <div key={mode} style={{ animation: "fadeUp 0.25s ease" }}>
          {mode === "reply"    && <ReplyMode approvalSystem={approvalSystem} sentLog={sentLog} />}
          {mode === "scan"     && <ScanMode approvalSystem={approvalSystem} sentLog={sentLog} />}
          {mode === "accounts" && <AccountsMode />}
          {mode === "log"      && <SentLogMode sentLog={sentLog} approvalSystem={approvalSystem} />}
        </div>
      </div>
    </div>
  );
}