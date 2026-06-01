"""Idempotent seed: Curl'o Hair team (8 users) + the 140-task assignment list.

- Each task's primary owner (first @mention) becomes the assignee; any further
  @mentions are recorded as "Collaborators" in the description.
- Tanishk (Senior Manager) assigns every task; Ritik (Founder) assigns Tanishk's
  own tasks so nothing is self-assigned.
- Tasks are tagged by category, priority-mapped, and given staggered due dates.
- Each task gets a `task_created` notification to its assignee.
"""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Notification, NotificationRecipient, Tag, Task, User
from app.utils.security import hash_password


def _due(days: int) -> date:
    return date.today() + timedelta(days=days)


# name -> (email, role, avatar color)
TEAM = {
    "Ritik": ("ritik@curlohair.com", "Assigner", "#6C8EF5"),
    "Tanishk": ("tanishk@curlohair.com", "Assigner", "#F2789F"),
    "Prakash": ("prakash@curlohair.com", "Assigner", "#43BFA0"),
    "Anmol": ("anmol@curlohair.com", "Assignee", "#F5A65B"),
    "Pushpendra": ("pushpendra@curlohair.com", "Assignee", "#9B72F2"),
    "Kunal": ("kunal@curlohair.com", "Assignee", "#E0C341"),
    "Saksham": ("saksham@curlohair.com", "Assignee", "#4FC3F7"),
    "Suraj": ("suraj@curlohair.com", "Assignee", "#EF7A6D"),
}

