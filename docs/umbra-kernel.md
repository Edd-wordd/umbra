# Umbra Kernel

> Phase 0 architecture for Umbra's operational brain. This document is planning-first: it defines the model before implementation.

## 1. Product stance

Umbra is a quiet, local-first operational console for Edward's projects, machines, tools, and field systems. It is not a dashboard and not a generic productivity app.

Umbra should reduce manual inspection by answering:

1. What exists?
2. How is it connected?
3. What changed?
4. What needs judgment?
5. What action is safe to prepare or execute?
6. What requires approval?
7. What happened afterward?

The visual brain renders operational truth. It should not be a decorative graph.

## 2. Core primitives

- **Entity** — a real thing Umbra knows about: repo, device, agent, lead, runbook, note, service.
- **Edge** — a typed relationship between entities.
- **Signal** — a raw or normalized event from a bridge, API, note indexer, or user action.
- **Situation** — grouped signals that represent an issue, opportunity, or open loop.
- **Action** — something Umbra can prepare or execute through the tool layer.
- **Decision** — a triage/routing/risk result from policy, Jev, or a human.
- **Approval** — human permission for one specific risky action.
- **Runbook** — a repeatable procedure with preconditions, steps, approval points, and success criteria.
- **MemoryEvent** — durable audit/history event.
- **Snapshot** — point-in-time state of graph entities, edges, and situations.

## 3. Status taxonomy

- **silent** — healthy or irrelevant; no surface.
- **fyi** — log only.
- **watch** — subtle state; no interruption.
- **actionable** — Umbra knows a likely next action.
- **judgment** — Edward must choose between options.
- **approval** — Umbra knows the action but needs permission.
- **blocked** — missing access, device, context, or failed precondition.
- **critical** — time-sensitive or high-impact.

Every surfaced item must have a short `whyNow` explanation.

## 4. Risk taxonomy

- **read** — read-only state.
- **prepare** — creates a plan, draft, or staging artifact.
- **local-safe** — reversible local action.
- **local-risky** — may disrupt local workflow, e.g. killing a process.
- **external** — touches outside systems or other people.
- **destructive** — deletes, overwrites, resets, or force-pushes.
- **physical** — moves hardware or starts a device action.
- **financial** — spends money or triggers paid work.
- **security** — touches secrets, credentials, access, auth, firewall, or identity.

Risk policy is deterministic. AI may summarize or recommend, but it does not override safety policy.

## 5. Initial ontology

Start small. Add types only when the system needs them.

### Entity types

- project
- repo
- service
- device
- agent
- session
- process
- job
- runbook
- decision
- incident
- action
- approval
- memory_event
- note
- person
- lead
- environment

### Edge types

- owns
- contains
- runs
- runs_on
- depends_on
- documents
- uses
- triggered
- resolved_by
- blocked_by
- affects
- belongs_to
- related_to
- derived_from
- assigned_to
- observed_in
- targets
- hosts

## 6. Stable IDs

Every durable entity needs a stable ID so memory and graph edges survive renames and re-indexing.

Examples:

```txt
project:umbra
repo:/Users/eddwordd/Documents/codes/projects/umbra
agent:herdr:<workspace-id>:<pane-id>
port:tcp:3000:<pid>
service:github:umbra
device:printer:canon-pro-1000
runbook:dev:stale-port
note:obsidian:<vault>:<path>
lead:frappe:<doctype>:<id>
```

## 7. Source-of-truth rules

Obsidian is not live truth. Bridges and APIs own current state.

- Notes can define context, runbooks, decisions, and durable knowledge.
- Mac helper owns current local process/port/git/Herdr state.
- CUPS owns current printer queue/device state.
- INDI/OnStep own current astro device state.
- Frappe owns current CRM state.
- GitHub/CI/Sentry/PostHog own current service signals.

If a note and a live bridge disagree, live state wins for operational decisions.

## 8. Traversal/query tooling

Umbra agents should receive graph query results, not raw vault dumps.

Required graph operations:

