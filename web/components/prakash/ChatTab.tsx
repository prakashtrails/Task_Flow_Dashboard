"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { COLORS } from "@/lib/theme";
import {
  CATEGORY_META,
  PRIORITY_COLORS,
  TeamMember,
  teamColor,
} from "@/lib/prakash/constants";
import {
  extractMentions,
  extractTriggerWords,
  parseMessage,
  resolveDueToISO,
} from "@/lib/prakash/parser";
import { addRule, addTask, bumpApplied, getRules } from "@/lib/prakash/store";
import { useCreateTask } from "@/hooks/useApi";
import { apiErrorMessage } from "@/lib/api/axios";
import { PreviewCard, PreviewState } from "./PreviewCard";

interface ConfirmedData {
  assignee: string;
  title: string;
  category: string;
  priority: string;
  dueLabel: string;
  corrected: boolean;
}

type Entry =
  | { id: string; kind: "message"; text: string }
  | { id: string; kind: "preview"; preview: PreviewState }
  | { id: string; kind: "confirmed"; data: ConfirmedData };

let counter = 0;
const eid = () => `e${++counter}-${Date.now().toString(36)}`;

export function ChatTab({
  usersByName,
  team,
  selfName,
  selfAssignOnly,
  userKey,
  onChanged,
}: {
  usersByName: Record<string, string>;
  team: TeamMember[]; // who this user may assign to
  selfName: string;
  selfAssignOnly: boolean;
  userKey: string; // localStorage namespace (email)
  onChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mIndex, setMIndex] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const createTask = useCreateTask();

  const teamNames = team.map((t) => t.name);
  const suggestions = mention
    ? team.filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase()))
    : [];

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const caret = e.target.selectionStart ?? val.length;
    setInput(val);
    const before = val.slice(0, caret);
    const m = before.match(/@(\w*)$/);
    if (m) {
      setMention({ query: m[1], start: caret - m[0].length });
      setMIndex(0);
    } else {
      setMention(null);
    }
  };

  const insertMention = (name: string) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? input.length;
    const start = mention?.start ?? caret;
    const next = input.slice(0, start) + `@${name} ` + input.slice(caret);
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = start + name.length + 2;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const appendChip = (name: string) => {
    setInput((cur) => {
      const sep = cur.length === 0 || cur.endsWith(" ") ? "" : " ";
      return cur + sep + `@${name} `;
    });
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(suggestions[mIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const send = () => {
    setError("");
    const msg = input.trim();
    if (!msg) return;

    let assignees: string[];
    if (selfAssignOnly) {
      // Assignees always create tasks for themselves; @mentions are not required.
      assignees = [selfName];
    } else {
      assignees = extractMentions(msg).filter((n) => teamNames.includes(n));
      if (assignees.length === 0) {
        setError("Please @mention at least one team member.");
        return;
      }
    }

    const rules = getRules(userKey);
    const parsed = parseMessage(msg, rules);
    bumpApplied(userKey, [parsed.categoryRuleId, parsed.priorityRuleId]);

    const newEntries: Entry[] = [{ id: eid(), kind: "message", text: msg }];
    for (const name of assignees) {
      const preview: PreviewState = {
        entryId: eid(),
        message: msg,
        origCategory: parsed.category,
        origPriority: parsed.priority,
        categoryReason: parsed.categoryReason,
        priorityReason: parsed.priorityReason,
        learnedCategory: parsed.categoryReason.type === "learned",
        learnedPriority: parsed.priorityReason.type === "learned",
        title: parsed.title,
        assignee: name,
        category: parsed.category,
        priority: parsed.priority,
        dueLabel: parsed.dueLabel ?? "",
        notes: parsed.notes,
        edited: false,
      };
      newEntries.push({ id: preview.entryId, kind: "preview", preview });
    }
    setEntries((prev) => [...prev, ...newEntries]);
    setInput("");
    setMention(null);
    if (parsed.categoryRuleId || parsed.priorityRuleId) onChanged();
  };

  const patchPreview = (entryId: string, patch: Partial<PreviewState>) => {
    setEntries((prev) =>
      prev.map((en) =>
        en.kind === "preview" && en.preview.entryId === entryId
          ? { ...en, preview: { ...en.preview, ...patch } }
          : en
      )
    );
  };

  const discard = (entryId: string) => {
    setEntries((prev) =>
      prev.filter((en) => !(en.kind === "preview" && en.preview.entryId === entryId))
    );
  };

  const confirm = async (entryId: string) => {
    const entry = entries.find(
      (en) => en.kind === "preview" && en.preview.entryId === entryId
    );
    if (!entry || entry.kind !== "preview") return;
    const p = entry.preview;

    const userId = usersByName[p.assignee];
    if (!userId) {
      patchPreview(entryId, { error: `No account found for ${p.assignee}.` });
      return;
    }
    patchPreview(entryId, { submitting: true, error: undefined });

    try {
      const created = await createTask.mutateAsync({
        title: p.title.trim() || "New task",
        description: p.notes || "Created via Chat → Task.",
        priority: p.priority,
        assignee_id: userId,
        due_date: resolveDueToISO(p.dueLabel.trim() || null),
        estimated_effort: 4,
        effort_unit: "hours",
        tags: [CATEGORY_META[p.category].tag, "via-chat"],
        depends_on_task_ids: [],
      });

      let corrected = false;
      if (p.category !== p.origCategory) {
        addRule(userKey, {
          field: "category",
          triggerWords: extractTriggerWords(p.message),
          correctedTo: p.category,
          fromVal: p.origCategory,
          example: p.message.slice(0, 70),
        });
        corrected = true;
      }
      if (p.priority !== p.origPriority) {
        addRule(userKey, {
          field: "priority",
          triggerWords: extractTriggerWords(p.message),
          correctedTo: p.priority,
          fromVal: p.origPriority,
          example: p.message.slice(0, 70),
        });
        corrected = true;
      }

      addTask(userKey, {
        id: created.id,
        title: p.title.trim() || "New task",
        assignee: p.assignee,
        category: p.category,
        priority: p.priority,
        dueLabel: p.dueLabel.trim() || null,
        notes: p.notes,
        corrected,
        done: false,
        ts: Date.now(),
      });

      setEntries((prev) =>
        prev.map((en) =>
          en.id === entryId
            ? {
                id: entryId,
                kind: "confirmed",
                data: {
                  assignee: p.assignee,
                  title: p.title.trim() || "New task",
                  category: p.category,
                  priority: p.priority,
                  dueLabel: p.dueLabel.trim(),
                  corrected,
                },
              }
            : en
        )
      );
      onChanged();
    } catch (err) {
      patchPreview(entryId, { submitting: false, error: apiErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <div className="text-center text-sm mt-10" style={{ color: COLORS.muted }}>
            {selfAssignOnly ? (
              <>Type a message to draft a task for yourself.</>
            ) : (
              <>Type a message and <span className="font-mono">@mention</span> a teammate to draft a task.</>
            )}
          </div>
        )}
        {entries.map((en) => {
          if (en.kind === "message") {
            return (
              <div key={en.id} className="flex justify-end mb-2">
                <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.primary, color: "#fff" }}>
                  {en.text}
                </div>
              </div>
            );
          }
          if (en.kind === "preview") {
            return (
              <PreviewCard
                key={en.id}
                p={en.preview}
                team={team}
                onChange={(patch) => patchPreview(en.preview.entryId, patch)}
                onConfirm={() => confirm(en.preview.entryId)}
                onDiscard={() => discard(en.preview.entryId)}
              />
            );
          }
          const d = en.data;
          return (
            <div key={en.id} className="rounded-lg p-3 mb-2" style={{ background: "#4CAF5018", border: "1px solid #4CAF5055" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor(d.assignee) }} />
                <span className="text-xs font-semibold" style={{ color: "#81C784" }}>✅ Assigned → @{d.assignee}</span>
                {d.corrected && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#6366F133", color: "#A5B4FC" }}>🧠 System learned</span>
                )}
              </div>
              <div className="text-sm font-semibold mb-1.5" style={{ color: COLORS.text }}>{d.title}</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: CATEGORY_META[d.category as keyof typeof CATEGORY_META].color + "22", color: CATEGORY_META[d.category as keyof typeof CATEGORY_META].color }}>{d.category}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white" style={{ background: PRIORITY_COLORS[d.priority as keyof typeof PRIORITY_COLORS] }}>{d.priority}</span>
                {d.dueLabel && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: COLORS.elevated, color: COLORS.muted }}>📅 {d.dueLabel}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* input area */}
      <div className="pt-2">
        {selfAssignOnly ? (
          <div className="text-[11px] mb-2" style={{ color: COLORS.muted }}>
            Tasks you create here are assigned to <span className="font-semibold" style={{ color: teamColor(selfName) }}>you</span>.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {team.map((m) => (
              <button
                key={m.name}
                onClick={() => appendChip(m.name)}
                className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}55` }}
              >
                @{m.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          {mention && suggestions.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 w-64 rounded-lg overflow-hidden shadow-2xl z-20" style={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}` }}>
              {suggestions.map((m, i) => (
                <button
                  key={m.name}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                  style={{ background: i === mIndex ? COLORS.primary + "22" : "transparent" }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <span className="text-sm" style={{ color: COLORS.text }}>{m.name}</span>
                  <span className="text-[11px]" style={{ color: COLORS.muted }}>{m.role}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={taRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={selfAssignOnly ? "Type a message to create a task for yourself…" : "Type a message… use @ to tag a team member and assign tasks"}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
          <button onClick={send} className="absolute right-2 bottom-2 p-1.5 rounded-md text-white" style={{ background: COLORS.primary }} title="Send (Enter)">
            <Send size={15} />
          </button>
        </div>

        {error && <div className="text-xs mt-1" style={{ color: COLORS.danger }}>{error}</div>}

        <div className="text-[11px] mt-1.5" style={{ color: COLORS.muted }}>
          🔴 High — urgent / asap / broken / fix &nbsp;|&nbsp; 🟡 Med — (default) &nbsp;|&nbsp; 🟢 Low — later / no rush &nbsp;|&nbsp; 📅 Due — by Friday / eow / by tomorrow
        </div>
      </div>
    </div>
  );
}
