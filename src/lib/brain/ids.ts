import type { BrainNodeType } from "./types";

const clean = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:/.@_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const brainId = (type: BrainNodeType, value: string) => `${type}:${clean(value)}`;

export const projectId = (name: string) => brainId("project", name);
export const repoId = (path: string) => brainId("repo", path);
export const serviceId = (provider: string, name: string) => brainId("service", `${provider}:${name}`);
export const deviceId = (kind: string, name: string) => brainId("device", `${kind}:${name}`);
export const agentId = (provider: string, id: string) => brainId("agent", `${provider}:${id}`);
export const sessionId = (provider: string, id: string) => brainId("session", `${provider}:${id}`);
export const processId = (pid: number | string) => brainId("process", String(pid));
export const runbookId = (domain: string, slug: string) => brainId("runbook", `${domain}:${slug}`);
export const decisionId = (domain: string, slug: string) => brainId("decision", `${domain}:${slug}`);
export const noteId = (vault: string, path: string) => brainId("note", `${vault}:${path}`);
