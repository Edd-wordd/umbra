# Ops Rail Audit

## Purpose

Cross-domain attention, approval, and command layer. Ops should answer what needs Edward now, what changed since he left, what is waiting for approval, and what Umbra can safely prepare.

## Belongs here

- Cross-rail Needs Edward
- Approvals
- What changed since I left?
- Prepared actions
- Open loops derived from state
- Runbook plans spanning multiple rails
- Command routing status

## Does not belong here

- Todo app
- Calendar dashboard
- Motivational focus timer
- Generic productivity widgets
- Full inbox UI

## Primary questions

- What needs me now?
- What changed?
- What is waiting for approval?
- What is safe to prepare automatically?
- Which runbook/action should happen next?

## Source of truth

- Live bridge/API: all domain adapters, action registry, approval state
- Obsidian context: runbooks, decisions, incident/session logs
- External app link: source systems as needed

## Entities

- situation
- action
- approval
- runbook
- memory_event
- incident

## Situations

- Any domain situation promoted to Ops when it needs attention

## Actions

### Read / safe

- Show needs
- Show approvals
- Show recent memory
- Show runbook plan

### Prepare

- Prepare action plan
- Prepare cross-domain summary
- Prepare runbook steps
- Prepare What Changed summary

### Approval required

- Any underlying action with risky/physical/external/destructive/security/financial risk

### Dangerous / hard limits

- Bypassing domain approval policy
- Combining multiple risky actions under one vague approval
- Executing physical/destructive actions without explicit target confirmation

## Runbooks

- What Changed Review
- Approval Review
- Cross-domain Incident Triage
- Open Loop Review

## History worth keeping

- Approvals granted/denied
- Actions executed/refused
- What Changed summaries
- Cross-domain situations

## Obsidian mappings

- Notes: session_log, incident
- Decisions: policy and architecture decisions
- Runbooks: ops runbooks
- Incidents: cross-domain incidents

## Deferred / excluded

- Calendar-first planning
- Manual task management
- Generic productivity dashboard
