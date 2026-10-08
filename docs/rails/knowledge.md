# Knowledge Rail Audit

## Purpose

Structured memory and authoring surface for Obsidian-backed knowledge. The Knowledge rail should keep notes useful as typed graph inputs, surface decisions/runbooks, and help log sessions/incidents.

## Belongs here

- Obsidian vault health
- Typed notes and untyped inbox
- Decisions
- Runbooks
- Session logs
- Incidents
- Device/project/person/lead notes
- Broken links or missing umbra_id
- Search/open/write note actions

## Does not belong here

- Generic AI chat over notes
- Dumping the full vault into context
- Treating every wikilink as truth
- Graph visualization of every note
- Folder taxonomy as a replacement for ontology

## Primary questions

- What do I know?
- What did I decide?
- Which runbook applies?
- What needs to be logged?
- Which notes are untyped or missing structure?

## Source of truth

- Live bridge/API: vault filesystem/indexer
- Obsidian context: the vault itself
- External app link: Obsidian

## Entities

- note
- decision
- runbook
- project
- device
- person
- lead
- incident
- session

## Situations

- note_untyped
- decision_missing
- runbook_missing
- orphan_note

## Actions

### Read / safe

- Search vault
- Open note
- Show backlinks
- Show related decisions
- Show runbooks for entity

### Prepare

- Draft decision note
- Draft session log
- Draft incident note
- Structure inbox note
- Prepare note graph mapping

### Approval required

- Write note
- Move note
- Rename note
- Delete note
- Bulk tag/update notes

### Dangerous / hard limits

- Delete/bulk modify notes without approval
- Treat generated content as accepted decision without Edward approval

## Runbooks

- Structure Inbox Note
- Create Decision Record
- Log Session
- Log Incident
- Repair Knowledge Graph Metadata

## History worth keeping

- Notes indexed/skipped
- Decisions created/accepted
- Runbooks added/changed
- Session logs written
- Broken links fixed

## Obsidian mappings

- Notes: all typed notes
- Decisions: decision notes
- Runbooks: runbook notes
- Incidents: incident notes

## Deferred / excluded

- Full semantic search product
- Full note graph UI
- Automatic bulk rewriting
