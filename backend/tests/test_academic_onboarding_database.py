"""First-time academic setup and college membership on a disposable local DB."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi import HTTPException, Response
from sqlalchemy import func, select, text

from models import Follow, Major, Profile, Space
from profiles.routes import choose_username, complete_academic_setup, update_current_profile
from profiles.schemas import AcademicSetup, ProfileUpdate, UsernameChoice
from spaces.routes import change_follow
from test_moderation_database import ImageDatabaseFixture


class AcademicOnboardingDatabaseTests(ImageDatabaseFixture):
    def setUp(self):
        super().setUp()
        with self.sessions() as db:
            self.assertIsNone(db.get(Profile, self.owner).academic_setup_completed_at)
            choose_username(UsernameChoice(username=f"user_{self.owner.hex[:12]}"), Response(), db.get(Profile, self.owner), db)
            major = db.scalar(select(Major).where(Major.active.is_(True)).order_by(Major.sort_order))
            self.payload = AcademicSetup(home_college_id=major.college_id, major_id=major.id, student_level="sophomore")
            self.slug = db.get(Space, major.college_id).slug

    def complete(self):
        with self.sessions() as db:
            return complete_academic_setup(self.payload, Response(), db.get(Profile, self.owner), db)

    def test_setup_saves_academics_and_one_counted_membership(self):
        result = self.complete()
        self.assertTrue(result.academic_setup_completed)
        self.assertEqual(result.home_college_id, self.payload.home_college_id)
        self.assertEqual(result.major_id, self.payload.major_id)
        self.assertEqual(result.student_level, "sophomore")
        self.assertEqual(result.followed_space_count, 1)
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            self.assertEqual(profile.major, db.get(Major, self.payload.major_id).name)
            self.assertEqual(profile.student_level, "sophomore")
            self.assertIsNotNone(profile.academic_setup_completed_at)
            self.assertIsNotNone(db.get(Follow, (self.owner, self.payload.home_college_id)))
            self.assertEqual(db.get(Space, self.payload.home_college_id).follower_count, 1)

    def test_concurrent_setup_and_retries_join_only_once(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.complete(), range(2)))
        self.assertTrue(all(result.academic_setup_completed for result in results))
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Follow).where(Follow.user_id == self.owner)), 1)
            self.assertEqual(db.get(Space, self.payload.home_college_id).follower_count, 1)
        with self.sessions() as db:
            change_follow(self.slug, False, db.get(Profile, self.owner), Response(), db)
        self.assertEqual(self.complete().followed_space_count, 0)

    def test_invalid_major_does_not_save_selections_or_join(self):
        with self.sessions() as db:
            with self.assertRaises(HTTPException) as caught:
                complete_academic_setup(AcademicSetup(home_college_id=self.payload.home_college_id, major_id=uuid4(), student_level="sophomore"),
                    Response(), db.get(Profile, self.owner), db)
            self.assertEqual(caught.exception.status_code, 422)
            db.rollback()
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            self.assertIsNone(profile.home_college_id)
            self.assertIsNone(profile.major_id)
            self.assertIsNone(profile.student_level)
            self.assertIsNone(profile.academic_setup_completed_at)
            self.assertIsNone(db.get(Follow, (self.owner, self.payload.home_college_id)))

    def test_membership_failure_rolls_back_profile_and_completion(self):
        # A database rejection must leave the entire final signup step undone.
        with self.sessions() as db:
            db.execute(text("""create function public.reject_test_follow() returns trigger language plpgsql as
                $$ begin raise exception 'test follow failure'; end $$;
                create trigger reject_test_follow before insert on public.follows
                for each row execute function public.reject_test_follow();"""))
            from sqlalchemy.exc import DBAPIError
            with self.assertRaises(DBAPIError):
                complete_academic_setup(self.payload, Response(), db.get(Profile, self.owner), db)
            # This also removes the uncommitted test function and trigger.
            db.rollback()
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            self.assertIsNone(profile.home_college_id)
            self.assertIsNone(profile.major_id)
            self.assertIsNone(profile.student_level)
            self.assertIsNone(profile.academic_setup_completed_at)

    def test_later_profile_edits_keep_setup_complete_and_membership_independent(self):
        self.complete()
        with self.sessions() as db:
            major = db.scalar(select(Major).where(Major.active.is_(True), Major.college_id != self.payload.home_college_id))
            profile = db.get(Profile, self.owner)
            completed_at = profile.academic_setup_completed_at
            result = update_current_profile(ProfileUpdate(home_college_id=major.college_id, major_id=major.id, student_level="junior"), Response(), profile, db)
            self.assertEqual(result.major_id, major.id)
            self.assertEqual(result.student_level, "junior")
            self.assertTrue(result.academic_setup_completed)
            self.assertEqual(profile.academic_setup_completed_at, completed_at)
            self.assertIsNotNone(db.get(Follow, (self.owner, self.payload.home_college_id)))
            self.assertIsNone(db.get(Follow, (self.owner, major.college_id)))
