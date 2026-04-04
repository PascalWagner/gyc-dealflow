# Feature Registry

Canonical list of every user-facing feature in DealFlow. Each file contains acceptance criteria, QA checklists, and test coverage status.

## How to Use

- **Before shipping a feature change**: Open the relevant feature file, run through the QA checklist
- **Before writing a new test**: Check the "Gaps" column to see what needs coverage
- **When adding a new feature**: Create a new file here and add it to the index

## Feature Index

| Feature | File | Routes | Tests | Status |
|---------|------|--------|-------|--------|
| Authentication | [auth.md](auth.md) | `/login` | 8 smoke, 2 unit | Stable |
| Onboarding | [onboarding.md](onboarding.md) | `/onboarding`, `/app/plan` | QA script | Stable |
| Dashboard | [dashboard.md](dashboard.md) | `/app/dashboard` | 0 | No tests |
| Deal Browser | [deal-browser.md](deal-browser.md) | `/app/deals` | 4 smoke, ~15 unit | Partial |
| Deal Detail | [deal-detail.md](deal-detail.md) | `/deal/[id]` | 4 smoke | Partial |
| Portfolio | [portfolio.md](portfolio.md) | `/app/portfolio` | 0 | No tests |
| Goals | [goals.md](goals.md) | `/app/goals` | 3 unit | Partial |
| Plan | [plan.md](plan.md) | `/app/plan` | 2 unit, QA script | Partial |
| Settings | [settings.md](settings.md) | `/app/settings` | QA script | Partial |
| Saved Deals | [saved-deals.md](saved-deals.md) | `/app/saved` | 5 smoke | Partial |
| Academy | [academy.md](academy.md) | `/app/academy`, `/app/resources`, `/app/office-hours` | 0 | No tests |
| Market Intel | [market-intel.md](market-intel.md) | `/app/market-intel` | 0 | No tests |
| Tax Prep | [tax-prep.md](tax-prep.md) | `/app/tax-prep` | 0 | No tests |
| Income Fund | [income-fund.md](income-fund.md) | `/app/income-fund` | 0 | No tests |
| GP Onboarding | [gp-onboarding.md](gp-onboarding.md) | `/gp-onboarding` | 0 | No tests |
| GP Dashboard | [gp-dashboard.md](gp-dashboard.md) | `/gp-dashboard` | 0 | No tests |
| Admin | [admin.md](admin.md) | `/app/admin`, `/app/admin/manage` | 3 smoke | Partial |
| Public Landing | [public-landing.md](public-landing.md) | `/landing` | 0 | No tests |
| Deal Review | [deal-review.md](deal-review.md) | `/deal-review` | 4 smoke (existing) + 4 smoke (new) + 5 unit | Partial |
| Deal Enrichment | [deal-enrichment.md](deal-enrichment.md) | API-only | 6 unit | Partial |
| **Infrastructure** | [infrastructure.md](infrastructure.md) | `api/` + `src/lib/` shared | **21 unit + 14 compat + 4 smoke** | **Active** |
