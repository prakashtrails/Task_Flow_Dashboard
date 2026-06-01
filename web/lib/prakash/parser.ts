// Prakash module — fully local parser engine (no AI / no API).
import { Category, Priority } from "./constants";
import type { LearnedRule } from "./store";

export interface Reason {
  type: "keyword" | "learned" | "default";
  detail?: string; // matched keyword (keyword) or short note (learned)
}

export interface ParseResult {
  title: string;
  category: Category;
  categoryReason: Reason;
  priority: Priority;
  priorityReason: Reason;
  dueLabel: string | null;
  notes: string | null;
  categoryRuleId: string | null;
  priorityRuleId: string | null;
}

/* ----------------------------- keyword tables ---------------------------- */
// Checked in this order; first category with any substring match wins.
const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["Marketplace", ["amazon", "flipkart", "meesho", "marketplace", "a+ content", "aplus", "fba", "fbf", "bsr", "brand store", "enhanced brand", "stranded", "suppressed", "account health", "seller central", "listing quality"]],
  ["Meta Ads", ["meta", "facebook", "instagram", "fb ads", "ig ads", "pixel", "capi", "lookalike", "retarget", "dpa", "advantage+", "ad set", "ad creative", "ad copy", "meta campaign", "business manager", "reels ad", "story ad"]],
  ["Google Ads", ["google ads", "google shopping", "search campaign", "shopping campaign", "pmax", "performance max", "merchant center", "gmc", "rsa", "quality score", "display campaign", "google remarketing", "negative keyword"]],
  ["Analytics & Reporting", ["analytics", "report", "reporting", "dashboard", "utm", "roas", "acos", "cac", "aov", "ltv", "conversion tracking", "ga4", "gtm", "google tag", "funnel", "attribution", "revenue report", "monthly report", "weekly report"]],
  ["Product Listing", ["product description", "product image", "product upload", "bulk upload", "variant", "sku", "product price", "product title", "product tag", "size guide", "csv upload", "product catalog", "product photo"]],
  ["Shopify Website", ["shopify", "website", "homepage", "banner", "navigation", "checkout", "payment gateway", "shipping rate", "theme", "collection", "mobile", "responsive", "app install", "domain", "blog", "wishlist", "loyalty", "announcement", "popup", "footer", "header", "redirect", "speed"]],
];

const HIGH_KEYWORDS = ["urgent", "asap", "immediately", "critical", "high priority", "right away", "broken", "not working", "error", "bug", "issue", "failing", "down", "emergency", "need it now", "need asap"];
const LOW_KEYWORDS = ["when you get a chance", "low priority", "eventually", "later", "not urgent", "nice to have", "whenever", "no rush", "if possible", "at some point"];

const BROKEN_KEYWORDS = ["broken", "not working", "issue", "error", "bug", "failing", "down"];
const ACTION_VERBS = ["fix", "update", "create", "add", "run", "launch", "review", "check", "build", "design", "upload", "submit", "optimize", "audit", "configure", "publish", "schedule", "pause", "stop", "start"];

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const LEAD_FILLERS = ["hey", "hi", "hello", "can you", "could you", "please", "kindly", "would you", "need you to", "i need", "i want", "we need"];
const ANY_FILLERS = ["please", "kindly", "asap", "urgently", "immediately"];

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "please", "this", "with", "that", "have", "will",
  "your", "from", "are", "was", "but", "not", "can", "could", "would", "need",
  "want", "they", "them", "then", "than", "into", "onto", "over", "some", "make",
  "made", "done", "task", "tasks", "also", "just", "very", "when", "what", "where",
  "which", "should", "about", "there", "their", "been", "being", "here",
]);

/* ------------------------------ extraction ------------------------------- */
export function extractMentions(message: string): string[] {
  const found = (message.match(/@(\w+)/g) || []).map((m) => m.slice(1));
  // de-dup, preserve order, capitalize to match team names (Title case)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function stripMentions(message: string): string {
  return message.replace(/@\w+/g, " ");
}

/* ---------------------------- learned rules ------------------------------ */
function applyLearned(
  msgLower: string,
  rules: LearnedRule[],
  field: "category" | "priority"
): { value: string; ruleId: string } | null {
  let best: { value: string; ruleId: string; count: number } | null = null;
  for (const rule of rules) {
    if (rule.field !== field) continue;
    const count = rule.triggerWords.filter((w) => msgLower.includes(w)).length;
    if (count >= 1 && (!best || count > best.count)) {
      best = { value: rule.correctedTo, ruleId: rule.id, count };
    }
  }
  return best ? { value: best.value, ruleId: best.ruleId } : null;
}

/* ---------------------------- field detectors ---------------------------- */
function detectCategory(msgLower: string): { category: Category; reason: Reason } {
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    const hit = words.find((w) => msgLower.includes(w));
    if (hit) return { category: cat, reason: { type: "keyword", detail: hit } };
  }
  return { category: "General", reason: { type: "default" } };
}

function detectPriority(msgLower: string): { priority: Priority; reason: Reason } {
  const high = HIGH_KEYWORDS.find((w) => msgLower.includes(w));
  if (high) return { priority: "High", reason: { type: "keyword", detail: high } };
  const low = LOW_KEYWORDS.find((w) => msgLower.includes(w));
  if (low) return { priority: "Low", reason: { type: "keyword", detail: low } };
  return { priority: "Medium", reason: { type: "default" } };
}

