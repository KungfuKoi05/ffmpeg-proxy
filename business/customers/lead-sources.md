# Lead Sources

The funnel needs ~625 prospects to reach 8 customers at assumed rates
(`analytics/acquisition-model.md`). `leads.csv` holds 28 verified starters. These are the free,
public sources that extend it to 625 — no purchased database, no scraping behind logins.

## Verification status — read before sending

Every company in `leads.csv` was sourced from public search results that named the firm, its market,
and its website. **None was independently fetched and confirmed from this environment** — outbound
access to those domains is blocked here, so the sites could not be opened.

That means: the companies are real and the URLs are as published, but **the founder must open each
site before sending** to confirm it is live, find the owner's name, and check the portfolio size. That
check is required work regardless — the personalization it produces is what makes the sequence work.
Do not send to a row that does not open.

## Verified directories

| Source | Coverage | Notes |
|---|---|---|
| [HOA-USA state directories](https://hoa-usa.com/north-carolina-hoa-management-companies/) | All 50 states | Free listings of management companies; swap the state in the URL |
| [HOAmanagement.com city directories](https://www.hoamanagement.com/city/atlanta/) | Major metros | Searchable by city; swap the city in the URL |
| [HOA Management Companies by state](https://hoamanagementcompanies.net/hoa-management-companies-in-colorado) | State lists | Long-tail firms the bigger directories miss |
| [Florida DBPR CAM license lookup](https://www.myfloridalicense.com/wl11.asp) | Florida | Community association managers are **state-licensed** in FL — a public, authoritative roster |
| CAI local chapters | National | The Suncoast chapter alone lists ~230 managers and management companies [FACT: https://www.avidxchange.com/blog/2026-community-manager-trends/] |

## Priority order

**Tier A — independent, owner-operated, 15–75 associations.** The owner answers their own email and
can say yes without asking anyone. Start here and stay here until the offer is proven.

**Tier B — regional firms, 75–300 associations.** Bigger prize, slower decision, often has existing
software. Approach after Tier A produces a reference customer.

**Tier C — national enterprises** (Associa, FirstService Residential, RealManage, Inframark).
Procurement, vendor onboarding, security review. Correct to include for completeness, wrong to
contact now. Leave them until there is a case study and a signed reference.

## Best geographies

Highest association density, and the two states with public licensing rosters:

1. **Florida** — enormous HOA density, public CAM license lookup, two-party consent (address recording consent up front)
2. **Arizona** — high density, many independent firms
3. **Georgia** — the Atlanta metro has an unusually deep bench of owner-operated firms
4. **North Carolina** — Charlotte and the Triangle, several strong independents
5. **Colorado, Nevada, Texas** — solid secondary markets

## Qualification, before a message is sent

1. Does the site indicate **15+ associations** managed? (Below that, deal size is too small.)
2. Is there a **named owner or principal**? (Personalization triples reply rates — this is the work.)
3. Is it **independently owned** rather than a national brand office?
4. Does the site mention board meetings, minutes, or board support? (A hook to open with.)

## Rules

- Every row must be a real business with a working URL. **Never invent a company, a name, or an
  email address.** One fabricated lead means a real person receives a message built on a lie.
- Take contact details only from the company's own public contact page.
- No email-guessing tools, no purchased lists, no scraping behind a login.
- Log every send in `data/pipeline.json` the same day, then run `node tools/kpi.js`.