# (category label, tag slug, tag color, {priority: [(title, [assignees...])]})
CATEGORIES = [
    ("Shopify Website", "shopify", "#6C8EF5", {
        "High": [
            ("Homepage banner / hero section update", ["Anmol", "Kunal"]),
            ("Navigation menu restructure or update", ["Anmol"]),
            ("Collection / category page setup & layout", ["Anmol", "Suraj"]),
            ("Mobile responsiveness audit & fixes", ["Anmol", "Suraj"]),
            ("Site speed optimization (image compression, lazy load, app cleanup)", ["Anmol"]),
            ("Checkout flow review & optimization", ["Anmol"]),
            ("Payment gateway setup and testing", ["Anmol"]),
            ("Shipping zones, rates & delivery settings", ["Anmol", "Suraj"]),
            ("Custom domain setup and SSL verification", ["Anmol"]),
            ("On-page SEO audit (meta titles, descriptions, alt text)", ["Anmol", "Suraj"]),
            ("Tax settings and GST configuration", ["Anmol"]),
        ],
        "Medium": [
            ("New page creation (About, Contact, FAQ, Policy)", ["Suraj"]),
            ("Theme customization (fonts, colors, sections)", ["Anmol", "Kunal"]),
            ("Announcement bar / promotional banner setup", ["Suraj", "Kunal"]),
            ("Popup / email capture widget setup", ["Suraj", "Anmol"]),
            ("Discount codes and automatic promotions setup", ["Suraj"]),
            ("Return & refund policy page update", ["Suraj"]),
            ("App installation, configuration & removal", ["Anmol"]),
            ("Sitemap submission and robots.txt review", ["Anmol"]),
            ("404 error page & redirect setup", ["Suraj"]),
            ("Review / testimonial section setup", ["Suraj"]),
            ("Upsell / cross-sell widget setup (related products)", ["Anmol", "Suraj"]),
        ],
        "Low": [
            ("Gift card and store credit configuration", ["Suraj"]),
            ("Email notification templates customization", ["Suraj", "Kunal"]),
            ("Blog post creation and SEO optimization", ["Suraj"]),
            ("Footer links, social icons & trust badges update", ["Suraj", "Kunal"]),
            ("Live chat or WhatsApp widget integration", ["Anmol"]),
            ("Wishlist feature setup", ["Anmol", "Suraj"]),
            ("Multi-language or multi-currency setup", ["Anmol"]),
            ("Loyalty / rewards program integration", ["Anmol"]),
        ],
    }),
    ("Product Listing", "product-listing", "#43BFA0", {
        "High": [
            ("New product creation and upload", ["Suraj"]),
            ("Bulk product import via CSV", ["Suraj"]),
            ("Product title writing and optimization", ["Suraj", "Saksham"]),
            ("Product description writing (features + benefits)", ["Suraj", "Saksham"]),
            ("Main product image upload and alt-text", ["Suraj", "Kunal"]),
            ("Product variant setup (size, color, material)", ["Suraj"]),
            ("Pricing, compare-at price and cost-per-item update", ["Suraj", "Tanishk"]),
            ("Inventory quantity and SKU management", ["Suraj", "Saksham"]),
            ("SEO meta title and description for each product", ["Suraj", "Anmol"]),
        ],
        "Medium": [
            ("Lifestyle and infographic image creation brief", ["Kunal"]),
            ("Product tags, type and vendor assignment", ["Suraj"]),
            ("Collection assignment and sorting", ["Suraj"]),
            ("Product weight, dimensions and shipping info", ["Suraj"]),
            ("Bundle and kit product creation", ["Suraj", "Tanishk"]),
            ("Seasonal or sale pricing update (bulk edit)", ["Suraj", "Tanishk"]),
            ("Out-of-stock product management (hide / notify)", ["Suraj", "Saksham"]),
            ("Compliance and warning labels (if applicable)", ["Tanishk"]),
        ],
        "Low": [
            ("Product review import and display setup", ["Suraj"]),
            ("Size guide creation and linking", ["Kunal", "Suraj"]),
            ("Digital product or download setup", ["Suraj", "Anmol"]),
        ],
    }),
    ("Marketplace Management", "marketplace", "#F5A65B", {
        "High": [
            ("New product listing creation on Amazon / Flipkart / Meesho", ["Saksham"]),
            ("Marketplace keyword research (title, bullets, backend)", ["Saksham"]),
            ("Listing title optimization per marketplace guidelines", ["Saksham"]),
            ("Bullet points (key features) writing", ["Saksham"]),
            ("Product description / A+ content creation", ["Saksham", "Kunal"]),
            ("Main, lifestyle and infographic images upload", ["Saksham", "Kunal"]),
            ("Backend search term and keyword update", ["Saksham"]),
            ("Category and browse node selection", ["Saksham"]),
            ("Pricing strategy review and update", ["Saksham", "Tanishk"]),
            ("Inventory sync and replenishment alerts", ["Saksham", "Suraj"]),
            ("FBA / FBF shipment creation and labeling", ["Saksham"]),
            ("Account health and policy compliance check", ["Saksham", "Tanishk"]),
            ("New marketplace onboarding (account setup, brand approval)", ["Saksham", "Ritik"]),
            ("Stranded / suppressed listing fix", ["Saksham"]),
        ],
        "Medium": [
            ("Enhanced Brand Content (EBC) / Brand Story update", ["Saksham", "Kunal"]),
            ("Marketplace Brand Store setup or redesign", ["Saksham", "Kunal"]),
            ("Video upload to listing (product demo)", ["Kunal", "Saksham"]),
            ("Deals, coupons and Lightning Deal submission", ["Saksham", "Tanishk"]),
            ("Review and rating monitoring and responses", ["Saksham"]),
            ("Negative seller feedback management", ["Saksham"]),
            ("Competitor price and listing analysis", ["Saksham", "Prakash"]),
            ("Category ranking and BSR tracking", ["Saksham"]),
            ("Return and refund case management", ["Saksham"]),
            ("Cross-marketplace price parity review", ["Saksham", "Tanishk"]),
        ],
        "Low": [
            ("GTIN / barcode exemption request (if needed)", ["Saksham"]),
        ],
    }),
    ("Meta Ads", "meta-ads", "#F2789F", {
        "High": [
            ("Meta Business Manager account setup and access audit", ["Pushpendra"]),
            ("Meta Pixel installation and event verification", ["Anmol", "Pushpendra"]),
            ("Conversion API (CAPI) setup for accurate tracking", ["Anmol", "Pushpendra"]),
            ("Product catalog creation and feed sync", ["Pushpendra", "Suraj"]),
            ("Campaign creation (Awareness / Traffic / Leads / Sales)", ["Pushpendra"]),
            ("Ad set audience targeting (demographics, interests, behaviors)", ["Pushpendra"]),
            ("Custom audience creation (customer list, website visitors)", ["Pushpendra"]),
            ("Lookalike audience creation and refresh", ["Pushpendra"]),
            ("Retargeting campaign setup (cart abandoners, viewers)", ["Pushpendra"]),
            ("Dynamic product ads (DPA / Advantage+ catalog) setup", ["Pushpendra"]),
            ("Ad creative brief and design coordination", ["Pushpendra", "Kunal"]),
            ("Ad copywriting (primary text, headline, CTA)", ["Pushpendra", "Kunal"]),
            ("Seasonal and promotional campaign planning", ["Pushpendra", "Tanishk"]),
            ("Budget allocation and daily spend review", ["Pushpendra", "Tanishk"]),
            ("Campaign scaling (budget increase for winners)", ["Pushpendra", "Tanishk"]),
            ("Underperforming ad pause and creative refresh", ["Pushpendra", "Kunal"]),
            ("Weekly campaign performance review and optimization", ["Pushpendra"]),
        ],
        "Medium": [
            ("Advantage+ Shopping campaign setup", ["Pushpendra"]),
            ("A/B split test setup (creative, audience, placement)", ["Pushpendra", "Kunal"]),
            ("Bid strategy selection (lowest cost, cost cap, ROAS bid)", ["Pushpendra"]),
            ("Facebook / Instagram page content alignment", ["Kunal", "Pushpendra"]),
            ("Influencer or UGC ad creative sourcing brief", ["Kunal", "Tanishk"]),
            ("Lead gen form campaign for email list building", ["Pushpendra"]),
        ],
        "Low": [
            ("Ad scheduling / dayparting setup", ["Pushpendra"]),
            ("WhatsApp click-to-chat ad setup", ["Pushpendra", "Anmol"]),
        ],
    }),
    ("Google Ads", "google-ads", "#9B72F2", {
        "High": [
            ("Google Ads account structure setup", ["Pushpendra"]),
            ("Google Merchant Center account setup and product feed", ["Pushpendra", "Suraj"]),
            ("Product feed optimization (titles, descriptions, attributes)", ["Pushpendra", "Suraj"]),
            ("Search campaign creation and keyword setup", ["Pushpendra"]),
            ("Shopping campaign creation (Standard or Smart)", ["Pushpendra"]),
            ("Performance Max campaign setup", ["Pushpendra"]),
            ("Remarketing list creation and RLSA targeting", ["Pushpendra"]),
            ("Keyword research (broad, phrase, exact match)", ["Pushpendra"]),
            ("Negative keyword list creation and maintenance", ["Pushpendra"]),
            ("Responsive Search Ad (RSA) copywriting", ["Pushpendra", "Kunal"]),
            ("Ad extensions setup (sitelinks, callout, price, promotion)", ["Pushpendra"]),
            ("Bid strategy configuration (tCPA, tROAS, Maximize Conversions)", ["Pushpendra"]),
            ("Conversion tracking setup via Google Tag Manager", ["Anmol", "Pushpendra"]),
            ("Google Analytics 4 linking and audience import", ["Anmol", "Pushpendra"]),
            ("Search term report review and negative keyword additions", ["Pushpendra"]),
            ("Campaign budget review and reallocation", ["Pushpendra", "Tanishk"]),
            ("Shopping feed disapproval fix and resubmission", ["Pushpendra", "Suraj"]),
            ("Weekly performance review and bid optimisation", ["Pushpendra"]),
        ],
        "Medium": [
            ("Display / Demand Gen campaign creation", ["Pushpendra", "Kunal"]),
            ("Quality Score and Ad Rank improvement", ["Pushpendra"]),
            ("Seasonal promotional ad scheduling", ["Pushpendra", "Tanishk"]),
            ("Competitor and auction insights analysis", ["Pushpendra", "Prakash"]),
            ("A/B test for ad copy (RSA variants)", ["Pushpendra", "Kunal"]),
            ("Location and device bid adjustments", ["Pushpendra"]),
        ],
        "Low": [
            ("YouTube video campaign", ["Pushpendra", "Kunal"]),
        ],
    }),
    ("Analytics & Reporting", "analytics", "#4CAF50", {
        "High": [
            ("UTM parameter framework setup for all campaigns", ["Pushpendra", "Anmol"]),
            ("Weekly performance dashboard update", ["Tanishk"]),
            ("Monthly consolidated performance report (Meta + Google + Marketplace + Shopify)", ["Tanishk", "Prakash"]),
            ("ROAS and ACOS tracking by channel", ["Pushpendra", "Tanishk"]),
            ("Customer acquisition cost (CAC) tracking", ["Tanishk", "Pushpendra"]),
            ("Channel-wise traffic and conversion funnel report", ["Tanishk", "Anmol"]),
            ("End-of-month budget vs actual spend review", ["Tanishk", "Ritik"]),
        ],
        "Medium": [
            ("Revenue attribution model review", ["Prakash", "Anmol"]),
            ("AOV (average order value) and LTV tracking", ["Tanishk", "Prakash"]),
            ("Cart abandonment rate analysis", ["Anmol", "Tanishk"]),
            ("Best-selling product performance report", ["Saksham", "Tanishk"]),
            ("Seasonal sales trend analysis", ["Tanishk", "Prakash"]),
            ("Ad creative performance comparison report", ["Pushpendra", "Kunal"]),
            ("Stock vs demand alignment report", ["Saksham", "Tanishk"]),
        ],
        "Low": [
            ("Competitor benchmarking report", ["Prakash"]),
        ],
    }),
]

