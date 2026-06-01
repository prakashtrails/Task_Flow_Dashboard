// Prakash module — shared constants (team, categories, colors).

export interface TeamMember {
  name: string;
  role: string;
  color: string;
}

// The full team. Each user's Chat→Task tab can assign to others (Assigners) or
// only to themselves (Assignees); the assignable subset is computed per user.
export const ALL_MEMBERS: TeamMember[] = [
  { name: "Ritik", role: "Founder", color: "#F97316" },
  { name: "Tanishk", role: "Senior Manager", color: "#3B82F6" },
  { name: "Prakash", role: "Consultant", color: "#6366F1" },
  { name: "Anmol", role: "Website & Tech Lead", color: "#10B981" },
  { name: "Pushpendra", role: "Marketing & Ads Lead", color: "#8B5CF6" },
  { name: "Kunal", role: "Creative Design Executive", color: "#F59E0B" },
  { name: "Saksham", role: "Marketplaces Lead", color: "#EC4899" },
  { name: "Suraj", role: "Website & Tech Executive", color: "#06B6D4" },
];

export const TEAM_NAMES = ALL_MEMBERS.map((t) => t.name);

export function teamColor(name: string): string {
  return ALL_MEMBERS.find((t) => t.name === name)?.color ?? "#7B82A8";
}

export type Category =
  | "Shopify Website"
  | "Product Listing"
  | "Marketplace"
  | "Meta Ads"
  | "Google Ads"
  | "Analytics & Reporting"
  | "General";

export const CATEGORIES: Category[] = [
  "Shopify Website",
  "Product Listing",
  "Marketplace",
  "Meta Ads",
  "Google Ads",
  "Analytics & Reporting",
  "General",
];

// color (for badges) + tag slug (for the existing task API)
export const CATEGORY_META: Record<Category, { color: string; tag: string }> = {
  "Shopify Website": { color: "#6C8EF5", tag: "shopify" },
  "Product Listing": { color: "#43BFA0", tag: "product-listing" },
  Marketplace: { color: "#F5A65B", tag: "marketplace" },
  "Meta Ads": { color: "#F2789F", tag: "meta-ads" },
  "Google Ads": { color: "#9B72F2", tag: "google-ads" },
  "Analytics & Reporting": { color: "#4CAF50", tag: "analytics" },
  General: { color: "#7B82A8", tag: "general" },
};

export type Priority = "High" | "Medium" | "Low";
export const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
export const PRIORITY_COLORS: Record<Priority, string> = {
  High: "#F44336",
  Medium: "#FF9800",
  Low: "#4CAF50",
};

export const PRAKASH_EMAIL = "prakash@curlohair.com";
