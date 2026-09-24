# TXST Lynx — Two-Week Sprint Timeline
**Development Period:** September–Mid-December 2026  
**Sprint Length:** 2 Weeks

## Sprint 1 — Project & Database Foundation
**September 1–13**

### Goal
Establish a stable development foundation that every team member can clone, run, and contribute to.

### Tasks
- Finalize GitHub repository structure
- Finalize team Git/branch workflow
- Verify Next.js frontend environment
- Verify FastAPI backend environment
- Verify frontend → backend communication
- Configure PostgreSQL
- Configure SQLAlchemy
- Establish database connection
- Define initial database models
- Establish database migration strategy
- Organize project documentation
- Define commenting/docstring standards
- Document local development setup

### Deliverable
A documented development environment with a working frontend, backend, and database connection.

---

# Sprint 2 — First Full-Stack Vertical Slice
**September 14–27**

### Goal
Prove the complete application architecture by implementing posts through every layer.

### Tasks
- Design initial Post model
- Create post database table/model
- Create Pydantic request/response schemas
- Implement create-post API endpoint
- Implement retrieve-post API endpoint
- Build basic post creation interface
- Build basic feed
- Connect frontend components to FastAPI
- Persist posts in PostgreSQL
- Retrieve persisted posts
- Add backend/API documentation
- Test complete request lifecycle

### Target Flow

User creates post  
→ Next.js  
→ FastAPI  
→ SQLAlchemy  
→ PostgreSQL  
→ FastAPI  
→ Next.js  
→ Feed displays post

### Deliverable
A user can create a post, store it permanently, and see it displayed in the application.

---

# Sprint 3 — Users, Authentication & Profiles
**September 28–October 11**

### Goal
Introduce user identity and associate application content with real accounts.

### Tasks
- Implement User model
- Implement Profile model
- Implement authentication
- Registration
- Login/logout
- Protect authenticated routes
- Associate posts with users
- Create profile API endpoints
- Build profile page
- Build profile editing
- Add profile image strategy if time permits
- Add college affiliation to profiles
- Test authentication and authorization

### Deliverable
Users can create accounts, authenticate, maintain profiles, and publish posts associated with their identities.

---

# Sprint 4 — Social Interaction
**October 12–25**

### Goal
Transform the application from a publishing system into an interactive social network.

### Tasks
- Implement comments
- Implement likes/reactions
- Implement follow/unfollow relationships
- Display interaction counts
- Display comments on posts
- Display follower/following information
- Add basic user discovery
- Improve main feed
- Add appropriate API validation
- Test relationships between users and posts

### Deliverable
Users can interact with posts and establish social relationships with other users.

---

# Sprint 5 — Texas State Communities
**October 26–November 8**

### Goal
Implement the Texas State-specific community structure that distinguishes the platform from a generic social network.

### Tasks
- Define College model
- Populate supported Texas State colleges
- Associate users with colleges
- Associate posts with colleges where appropriate
- Build college pages
- Build college-specific feeds
- Add college navigation
- Add college/community discovery
- Begin basic search
- Establish data/API structure needed by future 3D crest navigation
- Test college relationships

### Deliverable
Users can participate in and navigate college-specific communities within the larger social network.

---

# Sprint 6 — Community Expansion & Visual Identity
**November 9–22**

### Goal
Complete remaining important social features while establishing the application's visual identity.

### Core Tasks
- Refine search/discovery
- Implement groups/community features if core functionality is stable
- Improve navigation
- Improve responsive layouts
- Establish consistent visual design system
- Introduce GSAP
- Add animated backgrounds
- Add page transitions
- Add dynamic scrolling effects
- Improve loading states
- Improve error states
- Accessibility review
- Begin 3D technical prototype

### Scope Rule
Groups and other secondary social features may be reduced if previous sprint work requires additional development time.

### Deliverable
A substantially complete social application with a cohesive visual identity and initial 3D experimentation.

---

# Sprint 7 — 3D College Explorer & Final Integration
**November 23–December 6**

### Goal
Implement the signature 3D experience while integrating and stabilizing the complete application.

### Tasks
- Integrate Three.js
- Integrate React Three Fiber
- Integrate Drei as needed
- Create 3D college explorer scene
- Create/import college crest assets
- Position crests within the environment
- Implement camera behavior
- Implement crest selection
- Connect crest selection to college pages
- Add transitions between 3D and conventional UI
- Optimize 3D performance
- Integrate completed frontend/backend features
- Conduct full-system testing
- Resolve integration bugs

### Deliverable
Users can navigate an interactive 3D college environment and enter functional college communities through their respective crests.

---

# Final Stabilization — Delivery Window
**December 7–Mid-December**

### Goal
Freeze major feature development and prepare a reliable final product.

### Tasks
- No major new features
- Resolve critical bugs
- Complete unfinished integrations
- Test authentication
- Test database operations
- Test API endpoints
- Test major user workflows
- Browser testing
- Performance testing
- 3D performance optimization
- UI polish
- Clean unused code
- Review security
- Review documentation
- Finalize README
- Finalize architecture documentation
- Finalize API documentation
- Prepare demonstration accounts/data
- Prepare deployment
- Prepare presentation
- Rehearse final demonstration

### Final Deliverable
A stable, documented, demonstrable version of TXST Lynx ready for the final course presentation.

---

# Semester Milestones

| Sprint | Primary Milestone |
|---|---|
| Sprint 1 | Frontend + Backend + Database foundation |
| Sprint 2 | First persistent full-stack feature |
| Sprint 3 | Authentication + Profiles |
| Sprint 4 | Social interactions |
| Sprint 5 | Texas State college communities |
| Sprint 6 | Visual identity + secondary features |
| Sprint 7 | 3D College Explorer + integration |
| Final Window | Testing + stabilization + presentation |

---

# Sprint Development Pattern

Each sprint should follow approximately the same internal cycle.

### Beginning of Sprint
- Review previous sprint
- Select sprint requirements
- Break requirements into GitHub issues/tasks
- Assign owners
- Identify dependencies between developers
- Establish sprint acceptance criteria

### During Sprint
- Develop on feature branches
- Commit frequently
- Open pull requests
- Review teammates' code
- Merge completed features incrementally
- Keep API/database contracts documented
- Update automated documentation alongside code

### End of Sprint
- Stop adding features
- Integrate completed work
- Test sprint requirements
- Fix blocking bugs
- Demonstrate working functionality
- Review unfinished tasks
- Update documentation
- Conduct short retrospective
- Move incomplete work deliberately into the next sprint rather than silently carrying it forward

---

# Scope Priority

If development falls behind schedule, features should be protected in this order:

**1. Application architecture and database**

**2. Authentication and users**

**3. Posts and feed**

**4. Comments and social interactions**

**5. College communities**

**6. Search and discovery**

**7. Visual animation**

**8. 3D college explorer**

**9. Groups and other optional features**

A working social network with fewer features should take priority over a visually ambitious application with incomplete core functionality.