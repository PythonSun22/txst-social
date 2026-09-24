# TXST Lynx — Documentation Standard

## Purpose

TXST Lynx will use a **documentation-as-code** approach combining:

1. **Human-written project documentation**
2. **In-code documentation**
3. **Automatically generated technical documentation**

The goal is to keep documentation close to the code while avoiding unnecessary or redundant comments.

---

# 1. Human-Written Documentation

Project-level documentation will live in the repository:

```text
txst-social/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── development.md
│   ├── requirements.md
│   └── decisions/
├── frontend/
└── backend/
```

### README.md

Explains how to:

- Install dependencies
- Configure the project
- Run the frontend
- Run the backend
- Begin contributing

### architecture.md

Documents:

- Overall system architecture
- Frontend/backend boundaries
- Major components
- Communication between systems

### database.md

Documents:

- Database entities
- Relationships
- Important schema decisions

### development.md

Documents team conventions including:

- Git workflow
- Branch conventions
- Testing
- Code style
- Documentation expectations

### requirements.md

Maintains the project's:

- Goals
- Scope
- Features
- Functional requirements
- Non-functional requirements

### decisions/

Contains short **Architecture Decision Records (ADRs)** explaining important technical decisions.

Examples:

```text
001-use-fastapi.md
002-use-postgresql.md
003-threejs-college-explorer.md
```

These documents primarily answer:

**Why did we build the system this way?**

---

# 2. TypeScript Documentation

Important exported TypeScript functions, interfaces, classes, and components should use **TSDoc-style comments**.

Example:

```ts
/**
 * Retrieves posts associated with a college.
 *
 * @param collegeId - Unique identifier for the college.
 * @returns Posts belonging to the college.
 */
async function getCollegePosts(collegeId: number) {
    // ...
}
```

TypeDoc may later be used to generate browsable documentation from these comments and TypeScript types.

---

# 3. Python Documentation

Important Python functions, classes, services, and modules should use standard **Python docstrings**.

Example:

```python
def create_post(user_id: int, content: str):
    """
    Create and persist a new social post.

    Args:
        user_id: ID of the post author.
        content: Text content of the post.

    Returns:
        The newly created post.
    """
```

MkDocs and mkdocstrings may later be used to generate browsable documentation from these docstrings.

---

# 4. FastAPI Documentation

FastAPI automatically generates OpenAPI documentation from:

- API routes
- Request parameters
- Pydantic models
- Response models
- Type information
- Route descriptions

Developers should therefore keep FastAPI routes and schemas accurately typed and documented rather than manually maintaining a separate list of API endpoints.

During development, interactive API documentation is available through FastAPI's `/docs` endpoint.

---

# 5. Commenting Rule

Do **not** comment code simply to restate what it obviously does.

Avoid:

```ts
// Increment count
count++;
```

Use comments to explain:

- Why something is implemented a particular way
- Non-obvious behavior
- Important assumptions
- Constraints
- Workarounds
- Contracts between components

Example:

```ts
// College IDs must remain independent of display order.
// The 3D explorer may reorder crests without changing database relationships.
```

The code itself should communicate **what it does** whenever possible.

Documentation should communicate **how to use it, what assumptions it makes, and why important decisions were made.**

---

# 6. Documentation Responsibilities

Documentation is part of feature completion.

When a developer changes a feature, they are responsible for updating the relevant:

- TSDoc comments
- Python docstrings
- FastAPI schemas/descriptions
- Database documentation
- Architecture documentation
- ADRs
- Setup instructions

A pull request should not be considered complete if it makes existing documentation inaccurate.

---

# Documentation Strategy Summary

```text
Source Code
│
├── TypeScript
│   └── TSDoc → TypeDoc
│
├── Python
│   └── Docstrings → MkDocs / mkdocstrings
│
└── FastAPI
    └── Routes + Schemas → OpenAPI / Swagger

Repository Documentation
│
└── docs/
    ├── Architecture
    ├── Database
    ├── Development Standards
    ├── Requirements
    └── Architecture Decisions
```

## Core Principle

**Code documents what the system does.**

**In-code documentation explains contracts and non-obvious behavior.**

**Project documentation explains how the system fits together and why major decisions were made.**