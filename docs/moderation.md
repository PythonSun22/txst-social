# TXST Lynx moderation

## Current implementation

`backend/moderation.py` calls the official OpenAI moderation endpoint with
`omni-moderation-latest` for text and images. The standalone text CLI still works
without FastAPI or a database connection. The API now starts
`backend/moderation_worker.py` in a background thread (FR-90–92).

`POST /posts` currently saves General/ForAll posts as author-visible `pending`.
The committed post row is its durable queue entry. The worker screens eligible
posts, including the existing pending backlog, and saves `approved` or `blocked`
plus a moderation audit in one transaction. Any overall or category flag blocks.
Failures remain private and retry with a finite limit. Apply
`20260926000000_automatic_post_moderation.sql` before running this code; this
migration has not been deployed to the shared database.

## Automated workflow baseline — September 26, 2026

Saved at the user's request for refining the pipeline (FR-90–92, FR-97–99).
New-post screening below is implemented; report handling remains future work. The
current college-project scope must not depend on a staffed platform admin or
human-review queue. This baseline supersedes the human-review recommendations
in the historical suggestions below for the current scope.

**Current scope:** screening and publication for the existing General/ForAll
feed, including its backlog of pending posts. Automated user-report handling
is recorded here for later work.
College/subcommunity workflows and human moderation tools are outside this
immediate slice. Posts with images require screening of their attachments as
well as text before approval. The worker sends the title/body and every attachment
together in one moderation request (FR-32/90).

### Post and report transitions

| Event | Intended behavior |
|---|---|
| New post submitted | Save as `pending`, then screen it. |
| Screening passes | Change to `approved`. |
| Screening flags it | Change to `blocked`. |
| Screening fails | Keep `pending`; retry automatically with a limit. |
| User reports a published post | Save the report and schedule another screening. |
| Re-screening finds a violation | Change the published post to `removed`; resolve the report. |
| Re-screening finds no violation | Keep it `approved`; dismiss the report with an explanation. |
| Re-screening fails | Keep the report `open` for retry; do not treat the error as a violation. |

The backend applies these decisions to the existing post row. Post status and
report status remain separate: receiving a report does not itself change an
approved post's visibility. `blocked` means rejected before publication;
`removed` means withdrawn after publication. No `needs_review` status is needed
for this automated scope.

### Rules for manageable automated reporting

- Report counts alone never remove content or suspend accounts. Otherwise,
  coordinated users could silence classmates.
- Group reports about the same post into one screening job, with duplicate
  protection and a cooldown.
- No automatic account suspension in the first version. Limit actions to the
  reported post or comment; comment integration is later work.
- After retry attempts are exhausted, record the failure and show
  "Automated review could not be completed." Avoid an endless retry loop or a
  misleading "No violation found" result. New posts stay unpublished; a failed
  report check does not establish that a published post violated a rule.
- Do not offer a human appeal or review option that nobody can staff. A later
  automated recheck must be described as a recheck.

### Processing order and retries

The ForAll worker selects eligible pending posts by `created_at ASC, id ASC`.
This includes existing pending posts. Each API process runs one worker, and
database row locks with `SKIP LOCKED` prevent competing processes from claiming
the same live job. The worker runs only while FastAPI is running.

A failed attempt is scheduled for a later retry, allowing other eligible posts
to proceed. Oldest-first selection therefore does not guarantee publication
order: an older post waiting for retry can be approved after a newer post. More
workers could also finish jobs out of order. The public feed's newest-first
display order is independent of screening order.

Attempts are persisted before network calls. Claims expire after five minutes;
a crashed worker's job becomes eligible again without resetting its count.
After a crash on the final attempt, the next worker records exhaustion once the
lease expires. A stale claim or changed content fingerprint cannot publish.
No DB transaction stays open during Storage/OpenAI calls. SDK retries are off.

