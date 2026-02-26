#!/usr/bin/env python3
"""
GCC Demo Business Events Injector — Phase 4
=============================================
Sends synthetic gen_ai.* business events to Dynatrace GRAIL to populate
the Business Impact, User Feedback, and Guardrail pages in GCC.

Event types produced:
  - gen_ai.business_outcome  (Phase 4.1) — links AI calls to business results
  - gen_ai.user_feedback     (Phase 4.2) — thumbs up/down + CSAT ratings
  - gen_ai.guardrail_triggered (Phase 4.4) — PII / prompt injection / hallucination guards

Usage:
    # Export your API token first:
    export DT_API_TOKEN="dt0c01.xxx..."
    export DT_ENVIRONMENT="guu84124"  # or full URL

    python scripts/send_demo_bizevents.py --count 50 --dry-run
    python scripts/send_demo_bizevents.py --count 200

Config via env vars (see .env.example for reference):
    DT_API_TOKEN      Required. Token with bizevents:ingest scope.
    DT_ENVIRONMENT    Required. Either env ID (abc12345) or full URL.
    DT_COUNT          Optional. Number of events per type (default: 100).
    DT_DRY_RUN        Optional. Set to "1" to print events without sending.
"""

import json
import os
import random
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

# ── Try requests, fallback guidance ──────────────────────────────────────────
try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ── Config ───────────────────────────────────────────────────────────────────

DT_ENV = os.environ.get("DT_ENVIRONMENT", "").strip().rstrip("/")
DT_TOKEN = os.environ.get("DT_API_TOKEN", "").strip()
EVENT_COUNT = int(os.environ.get("DT_COUNT", "100"))
DRY_RUN = os.environ.get("DT_DRY_RUN", "0").strip() in ("1", "true", "yes")

import argparse

ap = argparse.ArgumentParser(description="GCC Phase 4 bizevent injector")
ap.add_argument("--count", type=int, default=EVENT_COUNT, help="Events per category")
ap.add_argument("--dry-run", action="store_true", default=DRY_RUN, help="Print events, do not send")
ap.add_argument("--env", default=DT_ENV, help="Dynatrace environment ID or full URL")
ap.add_argument("--token", default=DT_TOKEN, help="API token with bizevents:ingest scope")
args = ap.parse_args()

DT_ENV = args.env
DT_TOKEN = args.token
EVENT_COUNT = args.count
DRY_RUN = args.dry_run

if not DRY_RUN:
    if not DT_ENV:
        print("ERROR: DT_ENVIRONMENT not set. Use --env or export DT_ENVIRONMENT=<env-id>")
        sys.exit(1)
    if not DT_TOKEN:
        print("ERROR: DT_API_TOKEN not set. Use --token or export DT_API_TOKEN=<token>")
        sys.exit(1)

# Build base URL
if DT_ENV.startswith("http"):
    BASE_URL = DT_ENV
else:
    BASE_URL = f"https://{DT_ENV}.live.dynatrace.com"

INGEST_URL = f"{BASE_URL}/api/v2/bizevents/ingest"

# ── Demo data pools ──────────────────────────────────────────────────────────

SERVICES = ["travel-advisor", "booking-agent", "support-bot", "recommendation-engine", "content-writer"]
USERS = [f"user-{i:04d}" for i in range(1, 200)]
PROVIDERS = ["azure_openai", "azure_openai", "azure_openai", "openai", "anthropic"]  # weighted toward Azure
MODELS = ["gpt-4o-mini-2024-07-18", "gpt-4o-mini-2024-07-18", "gpt-4-turbo", "claude-3-haiku", "gpt-4o"]
SESSIONS = [str(uuid.uuid4()) for _ in range(50)]

BUSINESS_OUTCOMES = [
    ("booking_completed",    "high",   True,   lambda: round(random.uniform(45, 850), 2)),
    ("booking_abandoned",    "medium", False,  lambda: 0.0),
    ("lead_captured",        "high",   True,   lambda: round(random.uniform(10, 120), 2)),
    ("support_resolved",     "high",   True,   lambda: 0.0),
    ("support_escalated",    "low",    False,  lambda: 0.0),
    ("recommendation_clicked", "medium", True, lambda: round(random.uniform(5, 60), 2)),
    ("search_completed",     "low",    True,   lambda: 0.0),
    ("content_generated",    "medium", True,   lambda: 0.0),
]

