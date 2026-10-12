import "server-only";

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface KnowledgeWriteResult {
  ok: boolean;
  message: string;
  relativePath?: string;
  absolutePath?: string;
}

export async function chooseAvailableVaultMarkdownPath(relativePath: string): Promise<string> {
  const normalized = normalizeVaultRelativePath(relativePath);
  if (!normalized.ok) return relativePath;
  const parsed = path.posix.parse(normalized.relativePath);
  for (let index = 1; index < 100; index += 1) {
    const candidate = index === 1 ? normalized.relativePath : path.posix.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`);
    const target = resolveVaultPath(candidate);
    if (!target.ok) return candidate;
    try {
      await access(target.absolutePath);
    } catch {
      return candidate;
    }
  }
  return normalized.relativePath;
}

export async function writeNewVaultMarkdown(relativePath: string, content: string): Promise<KnowledgeWriteResult> {
  const normalized = normalizeVaultRelativePath(relativePath);
  if (!normalized.ok) return normalized;
  const target = resolveVaultPath(normalized.relativePath);
  if (!target.ok) return target;
  try {
    await mkdir(path.dirname(target.absolutePath), { recursive: true });
    await writeFile(target.absolutePath, content, { flag: "wx" });
    return { ok: true, message: `created ${normalized.relativePath}`, relativePath: normalized.relativePath, absolutePath: target.absolutePath };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") return { ok: false, message: "note already exists" };
    return { ok: false, message: error instanceof Error ? error.message : "write failed" };
  }
}

function resolveVaultPath(relativePath: string): { ok: true; absolutePath: string } | { ok: false; message: string } {
  const vaultPath = process.env.UMBRA_OBSIDIAN_VAULT;
  if (!vaultPath) return { ok: false, message: "UMBRA_OBSIDIAN_VAULT is not configured" };
  const absolutePath = path.join(/* turbopackIgnore: true */ vaultPath, relativePath);
  const resolvedVault = path.resolve(/* turbopackIgnore: true */ vaultPath);
  const resolvedTarget = path.resolve(/* turbopackIgnore: true */ absolutePath);
  if (!resolvedTarget.startsWith(resolvedVault + path.sep)) return { ok: false, message: "path escapes vault" };
  return { ok: true, absolutePath: resolvedTarget };
}

function normalizeVaultRelativePath(relativePath: string): { ok: true; relativePath: string } | { ok: false; message: string } {
  const clean = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean.endsWith(".md")) return { ok: false, message: "only markdown notes can be written" };
  if (clean.split("/").some((part) => part === ".." || part === "")) return { ok: false, message: "invalid note path" };
  return { ok: true, relativePath: clean };
}
