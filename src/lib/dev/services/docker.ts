import { defineService, notConnected } from "./types";

/** Only the containers tied to this project. General Docker lives on the LAB/NET rail. */
export interface DockerPayload {
  host: string;
  containers: { name: string; image: string; state: "running" | "restarting" | "exited"; up: string; port?: number }[];
}

export const docker = defineService<DockerPayload>({
  id: "docker",
  label: "docker",
  chip: "D",
  blurb: "this project's containers (rest stays on LAB/NET)",
  read(p) {
    if (!p) return notConnected("Docker");
    const bad = p.containers.filter((c) => c.state === "exited");
    const flapping = p.containers.filter((c) => c.state === "restarting");
    return {
      status: bad.length ? "broken" : flapping.length ? "attention" : "ok",
      summary: bad.length
        ? `${bad.length} exited`
        : flapping.length
          ? `${flapping[0].name} restarting`
          : `${p.containers.length} up · ${p.host}`,
      rows: [
        ...p.containers.map((c) => ({
          k: c.name,
          v: `${c.state} · ${c.up}${c.port ? ` · :${c.port}` : ""}`,
          tone: c.state === "exited" ? ("broken" as const) : c.state === "restarting" ? ("attention" as const) : undefined,
        })),
      ],
    };
  },
});
