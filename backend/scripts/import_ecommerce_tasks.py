"""Import the E-Commerce Master Task List (140 tasks) into the running TaskFlow API.

- Logs in as an Assigner (Alex), who becomes the creator of every task.
- Round-robins each task across the Assignee-role users.
- Maps category -> tag, list priority -> task priority, and staggers due dates.
- Idempotent: skips any task whose exact title already exists.

Run:  backend/.venv/Scripts/python.exe backend/scripts/import_ecommerce_tasks.py
Env:  API_BASE (default http://127.0.0.1:8000/api/v1)
"""
import os
from datetime import date, timedelta

import httpx

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api/v1")
ASSIGNER_EMAIL = os.environ.get("ASSIGNER_EMAIL", "alex@taskflow.dev")
PASSWORD = os.environ.get("SEED_PASSWORD", "password123")

# category -> (tag, {priority: [titles]})
DATA: dict[str, tuple[str, dict[str, list[str]]]] = {
    "Shopify Website": ("shopify", {
        "High": [
            "Homepage banner / hero section update",
            "Navigation menu restructure or update",
            "Collection / category page setup & layout",
            "Mobile responsiveness audit & fixes",
            "Site speed optimization (image compression, lazy load, app cleanup)",
            "Checkout flow review & optimization",
            "Payment gateway setup and testing",
            "Shipping zones, rates & delivery settings",
            "Custom domain setup and SSL verification",
            "On-page SEO audit (meta titles, descriptions, alt text)",
            "Tax settings and GST configuration",
        ],
        "Medium": [
            "New page creation (About, Contact, FAQ, Policy)",
            "Theme customization (fonts, colors, sections)",
            "Announcement bar / promotional banner setup",
            "Popup / email capture widget setup",
            "Discount codes and automatic promotions setup",
            "Return & refund policy page update",
            "App installation, configuration & removal",
            "Sitemap submission and robots.txt review",
            "404 error page & redirect setup",
            "Review / testimonial section setup",
            "Upsell / cross-sell widget setup (related products)",
        ],
        "Low": [
            "Gift card and store credit configuration",
            "Email notification templates customization",
            "Blog post creation and SEO optimization",
            "Footer links, social icons & trust badges update",
            "Live chat or WhatsApp widget integration",
            "Wishlist feature setup",
            "Multi-language or multi-currency setup",
            "Loyalty / rewards program integration",
        ],
    }),
    "Product Listing": ("product-listing", {
        "High": [
            "New product creation and upload",
            "Bulk product import via CSV",
            "Product title writing and optimization",
            "Product description writing (features + benefits)",
            "Main product image upload and alt-text",
            "Product variant setup (size, color, material)",
            "Pricing, compare-at price and cost-per-item update",
            "Inventory quantity and SKU management",
            "SEO meta title and description for each product",
        ],
        "Medium": [
            "Lifestyle and infographic image creation brief",
            "Product tags, type and vendor assignment",
            "Collection assignment and sorting",
            "Product weight, dimensions and shipping info",
            "Bundle and kit product creation",
            "Seasonal or sale pricing update (bulk edit)",
            "Out-of-stock product management (hide / notify)",
            "Compliance and warning labels (if applicable)",
        ],
        "Low": [
            "Product review import and display setup",
            "Size guide creation and linking",
            "Digital product or download setup",
        ],
    }),
    "Marketplace Management": ("marketplace", {
        "High": [
            "New product listing creation on Amazon / Flipkart / Meesho",
            "Marketplace keyword research (title, bullets, backend)",
            "Listing title optimization per marketplace guidelines",
            "Bullet points (key features) writing",
            "Product description / A+ content creation",
            "Main, lifestyle and infographic images upload",
            "Backend search term and keyword update",
            "Category and browse node selection",
            "Pricing strategy review and update",
            "Inventory sync and replenishment alerts",
            "FBA / FBF shipment creation and labeling",
            "Account health and policy compliance check",
            "New marketplace onboarding (account setup, brand approval)",
            "Stranded / suppressed listing fix",
        ],
        "Medium": [
            "Enhanced Brand Content (EBC) / Brand Story update",
            "Marketplace Brand Store setup or redesign",
            "Video upload to listing (product demo)",
            "Deals, coupons and Lightning Deal submission",
            "Review and rating monitoring and responses",
            "Negative seller feedback management",
            "Competitor price and listing analysis",
            "Category ranking and BSR tracking",
            "Return and refund case management",
            "Cross-marketplace price parity review",
        ],
        "Low": [
            "GTIN / barcode exemption request (if needed)",
        ],
    }),
    "Meta Ads": ("meta-ads", {
        "High": [
            "Meta Business Manager account setup and access audit",
            "Meta Pixel installation and event verification",
            "Conversion API (CAPI) setup for accurate tracking",
            "Product catalog creation and feed sync",
            "Campaign creation (Awareness / Traffic / Leads / Sales)",
            "Ad set audience targeting (demographics, interests, behaviors)",
            "Custom audience creation (customer list, website visitors)",
            "Lookalike audience creation and refresh",
            "Retargeting campaign setup (cart abandoners, viewers)",
            "Dynamic product ads (DPA / Advantage+ catalog) setup",
            "Ad creative brief and design coordination",
            "Ad copywriting (primary text, headline, CTA)",
            "Seasonal and promotional campaign planning",
            "Budget allocation and daily spend review",
            "Campaign scaling (budget increase for winners)",
            "Underperforming ad pause and creative refresh",
            "Weekly campaign performance review and optimization",
        ],
        "Medium": [
            "Advantage+ Shopping campaign setup",
            "A/B split test setup (creative, audience, placement)",
            "Bid strategy selection (lowest cost, cost cap, ROAS bid)",
            "Facebook / Instagram page content alignment",
            "Influencer or UGC ad creative sourcing brief",
            "Lead gen form campaign for email list building",
        ],
        "Low": [
            "Ad scheduling / dayparting setup",
            "WhatsApp click-to-chat ad setup",
        ],
    }),
    "Google Ads": ("google-ads", {
        "High": [
            "Google Ads account structure setup",
            "Google Merchant Center account setup and product feed",
            "Product feed optimization (titles, descriptions, attributes)",
            "Search campaign creation and keyword setup",
            "Shopping campaign creation (Standard or Smart)",
            "Performance Max campaign setup",
            "Remarketing list creation and RLSA targeting",
            "Keyword research (broad, phrase, exact match)",
            "Negative keyword list creation and maintenance",
            "Responsive Search Ad (RSA) copywriting",
            "Ad extensions setup (sitelinks, callout, price, promotion)",
            "Bid strategy configuration (tCPA, tROAS, Maximize Conversions)",
            "Conversion tracking setup via Google Tag Manager",
            "Google Analytics 4 linking and audience import",
            "Search term report review and negative keyword additions",
            "Campaign budget review and reallocation",
            "Shopping feed disapproval fix and resubmission",
            "Weekly performance review and bid optimisation",
        ],
        "Medium": [
            "Display / Demand Gen campaign creation",
            "Quality Score and Ad Rank improvement",
            "Seasonal promotional ad scheduling",
            "Competitor and auction insights analysis",
            "A/B test for ad copy (RSA variants)",
            "Location and device bid adjustments",
        ],
        "Low": [
            "YouTube video campaign (if applicable)",
        ],
    }),
    "Analytics & Reporting": ("analytics", {
        "High": [
            "UTM parameter framework setup for all campaigns",
            "Weekly performance dashboard update",
            "Monthly consolidated performance report (Meta + Google + Marketplace + Shopify)",
            "ROAS and ACOS tracking by channel",
            "Customer acquisition cost (CAC) tracking",
            "Channel-wise traffic and conversion funnel report",
            "End-of-month budget vs actual spend review",
        ],
        "Medium": [
            "Revenue attribution model review",
            "AOV (average order value) and LTV tracking",
            "Cart abandonment rate analysis",
            "Best-selling product performance report",
            "Seasonal sales trend analysis",
            "Ad creative performance comparison report",
            "Stock vs demand alignment report",
        ],
        "Low": [
            "Competitor benchmarking report",
        ],
    }),
}

