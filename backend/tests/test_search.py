"""FR-80/66: partial post title search keeps the feed's visibility rule and cursor."""
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import uuid4
os.environ['DATABASE_URL']='postgresql+psycopg://test:test@localhost/test'
os.environ['MODERATION_ENABLED']='false'
os.environ['IMAGE_PROCESSING_ENABLED']='false'
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from auth import get_optional_profile
from database import get_db
from main import app
from models import Post, Profile, Space
from posts.routes import encode_cursor
from search import search_posts, title_matches

class SearchTests(unittest.TestCase):
    def setUp(self):
        self.user=Profile(id=uuid4(),username='tester',email='tester@txstate.edu',email_verified_at=datetime.now(timezone.utc))
        self.post=Post(id=uuid4(),space_id=uuid4(),author_id=self.user.id,title='Calculus tutoring',body=None,type='text',status='approved',created_at=datetime.now(timezone.utc),like_count=0,comment_count=0)
        self.db=Mock(); self.db.scalars.return_value.all.return_value=[]
        self.addCleanup(app.dependency_overrides.clear)

    def sql(self):
        return str(self.db.scalars.call_args.args[0].compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True})).replace('public.', '')

    def test_anonymous_search_sees_only_approved(self):
        search_posts(Response(),q='  calculus  ',cursor=None,limit=20,viewer=None,db=self.db)
        sql=self.sql()
        for clause in ("posts.search_vector @@ to_tsquery('english', 'calculus:*')","posts.title ILIKE","posts.status = 'approved'",
                       'posts.deleted_at IS NULL','spaces.deleted_at IS NULL','posts.created_at DESC, posts.id DESC'):
            self.assertIn(clause,sql)
        self.assertNotIn('OR posts.author_id',sql)
        # Search spans every space; it must not inherit the feed's General-only filter.
        self.assertNotIn("spaces.slug = 'general'",sql)

    def test_partial_words_match_by_prefix_and_substring(self):
        # "calc tut" must find "Calculus tutoring": every word as a prefix, any order.
        sql=str(title_matches('calc tut').compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True}))
        self.assertIn("to_tsquery('english', 'calc:* & tut:*')",sql)
        self.assertIn('posts.title ILIKE',sql)

    def test_operator_characters_cannot_break_the_query(self):
        # to_tsquery raises on stray operators; only letters/digits may reach it.
        sql=str(title_matches('c++ & (calc)!:').compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True}))
        self.assertIn("to_tsquery('english', 'c:* & calc:*')",sql)
        # Symbol-only input skips the word index and falls back to substring search.
        self.assertNotIn('to_tsquery',str(title_matches('&|!():').compile(dialect=postgresql.dialect())))

    def test_like_wildcards_are_matched_literally(self):
        params=title_matches('50%_off').compile(dialect=postgresql.dialect()).params
        self.assertIn('%50\\%\\_off%',params.values())

    def test_author_also_finds_own_pending_posts(self):
        search_posts(Response(),q='calculus',cursor=None,limit=20,viewer=self.user,db=self.db)
        self.assertIn(f"OR posts.author_id = '{self.user.id}'",self.sql())

    def test_cursor_continues_after_last_result(self):
        search_posts(Response(),q='calculus',cursor=encode_cursor(self.post),limit=20,viewer=None,db=self.db)
        self.assertIn('posts.created_at <',self.sql())
        with self.assertRaises(HTTPException): search_posts(Response(),q='calculus',cursor='bad',limit=20,viewer=None,db=self.db)

    def test_blank_and_oversized_queries_rejected(self):
        with self.assertRaises(HTTPException): search_posts(Response(),q='   ',cursor=None,limit=20,viewer=None,db=self.db)
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_optional_profile]=lambda:None
        with TestClient(app) as client:
            for q in ('', 'x'*101):
                with self.subTest(length=len(q)): self.assertEqual(client.get('/search/posts',params={'q':q}).status_code,422)

    def test_results_use_feed_contract(self):
        space=Space(id=self.post.space_id,kind='college',slug='science_engineering',name='College of Science and Engineering')
        rows=[]
        for values in ([self.post],[self.user],[space],[]):
            result=Mock(); result.all.return_value=values; rows.append(result)
        self.db.scalars.side_effect=rows
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_optional_profile]=lambda:None
        with TestClient(app) as client:
            response=client.get('/search/posts',params={'q':'calculus'})
        self.assertEqual(response.status_code,200)
        body=response.json()
        self.assertEqual((body['items'][0]['title'],body['items'][0]['author'],body['next_cursor']),('Calculus tutoring','tester',None))
        self.assertEqual(body['items'][0]['space_name'],space.name)