- `neighbors(entityId, depth, edgeTypes?)`
- `path(fromEntityId, toEntityId, constraints?)`
- `related(entityId, relationSpec)`
- `situationsForEntity(entityId)`
- `runbooksForSituation(situationType)`
- `decisionsAffectingEntity(entityId)`
- `priorSimilarIncidents(entityId, situationType)`
- `actionsForSituation(situationId)`

Example traversal:

```txt
failed CI
→ repo
→ project
→ active agent session
→ related runbook
→ prior incident
→ suggested action
```

## 9. Situation model

A situation groups related signals and gives Umbra an anti-noise layer.

Fields:

```txt
id
type
title
status
severity
confidence
entities
signals
createdAt
updatedAt
lastSeenAt
summary
whyNow
suggestedActions
needsHuman
```

Lifecycle:

```txt
new → active → waiting → resolved
              ↘ snoozed
              ↘ ignored
              ↘ recurring
```

Initial Dev situations:

- blocked agent
- failed CI
- stale port
- dirty repo
- local-only work at risk
- service attention

## 10. Action/tool lifecycle

One action contract must serve buttons, Cmd-K, voice, agents, and runbooks.

Action contract:

```txt
id
label
description
domain
risk
inputSchema
preconditions
dryRun
execute
verify
rollbackHint
approvalPolicy
audit
```

Lifecycle:

```txt
intent → plan → riskCheck → dryRun → approval → execute → verify → audit
```

Risky actions must show:

- exact target
- reason
- risk
- command/API call when possible
- expected result
- rollback/recovery hint
- approval requirement

## 11. Memory model

Every meaningful action, decision, refusal, approval, signal grouping, and resolution creates a MemoryEvent.

Fields:

```txt
id
timestamp
source
actor
type
entities
situationId
actionId
decisionId
summary
result
raw
```

Sources:

- helper
- user
- voice
- cmdk
- agent
- system
- bridge
- jev
- local-policy

Memory powers:

- activity timeline
- situation replay
- audit trail
- graph history
- “What changed since I left?”

## 12. Obsidian role

Obsidian is Umbra's human-readable authoring layer, not the graph database.

Obsidian should hold:

- project notes
- area notes
- runbooks
- decisions
- incidents
- session logs
- device notes
- person/lead context
- resources

Umbra should parse typed notes into graph nodes and semantic links/frontmatter into graph edges.

Untyped notes may be searchable documents, but they are not trusted graph entities.

Initial note types:

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

Required frontmatter fields:

```yaml
type:
umbra_id:
domain:
status:
created:
updated:
aliases:
tags:
```

Optional relationship fields:

```yaml
related_projects:
related_devices:
related_repos:
related_services:
related_people:
related_runbooks:
related_decisions:
external_id:
risk:
confidence:
```

## 13. Visual brain mapping

The visual brain renders graph and situation state.

- entity = node
- edge = pathway
- domain = sector
- situation = cluster/pulse
- risk = bracket/line style
- status = glow color/intensity
- voice = transient center pulse

Visual status mapping:

- silent: dim
- fyi: log only
- watch: faint cyan
- actionable: cyan
- judgment: amber
- approval: amber pulse
- blocked: red bracket
- critical: red pulse

## 14. Build phases

1. **Phase 0 — Kernel / ontology planning**
2. **Phase 1 — Typed brain graph**
3. **Phase 2 — Dev graph adapter + situations**
4. **Phase 3 — Action/tool kernel**
5. **Phase 4 — Memory/timeline**
6. **Phase 5 — Visual brain from graph**
7. **Phase 6 — Obsidian typed authoring layer**
8. **Phase 7 — Homelab + Network**
9. **Phase 8 — Print**
10. **Phase 9 — Astro**
11. **Phase 10 — Business**
12. **Phase 11 — Cameras**
13. **Phase 12 — Life Ops**
14. **Phase 13 — Desk robot**

## 15. Non-goals

- Do not treat Obsidian links/YAML as a complete knowledge graph.
- Do not dump entire vault folders into agent context.
- Do not build dashboard widgets before the graph/action/memory kernel.
- Do not let AI override deterministic risk policy.
- Do not execute destructive, external, physical, financial, or security actions without explicit approval.
