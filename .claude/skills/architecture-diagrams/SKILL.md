---
name: architecture-diagrams
description: Engineering flow diagram and system graph generation. Use when asked to generate, regenerate, or update an architecture diagram, engineering flow, or system graph.
user-invocable: false
---

# Architecture Diagrams

- Keep the diagram high-level.
- Save the result under `docs/architecture/{feature}-flow.md` unless the user asks for a different path.

## What to include

- Main requests and entry points
- External services
- Database effects
- Client update path

## What to avoid

- Low-level implementation details
- Every helper function
- Internal utility calls

## Output Format

### Summary

One short paragraph describing what the flow does end-to-end.

### High-Level Flow

```mermaid
flowchart TD
    A[User action] --> B[Client request]
    B --> C[Server entry point]
    C --> D[External service call]
    C --> E[DB write]
    D --> F[Return data]
    E --> F
    F --> G[Client state update]
```

### Sequence View

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant X as External Service
    participant DB as Database
    participant RT as Realtime

    U->>C: User action
    C->>S: Request
    S->>X: External call
    S->>DB: Read/Write
    S-->>C: Response
    C->>RT: Subscribe / listen
    RT-->>C: Updates
    C-->>U: UI update
```

### DB Effects

- `table_name`: what is inserted / updated / deleted
- `table_name`: what is read for context

### Notes

- Put only the important invariants here
- Mention any intentional async / realtime path
