export interface PrintDevice {
  id: string;
  label: string;
  model: string;
  status: "ready" | "offline" | "attention";
  queue: "clear" | "blocked" | "printing";
  paper?: string;
  profile?: string;
}

export interface PrintJob {
  id: string;
  title: string;
  status: "recent" | "staged" | "printing" | "failed";
  source?: string;
  paper?: string;
  profile?: string;
  printedAt?: number;
}

export interface PrintImageSet {
  id: string;
  title: string;
  sourceSession?: string;
  status: "imported" | "stack_ready" | "edit_ready" | "print_ready";
  files: number;
}

export interface PrintSnapshot {
  device: PrintDevice;
  jobs: PrintJob[];
  imageSets: PrintImageSet[];
}
