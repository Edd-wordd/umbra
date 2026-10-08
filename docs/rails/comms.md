# Comms Strip Audit

## Purpose

Minimal communication awareness strip. Comms should show only urgent/unread communication state and source links; it should not become an inbox or chat client.

## Belongs here

- Urgent/unread count
- Client/business replies when tied to Business rail
- Agent/human handoff messages
- Source app quick links

## Does not belong here

- Full inbox UI
- Chat client
- Social feeds
- Notification stream
- General email management

## Primary questions

- Is there anything urgent?
- Did a lead/client reply?
- Is another human or agent waiting?

## Source of truth

- Live bridge/API: selected comm sources later
- Obsidian context: person/lead notes only when relevant
- External app link: source communication apps

## Entities

- person
- lead
- message
- service

## Situations

- client_replied
- urgent_message
- agent_handoff_waiting

## Actions

### Read / safe

- Open source app
- Show urgent message summary
- Open related lead/person

### Prepare

- Draft reply when tied to Business/Knowledge context

### Approval required

- Send reply
- Mark business-critical message handled

### Dangerous / hard limits

- Auto-send messages
- Bulk mark read/delete

## Runbooks

- Client Reply Handling
- Agent Handoff Review

## History worth keeping

- Urgent replies
- Drafts sent
- Handoffs resolved

## Obsidian mappings

- Notes: person, lead
- Decisions: communication policy
- Runbooks: comms runbooks
- Incidents: missed/failed communication

## Deferred / excluded

- Full comms rail
- Inbox replacement
