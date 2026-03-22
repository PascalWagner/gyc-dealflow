#!/usr/bin/env python3
"""Classify blank-strategy deals into one of 5 valid strategies."""
import json, requests, re, sys

SUPABASE_URL = "https://nntzqyufmtypfjpusflm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

VALID = ["Lending", "Buy & Hold", "Value-Add", "Distressed", "Development"]

# Keywords for classification (checked against investment_strategy + investment_name)
LENDING_KW = [
    r'\blend\w*\b', r'\bdebt fund\b', r'\bcredit\b', r'\bnote\b', r'\bmortgage\b',
    r'\btrust deed\b', r'\bpromissory\b', r'\bbridge loan\b', r'\bhard money\b',
    r'\blife settl\w+\b', r'\breceivable\b', r'\bsecured income\b', r'\binterest return\b',
    r'\bprivate credit\b', r'\bfixed.?income\b', r'\bincome fund\b',
    r'\bshort.?term note\b', r'\bcapital preservation\b',
]
DEVELOPMENT_KW = [
    r'\bdevelop\w*\b', r'\bground.?up\b', r'\bnew construct\w*\b', r'\bbuild\b',
    r'\bentitle\w*\b', r'\bshovel.?ready\b', r'\bconstruct\w+\b',
    r'\bnewly built\b', r'\bnewly constructed\b',
]
DISTRESSED_KW = [
    r'\bdistress\w*\b', r'\bturnaround\b', r'\bforeclos\w*\b', r'\bdiscount\w*\b',
    r'\bnon.?performing\b', r'\bworkout\b', r'\bbelow.?market\b',
    r'\boff.?market.*discount\b', r'\bdeep discount\b',
]
VALUE_ADD_KW = [
    r'\bvalue.?add\b', r'\brenovati\w+\b', r'\brehab\b', r'\bupgrad\w+\b',
    r'\brepositio\w+\b', r'\bimprov\w+\b', r'\bcapex\b', r'\bcapital improve\w*\b',
    r'\benhance\b', r'\bmoderniz\w+\b', r'\bupfit\w*\b', r'\brent increase\b',
    r'\brents? grow\w*\b', r'\bboost\w* rent\w*\b',
]
BUY_HOLD_KW = [
    r'\bbuy.?and.?hold\b', r'\bstabiliz\w+\b', r'\bcash.?flow\b', r'\bsteady income\b',
    r'\bincome.?generat\w+\b', r'\bmonthly.?distribut\w+\b', r'\bquarterly.?distribut\w+\b',
    r'\bpassive income\b', r'\bNNN\b', r'\btriple net\b', r'\bnet lease\b',
    r'\bDST\b', r'\ball.?cash\b', r'\bno debt\b',
]


def score(text, keywords):
    """Count keyword matches in text."""
    total = 0
    for kw in keywords:
        total += len(re.findall(kw, text, re.IGNORECASE))
    return total


def classify(deal):
    """Classify a deal into one of 5 strategies."""
    name = deal.get("investment_name") or ""
    inv_strat = deal.get("investment_strategy") or ""
    ac = deal.get("asset_class") or ""
    inst = deal.get("instrument") or ""
    text = f"{name} {inv_strat}"

    # Hard rules first
    if ac == "Lending":
        return "Lending"
    if inst == "Debt":
        return "Lending"

    # Score each strategy
    scores = {
        "Lending": score(text, LENDING_KW),
        "Development": score(text, DEVELOPMENT_KW),
        "Distressed": score(text, DISTRESSED_KW),
        "Value-Add": score(text, VALUE_ADD_KW),
        "Buy & Hold": score(text, BUY_HOLD_KW),
    }

    # Boost: if investment_strategy mentions "value-add" explicitly, strong signal
    if re.search(r'\bvalue.?add\b', text, re.IGNORECASE):
        scores["Value-Add"] += 3

    max_score = max(scores.values())
    if max_score == 0:
        # No keyword matches — use asset class heuristic
        if ac in ("NNN", "Oil & Gas / Energy"):
            return "Buy & Hold"
        # Default: Value-Add (most common for MF, Industrial, etc.)
        return "Value-Add"

    # Return highest scoring strategy
    winner = max(scores, key=scores.get)
    return winner


def fetch_deals():
    """Fetch all deals with blank strategy."""
    url = f"{SUPABASE_URL}/rest/v1/opportunities"
    params = {
        "select": "id,investment_name,asset_class,instrument,investment_strategy",
        "strategy": "eq.",
        "limit": "1000",
    }
    resp = requests.get(url, headers=HEADERS, params=params)
    resp.raise_for_status()
    return resp.json()


def update_deal(deal_id, strategy):
    """Update a single deal's strategy."""
    url = f"{SUPABASE_URL}/rest/v1/opportunities?id=eq.{deal_id}"
    resp = requests.patch(url, headers=HEADERS, json={"strategy": strategy})
    resp.raise_for_status()


def main():
    dry_run = "--dry-run" in sys.argv
    deals = fetch_deals()
    print(f"Found {len(deals)} deals with blank strategy")

    from collections import Counter
    assignments = Counter()
    updates = []

    for d in deals:
        strat = classify(d)
        assignments[strat] += 1
        updates.append((d["id"], d["investment_name"], strat))

    print("\nClassification summary:")
    for s, c in assignments.most_common():
        print(f"  {c:4d}  {s}")

    if dry_run:
        print("\n--- DRY RUN (showing first 20) ---")
        for uid, name, strat in updates[:20]:
            print(f"  [{strat:15s}] {name[:80]}")
        return

    print(f"\nApplying {len(updates)} updates...")
    for i, (uid, name, strat) in enumerate(updates):
        update_deal(uid, strat)
        if (i + 1) % 50 == 0:
            print(f"  ...{i+1}/{len(updates)}")

    print("Done!")

    # Verify
    remaining = fetch_deals()
    print(f"Remaining deals with blank strategy: {len(remaining)}")


if __name__ == "__main__":
    main()
