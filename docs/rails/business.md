# Business Rail Audit

## Purpose

Deadbridge business operations surface focused on leads, deals, follow-up judgment, proposals, and light cost/revenue awareness. This rail should not become a full CRM replacement.

## Belongs here

- Frappe CRM leads and deals
- Lead/deal stage and fit
- Proposal activity
- Follow-up needs
- Draft follow-ups
- Appointments tied to leads/deals
- Unpaid invoices or business-cost warnings when relevant
- Links into Frappe/source systems

## Does not belong here

- Full CRM UI replacement
- Full calendar
- Vanity sales charts
- Automatic sending
- Over-scoring every lead with AI
- Casa Plasencio, currently deferred

## Primary questions

- Which lead/deal needs judgment?
- What changed with a client or prospect?
- What follow-up can Umbra prepare?
- What business cost/revenue issue matters now?
- What should open in Frappe?

## Source of truth

- Live bridge/API: Frappe CRM, proposal/invoice systems, optional email/source activity
- Obsidian context: people notes, lead notes, business decisions, follow-up runbooks
- External app link: Frappe CRM, proposal/invoice tools

## Entities

- lead
- person
- project
- service
- job
- note
- decision
- runbook

## Situations

- lead_warm
- lead_needs_followup
- proposal_viewed
- reply_draft_ready

## Actions

### Read / safe

- Open Frappe
- Open lead/deal
- Show proposal activity
- Summarize lead/deal
- Show upcoming business appointment tied to lead/deal

### Prepare

- Draft follow-up
- Draft proposal update
- Draft meeting/call summary
- Prepare lead score/reason
- Prepare cost/revenue summary

### Approval required

- Send email/message
- Update CRM stage
- Create invoice
- Change deal value
- Delete lead/deal

### Dangerous / hard limits

- Auto-send external communication
- Change financial records without approval
- Delete CRM records without explicit approval

## Runbooks

- Lead Follow-up Preparation
- Proposal Activity Response
- Deal Stalled Review
- Business Cost Review

## History worth keeping

- Lead/deal stage changes
- Proposal views
- Follow-ups drafted/sent
- Appointment notes
- Revenue/cost warnings

## Obsidian mappings

- Notes: person, lead, project, decision
- Decisions: business/process decisions
- Runbooks: business runbooks
- Incidents: missed follow-up, CRM sync issues

## Deferred / excluded

- Casa Plasencio
- Full accounting
- Full calendar/meeting UI
