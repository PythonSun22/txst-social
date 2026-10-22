"""FR-32: rolling upload budgets, boundary behavior and account serialization."""
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import uuid4

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"

from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from images.limits import reserve_upload_slot


class ImageLimitTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
        self.owner = uuid4()
        self.db = Mock()
        self.db.scalar.return_value = self.now

    def check(self, ages):
        self.db.scalars.return_value.all.return_value = sorted(
            self.now - timedelta(seconds=age) for age in ages)
        return reserve_upload_slot(self.db, self.owner)

    def test_tenth_upload_allowed_but_eleventh_waits_for_oldest_minute_slot(self):
        self.assertEqual(self.check([10] * 9), self.now)
        with self.assertRaises(HTTPException) as caught:
            self.check([10] * 10)
        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(caught.exception.headers["Retry-After"], "50")

    def test_hourly_budget_and_combined_windows_use_longer_wait(self):
        self.assertEqual(self.check([120] * 39), self.now)
        for ages in ([120] * 40, [120] * 30 + [10] * 10):
            with self.subTest(ages=ages), self.assertRaises(HTTPException) as caught:
                self.check(ages)
            self.assertEqual(caught.exception.headers["Retry-After"], "3480")

    def test_expired_slots_are_available_at_exact_boundary(self):
        self.assertEqual(self.check([60] * 10), self.now)
        self.assertEqual(self.check([3600] * 40), self.now)

    def test_lock_and_history_are_owner_scoped_and_include_all_reservations(self):
        self.check([])
        lock = self.db.execute.call_args.args[0]
        history = self.db.scalars.call_args.args[0]
        sql = str(history.compile(dialect=postgresql.dialect()))
        self.assertIn("FOR UPDATE", str(lock))
        self.assertIn(self.owner, lock.compile().params.values())
        self.assertIn(self.owner, history.compile().params.values())
        self.assertIn("image_uploads.created_at >", sql)
        for ignored in ("deleted_at", "uploaded_at", "purpose", "processing_status", "image_variants"):
            self.assertNotIn(ignored, sql)
        self.assertEqual(self.db.method_calls[0][0], "execute")
        self.db.commit.assert_not_called()  # Caller commits reservation and releases lock together.
