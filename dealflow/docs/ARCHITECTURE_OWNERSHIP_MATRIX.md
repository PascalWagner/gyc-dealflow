# Architecture Ownership Matrix

This document defines the intended source of truth for the core user and deal
domains in Dealflow. The goal is to eliminate ambiguous ownership between
Supabase, GHL, and browser persistence.

## Core rule

- Supabase is the canonical source of truth for application state.
- GHL is a downstream CRM mirror, except for truly external-authoritative
  membership/billing events that originate outside the app.
- Browser storage is cache only. It may accelerate rendering, but it must not
  be treated as authoritative state.

## Domain ownership

### Identity and profile

- Canonical owner: `user_profiles`
- Allowed fields:
  - `full_name`
  - `phone`
  - `location`
  - `avatar_url`
  - privacy flags
  - investor-profile fields
- GHL mirror only:
  - contact linkage
  - tier/membership snapshot
  - academy dates
  - billing snapshot fields

### Goals

- Canonical owner: `user_goals`
- Allowed fields:
  - income goal
  - tax goal
  - growth goal
  - current baseline values
  - capital goal inputs that are part of the goal model
- Not allowed:
  - direct ownership by `user_buy_box`
  - direct ownership by browser cache
  - silent mutation from analytics/event pipelines like `goals_complete`

### Buy box / matching preferences

- Canonical owner: `user_buy_box`
- Allowed fields:
  - asset classes
  - strategies
  - distributions
  - deal types
  - lockup
  - accreditation
  - diversification preferences
  - operator focus
  - matching-only filters
- Not allowed:
  - duplicating goal targets as editable source fields
  - acting as the primary onboarding state sink for everything

### Portfolio plan

- Canonical owner: `user_portfolio_plans`
- Allowed fields:
  - generated plan buckets
  - generated target output
  - plan metadata / provenance
- Rule:
  - plans are derived from user state
  - plans should not be mirrored back into goals or buy-box tables

### Deal stages / pipeline

- Canonical owner: `user_deal_stages`
- Rule:
  - one stage vocabulary only
  - APIs, UI stores, analytics, and GP views must all use the same enum

### Sponsor relationships

- Canonical owner: `deal_sponsors`
- Transitional support:
  - `opportunities.management_company_id` may exist for legacy compatibility
  - it should be treated as a legacy/derived primary sponsor pointer, not the
    long-term source of truth

### Event stream

- Canonical owner: `user_events`
- Rule:
  - event writes must require verified user identity
  - analytics side effects must never be allowed to mutate another user's state
    via email alone
  - onboarding/analytics events may feed CRM tags or metrics, but must not
    become a second write path into canonical state tables

## GHL rules

- GHL receives mirrored fields from Supabase-owned state.
- GHL webhooks may update app state only for external-authoritative workflows,
  such as subscription/billing events.
- GHL must not be a co-equal writer for app-owned goals, buy box, or plan data.

## Browser persistence rules

- Local storage / IndexedDB may cache:
  - hydrated user bundle
  - UI state
  - workspace state
  - optimistic local projections
- Browser persistence must not be the only copy of:
  - goals
  - buy box
  - plan
  - profile
  - stages
- All persisted keys should be user-scoped by email or user ID.

## Immediate cleanup implications

1. Remove or deprecate cross-sync from `user_goals` into `user_buy_box`.
2. Stop trusting caller-supplied email when mutating user-owned resources.
3. Normalize one canonical stage vocabulary and remove compatibility branches.
4. Move sponsor analytics and write paths onto `deal_sponsors`.
5. Treat browser state restore as cache hydration, not ownership restoration.
