"use client";

import { use, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { splitFirstParagraph } from "@/lib/splitFirstParagraph";

interface ChatMessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface AnalysisRunRow {
  id: number;
  suggestedQuestionsJson: string;
}

interface SuggestedQuestionGroup {
  topic: string;
  questions: string[];
}

// Analysis runs saved before grouping existed stored suggestedQuestions as a
// flat string[] — normalize both shapes so old rows don't need a re-run just
// to render under the new UI.
function normalizeSuggestedQuestions(raw: unknown): SuggestedQuestionGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "string") return [{ topic: "Suggested", questions: raw as string[] }];
  return raw as SuggestedQuestionGroup[];
}

export default function ChatTab({ params }: PageProps<"/company/[slug]/chat">) {
  const { slug } = use(params);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const [jobPostingCount, setJobPostingCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [latestRun, setLatestRun] = useState<AnalysisRunRow | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  async function refresh() {
    const { companies } = await fetch("/api/companies").then((r) => r.json());
    const company = companies.find((c: { slug: string }) => c.slug === slug);
    if (!company) return;
    setCompanyId(company.id);
    setPeopleCount(company.personCount);
    setJobPostingCount(company.jobPostingCount);
    const [chatRes, analyzeRes] = await Promise.all([
      fetch(`/api/companies/${company.id}/chat`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/analyze`).then((r) => r.json()),
    ]);
    setMessages(chatRes.messages ?? []);
    setLatestRun(analyzeRes.runs?.[0] ?? null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function sendMessage(userText: string) {
    if (!companyId || !userText.trim()) return;
    setMessages((m) => [...m, { id: -1, role: "user", content: userText }]);
    setStreamingText("");

    const res = await fetch(`/api/companies/${companyId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      setStreamingText(full);
    }
    setStreamingText(null);
    setMessages((m) => [...m, { id: -1, role: "assistant", content: full }]);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const userText = chatInput.trim();
    if (!userText) return;
    setChatInput("");
    await sendMessage(userText);
  }

  const suggestedGroups: SuggestedQuestionGroup[] = latestRun
    ? (() => {
        try {
          return normalizeSuggestedQuestions(JSON.parse(latestRun.suggestedQuestionsJson));
        } catch {
          return [];
        }
      })()
    : [];
  const totalSuggested = suggestedGroups.reduce((n, g) => n + g.questions.length, 0);
  const groundedIn = `${peopleCount} profiles, ${jobPostingCount} job descriptions, your profile`;

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1000px] w-full">
      <SectionHeader eyebrow="GROUNDED IN" title={groundedIn} />

      <div className="flex flex-col gap-[2px] mb-7">
        {messages.map((m, i) => {
          const isAssistant = m.role === "assistant";
          const split = isAssistant ? splitFirstParagraph(m.content) : { first: m.content, rest: null };
          const revealed = revealedAnswers[i] ?? false;
          return (
            <div key={i} className={`p-5 border-l-[3px] ${m.role === "user" ? "bg-bg border-neutral-400" : "bg-surface border-accent"}`}>
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2">
                {m.role === "user" ? "YOU" : "REVERSE SEARCH"}
              </div>
              <p className="text-[15px] leading-relaxed m-0 max-w-[80ch]">
                {split.first}
                {split.rest && !revealed && (
                  <button
                    onClick={() => setRevealedAnswers((r) => ({ ...r, [i]: true }))}
                    className="ml-1.5 text-xs text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
                  >
                    Read the full answer
                  </button>
                )}
                {split.rest && revealed && <span> {split.rest}</span>}
              </p>
              {isAssistant && (
                <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600 mt-2.5">GROUNDED IN — {groundedIn}</div>
              )}
            </div>
          );
        })}
        {streamingText !== null && (
          <div className="p-5 border-l-[3px] bg-surface border-accent">
            <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2">REVERSE SEARCH</div>
            <p className="text-[15px] leading-relaxed m-0 max-w-[80ch]">{streamingText || "…"}</p>
          </div>
        )}
        {messages.length === 0 && streamingText === null && (
          <p className="text-neutral-700 text-sm">
            {latestRun ? "Ask about this company's fit." : "Run an analysis on the Profiles tab to get a first take, then ask questions here."}
          </p>
        )}
      </div>

      <form onSubmit={sendChat} className="flex gap-2 mb-6">
        <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask your own question…" className="flex-1" />
        <Button type="submit">Ask</Button>
      </form>

      {totalSuggested > 0 && (
        <details>
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3">
            {totalSuggested} SUGGESTED QUESTIONS — {suggestedGroups.map((g) => g.topic).join(" · ")}
          </summary>
          <div className="flex flex-col gap-5 mt-3">
            {suggestedGroups.map((group, gi) => (
              <div key={gi}>
                <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600 mb-1.5">{group.topic.toUpperCase()}</div>
                <div className="flex flex-col gap-[2px]">
                  {group.questions.map((q, qi) => (
                    <div
                      key={qi}
                      className="flex items-center gap-3 bg-surface border-l-[3px] border-divider px-4 py-3 hover:border-accent hover:bg-accent-100"
                    >
                      <span className="text-sm flex-1">{q}</span>
                      <button
                        onClick={() => setChatInput(q)}
                        className="text-[11px] font-heading font-extrabold text-accent-700 bg-transparent border border-accent-700 px-2.5 py-1 cursor-pointer flex-none"
                      >
                        USE
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
