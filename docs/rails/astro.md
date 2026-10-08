# Astro Rail Audit

## Purpose

Observation and capture operations surface. The Astro rail should answer whether a session is viable, whether gear is ready, what target to capture, and how to import/log the session afterward.

## Belongs here

- INDI / Raspberry Pi bridge
- OnStep mount status/control
- Sony A7 II capture status
- Parallax target feed
- Weather/moon/visibility readiness
- Session plans
- Last session summary
- Session image import into processing/print pipeline
- Session logging

## Does not belong here

- Full KStars replacement
- Full planetarium app
- Decorative star maps without action
- Unsafe autonomous mount movement
- General weather dashboard unrelated to observing

## Primary questions

- Can I observe tonight?
- Is the gear ready?
- What target is best now/tonight?
- What happened last session?
- Are captured images imported/logged/ready for processing?

## Source of truth

- Live bridge/API: INDI, OnStep, camera bridge, Parallax, weather source
- Obsidian context: session logs, device notes, target notes, astro runbooks
- External app link: INDI Web Manager, camera folders, stacking/editing tools

## Entities

- device
- target
- session
- job
- note
- runbook
- incident

## Situations

- astro_window_candidate
- astro_device_disconnected
- weather_risk
- alignment_required

## Actions

### Read / safe

- Check INDI
- Check mount
- Check camera
- Show target list
- Show visibility/weather window
- Show last session
- Open session folder

### Prepare

- Prepare session plan
- Prepare capture folders
- Prepare calibration checklist
- Import session images
- Draft session log

### Approval required

- Connect/disconnect equipment if disruptive
- Slew mount
- Start capture sequence
- Park mount
- Change tracking

### Dangerous / hard limits

- Move mount without explicit approval
- Ignore safety limits
- Overwrite raw captures
- Start unattended physical actions without checks

## Runbooks

- Astro Readiness Check
- Session Capture Plan
- Session Image Import
- Mount Alignment Required
- Session Logging

## History worth keeping

- Last sessions
- Targets captured
- Gear/settings used
- Capture failures
- Imported/not imported state
- Calibration frame completeness

## Obsidian mappings

- Notes: device, session_log, resource, target notes
- Decisions: gear/workflow/tool choices
- Runbooks: astro runbooks
- Incidents: failed captures, device disconnects, weather aborts

## Deferred / excluded

- KStars
- Full planetarium
- Autonomous unsafe mount actions