Default [D-4] behavior is three total attempts, with delays of 30 seconds and
120 seconds after failures. All screening failures consume the budget, including
configuration errors. A provider `Retry-After` can lengthen the delay. Configuration
errors still require fixing the configuration; automatic retry cannot repair it.
Exhaustion is persisted as `moderation_exhausted_at`; it leaves the post pending
and stops retries even after restart. The author sees "Automated review could not
be completed." There is no automatic reset, manual review, or user retry endpoint
in this version. Correcting configuration does not reset an exhausted post.

The worker records full flags/scores, model, policy version, content fingerprint,
latency, and attempt number in `moderation_checks`. Signed URLs, keys, and post
text are not copied into audit results or error logs. Failure codes live on the
post; errors never become successful classification audits. `GET /posts/{id}`
uses the existing visibility checks and lets pending cards refresh every five
seconds without resetting feed pagination. Refreshing stops on a verdict or
exhaustion.

### Deferred work and limits

- Recovery after exhaustion, post editing and revision-aware re-screening. Any
  future edit/attachment writer must lock its parent post and return edited
  content to pending; the fingerprint check does not implement an edit API.
- Legacy link posts stay pending and exhaust with `unsupported_link`: screening
  their title or URL text cannot certify the external destination.
- No dedicated profanity check, OCR, animation frame extraction, or custom
  score thresholds. Provider image categories do not cover every text category.
  Evaluate false positives/negatives before treating screening as comprehensive.
- Later report checks: whether to re-screen content alone or assess relevant
  context alongside the report. A reporter's allegation is not proof or an
  instruction, and repeating the same classifier call may repeat its mistake.
- Persisting retry exhaustion and its user-facing message. The current report
  statuses (`open`, `resolved`, `dismissed`) do not distinguish retry exhaustion;
  the implementation must track it separately or introduce a migration. An
  exhausted report must not remain eligible for automatic retry indefinitely.

## Configure and run

Apply migrations to local Supabase with `supabase migration up --local`, following
[local development](local-development.md). Shared deployment still requires the
normal review/merge process. Do not rely on earlier deployment exceptions.

Configure the existing, ignored `backend/.env` before starting FastAPI:

```dotenv
OPENAI_API_KEY=your_actual_api_key
SUPABASE_SECRET_KEY=your_backend_only_supabase_secret
MODERATION_ENABLED=false
MODERATION_MAX_ATTEMPTS=3
MODERATION_RETRY_SECONDS=30
MODERATION_POLL_SECONDS=2
```

