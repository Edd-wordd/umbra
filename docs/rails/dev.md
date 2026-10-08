# Dev Rail Audit

## Purpose

Software operations surface for projects, agents, local dev servers, git, CI, and code-related service health. The Dev rail should show blocked work and the next safe action, not become a general engineering dashboard.

## Belongs here

- Active repos/projects
- Herdr workspaces and agent sessions
- Local dev servers and ports
- Git state: dirty, ahead/behind, no remote, stale branches
- CI status and failing runs
- Sentry/PostHog/Supabase/GitHub/Figma service cards when tied to a project
- Agent handoff and dispatch
- Risk-gated local commands

## Does not belong here

- WakaTime or generic time tracking
- Full GitHub replacement
- Full analytics dashboard
- Permanent metrics wall
- Unrelated Docker/homelab inventory unless attached to a project

## Primary questions

- Which project needs Edward?
- Which agent is blocked or failed?
- Which local server/port is stale?
- Which CI/service failure matters now?
- What can be handed to an agent with context?

## Source of truth

- Live bridge/API: Mac helper, Herdr, git, gh, lsof, service adapters
- Obsidian context: project notes, decisions, dev runbooks, incident logs
- External app link: GitHub, Sentry, PostHog, Supabase, Figma

## Entities

- project
- repo
- agent
- session
- process
- service
- job
- runbook
- decision
- incident

## Situations

- blocked_agent
- failed_ci
- stale_port
- dirty_repo
- local_only_work
- service_attention
- project_blocked

## Actions

### Read / safe

- Open agent session
- Open failing CI
- Open service detail
- Show git state
- Show terminal transcript

### Prepare

- Prepare agent handoff packet
- Prepare stale port recovery plan
- Prepare failed CI triage plan
- Prepare project handoff summary

### Approval required

- Kill process / free port
- Rerun external CI
- Approve agent prompt
- Push branch
- Restart project service

### Dangerous / hard limits

- Force push
- Delete branches/files
- Reset hard
- Modify secrets/auth
- Deploy production without explicit approval

## Runbooks

- Stale Port Recovery
- Failed CI Triage
- Blocked Agent Resolution
- Dirty Repo / Local-only Work Backup
- Project Handoff Summary

## History worth keeping

- Agent approvals/denials
- Failed CI and resolution
- Stale port recovery
- Project handoffs
- Local-only work warnings

## Obsidian mappings

- Notes: project, incident, session_log
- Decisions: architecture/tooling decisions
- Runbooks: dev runbooks
- Incidents: failed CI, broken local env, service incidents

## Deferred / excluded

- Full PR review UI
- Full analytics UI
- General Docker dashboard
