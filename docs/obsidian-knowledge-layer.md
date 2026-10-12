# Umbra Obsidian Knowledge Layer

> Obsidian is Umbra's human-readable authoring layer. It is not the graph database. Typed notes feed Umbra's brain graph.

## 1. Vault principles

- Notes are readable/editable by Edward first.
- Typed notes can become graph nodes.
- Semantic frontmatter and links can become graph edges.
- Untyped notes are searchable documents, not trusted graph entities.
- Live bridge/API state wins over note state for operational decisions.
- Agents receive graph traversal summaries and cited source notes, not raw vault dumps.

## 2. Recommended folders

```txt
00_Inbox/
10_Projects/
20_Areas/
30_Resources/
40_Runbooks/
50_Decisions/
60_Logs/
  Sessions/
  Incidents/
  Astro/
  Print/
70_People/
80_Devices/
90_Archive/
```

Folders are for human browsing. Umbra relies on `type`, `umbra_id`, and semantic fields.

## 3. Common frontmatter

```yaml
---
type:
umbra_id:
domain:
status:
created:
updated:
aliases: []
tags: []
---
```

Optional relationships:

```yaml
related_projects: []
related_devices: []
related_repos: []
related_services: []
related_people: []
related_runbooks: []
related_decisions: []
external_id:
risk:
confidence:
---
```

## 4. Stable ID conventions

```txt
project:umbra
repo:/Users/eddwordd/Documents/codes/projects/umbra
device:printer:canon-pro-1000
runbook:dev:stale-port
decision:knowledge:obsidian-authoring-layer
note:obsidian:<vault>:<path>
lead:frappe:<doctype>:<id>
```

## 5. Note types

Initial typed notes:

- project
- area
- resource
- runbook
- decision
- incident
- session_log
- device
- person
- lead
- service

## 6. Relationship mapping

Umbra indexer should map frontmatter to graph edges.

```txt
related_projects  -> related_to / belongs_to
related_devices   -> documents / uses / targets, depending on note type
related_repos     -> owns / documents
related_services  -> uses / depends_on
related_people    -> related_to / assigned_to
related_runbooks  -> uses
related_decisions -> affected_by / documents
```

Plain wikilinks are weak evidence. Semantic frontmatter is stronger.

## 7. Templates

### Project

```yaml
---
type: project
umbra_id: project:umbra
domain: dev
status: active
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_repos:
  - repo:/Users/eddwordd/Documents/codes/projects/umbra
related_services: []
related_runbooks: []
related_decisions: []
tags: [umbra/project]
---
```

```md
# Project Name

## Current objective

## Open loops

## Active decisions

## Related runbooks

## Recent sessions

## Notes
```

### Runbook

```yaml
---
type: runbook
umbra_id: runbook:dev:stale-port
domain: dev
status: active
risk: local-risky
triggers:
  - stale_port
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_projects: []
related_devices: []
tags: [umbra/runbook]
---
```

```md
# Runbook Name

## Purpose

## Preconditions

## Steps

1. 

## Approval required

## Success criteria

## Failure modes
```

### Decision

```yaml
---
type: decision
umbra_id: decision:knowledge:obsidian-authoring-layer
domain: knowledge
status: accepted
created: YYYY-MM-DD
updated: YYYY-MM-DD
affects:
  - project:umbra
related_projects:
  - project:umbra
tags: [umbra/decision]
---
```

```md
# Decision Title

## Decision

## Context

## Options considered

## Chosen

## Consequences
```

### Device

```yaml
---
type: device
umbra_id: device:printer:canon-pro-1000
domain: print
status: known
created: YYYY-MM-DD
updated: YYYY-MM-DD
live_source: cups
related_runbooks: []
tags: [umbra/device]
---
```

```md
# Device Name

## Connection

## Known-good settings

## Common failures

## Related runbooks

## Maintenance log
```

### Incident

```yaml
---
type: incident
umbra_id: incident:dev:YYYY-MM-DD-short-slug
domain: dev
status: resolved
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_projects: []
related_runbooks: []
related_decisions: []
tags: [umbra/incident]
---
```

```md
# Incident Title

## Summary

## Timeline

## Cause

## Resolution

## Follow-ups
```

### Session log

```yaml
---
type: session_log
umbra_id: session:YYYY-MM-DD-short-slug
domain: dev
status: logged
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_projects: []
related_runbooks: []
related_decisions: []
tags: [umbra/session]
---
```

```md
# Session Title

## Summary

## Decisions made

## Open loops

## Next actions
```

## 8. Indexer requirements

The future Obsidian indexer should:

1. Read markdown files from the configured vault path.
2. Parse frontmatter.
3. Accept only known `type` values as graph entities.
4. Require `umbra_id` for trusted graph nodes.
5. Map semantic relationship fields into typed graph edges.
6. Preserve source note path for citations.
7. Emit `note.indexed` memory events.
8. Never treat note state as live operational truth.

## 9. Non-goals

- Do not dump the vault into context.
- Do not treat every wikilink as the same relationship.
- Do not build a folder taxonomy that replaces ontology.
- Do not let note text override live bridge/API state.
