"""Offline-in-app comparison of a contextual check with the current ForAll rule.

This script calls OpenAI only when --live is passed. It never opens the app
database or changes a post. The worker uses the same candidate rule only when
its separate local experiment setting is explicitly enabled.
"""

import argparse
import json
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from openai import APIError, OpenAI
from pydantic import BaseModel, ValidationError

from moderation import ModerationError, moderate_text
from moderation_context import VIOLENCE_CEILING, ContextAssessment, candidate_blocks, context_check


CASES_PATH = Path(__file__).resolve().parent / "evals" / "context_cases.jsonl"
class Case(BaseModel):
    id: str
    expected: Literal["allow", "block"]
    text: str


def load_cases(path: Path) -> list[Case]:
    cases = [Case.model_validate_json(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = [case.id for case in cases]
    if not cases or len(ids) != len(set(ids)):
        raise ValueError("The evaluation corpus must contain unique cases.")
    return cases


def tally(rows: list[dict], key: str) -> dict[str, int]:
    return {
        "false_blocks": sum(row["expected"] == "allow" and row[key] == "block" for row in rows),
        "harmful_approvals": sum(row["expected"] == "block" and row[key] == "allow" for row in rows),
        "correct": sum(row["expected"] == row[key] for row in rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Allow OpenAI calls; otherwise only validate the corpus")
    parser.add_argument("--model", default="gpt-4o-mini", help="Model used for the contextual check")
    parser.add_argument("--violence-ceiling", type=float, default=VIOLENCE_CEILING,
                        help="Experimental violence ceiling for eligible flags, not a production threshold")
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    args = parser.parse_args()
    if not 0 <= args.violence_ceiling <= 1:
        parser.error("--violence-ceiling must be between 0 and 1")
    cases = load_cases(args.cases)
    print(json.dumps({"cases": len(cases), "allow": sum(c.expected == "allow" for c in cases),
                      "block": sum(c.expected == "block" for c in cases), "live": args.live}), flush=True)
    if not args.live:
        return 0

    load_dotenv(Path(__file__).resolve().with_name(".env"))
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        parser.error("Set OPENAI_API_KEY in backend/.env for live evaluation")
    rows = []
    errors = 0
    with OpenAI(api_key=api_key, timeout=20, max_retries=0) as client:
        for case in cases:
            try:
                first = moderate_text(case.text)
            except ModerationError as error:
                errors += 1
                print(json.dumps({"id": case.id, "error": error.code}), flush=True)
                continue
            context = None
            context_error = False
            try:
                context = context_check(client, args.model, case.text)
            except (APIError, ValidationError, ValueError):
                context_error = True
            if context is None:
                context_error = True
            baseline = "block" if first.blocked else "allow"
            candidate = "block" if candidate_blocks(first, context, args.violence_ceiling) else "allow"
            row = {
                "id": case.id, "expected": case.expected,
                "baseline": baseline, "candidate": candidate,
                "raised": [name for name, value in first.categories.items() if value],
                "violence_score": round(first.category_scores.get("violence", 0), 4),
                "context": context.decision if context else "unavailable",
                "reason_code": context.reason_code if context else None,
                "context_error": context_error,
            }
            rows.append(row)
            print(json.dumps(row), flush=True)
    print(json.dumps({"summary": {"evaluated": len(rows), "moderation_errors": errors,
        "context_errors": sum(row["context_error"] for row in rows),
        "baseline": tally(rows, "baseline"), "candidate": tally(rows, "candidate")}}), flush=True)
    return 1 if errors or any(row["context_error"] for row in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