# list priority -> (task priority, effort hours, due-window start, due-window span)
PRIORITY_MAP = {
    "High": ("High", 6, 3, 8),
    "Medium": ("Medium", 4, 14, 14),
    "Low": ("Low", 2, 30, 30),
}


def main() -> None:
    with httpx.Client(base_url=API_BASE, timeout=30) as c:
        tok = c.post("/auth/login", json={"email": ASSIGNER_EMAIL, "password": PASSWORD}).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        users = c.get("/users", headers=h).json()
        assignees = [u for u in users if u["role"] == "Assignee"]
        assignees.sort(key=lambda u: u["name"])
        if not assignees:
            raise SystemExit("No Assignee-role users found.")
        print("Assignees (round-robin):", ", ".join(u["name"] for u in assignees))

        # existing titles (paginate) for idempotency
        existing: set[str] = set()
        page = 1
        while True:
            resp = c.get("/tasks", headers=h, params={"page": page, "per_page": 100}).json()
            for t in resp["data"]:
                existing.add(t["title"])
            if page * 100 >= resp["meta"]["total"]:
                break
            page += 1

        created = 0
        skipped = 0
        failed = 0
        per_assignee: dict[str, int] = {u["name"]: 0 for u in assignees}
        rr = 0  # round-robin index across ALL created tasks

        for category, (tag, buckets) in DATA.items():
            for list_priority, titles in buckets.items():
                task_priority, effort, due_start, due_span = PRIORITY_MAP[list_priority]
                for i, title in enumerate(titles):
                    if title in existing:
                        skipped += 1
                        continue
                    assignee = assignees[rr % len(assignees)]
                    due = date.today() + timedelta(days=due_start + (i % due_span))
                    payload = {
                        "title": title,
                        "description": f"{category} — {list_priority} priority.",
                        "priority": task_priority,
                        "assignee_id": assignee["id"],
                        "due_date": due.isoformat(),
                        "estimated_effort": effort,
                        "effort_unit": "hours",
                        "tags": [tag],
                        "depends_on_task_ids": [],
                    }
                    r = c.post("/tasks", headers=h, json=payload)
                    if r.status_code == 201:
                        created += 1
                        per_assignee[assignee["name"]] += 1
                        rr += 1
                    else:
                        failed += 1
                        print(f"  FAILED [{r.status_code}] {title}: {r.text[:120]}")

        print(f"\nCreated: {created} | Skipped (already existed): {skipped} | Failed: {failed}")
        print("Per assignee:", ", ".join(f"{k}={v}" for k, v in per_assignee.items()))


if __name__ == "__main__":
    main()