function detectDue(msgLower: string): string | null {
  if (/\beow\b|\bend of week\b/.test(msgLower)) return "End of week";
  if (/\beom\b|\bend of month\b/.test(msgLower)) return "End of month";
  if (/\bnext week\b/.test(msgLower)) return "Next week";
  if (/\bthis week\b/.test(msgLower)) return "This week";
  if (/\btomorrow\b/.test(msgLower)) return "Tomorrow";

  const byMatch = msgLower.match(/\b(?:by|due|deadline:?)\s+([a-z]+)/);
  if (byMatch) {
    const tok = byMatch[1];
    if (tok === "today") return "Today";
    if (tok === "tomorrow") return "Tomorrow";
    if (WEEKDAYS.includes(tok)) return cap(tok);
  }

  const day = WEEKDAYS.find((d) => new RegExp(`\\b${d}\\b`).test(msgLower));
  if (day) return cap(day);

  if (/\btoday\b/.test(msgLower)) return "Today";
  return null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------------------------- title generation --------------------------- */
function generateTitle(message: string): { title: string; cleanedLen: number } {
  let text = stripMentions(message);

  // strip leading filler phrases (repeatedly)
  let changed = true;
  while (changed) {
    changed = false;
    const lower = text.trimStart().toLowerCase();
    for (const f of LEAD_FILLERS) {
      if (lower.startsWith(f + " ") || lower === f) {
        text = text.trimStart().slice(f.length);
        changed = true;
        break;
      }
    }
  }

  // remove filler words anywhere
  for (const f of ANY_FILLERS) {
    text = text.replace(new RegExp(`\\b${f}\\b`, "gi"), " ");
  }

  // remove due-date fragments
  text = text
    .replace(/\b(?:by|due|deadline:?)\s+[a-z]+/gi, " ")
    .replace(/\beow\b|\beom\b|\bend of week\b|\bend of month\b|\bthis week\b|\bnext week\b|\btomorrow\b|\btoday\b/gi, " ");

  text = text.replace(/\s+/g, " ").trim();
  const cleanedLen = text.length;

  // infer action verb
  const lower = text.toLowerCase();
  const hasBroken = BROKEN_KEYWORDS.some((k) => lower.includes(k));
  const firstWord = lower.split(" ")[0] || "";
  if (hasBroken && !ACTION_VERBS.some((v) => lower.startsWith(v))) {
    text = "Fix " + text;
  } else if (!ACTION_VERBS.includes(firstWord) && firstWord && !hasBroken) {
    // leave as-is (spec: only force a verb in the broken case)
  }

  // trim to 9 words
  const words = text.split(" ").filter(Boolean);
  let truncated = false;
  let kept = words;
  if (words.length > 9) {
    kept = words.slice(0, 9);
    truncated = true;
  }
  let title = kept.join(" ");
  if (truncated) title += "…";
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: title || "New task", cleanedLen };
}

/* -------------------------------- parse ---------------------------------- */
export function parseMessage(message: string, rules: LearnedRule[]): ParseResult {
  const msgLower = message.toLowerCase();

  // Category: learned first, then keywords, then default.
  const learnedCat = applyLearned(msgLower, rules, "category");
  let category: Category;
  let categoryReason: Reason;
  let categoryRuleId: string | null = null;
  if (learnedCat) {
    category = learnedCat.value as Category;
    categoryReason = { type: "learned" };
    categoryRuleId = learnedCat.ruleId;
  } else {
    const det = detectCategory(msgLower);
    category = det.category;
    categoryReason = det.reason;
  }

  // Priority: learned first, then keywords, then default.
  const learnedPri = applyLearned(msgLower, rules, "priority");
  let priority: Priority;
  let priorityReason: Reason;
  let priorityRuleId: string | null = null;
  if (learnedPri) {
    priority = learnedPri.value as Priority;
    priorityReason = { type: "learned" };
    priorityRuleId = learnedPri.ruleId;
  } else {
    const det = detectPriority(msgLower);
    priority = det.priority;
    priorityReason = det.reason;
  }

  const dueLabel = detectDue(msgLower);
  const { title, cleanedLen } = generateTitle(message);
  const notes = cleanedLen > 55 ? message.trim().slice(0, 180) : null;

  return {
    title,
    category,
    categoryReason,
    priority,
    priorityReason,
    dueLabel,
    notes,
    categoryRuleId,
    priorityRuleId,
  };
}

/* --------------------- keyword extraction for learning ------------------- */
export function extractTriggerWords(message: string): string[] {
  const words = stripMentions(message)
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
    if (out.length >= 10) break;
  }
  return out;
}

/* ----------------------- natural due -> ISO date ------------------------- */
export function resolveDueToISO(label: string | null): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const addDays = (n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const nextWeekday = (target: number) => {
    // target: 0=Sun..6=Sat ; next occurrence strictly within the coming 7 days
    const diff = (target - d.getDay() + 7) % 7 || 7;
    return addDays(diff);
  };

  let result: Date;
  switch (label) {
    case "Today":
      result = d;
      break;
    case "Tomorrow":
      result = addDays(1);
      break;
    case "This week":
    case "End of week":
      result = nextWeekday(5); // Friday
      break;
    case "Next week":
      result = addDays(7);
      break;
    case "End of month":
      result = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
      break;
    default: {
      const idx = WEEKDAYS.indexOf((label || "").toLowerCase());
      if (idx >= 0) {
        // WEEKDAYS index 0=Monday -> JS day (1=Mon..0=Sun)
        const jsDay = (idx + 1) % 7;
        result = nextWeekday(jsDay);
      } else {
        result = addDays(7); // no due detected -> default a week out
      }
    }
  }
  return result.toISOString().slice(0, 10);
}