# list priority -> (task priority, effort hours, due-window start, due-window span)
PRIORITY_MAP = {
    "High": ("High", 6, 3, 8),
    "Medium": ("Medium", 4, 14, 14),
    "Low": ("Low", 2, 30, 30),
}


async def seed(db: AsyncSession) -> None:
    existing = await db.scalar(select(func.count()).select_from(User))
    if existing:
        return

    pw = hash_password(settings.SEED_PASSWORD)
    users: dict[str, User] = {}
    for name, (email, role, color) in TEAM.items():
        u = User(name=name, email=email, password_hash=pw, role=role, avatar_color=color)
        db.add(u)
        users[name] = u
    await db.flush()

    tanishk = users["Tanishk"]
    ritik = users["Ritik"]

    tag_cache: dict[str, Tag] = {}
    created: list[tuple[Task, User, User]] = []  # (task, assignee, assigner)

    for category, tag_slug, tag_color, buckets in CATEGORIES:
        if tag_slug not in tag_cache:
            tag = Tag(name=tag_slug, color=tag_color)
            db.add(tag)
            tag_cache[tag_slug] = tag
        tag = tag_cache[tag_slug]
        for list_priority, items in buckets.items():
            task_priority, effort, due_start, due_span = PRIORITY_MAP[list_priority]
            for i, (title, owners) in enumerate(items):
                assignee = users[owners[0]]
                # Senior Manager assigns everything; Founder assigns Tanishk's own work.
                assigner = ritik if assignee is tanishk else tanishk
                collaborators = owners[1:]
                desc = f"{category} — {list_priority} priority."
                if collaborators:
                    desc += f" Collaborators: {', '.join(collaborators)}."
                task = Task(
                    title=title,
                    description=desc,
                    priority=task_priority,
                    status="Queued",
                    assigner_id=assigner.id,
                    assignee_id=assignee.id,
                    estimated_effort=effort,
                    effort_unit="hours",
                    due_date=_due(due_start + (i % due_span)),
                )
                task.tags = [tag]
                db.add(task)
                created.append((task, assignee, assigner))

    await db.flush()  # assign task ids

    recipients: list[tuple[Notification, User]] = []
    for task, assignee, assigner in created:
        n = Notification(
            type="task_created",
            actor_id=assigner.id,
            task_id=task.id,
            message=f'{assigner.name} assigned you "{task.title}"',
        )
        db.add(n)
        recipients.append((n, assignee))
    await db.flush()
    for n, assignee in recipients:
        db.add(NotificationRecipient(notification_id=n.id, user_id=assignee.id))

    await db.commit()