GUARDRAIL_TYPES = [
    ("pii_detected",           "critical", "PII content (credit card / email) detected in AI response — redacted"),
    ("prompt_injection",       "high",     "Prompt injection attempt detected — request blocked"),
    ("hallucination_detected", "medium",   "AI response flagged as potential hallucination — confidence < 0.4"),
    ("toxicity_detected",      "high",     "Toxic content detected in user prompt — request rejected"),
    ("rate_limit_exceeded",    "low",      "Provider rate limit hit — request queued for retry"),
    ("off_topic_request",      "low",      "User query outside allowed topic scope — deflected to human agent"),
    ("data_leak_prevention",   "critical", "Potential sensitive data leak detected — response filtered"),
]

GUARDRAIL_ACTIONS = ["blocked", "redacted", "escalated", "queued", "logged"]

def rand_ts(lookback_hours: int = 24) -> str:
    """ISO-8601 timestamp within the past N hours."""
    offset = random.uniform(0, lookback_hours * 3600)
    t = datetime.now(timezone.utc) - timedelta(seconds=offset)
    return t.isoformat()

def rand_latency() -> int:
    """Realistic LLM latency in ms."""
    return int(random.lognormvariate(7.5, 0.8))  # ~1.8 seconds mean

def rand_tokens() -> tuple[int, int]:
    """Realistic prompt + completion token counts."""
    prompt = random.randint(50, 2000)
    completion = random.randint(50, 800)
    return prompt, completion

# ── Event builders ───────────────────────────────────────────────────────────

def build_business_outcome_events(n: int) -> list[dict]:
    events = []
    for _ in range(n):
        service = random.choice(SERVICES)
        outcome, confidence, success, revenue_fn = random.choice(BUSINESS_OUTCOMES)
        prompt_tokens, completion_tokens = rand_tokens()
        model = random.choice(MODELS)
        provider = random.choice(PROVIDERS)
        session = random.choice(SESSIONS)

        e: dict[str, Any] = {
            "eventType": "gen_ai.business_outcome",
            "title": f"AI assisted: {outcome.replace('_', ' ').title()}",
            # Standard open-telemetry gen_ai attributes
            "gen_ai.service.name": service,
            "gen_ai.request.model": model,
            "gen_ai.provider.name": provider,
            "gen_ai.usage.prompt_tokens": prompt_tokens,
            "gen_ai.usage.completion_tokens": completion_tokens,
            "gen_ai.usage.total_tokens": prompt_tokens + completion_tokens,
            "gen_ai.session.id": session,
            # Business outcome specific
            "business.outcome.type": outcome,
            "business.outcome.success": success,
            "business.outcome.confidence_score": round(confidence == "high" and random.uniform(0.75, 0.99) or
                                                       confidence == "medium" and random.uniform(0.45, 0.74) or
                                                       random.uniform(0.15, 0.44), 3),
            "business.outcome.revenue_usd": revenue_fn(),
            "business.outcome.latency_ms": rand_latency(),
            "business.outcome.user_id": random.choice(USERS),
            "business.outcome.source": service,
            "timestamp": rand_ts(72),
        }
        events.append(e)
    return events


def build_user_feedback_events(n: int) -> list[dict]:
    events = []
    for _ in range(n):
        service = random.choice(SERVICES)
        model = random.choice(MODELS)
        provider = random.choice(PROVIDERS)
        session = random.choice(SESSIONS)
        prompt_tokens, completion_tokens = rand_tokens()

        # Weighted ratings: most responses are good (4-5 stars)
        rating_weights = [1, 3, 8, 22, 16]  # 1=bad, 5=great
        rating = random.choices([1, 2, 3, 4, 5], weights=rating_weights)[0]
        thumbs = "up" if rating >= 4 else "down"
        csat = round(rating / 5 * 10, 1)

        e: dict[str, Any] = {
            "eventType": "gen_ai.user_feedback",
            "title": f"User feedback: {thumbs} ({rating}/5 stars)",
            "gen_ai.service.name": service,
            "gen_ai.request.model": model,
            "gen_ai.provider.name": provider,
            "gen_ai.usage.prompt_tokens": prompt_tokens,
            "gen_ai.usage.completion_tokens": completion_tokens,
            "gen_ai.session.id": session,
            # Feedback specific
            "feedback.rating": rating,
            "feedback.thumbs": thumbs,
            "feedback.csat_score": csat,
            "feedback.category": random.choice(["accuracy", "helpfulness", "speed", "relevance", "tone"]),
            "feedback.user_id": random.choice(USERS),
            "feedback.response_latency_ms": rand_latency(),
            "feedback.comment_length": random.choice([0, 0, 0, 12, 34, 67, 102, 220]) if random.random() > 0.7 else 0,
            "timestamp": rand_ts(72),
        }
        events.append(e)
    return events


