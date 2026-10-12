# Lab / Homelab Rail Audit

## Purpose

Operations surface for Proxmox, VMs, LXC containers, Docker services, network services, storage, backups, and self-hosted apps. The Lab rail should answer what is running, what is unhealthy, and what can be safely opened, restarted, or provisioned.

## Belongs here

- Proxmox nodes
- VMs and LXC containers
- Docker hosts and containers
- Jellyfin, Immich, AdGuard, n8n, and other self-hosted services
- Tailscale node reachability
- Storage pools, volumes, and backup state
- Service URLs and source-system links
- Provisioning templates for VMs/CTs

## Does not belong here

- Full Grafana replacement
- Constant CPU/memory charts for everything
- Media browsing inside Umbra
- Full network-topology art unless it explains a problem
- Dev-project Docker details unless attached to a Dev project

## Primary questions

- Are hosts and key services healthy?
- What service is running where?
- What restarted or went down?
- Are backups current?
- Can Umbra safely open, restart, or prepare a new VM/CT?

## Source of truth

- Live bridge/API: Proxmox API, Docker API, AdGuard API, Tailscale, service health checks
- Obsidian context: device notes, service notes, lab runbooks, incidents
- External app link: Proxmox UI, service dashboards, AdGuard, Jellyfin, Immich, n8n

## Entities

- device
- environment
- service
- process
- job
- runbook
- incident
- note

## Situations

- service_down
- container_restart_loop
- backup_stale
- tailscale_unreachable
- disk_pressure

## Actions

### Read / safe

- Open Proxmox
- Open service URL
- Show VM/CT status
- Show service logs
- Show backup status
- Show recent restarts

### Prepare

- Prepare VM/CT creation plan
- Prepare service restart plan
- Prepare update plan
- Prepare backup verification plan

### Approval required

- Restart service/container
- Start/stop VM or CT
- Create VM/CT
- Update containers
- Restore backup
- Change DNS/firewall/service config

### Dangerous / hard limits

- Delete VM/CT
- Wipe or detach volumes
- Restore over live data
- Change network routes
- Broad AdGuard rule changes

## Runbooks

- Service Restart
- Container Restart Loop
- VM/CT Provisioning
- Backup Verification
- Disk Pressure Response
- Tailscale Reachability Check

## History worth keeping

- Service restarts
- VM/CT creation
- Backup failures/staleness
- Storage incidents
- Network outages

## Obsidian mappings

- Notes: device, service, area, incident
- Decisions: hosting, network, storage, backup decisions
- Runbooks: lab runbooks
- Incidents: outages, restart loops, backup failures

## Deferred / excluded

- Full observability dashboard
- Media library UI
- Automated destructive maintenance
