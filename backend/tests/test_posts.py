"""FR-30/32/50/60/90/95: post validation, visibility and transactional writes."""
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import uuid4
os.environ['DATABASE_URL']='postgresql+psycopg://test:test@localhost/test'
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from auth import get_authenticated_user_id
from database import get_db
from main import app
from models import Ban, ImageUpload, Post, PostLike, Profile, Space
from post_schemas import PostCreate
from posts import create_post, decode_cursor, delete_own_post, encode_cursor, list_posts, serialize_posts, set_like

class PostTests(unittest.TestCase):
    def setUp(self):
        self.user=Profile(id=uuid4(),username='tester',email='tester@txstate.edu',email_verified_at=datetime.now(timezone.utc))
        self.space=Space(id=uuid4(),kind='campus',slug='general',name='General')
        self.post=Post(id=uuid4(),space_id=self.space.id,author_id=self.user.id,title='Test',body='Body',type='text',status='pending',created_at=datetime.now(timezone.utc),like_count=0,comment_count=0)
        self.db=Mock(); self.db.get.return_value=None; self.db.scalar.return_value=self.post
        self.db.scalars.return_value.all.return_value=[]
        self.addCleanup(app.dependency_overrides.clear)

    def test_validation(self):
        for fields in ({'title':' '},{'body':' '},{'author_id':str(uuid4())},{'status':'approved'},{'body':'x'*20001},{'image_ids':[uuid4() for _ in range(11)]}):
            with self.subTest(fields=fields),self.assertRaises(ValidationError):
                PostCreate(submission_id=uuid4(),**{'title':'Title','body':'Body',**fields})
        uid=uuid4()
        with self.assertRaises(ValidationError): PostCreate(submission_id=uuid4(),title='T',image_ids=[uid,uid])
        self.assertIsNone(PostCreate(submission_id=uuid4(),title='T',image_ids=[uid]).body)

    def test_anonymous_feed_visibility_and_order(self):
        self.assertEqual(list_posts(Response(),cursor=None,limit=20,viewer=None,db=self.db).items,[])
        sql=str(self.db.scalars.call_args.args[0].compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True})).replace('public.', '')
        for clause in ("posts.status = 'approved'",'posts.deleted_at IS NULL',"spaces.slug = 'general'",'posts.created_at DESC, posts.id DESC'): self.assertIn(clause,sql)
        self.assertNotIn('OR posts.author_id',sql)

    def test_owner_feed_visibility(self):
        list_posts(Response(),cursor=None,limit=20,viewer=self.user,db=self.db)
        sql=str(self.db.scalars.call_args.args[0].compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True})).replace('public.', '')
        self.assertIn(f"OR posts.author_id = '{self.user.id}'",sql)

    def test_cursor(self):
        self.assertEqual(decode_cursor(encode_cursor(self.post)),(self.post.created_at,self.post.id))
        for value in ('bad','%%%%',''):
            with self.assertRaises(HTTPException): decode_cursor(value)

    def test_delete_permission_in_response(self):
        # FR-34: display names are not identities; only verified authors get the control.
        for viewer, expected in ((self.user, True), (None, False),
                                 (Profile(id=uuid4(), email_verified_at=self.user.email_verified_at), False),
                                 (Profile(id=self.user.id), False)):
            with self.subTest(expected=expected, viewer=viewer):
                self.assertEqual(serialize_posts(self.db, [self.post], viewer)[0].can_delete, expected)

    def test_soft_delete_text_and_image(self):
        # FR-34/32: retain the post and reusable media, decrement the space count once.
        for kind in ('text', 'image', 'link'):
            with self.subTest(kind=kind):
                self.db.reset_mock()
                self.post.type = kind
                self.post.deleted_at = None
                response = delete_own_post(self.post.id, self.user, self.db)
                self.assertEqual(response.status_code, 204)
                self.assertEqual(response.body, b'')
                self.assertIsNotNone(self.post.deleted_at.tzinfo)
                query = self.db.scalar.call_args.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={'literal_binds': True})
                for clause in (str(self.user.id), 'posts.author_id =', 'posts.deleted_at IS NULL', 'FOR UPDATE'):
                    self.assertIn(clause, str(query))
                self.db.execute.assert_called_once()
                self.db.commit.assert_called_once()
                self.db.delete.assert_not_called()

    def test_delete_missing_other_author_or_already_deleted(self):
        self.db.scalar.return_value = None
        with self.assertRaises(HTTPException) as error:
            delete_own_post(self.post.id, self.user, self.db)
        self.assertEqual(error.exception.status_code, 404)
        self.db.execute.assert_not_called()
        self.db.commit.assert_not_called()

    def test_anonymous_writes(self):
        app.dependency_overrides[get_db]=lambda:self.db
        with TestClient(app) as client:
            self.assertEqual(client.delete(f'/posts/{self.post.id}').status_code,401)
            self.assertEqual(client.post('/posts',json={'title':'T','body':'B','submission_id':str(uuid4())}).status_code,401)
            for method in ('put','delete'): self.assertEqual(getattr(client,method)(f'/posts/{self.post.id}/like').status_code,401)
        self.db.add.assert_not_called()

    def test_delete_http_uses_authenticated_author_only(self):
        # FR-34: another account cannot impersonate the owner through request data.
        app.dependency_overrides[get_db] = lambda: self.db
        other = Profile(id=uuid4(), username='other', email='other@txstate.edu',
                        email_verified_at=datetime.now(timezone.utc))

        def select_owned_post(query):
            params = query.compile().params
            self.assertEqual(params['id_1'], self.post.id)
            self.assertEqual(params['author_id_1'], account.id)
            return self.post if params['author_id_1'] == self.post.author_id else None

        self.db.scalar.side_effect = select_owned_post
        with TestClient(app) as client:
            for account in (other, self.user):
                app.dependency_overrides[get_authenticated_user_id] = lambda: account.id
                self.db.get.return_value = account
                for admin in (False, True):
                    account.is_admin = admin
                    with self.subTest(owner=account.id == self.user.id, admin=admin):
                        self.db.reset_mock()
                        response = client.request('DELETE', f'/posts/{self.post.id}',
                            params={'author_id': str(self.user.id)},
                            json={'author_id': str(self.user.id)})
                        if account.id == self.user.id:
                            self.assertEqual(response.status_code, 204)
                            self.db.commit.assert_called_once()
                        else:
                            self.assertEqual(response.status_code, 404)
                            self.assertIsNone(self.post.deleted_at)
                            self.db.execute.assert_not_called()
                            self.db.commit.assert_not_called()

    def test_invalid_attachment(self):
        self.db.scalar.side_effect=[None,self.space]
        with self.assertRaises(HTTPException) as error: create_post(PostCreate(submission_id=uuid4(),title='T',image_ids=[uuid4()]),Response(),self.user,self.db)
        self.assertEqual(error.exception.status_code,422); self.db.commit.assert_not_called()
        sql=str(self.db.scalars.call_args.args[0])
        for clause in ('image_uploads.owner_id =','image_uploads.uploaded_at IS NOT NULL','image_uploads.deleted_at IS NULL'): self.assertIn(clause,sql)

    def test_attachment_order_and_pending(self):
        uploads=[ImageUpload(id=uuid4(),owner_id=self.user.id,object_key=f'{n}.png',width=100,height=50) for n in range(2)]
        self.db.scalar.side_effect=[None,self.space]; self.db.scalars.return_value.all.return_value=uploads
        with patch('posts.serialize_posts',return_value=[Mock()]): create_post(PostCreate(submission_id=uuid4(),title='T',body='B',image_ids=[uploads[1].id,uploads[0].id]),Response(),self.user,self.db)
        added=[c.args[0] for c in self.db.add.call_args_list]
        self.assertEqual((added[0].status,added[0].author_id,added[0].type),('pending',self.user.id,'image'))
        self.assertEqual([(a.position,a.image_upload_id) for a in added[1:]],[(0,uploads[1].id),(1,uploads[0].id)])
        self.db.commit.assert_called_once()

    def test_submission_retry(self):
        with patch('posts.serialize_posts',return_value=[Mock()]): create_post(PostCreate(submission_id=uuid4(),title='Test',body='Body'),Response(),self.user,self.db)
        self.db.add.assert_not_called(); self.db.commit.assert_not_called()
        with self.assertRaises(HTTPException) as error: create_post(PostCreate(submission_id=uuid4(),title='Changed',body='Body'),Response(),self.user,self.db)
        self.assertEqual(error.exception.status_code,409)

    def test_banned_creation(self):
        self.db.scalar.side_effect=[None,self.space]; self.db.get.return_value=Ban(space_id=self.space.id,user_id=self.user.id)
        with self.assertRaises(HTTPException) as error: create_post(PostCreate(submission_id=uuid4(),title='T',body='B'),Response(),self.user,self.db)
        self.assertEqual(error.exception.status_code,403); self.db.commit.assert_not_called()

    def test_like_unlike_retries(self):
        self.assertEqual(set_like(self.db,self.post.id,self.user,True).like_count,1)
        self.assertIn('FOR UPDATE',str(self.db.scalar.call_args.args[0]))
        self.db.get.side_effect=lambda model,key: PostLike(user_id=self.user.id,post_id=self.post.id) if model is PostLike else None
        self.assertEqual(set_like(self.db,self.post.id,self.user,True).like_count,1)
        self.assertEqual(set_like(self.db,self.post.id,self.user,False).like_count,0)
        self.db.get.side_effect=None; self.db.get.return_value=None
        self.assertEqual(set_like(self.db,self.post.id,self.user,False).like_count,0)
        self.assertEqual(self.db.execute.call_count,2)

    def test_invisible_or_removed_post_like(self):
        self.db.scalar.return_value=None
        with self.assertRaises(HTTPException) as error: set_like(self.db,self.post.id,self.user,True)
        self.assertEqual(error.exception.status_code,404)
        self.db.scalar.return_value=self.post; self.post.status='removed'
        with self.assertRaises(HTTPException) as error: set_like(self.db,self.post.id,self.user,True)
        self.assertEqual(error.exception.status_code,409); self.db.commit.assert_not_called()

    def test_like_cors(self):
        with TestClient(app) as client:
            for method in ('PUT','DELETE'):
                r=client.options(f'/posts/{self.post.id}/like',headers={'Origin':'http://localhost:3000','Access-Control-Request-Method':method,'Access-Control-Request-Headers':'authorization'})
                self.assertEqual(r.status_code,200)
