"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { COLORS } from "@/lib/theme";
import { deleteRule, getRules, LearnedRule } from "@/lib/prakash/store";

export function LearnedTab({
  userKey,
  version,
  onChanged,
}: {
  userKey: string;
  version: number;
  onChanged: () => void;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rules = useMemo<LearnedRule[]>(() => getRules(userKey), [version, userKey]);

  const del = (id: string) => {
    deleteRule(userKey, id);
    onChanged();
  };

  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto pr-1">
      <div className="mb-3">
        <h2 className="text-sm font-bold" style={{ color: COLORS.text }}>
          {rules.length} correction{rules.length !== 1 ? "s" : ""} learned
        </h2>
      </div>

      {/* how it works */}
      <div
        className="rounded-lg p-3 mb-4 text-[12px] space-y-1"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
      >
        <div className="font-semibold mb-1" style={{ color: COLORS.text }}>How it works</div>
        <div>• When you edit a task's Category or Priority before confirming, the system saves a rule.</div>
        <div>• The rule remembers the distinctive words from your message.</div>
        <div>• Next time a message contains those words, the corrected value is applied automatically.</div>
        <div>• Learned rules always take priority over the built-in keyword rules.</div>
        <div>• Delete any rule below to stop it from being applied.</div>
      </div>

      {rules.length === 0 && (
        <div className="text-center text-sm mt-6" style={{ color: COLORS.muted }}>
          No rules yet. Edit a Category or Priority in a preview, then Confirm, to teach the system.
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div
            key={r.id}
            className="rounded-lg p-3"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {r.triggerWords.map((w) => (
                    <span
                      key={w}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: COLORS.elevated, color: COLORS.text }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <div className="text-sm" style={{ color: COLORS.text }}>
                  → set <span className="font-semibold capitalize">{r.field}</span> to{" "}
                  <span className="font-semibold" style={{ color: "#A5B4FC" }}>{r.correctedTo}</span>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
                  Changed from: {r.fromVal} · Applied {r.appliedCount}× automatically
                </div>
                <div className="text-[11px] italic mt-1" style={{ color: COLORS.muted }}>
                  &ldquo;{r.example}&rdquo;
                </div>
              </div>
              <button onClick={() => del(r.id)} className="p-1 flex-shrink-0" style={{ color: COLORS.muted }} title="Delete rule">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
