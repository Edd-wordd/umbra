# Print Rail Audit

## Purpose

Print production surface for the Canon imagePROGRAF PRO-1000 and photo/astro print workflow. The Print rail should manage readiness, staging, history, and handoff to editing/stacking tools without becoming a photo editor.

## Belongs here

- Canon PRO-1000 status and queue
- CUPS/LPR state
- Staged print jobs
- Recent print history
- Paper/profile/ICC readiness
- Astro/photo image sets ready for print
- Handoff to Lightroom, Affinity, or stacking tools
- Reprint from known-good settings

## Does not belong here

- Full photo editor
- Full Lightroom/Affinity replacement
- Decorative previews without action
- Full ink analytics unless reliable
- Generic file browser

## Primary questions

- Is the printer ready?
- What is staged to print?
- What was printed recently with which settings?
- What astro/photo session can be processed into a print?
- What needs approval before paper/ink are consumed?

## Source of truth

- Live bridge/API: CUPS/LPR, local filesystem, optional print logs
- Obsidian context: print runbooks, device notes, session logs, print history notes
- External app link: CUPS, Lightroom, Affinity, stacking tool, Finder

## Entities

- device
- job
- service
- note
- runbook
- incident
- session

## Situations

- printer_offline
- print_queue_blocked
- print_job_ready
- ink_low
- paper_mismatch

## Actions

### Read / safe

- Show printer status
- Show print queue
- Show recent prints
- Open CUPS
- Reveal staged print folder
- Open image in Lightroom/Affinity

### Prepare

- Stage print job
- Prepare print readiness checklist
- Collect astro session frames
- Prepare stacking folder
- Prepare print export
- Prepare reprint from history

### Approval required

- Start print job
- Cancel print job
- Overwrite final export
- Delete staged export

### Dangerous / hard limits

- Auto-print without approval
- Delete original image sets
- Overwrite raw session data

## Runbooks

- Print Readiness Check
- Astro Image Print Pipeline
- Queue Blocked Recovery
- Reprint Known-good Settings

## History worth keeping

- Last prints with paper/profile/settings
- Failed/cancelled print jobs
- Successful astro print pipeline runs
- Known-good export settings

## Obsidian mappings

- Notes: device, session_log, resource
- Decisions: paper/profile/workflow choices
- Runbooks: print runbooks
- Incidents: queue failures, bad print, color/profile issues

## Deferred / excluded

- Full image editing
- Automated stacking implementation until tool is chosen
- Printer ink telemetry if not reliable