Create/manage the key on the [OpenAI API platform](https://platform.openai.com/api-keys).
Keep it in the backend environment; do not put it in frontend code or commit it.
The module loads `backend/.env` explicitly and preserves existing environment
variables. The database password is unrelated to this credential.

The Storage secret is required for pending images because the worker has no user
session. `backend/moderation_storage.py` signs only persisted attachment keys for
five minutes. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works if the new secret
is absent. Never place either key in frontend variables. Public image/upload
routes still use the caller's JWT and do not use this elevated adapter.
Local Supabase signs images with a `127.0.0.1` URL, which OpenAI cannot fetch.
The worker currently passes that URL through, so local image posts may exhaust
their retries and remain pending. A one-off Base64 data-URL check with a local
image succeeded, but that temporary adapter was reverted. Text screening is
unaffected.
[Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

Start normally with `uv run fastapi dev main.py`. The worker is disabled by
default so starting a development backend cannot screen posts in its configured
database unexpectedly. After the migration is reviewed, applied to that same
database, and credentials are configured, set `MODERATION_ENABLED=true` to start
screening. Set it back to `false` to pause screening. Disabling the worker does
not make an unapplied migration optional: the ORM still needs the new columns.
`MODERATION_MAX_ATTEMPTS` accepts 1–10; retry/poll settings accept 1–3600 seconds.
Retry delays grow by four times per failure, capped at one hour before applying
a longer provider hint. Exhausted posts remain stopped when settings change.

From `backend`, using the project's existing environment:

```powershell
uv sync
uv run python moderation.py "Anyone studying at Alkek tonight?"
```

If `uv` is not on your PATH but dependencies are installed, on Windows use:

```powershell
.\.venv\Scripts\python.exe moderation.py "Anyone studying at Alkek tonight?"
```

This sends the supplied text to OpenAI. Output contains `flagged`, `categories`,
`category_scores`, the returned `model`, and measured `latency_ms`. Category
names such as `violence/graphic` are preserved. The command exits with status 1
on missing configuration, blank input, provider errors, or invalid responses.

## Use from backend code

```python
from moderation import moderate_text

result = moderate_text(f"{title}\n\n{body}")
```

This is a synchronous function, matching the current synchronous endpoints.
Do not call it directly on an async event loop without moving the work to a
thread or switching to an async client.

The implementation uses the official OpenAI Python SDK, installed with
`uv add openai`. This records the dependency in `backend/pyproject.toml`, locks resolved
versions in `backend/uv.lock`, and installs into `backend/.venv`. Teammates can
reproduce the environment with `uv sync`.

For this setup, `uv` was available at `.\.venv\Scripts\uv.exe`, so the command
run from `backend` was `.\.venv\Scripts\uv.exe add openai`. The executable path
selects which program runs; `uv` discovers the backend project and its virtual
environment from the working directory. Activation with
`.\.venv\Scripts\Activate.ps1` makes the environment's executables available on
PATH; it is optional when calling them by their explicit paths. Using `uv add`
also records dependency metadata so teammates can reproduce the installation.

One SDK request uses a 10-second network timeout with automatic retries disabled.
This bounds a network operation, not total job duration. Publication does not
wait inside `POST /posts`; [D-4] is pending plus bounded background retries for
this ForAll slice.

`ModerationError` means screening failed, never that content is safe. The caller
must not substitute an unflagged result after an exception. Provider flags are
interpreted by the worker's any-flag policy, not a guarantee of profanity detection.

## Offline verification

From `backend`:

```powershell
uv run python -m unittest discover -s tests -v
```

Tests exercise the real SDK with a mocked HTTP transport, so they require no key, database, or network. They
check provider results, blank input, missing keys, authentication/rate-limit
errors, timeouts, invalid responses, multimodal payloads, signing and lifecycle.
They do not measure model accuracy. Database tests are skipped unless explicitly
configured with a disposable local test database.

The migration/worker integration tests can also run on a disposable PostgreSQL
16 container, with no shared credentials or live provider requests:

```powershell
docker run --rm --detach --name txst-moderation-test --publish 127.0.0.1:55439:5432 --env POSTGRES_PASSWORD=local-moderation-test --env POSTGRES_DB=moderation_test postgres:16
# From backend, once PostgreSQL is ready:
$env:MODERATION_TEST_DATABASE_URL='postgresql+psycopg://postgres:local-moderation-test@127.0.0.1:55439/moderation_test'
uv run python -m unittest discover -s tests -v
Remove-Item Env:MODERATION_TEST_DATABASE_URL
docker stop txst-moderation-test
```

The runner refuses non-loopback hosts and databases not named `moderation_test*`.
It applies every repository migration to an empty database with minimal
Auth/Storage schema stand-ins. Tests exercise real transactions, competing
connections, retries, visibility, stale results and atomic audit writes. This is
not a full Supabase Auth/Storage end-to-end test. Verify a real signed image fetch
and OpenAI response in local Supabase before shared deployment.

## Remaining integration

### Troubleshooting HTTP 429

A live demo returned HTTP 429 with `Too Many Requests`, type
`invalid_request_error`, and no specific error code or Retry-After header.
That response does not establish whether a request limit or an account quota
caused the failure. Wait briefly before retrying, then check the API project's
model limits and organization usage. Only change billing if the platform or a
specific quota error indicates a billing issue. No classification is available
when the request fails (FR-90).

Reference: [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes).

### Future work

Automated reports, comments, subcommunity review, editing, profanity rules,
evaluation datasets and recovery after exhaustion remain future work. There is
no human review dependency in the implemented ForAll scope.

Reference: [official OpenAI moderation documentation](https://developers.openai.com/api/docs/guides/moderation).

---

## Design suggestions and alternatives

> Saved from the moderation discussion on September 22, 2026. These are proposals, not approved product decisions or implemented features. Service details reflect the sources consulted for the original answer.

> OpenAI has been selected and the SDK starter is described above. This section is historical: the September 26 automated workflow baseline above takes precedence for current scope. Human-review suggestions below are not current staffing requirements; other alternatives remain proposals.

**For Boko Lynx, I’d start with a hosted moderation model, a separate profanity check, and a small human-review workflow.** That gives you a feasible semester project while covering more than a list of banned words.

The part you build is substantial: deciding what is allowed, connecting the classifier, controlling publication, handling failures, and measuring whether the system makes good decisions.

First, define what you want to prohibit. These examples require different treatment:

| Example | Suggested treatment |
|---|---|
| “This exam was damn hard.” | If you prohibit all profanity, ask the author to revise it. |
| A direct threat against another student | Block publication and route for moderator attention. |
| Pornographic image | Block publication. |
| Graphic image of severe injuries | Block under your graphic-violence policy; review uncertain cases. |
| A sexual-health event announcement | Allow when educational and non-explicit. |
| “That exam killed me.” | Allow; the phrase alone is not a threat. |

These are **suggested policies for the team to agree on**, not decisions already made. “Contains a swear word,” “discusses violence,” and “threatens someone” should not automatically mean the same thing.

**Common industry practice combines automated detection with application rules and human review.** The model identifies categories; your application decides what to do about them. Borderline cases and appeals need a person. AWS explicitly supports combining automated moderation with human review, while Azure supports category-specific severity filtering and blocklists. There isn’t a universal threshold that every platform uses. [AWS moderation workflow](https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html), [Azure Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview)

These are the implementation options I would consider. Feasibility is my assessment for your five-person team.

| Option | What it offers | Limitations and cost | Feasibility |
|---|---|---|---|
| **OpenAI Moderation API** | `omni-moderation-latest` accepts text and images, with categories including sexual content and graphic violence. | The moderation endpoint is free. Some categories, including harassment and hate, are text-only. No dedicated “all profanity” category. | **High.** My first option to prototype. [Documentation](https://developers.openai.com/api/docs/guides/moderation) |
| **Azure AI Content Safety** | Text/image analysis for sexual content, violence, hate, and self-harm; severity levels and text blocklists. | Requires an Azure subscription and resource. Offers F0 and S0 tiers. | **High.** Especially reasonable if your team already uses Azure. [Documentation](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview) |
| **Amazon Rekognition** | Image/video moderation, with an established human-review integration. | You still need a text-moderation solution. Metered pricing and another cloud integration. | **Medium.** Worth considering if visual moderation becomes the main focus. [Capabilities](https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html), [pricing](https://aws.amazon.com/rekognition/pricing/) |
| **Self-hosted Detoxify** | Pretrained Python models for text toxicity, threats, obscenity, insults, and identity attacks. | You manage model hosting and performance. It doesn’t cover images; its authors document context and bias limitations. | **Medium.** Useful if learning model deployment is part of your goal. [Repository](https://github.com/unitaryai/detoxify) |
| **A maintained word blocklist** | Fast, predictable matching of words your platform prohibits. | Misses context and evasive spellings; careless matching flags innocent words. Cannot assess images. | **High as a supplementary check.** Insufficient as the whole moderation system. |

Training a text-and-image classifier from scratch would be a much larger project. Unless your course requires model training, I would put your effort into integrating and evaluating a pretrained system.

For your application, I would propose this flow:

```mermaid
flowchart TD
    A[Student submits post] --> B[Save as pending]
    B --> C[Screen text and any image]
    C --> D{Apply community policy}
    D -->|Pass| E[Approved: visible in the space]
    D -->|Clear violation| F[Blocked: author sees reason]
    D -->|Uncertain| G[Remain pending for human review]
    C -->|Timeout or service failure| H[Remain pending for retry]
```

This fits your existing requirement that screening precedes publication, **FR-90**. Here is what implementing it would involve:

1. **Build a moderation service inside the backend.**
   Give the rest of the team one internal interface that accepts a post’s title and body, calls the selected provider, and returns category results plus your application’s decision. Keep provider credentials on the server. The browser must never be able to mark its own post approved.

2. **Keep detection separate from your policy.**
   For example, a model might detect violence in a news discussion. Your rules determine whether that is prohibited. If all cuss words are prohibited, run a dedicated profanity check too. For memes or screenshots, extract embedded text and screen it as well; visual screening alone should not be assumed to cover every text category.

3. **Record the screening and update visibility together.**
   Save the result in `moderation_checks` and update the post’s status in the same database transaction. Public feeds, search, and individual-post endpoints must all enforce visibility. Hiding a post in the frontend is insufficient.

4. **Handle slow or failed screening explicitly.**
   My recommendation is the bounded-wait approach already discussed in **[D-4]**: try briefly, then leave the post pending and retry in the background. That is a proposal requiring team agreement. A timeout means “not checked,” not “safe” or “prohibited.” Retries should survive a backend restart.

5. **Re-screen edits and image replacements.**
   Otherwise, someone could publish harmless text and replace it afterward. Tie each result to the exact content revision so a delayed result cannot approve newer, unreviewed content.

**Images need an additional privacy step.** Upload them directly from the browser into private Supabase Storage using a signed upload URL, retaining only the object key in PostgreSQL, as required by FR-32. Give the moderation service controlled access to the image. Other students should gain access only after approval. A pending database row does not protect an image stored at a public URL. [Supabase bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals)

For the first image implementation, I would accept only supported still-image formats. Animated images require checking more than their first frame. Link posts also need a separate scope decision: screening a URL’s text does not inspect everything on the destination page.

Your [existing moderation schema](../supabase/migrations/20260910200000_lynx_core.sql) already provides a useful foundation:

- `pending`, `approved`, `blocked`, and `removed` content states.
- A screening record containing a label, score, model version, and latency (**FR-92**).
- Fields for moderator overrides, plus separate user reports (**FR-93, FR-97–99**).

However, it currently stores only one label and score, and its decision enum has only `allow` and `block`. It has **no profanity label or explicit review outcome**. If you adopt the workflow above, I would propose a migration for those gaps, category-level results, the policy version, and the content revision checked. Update the SQLAlchemy models alongside it.

**Evaluation is where you find out whether the feature works.** Before connecting it to real publication, assemble perhaps 150–300 team-labelled text examples as a starter set—not proof of production accuracy. Include normal campus discussion, profanity, threats, quotations, educational content, slang, and harmless uses of sensitive words. Keep some examples separate from those used to tune the rules.

Measure:

- **False positives:** acceptable posts incorrectly blocked.
- **False negatives:** prohibited posts incorrectly allowed.
- **Review rate:** how much work gets sent to people.
- **Latency and failures:** how long authors wait and whether pending posts recover.

Use separate measurements for each category. Don’t interpret a score of `0.9` as “90% obscene” or copy one threshold across providers. OpenAI notes that score-based policies may need recalibration when its moderation model changes. [Score interpretation](https://developers.openai.com/api/docs/guides/moderation)

For your own first deliverable, I would build **text screening with a small evaluation runner**: feed it labelled examples, get back decisions and reasons, and produce a report of mistakes. You can work on that before the posting interface is ready. Then connect it to pending-post publication, add a moderator review screen, and extend the same workflow to images.