def build_guardrail_events(n: int) -> list[dict]:
    events = []
    for _ in range(n):
        service = random.choice(SERVICES)
        model = random.choice(MODELS)
        provider = random.choice(PROVIDERS)
        session = random.choice(SESSIONS)
        gr_type, severity, description = random.choice(GUARDRAIL_TYPES)

        e: dict[str, Any] = {
            "eventType": "gen_ai.guardrail_triggered",
            "title": f"Guardrail: {gr_type.replace('_', ' ').title()}",
            "gen_ai.service.name": service,
            "gen_ai.request.model": model,
            "gen_ai.provider.name": provider,
            "gen_ai.session.id": session,
            # Guardrail specific
            "guardrail.type": gr_type,
            "guardrail.severity": severity,
            "guardrail.description": description,
            "guardrail.action_taken": random.choice(GUARDRAIL_ACTIONS),
            "guardrail.policy_id": f"policy-{random.randint(1000, 9999)}",
            "guardrail.detection_confidence": round(random.uniform(0.60, 0.99), 3),
            "guardrail.user_id": random.choice(USERS),
            "guardrail.latency_overhead_ms": random.randint(1, 45),
            "timestamp": rand_ts(72),
        }
        events.append(e)
    return events


# ── Sender ───────────────────────────────────────────────────────────────────

def send_events(events: list[dict], category: str) -> None:
    if DRY_RUN:
        print(f"\n[DRY RUN] {category}: would send {len(events)} events")
        print(f"  Sample: {json.dumps(events[0], indent=2, default=str)[:400]}...")
        return

    headers = {
        "Authorization": f"Api-Token {DT_TOKEN}",
        "Content-Type": "application/cloudevents+json",
    }

    ok = 0
    fail = 0
    batch_size = 25  # Dynatrace bizevents endpoint accepts arrays

    for i in range(0, len(events), batch_size):
        batch = events[i : i + batch_size]
        try:
            resp = requests.post(INGEST_URL, headers=headers, json=batch, timeout=15)
            if resp.status_code in (200, 202, 204):
                ok += len(batch)
            else:
                fail += len(batch)
                print(f"  WARN [{resp.status_code}]: {resp.text[:200]}")
        except requests.RequestException as exc:
            fail += len(batch)
            print(f"  ERROR: {exc}")

        time.sleep(0.1)  # polite rate limiting

    status = "✓" if fail == 0 else "⚠"
    print(f"  {status} {category}: sent {ok}/{ok+fail} events")


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    banner = "=" * 60
    print(banner)
    print("GCC Phase 4 — Business Event Injector")
    print(f"  Target:  {BASE_URL if not DRY_RUN else '(dry-run mode)'}")
    print(f"  Count:   {EVENT_COUNT} events per category (3 categories)")
    print(f"  Total:   {EVENT_COUNT * 3} events")
    print(f"  Mode:    {'DRY RUN (no data sent)' if DRY_RUN else 'LIVE'}")
    print(banner)

    categories = [
        ("Phase 4.1 — gen_ai.business_outcome", build_business_outcome_events),
        ("Phase 4.2 — gen_ai.user_feedback",     build_user_feedback_events),
        ("Phase 4.4 — gen_ai.guardrail_triggered", build_guardrail_events),
    ]

    for label, builder in categories:
        print(f"\nGenerating {label}...")
        events = builder(EVENT_COUNT)
        send_events(events, label)

    print(f"\n{banner}")
    print("Done. Events will appear in Dynatrace within ~60 seconds.")
    print("DQL to query: fetch bizevents | filter eventType startsWith \"gen_ai.\"")
    print(banner)


if __name__ == "__main__":
    main()
