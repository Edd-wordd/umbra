# Deferred Rails / Later Phases

## Life Ops

### Current stance

Deferred until core operational rails are working. Life Ops should not become a generic personal dashboard.

### Possible future scope

- Apple Health export ingestion
- Important document reminders
- Maintenance logs
- Home inventory

### Excluded for now

- Calendar-first planning
- Habit tracker
- Generic life dashboard
- Motivational widgets

## Desk Robot

### Current stance

Later phase only. Treat as physical action domain with strict safety limits.

### Possible future scope

- Robot status
- Dock/charge state
- Simple approved commands
- Safety/runbook checks

### Hard limits

- No autonomous physical motion without explicit approval
- No unsafe movement near people/equipment
- No destructive/physical actions without target confirmation

## General deferred rules

- Do not add a rail just because an integration exists.
- Do not build dashboards before actions/runbooks/sources of truth are clear.
- Do not surface data unless it changes judgment or prepares action.
