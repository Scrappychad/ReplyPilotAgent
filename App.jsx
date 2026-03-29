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

const VOICE = `VOICE - FREDRICK OSEI (scrappychad):
- Conversational but sharp. Smart friend, not a lecturer.
- Teaches through reframing. Flips the familiar so the reader sees it differently.
- No jargon. Everyday logic and real-world analogies.
- Occasionally philosophical - connects ideas to bigger human truths.
- Short punchy sentences. One idea per sentence.
- Never uses em dashes. Commas, colons, or new sentences.
- Confident but not arrogant. Direct but not rude.
- Replies feel like they came from someone who actually thought about it, not a bot.`;

function cleanText(t) {
  return t.replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

async function askGroq(messages, maxTokens = 2000) {
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

// ── PROMPTS ───────────────────────────────────────────────────────────────────

function buildRepliesPrompt(tweet, author, context) {
  return `You are writing replies for Fredrick Osei (@scrappychad) on X (Twitter).

${VOICE}

REPLY RULES:
- Under 280 characters each.
- No hashtags. No emojis unless it fits naturally.
- Never start with "I" or "Great post" or "This is so true".
- Each reply must add something - a new angle, a reframe, a sharp question, a contrarian take, wit, or a punchy insight.
- Replies should make the original author want to respond or quote tweet.
- Never sycophantic. Never generic.
- Vary the style across the 3 replies.

TWEET TO REPLY TO:
Author: ${author || "Unknown"}
Tweet: ${tweet}
${context ? "Additional context: " + context : ""}

Write exactly 3 replies. Label them clearly:

REPLY 1 - [style: e.g. Insight / Contrarian / Witty / Question / Reframe / Agreement with twist]:
[reply text]

REPLY 2 - [style]:
[reply text]

REPLY 3 - [style]:
[reply text]`;
}

function buildAccountPrompt(handle, niche) {
  return `You are a growth operator helping Fredrick Osei (@scrappychad) identify high-value X accounts to engage with.

CRITERIA FOR HIGH-VALUE ACCOUNTS:
- High follower count with genuine engagement (comments, retweets, discussions)
- Niche Web3 or growth-focused accounts
- Post thought leadership content (not just news or promotions)
- Engaging with them would give Fredrick visibility with the right audience

NICHE / CONTEXT: ${niche || "Web3, growth strategy, brand building, startups, thought leadership"}
HANDLE TO ANALYZE (if provided): ${handle || "Not provided - suggest accounts based on niche"}

Return a JSON array of 8-10 accounts. No markdown, no explanation, just the JSON:
[
  {
    "handle": "@handle",
    "name": "Display Name",
    "niche": "What they post about",
    "why_engage": "Specific reason Fredrick should engage with them",
    "engagement_tip": "What kind of reply or angle would work best on their content",
    "score": 8
  }
]`;
}

function buildScanPrompt(tweets, niche) {
  return `You are a growth operator helping Fredrick Osei (@scrappychad) identify the best reply opportunities from a list of tweets.

WHAT MAKES A GOOD REPLY OPPORTUNITY:
- The tweet has a clear point of view Fredrick can add to, challenge, or reframe
- Replying would be visible to the right audience (Web3, growth, startups, thought leadership)
- The tweet invites engagement (question, controversial claim, insight gap, story)
- The author has influence in the niche

NICHE CONTEXT: ${niche || "Web3, growth strategy, brand building, startups"}

TWEETS TO ANALYZE:
${tweets}

Return a JSON array of the top opportunities only (skip weak ones). No markdown, just JSON:
[
  {
    "tweet_preview": "First 80 chars of the tweet...",
    "author": "@handle",
    "opportunity_score": 8,
    "why_reply": "Specific reason this is a good opportunity",
    "angle": "The angle Fredrick should take in his reply"
  }
]`;
}

// ── PARSERS ───────────────────────────────────────────────────────────────────

function parseReplies(raw) {
  const replies = [];
  const blocks = raw.split(/REPLY \d+/i).slice(1);
  for (const block of blocks) {
    const styleMatch = block.match(/-\s*\[?style[:\s]*([^\]:\n]+)\]?/i) || block.match(/-\s*([A-Za-z /]+):/);
    const style = styleMatch ? styleMatch[1].trim() : "Reply";
    const text = block.replace(/-\s*\[?style[:\s]*[^\]:\n]+\]?/i, "").replace(/-\s*[A-Za-z /]+:/i, "").trim();
    if (text.length > 5) replies.push({ style, text });
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

// ── SENT TRACKER ─────────────────────────────────────────────────────────────

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
    const headers = ["Sent At", "Author", "Original Tweet", "Reply Used", "Style"];
    const rows = log.map(e => [
      new Date(e.sentAt).toLocaleString(),
      e.author || "",
      `"${(e.tweet || "").replace(/"/g, "'")}"`,
      `"${(e.reply || "").replace(/"/g, "'")}"`,
      e.style || "",
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

// ── REPLY CARD ────────────────────────────────────────────────────────────────

function ReplyCard({ reply, tweet, author, onSent }) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(reply.text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const markSent = () => {
    onSent({ tweet, author, reply: reply.text, style: reply.style });
    setSent(true);
  };

  return (
    <div style={{ background: G.surface2, border: `1px solid ${sent ? G.accent + "44" : G.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, animation: "fadeIn 0.25s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: G.accent, fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{reply.style}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={copy} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${G.border}`, background: "transparent", color: copied ? "#22c55e" : G.muted, fontFamily: "Outfit, sans-serif", fontSize: "0.65rem", fontWeight: 600, cursor: "pointer" }}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={markSent} disabled={sent} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${sent ? G.accent + "44" : G.accent}`, background: sent ? `${G.accent}15` : "transparent", color: sent ? G.accent : G.accent, fontFamily: "Outfit, sans-serif", fontSize: "0.65rem", fontWeight: 600, cursor: sent ? "default" : "pointer" }}>
            {sent ? "Logged" : "Mark Sent"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: "0.88rem", lineHeight: 1.75, color: "#d8d8ee", fontFamily: "Outfit, sans-serif" }}>{reply.text}</div>
      <div style={{ fontSize: "0.62rem", color: G.muted, marginTop: 8, fontFamily: "JetBrains Mono, monospace" }}>{reply.text.length}/280</div>
    </div>
  );
}

// ── MODE: REPLY GENERATOR ─────────────────────────────────────────────────────

function ReplyMode({ sentLog }) {
  const [tweet, setTweet] = useState("");
  const [author, setAuthor] = useState("");
  const [context, setContext] = useState("");
  const [replies, setReplies] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!tweet.trim()) { setError("Paste a tweet first."); return; }
    setError(""); setLoading(true);
    try {
      const raw = await askGroq([{ role: "user", content: buildRepliesPrompt(tweet, author, context) }], 1500);
      const parsed = parseReplies(raw);
      if (!parsed) throw new Error("Could not parse replies. Try again.");
      setReplies(parsed);
    } catch (err) { setError("Failed: " + err.message); }
    setLoading(false);
  };

  const reset = () => { setReplies(null); setTweet(""); setAuthor(""); setContext(""); setError(""); };

  return (
    <div>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "20px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 16, fontWeight: 600 }}>Tweet to Reply To</div>
        <TArea label="Tweet *" value={tweet} onChange={setTweet} rows={4} placeholder="Paste the tweet you want to reply to..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <TInput label="Author Handle" value={author} onChange={setAuthor} placeholder="@handle" />
          <TInput label="Context (optional)" value={context} onChange={setContext} placeholder="e.g. they are a DeFi founder" />
        </div>
      </div>

      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.8rem", color: "#ff8888" }}>{error}</div>}

      {replies ? (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: "0.75rem", color: G.muted }}>{replies.length} replies generated</div>
            <button onClick={reset} style={{ padding: "6px 14px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>New Tweet</button>
          </div>
          <div style={{ background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: "0.82rem", color: G.muted, lineHeight: 1.6, fontStyle: "italic" }}>
            "{tweet.slice(0, 120)}{tweet.length > 120 ? "..." : ""}"
          </div>
          {replies.map((r, i) => <ReplyCard key={i} reply={r} tweet={tweet} author={author} onSent={sentLog.addEntry} />)}
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

function ScanMode({ sentLog }) {
  const [tweets, setTweets] = useState("");
  const [niche, setNiche] = useState("");
  const [opportunities, setOpportunities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [replies, setReplies] = useState({});
  const [replyLoading, setReplyLoading] = useState(null);

  const scan = async () => {
    if (!tweets.trim()) { setError("Paste some tweets first."); return; }
    setError(""); setLoading(true);
    try {
      const raw = await askGroq([{ role: "user", content: buildScanPrompt(tweets, niche) }], 2000);
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Could not parse opportunities. Try again.");
      setOpportunities(parsed);
    } catch (err) { setError("Failed: " + err.message); }
    setLoading(false);
  };

  const generateRepliesFor = async (opp, idx) => {
    setReplyLoading(idx);
    try {
      const raw = await askGroq([{ role: "user", content: buildRepliesPrompt(opp.tweet_preview, opp.author, opp.angle) }], 1500);
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
          placeholder={"Paste multiple tweets here. Format each like:\n\n@handle: tweet text\n\n@handle: tweet text\n\nOr just paste raw tweets one after another."}
          hint="Copy tweets from X and paste them here. The AI will identify the best reply opportunities." />
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
              <div key={i} style={{ background: G.surface, border: `1px solid ${selected === i ? G.accent + "55" : G.border}`, borderRadius: G.radius, overflow: "hidden" }}>
                <div onClick={() => setSelected(selected === i ? null : i)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: G.accent }}>{opp.author}</span>
                      <span style={{ fontSize: "0.62rem", color: scoreColor(opp.opportunity_score), fontFamily: "JetBrains Mono, monospace" }}>Score: {opp.opportunity_score}/10</span>
                    </div>
                    <div style={{ fontSize: "0.83rem", color: "#ccc", lineHeight: 1.6, marginBottom: 6 }}>"{opp.tweet_preview}..."</div>
                    <div style={{ fontSize: "0.72rem", color: G.muted, lineHeight: 1.5 }}>
                      <span style={{ color: G.accent }}>Why: </span>{opp.why_reply}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: G.muted, lineHeight: 1.5, marginTop: 3 }}>
                      <span style={{ color: G.accent }}>Angle: </span>{opp.angle}
                    </div>
                  </div>
                  <span style={{ color: G.muted, fontSize: "0.75rem", flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: selected === i ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                </div>
                {selected === i && (
                  <div style={{ borderTop: `1px solid ${G.border}`, padding: "14px 16px", animation: "fadeIn 0.2s ease" }}>
                    {replies[i] ? (
                      <div>
                        {replies[i].map((r, j) => <ReplyCard key={j} reply={r} tweet={opp.tweet_preview} author={opp.author} onSent={sentLog.addEntry} />)}
                      </div>
                    ) : (
                      <button onClick={() => generateRepliesFor(opp, i)} disabled={replyLoading === i}
                        style={{ width: "100%", padding: "10px", borderRadius: 10, background: replyLoading === i ? G.surface2 : `${G.accent}15`, border: `1px solid ${G.accent}44`, color: G.accent, fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: replyLoading === i ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
          {loading ? <><Spinner /><span>Scanning opportunities...</span></> : "Scan for Opportunities"}
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
        <TInput label="X Handle to Analyze (optional)" value={handle} onChange={setHandle} placeholder="@handle - analyze a specific account's network" hint="Leave blank to get suggestions based on niche only" />
        <TInput label="Niche / Context" value={niche} onChange={setNiche} placeholder="e.g. Web3 founders, growth strategists, DeFi builders" hint="The more specific, the better the suggestions" />
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
              <div key={i} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "14px 16px", animation: "fadeUp 0.3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: G.text }}>{acc.name}</div>
                    <div style={{ fontSize: "0.72rem", color: G.accent }}>{acc.handle}</div>
                  </div>
                  <div style={{ fontSize: "0.62rem", color: scoreColor(acc.score), fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{acc.score}/10</div>
                </div>
                <div style={{ fontSize: "0.72rem", color: G.muted, marginBottom: 6 }}>{acc.niche}</div>
                <div style={{ fontSize: "0.75rem", color: "#ccc", lineHeight: 1.55, marginBottom: 8 }}>
                  <span style={{ color: G.accent, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Why: </span>{acc.why_engage}
                </div>
                <div style={{ background: G.surface2, borderRadius: 8, padding: "8px 10px", fontSize: "0.72rem", color: G.muted, lineHeight: 1.5 }}>
                  <span style={{ color: G.accent, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tip: </span>{acc.engagement_tip}
                </div>
                <a href={"https://x.com/" + acc.handle.replace("@", "")} target="_blank" rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 10, fontSize: "0.65rem", color: G.accent, textDecoration: "none" }}>
                  View on X ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={find} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: G.radius, background: loading ? G.surface2 : G.accent, border: "none", color: loading ? G.muted : "#000", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <><Spinner /><span>Finding accounts...</span></> : "Find Accounts to Engage"}
        </button>
      )}
    </div>
  );
}

// ── MODE: SENT LOG ────────────────────────────────────────────────────────────

function SentLogMode({ sentLog }) {
  const { log, exportCSV } = sentLog;

  if (log.length === 0) return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>◎</div>
      <div style={{ fontSize: "0.85rem", color: G.muted }}>No replies logged yet.</div>
      <div style={{ fontSize: "0.75rem", color: G.muted, marginTop: 6 }}>Mark replies as sent from the Reply or Scan modes to track them here.</div>
    </div>
  );

  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: "0.75rem", color: G.muted }}>{log.length} replies logged</div>
        <button onClick={exportCSV} style={{ padding: "7px 16px", borderRadius: 8, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Export CSV</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {log.map((entry, i) => (
          <div key={i} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "0.72rem", color: G.accent, fontWeight: 600 }}>{entry.author || "Unknown"}</span>
              <span style={{ fontSize: "0.62rem", color: G.muted, fontFamily: "JetBrains Mono, monospace" }}>{new Date(entry.sentAt).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: G.muted, marginBottom: 8, fontStyle: "italic" }}>"{(entry.tweet || "").slice(0, 100)}{entry.tweet?.length > 100 ? "..." : ""}"</div>
            <div style={{ fontSize: "0.84rem", color: "#d0d0e8", lineHeight: 1.65, background: G.surface2, borderRadius: 8, padding: "10px 12px" }}>{entry.reply}</div>
            <div style={{ fontSize: "0.62rem", color: G.muted, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>Style: {entry.style}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function ReplyPilot() {
  const [mode, setMode] = useState("reply");
  const sentLog = useSentLog();

  const MODES = [
    { id: "reply",    label: "Reply",    icon: "◎" },
    { id: "scan",     label: "Scan",     icon: "◈" },
    { id: "accounts", label: "Accounts", icon: "◆" },
    { id: "log",      label: "Sent Log", icon: "▣" },
  ];

  const modeDesc = {
    reply: "Paste a tweet, get 3 replies in your voice",
    scan: "Paste tweets, surface the best reply opportunities",
    accounts: "Find high-value accounts worth engaging with",
    log: "Track replies you've sent - export as CSV",
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
                <span style={{ background: mode === m.id ? "#00000033" : G.accent, color: mode === m.id ? "#000" : "#000", borderRadius: 20, fontSize: "0.6rem", padding: "1px 6px", fontWeight: 700 }}>{sentLog.log.length}</span>
              )}
            </button>
          ))}
        </div>

        <div key={mode} style={{ animation: "fadeUp 0.25s ease" }}>
          {mode === "reply"    && <ReplyMode sentLog={sentLog} />}
          {mode === "scan"     && <ScanMode sentLog={sentLog} />}
          {mode === "accounts" && <AccountsMode />}
          {mode === "log"      && <SentLogMode sentLog={sentLog} />}
        </div>
      </div>
    </div>
  );
}
