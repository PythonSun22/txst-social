"""FR-90–92: context overrides stay within the experimental category gates."""

import unittest

from moderation import TextModerationResult
from moderation_context import VIOLENCE_CEILING, ContextAssessment, candidate_blocks, should_recheck
from moderation_context_eval import load_cases, CASES_PATH


def first_result(flags: dict[str, bool], scores: dict[str, float], flagged=True):
    return TextModerationResult(flagged=flagged, categories=flags,
                                category_scores=scores, model="test", latency_ms=1)


class ContextEvaluationTests(unittest.TestCase):
    def test_corpus_labels_are_balanced_and_unique(self):
        cases = load_cases(CASES_PATH)
        self.assertEqual(len(cases), 20)
        self.assertEqual(sum(case.expected == "allow" for case in cases), 10)
        self.assertEqual(sum(case.expected == "block" for case in cases), 10)

    def test_lone_lower_score_violence_can_be_overridden(self):
        allow = ContextAssessment(decision="allow", reason_code="media_reference")
        lower = first_result({"violence": True}, {"violence": 0.42})
        self.assertFalse(candidate_blocks(lower, allow, 0.5))
        self.assertTrue(candidate_blocks(lower, None, 0.5))
        self.assertTrue(candidate_blocks(lower, ContextAssessment(decision="uncertain", reason_code="unclear"), 0.5))
        self.assertTrue(candidate_blocks(lower, ContextAssessment(decision="block", reason_code="real_world_threat"), 0.5))
        self.assertTrue(candidate_blocks(first_result({"violence": True}, {"violence": 0.5}), allow, 0.5))
        self.assertTrue(candidate_blocks(first_result({"violence": True, "harassment/threatening": True},
                                                      {"violence": 0.42, "harassment/threatening": 0.2}), allow, 0.5))
        self.assertTrue(candidate_blocks(first_result({"violence": False}, {"violence": 0.42}), allow, 0.5))

    def test_unflagged_post_keeps_current_approval(self):
        first = first_result({"violence": False}, {"violence": 0.01}, flagged=False)
        self.assertFalse(candidate_blocks(first, None, 0.5))

    def test_past_incident_is_required_for_combined_violence_and_harassment(self):
        combined = first_result({"violence": True, "harassment": True},
                                {"violence": 0.426, "harassment": 0.568})
        past = ContextAssessment(decision="allow", reason_code="past_incident")
        generic = ContextAssessment(decision="allow", reason_code="other")
        self.assertTrue(should_recheck(combined))
        self.assertFalse(candidate_blocks(combined, past))
        self.assertTrue(candidate_blocks(combined, generic))
        self.assertTrue(candidate_blocks(combined, None))
        self.assertTrue(candidate_blocks(combined, ContextAssessment(
            decision="block", reason_code="targeted_abuse")))
        self.assertFalse(should_recheck(first_result(
            {"violence": True, "harassment": True},
            {"violence": 0.426, "harassment": 0.65})))
        self.assertTrue(candidate_blocks(first_result(
            {"violence": True, "harassment": True, "hate": True},
            {"violence": 0.426, "harassment": 0.568, "hate": 0.1}), past))

    def test_animal_context_can_clear_only_eligible_violence_signals(self):
        animal = ContextAssessment(decision="allow", reason_code="animal_context")
        lone = first_result({"violence": True}, {"violence": 0.524})
        combined = first_result({"violence": True, "harassment": True},
                                {"violence": 0.451, "harassment": 0.523})
        self.assertTrue(should_recheck(lone))
        self.assertFalse(candidate_blocks(lone, animal))
        self.assertFalse(candidate_blocks(combined, animal))
        self.assertTrue(candidate_blocks(combined, ContextAssessment(
            decision="block", reason_code="harm_request")))
        self.assertTrue(candidate_blocks(first_result(
            {"violence": True, "harassment": True, "hate": True},
            {"violence": 0.451, "harassment": 0.523, "hate": 0.1}), animal))
        self.assertTrue(candidate_blocks(first_result(
            {"violence": True}, {"violence": VIOLENCE_CEILING}), animal))
