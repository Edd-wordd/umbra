# Cameras Rail Audit

## Purpose

Camera source health and quick access surface. The Cameras rail should show whether streams are online, provide fast open/snapshot actions, and link camera problems to Lab/network services.

## Belongs here

- RTSP/source health
- Camera online/offline state
- NVR/source links
- Recent offline/recovery events
- Snapshot on demand
- Relationship to Lab services/storage/network

## Does not belong here

- Always-on camera wall in Umbra
- Full NVR replacement
- AI detection feed unless explicitly needed
- Notification spam
- Social/security theater features

## Primary questions

- Are camera streams online?
- Can I quickly open a camera?
- Did anything go offline/recover?
- Can I take a snapshot for an incident?
- Is the issue actually Lab/network related?

## Source of truth

- Live bridge/API: RTSP checks, NVR/Frigate/Home Assistant if used, network checks
- Obsidian context: device notes, camera runbooks, incidents
- External app link: NVR/camera UI

## Entities

- device
- service
- job
- incident
- note

## Situations

- camera_offline
- stream_unreachable

## Actions

### Read / safe

- Open camera stream
- Check stream health
- Take snapshot
- Open NVR/source UI
- Copy RTSP URL

### Prepare

- Prepare camera incident note
- Prepare restart plan
- Attach snapshot to incident

### Approval required

- Restart camera
- Restart NVR service
- Change recording mode
- Delete recordings

### Dangerous / hard limits

- Delete recordings without approval
- Disable recording without approval
- Change security/privacy settings without approval

## Runbooks

- Camera Offline Triage
- Stream Unreachable
- NVR Restart
- Snapshot Incident Capture

## History worth keeping

- Offline/recovered events
- Restarts
- Snapshots attached to incidents
- NVR/storage issues

## Obsidian mappings

- Notes: device, incident
- Decisions: camera/source/retention decisions
- Runbooks: camera runbooks
- Incidents: offline/stream failures

## Deferred / excluded

- Full surveillance dashboard
- AI detection pipeline
- Long-term retention UI
