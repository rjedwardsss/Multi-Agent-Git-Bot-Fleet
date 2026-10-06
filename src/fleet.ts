/**
 * Multi-agent git-bot fleet — in-memory simulation only.
 * Aligned with Multi-Agent-Git-Bot-Fleet/src/fleet.ts.
 * No GitHub API, pushes, or remote writes.
 */

export type AgentName = "triage" | "lint-fixer" | "docs" | "deps";
export type WorkItemType = "issue" | "pull-request" | "finding";
export type WorkItemStatus = "open" | "in-progress" | "blocked" | "resolved";
export type WorkPhase =
  | "intake"
  | "triaged"
  | "assigned"
  | "patching"
  | "review"
  | "resolved";

export type SimFile = {
  path: string;
  lockedBy: AgentName | null;
  revision: number;
};

export type WorkItem = {
  id: number;
  type: WorkItemType;
  title: string;
  labels: string[];
  status: WorkItemStatus;
  phase: WorkPhase;
  priority: number;
  owner?: AgentName;
  files: string[];
  note?: string;
};

export type FleetAgent = {
  name: AgentName;
  specialty: string;
  handled: number;
  active: boolean;
};

export type FleetState = {
  tick: number;
  nextId: number;
  agents: FleetAgent[];
  items: WorkItem[];
  files: SimFile[];
  log: string[];
  lastActive: AgentName[];
};

const AGENTS: Omit<FleetAgent, "handled" | "active">[] = [
  { name: "triage", specialty: "labels and priority" },
  { name: "lint-fixer", specialty: "format and static findings" },
  { name: "docs", specialty: "README and changelog gaps" },
  { name: "deps", specialty: "dependency update review" },
];

const SEED_ITEMS: Omit<WorkItem, "status" | "phase" | "owner" | "note">[] = [
  {
    id: 101,
    type: "issue",
    title: "Crash on empty config",
    labels: ["bug"],
    priority: 1,
    files: ["src/config.ts"],
  },
  {
    id: 102,
    type: "finding",
    title: "ESLint no-unused-vars in parser",
    labels: ["lint"],
    priority: 2,
    files: ["src/parser.ts"],
  },
  {
    id: 103,
    type: "pull-request",
    title: "Add quickstart examples",
    labels: ["docs"],
    priority: 3,
    files: ["README.md"],
  },
  {
    id: 104,
    type: "issue",
    title: "Bump vite patch release",
    labels: ["dependency"],
    priority: 2,
    files: ["package.json"],
  },
];

const SPAWN_POOL: Array<{
  type: WorkItemType;
  title: string;
  labels: string[];
  priority: number;
  files: string[];
}> = [
  {
    type: "finding",
    title: "Prefer const in utils/format",
    labels: ["lint"],
    priority: 3,
    files: ["src/utils/format.ts"],
  },
  {
    type: "issue",
    title: "Document env vars for local demos",
    labels: ["docs"],
    priority: 3,
    files: ["README.md", "docs/setup.md"],
  },
  {
    type: "issue",
    title: "Upgrade eslint peer range",
    labels: ["dependency"],
    priority: 2,
    files: ["package.json"],
  },
  {
    type: "issue",
    title: "Null check missing in loader",
    labels: ["bug"],
    priority: 1,
    files: ["src/loader.ts", "src/config.ts"],
  },
  {
    type: "pull-request",
    title: "Clarify contribution checklist",
    labels: ["docs"],
    priority: 4,
    files: ["CONTRIBUTING.md"],
  },
  {
    type: "finding",
    title: "Unused import in router helpers",
    labels: ["lint"],
    priority: 2,
    files: ["src/router.ts"],
  },
];

function cloneFiles(files: SimFile[]): SimFile[] {
  return files.map((file) => ({ ...file }));
}

function seedFiles(): SimFile[] {
  const paths = new Set<string>();
  for (const item of SEED_ITEMS) {
    for (const path of item.files) paths.add(path);
  }
  for (const spawn of SPAWN_POOL) {
    for (const path of spawn.files) paths.add(path);
  }
  return [...paths].sort().map((path) => ({ path, lockedBy: null, revision: 1 }));
}

export function createFleet(): FleetState {
  return {
    tick: 0,
    nextId: 105,
    agents: AGENTS.map((agent) => ({ ...agent, handled: 0, active: false })),
    items: SEED_ITEMS.map((item) => ({
      ...item,
      labels: [...item.labels],
      files: [...item.files],
      status: "open",
      phase: "intake",
    })),
    files: seedFiles(),
    log: ["Simulation booted: no GitHub writes or remote changes."],
    lastActive: [],
  };
}

function specialistFor(item: WorkItem): AgentName {
  if (item.labels.includes("lint")) return "lint-fixer";
  if (item.labels.includes("docs")) return "docs";
  if (item.labels.includes("dependency")) return "deps";
  return "lint-fixer";
}

function fileEntry(state: FleetState, path: string): SimFile {
  let file = state.files.find((candidate) => candidate.path === path);
  if (!file) {
    file = { path, lockedBy: null, revision: 1 };
    state.files.push(file);
  }
  return file;
}

function unlockAgent(state: FleetState, agent: AgentName) {
  for (const file of state.files) {
    if (file.lockedBy === agent) file.lockedBy = null;
  }
}

function tryLock(state: FleetState, agent: AgentName, paths: string[]): string | null {
  for (const path of paths) {
    const file = fileEntry(state, path);
    if (file.lockedBy && file.lockedBy !== agent) {
      return file.lockedBy;
    }
  }
  for (const path of paths) {
    fileEntry(state, path).lockedBy = agent;
  }
  return null;
}

function bumpFiles(state: FleetState, paths: string[]) {
  for (const path of paths) {
    fileEntry(state, path).revision += 1;
  }
}

function markAgent(state: FleetState, name: AgentName) {
  const agent = state.agents.find((candidate) => candidate.name === name);
  if (!agent) return;
  agent.handled += 1;
  agent.active = true;
  if (!state.lastActive.includes(name)) state.lastActive.push(name);
}

function pushLog(state: FleetState, message: string) {
  state.log.push(`tick ${state.tick}: ${message}`);
}

function sortedOpen(state: FleetState): WorkItem[] {
  return state.items
    .filter((item) => item.status === "open" || item.status === "in-progress" || item.status === "blocked")
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function maybeSpawn(state: FleetState) {
  const unfinished = state.items.filter((item) => item.status !== "resolved").length;
  if (unfinished >= 7) return;
  if (state.tick % 3 !== 0) return;
  const template = SPAWN_POOL[(state.tick + state.nextId) % SPAWN_POOL.length];
  const item: WorkItem = {
    id: state.nextId,
    type: template.type,
    title: template.title,
    labels: [...template.labels],
    priority: template.priority,
    files: [...template.files],
    status: "open",
    phase: "intake",
  };
  state.nextId += 1;
  state.items.push(item);
  pushLog(
    state,
    `spawned #${item.id} "${item.title}" (reason: backlog refresh keeps the fleet busy)`,
  );
}

function advanceItem(state: FleetState, item: WorkItem): boolean {
  if (item.status === "resolved") return false;

  // Blocked items retry locks
  if (item.status === "blocked" && item.owner) {
    const blocker = tryLock(state, item.owner, item.files);
    if (blocker) {
      pushLog(
        state,
        `${item.owner} still blocked on #${item.id} (reason: ${blocker} holds ${item.files.join(", ")})`,
      );
      markAgent(state, item.owner);
      return true;
    }
    item.status = "in-progress";
    item.note = "lock acquired after wait";
    pushLog(
      state,
      `${item.owner} unblocked #${item.id} (reason: file lock released)`,
    );
    markAgent(state, item.owner);
    return true;
  }

  if (item.phase === "intake") {
    item.owner = "triage";
    item.status = "in-progress";
    item.phase = "triaged";
    if (!item.labels.includes("triaged")) item.labels.push("triaged");
    item.priority = Math.max(1, item.priority - (item.labels.includes("bug") ? 1 : 0));
    pushLog(
      state,
      `triage labeled #${item.id} and set priority ${item.priority} (reason: intake routing)`,
    );
    markAgent(state, "triage");
    return true;
  }

  if (item.phase === "triaged") {
    const specialist = specialistFor(item);
    item.owner = specialist;
    item.phase = "assigned";
    item.status = "in-progress";
    pushLog(
      state,
      `triage handed #${item.id} to ${specialist} (reason: labels=${item.labels.join("/")})`,
    );
    markAgent(state, "triage");
    markAgent(state, specialist);
    return true;
  }

  if (item.phase === "assigned" || item.phase === "patching") {
    const agent = item.owner ?? specialistFor(item);
    item.owner = agent;
    const blocker = tryLock(state, agent, item.files);
    if (blocker) {
      item.status = "blocked";
      item.note = `waiting on ${blocker}`;
      pushLog(
        state,
        `${agent} blocked on #${item.id} (reason: conflict with ${blocker} on ${item.files.join(", ")})`,
      );
      markAgent(state, agent);
      return true;
    }

    if (item.phase === "assigned") {
      item.phase = "patching";
      item.status = "in-progress";
      item.note = "simulated patch draft";
      pushLog(
        state,
        `${agent} opened simulated patch for #${item.id} (reason: specialty match)`,
      );
      markAgent(state, agent);
      return true;
    }

    bumpFiles(state, item.files);
    unlockAgent(state, agent);
    item.phase = "review";
    item.status = "in-progress";
    item.note = "awaiting review";
    pushLog(
      state,
      `${agent} finished patch on #${item.id} (reason: files ${item.files.join(", ")} rev+1)`,
    );
    markAgent(state, agent);
    return true;
  }

  if (item.phase === "review") {
    const reviewer: AgentName = item.owner === "triage" ? "docs" : "triage";
    item.phase = "resolved";
    item.status = "resolved";
    item.note = "merged in memory";
    if (item.owner) unlockAgent(state, item.owner);
    pushLog(
      state,
      `${reviewer} approved #${item.id} from ${item.owner ?? "unknown"} (reason: simulated review gate passed)`,
    );
    markAgent(state, reviewer);
    if (item.owner) markAgent(state, item.owner);
    return true;
  }

  return false;
}

/** One simulation tick: up to two parallel agent actions + occasional spawn. */
export function tickFleet(state: FleetState): FleetState {
  const next: FleetState = {
    tick: state.tick + 1,
    nextId: state.nextId,
    agents: state.agents.map((agent) => ({ ...agent, active: false })),
    items: state.items.map((item) => ({
      ...item,
      labels: [...item.labels],
      files: [...item.files],
    })),
    files: cloneFiles(state.files),
    log: [...state.log],
    lastActive: [],
  };

  maybeSpawn(next);

  let actions = 0;
  const busyAgents = new Set<AgentName>();
  const queue = sortedOpen(next);

  for (const item of queue) {
    if (actions >= 2) break;
    const prospective =
      item.phase === "intake" || item.phase === "triaged"
        ? "triage"
        : item.phase === "review"
          ? item.owner === "triage"
            ? "docs"
            : "triage"
          : (item.owner ?? specialistFor(item));

    if (busyAgents.has(prospective) && item.phase !== "triaged") continue;

    const beforePhase = item.phase;
    const acted = advanceItem(next, item);
    if (!acted) continue;

    actions += 1;
    for (const name of next.lastActive) busyAgents.add(name);

    // After triage->assigned, allow a second different agent same tick on another item
    if (beforePhase === "triaged") {
      busyAgents.add("triage");
    }
  }

  if (actions === 0) {
    const unresolved = next.items.some((item) => item.status !== "resolved");
    pushLog(
      next,
      unresolved
        ? "fleet idle (reason: all active work blocked or waiting)"
        : "all simulated work resolved",
    );
  }

  return next;
}

export function runFleet(ticks: number): FleetState {
  let state = createFleet();
  for (let i = 0; i < ticks; i += 1) {
    state = tickFleet(state);
  }
  return state;
}

export function itemsByStatus(state: FleetState, status: WorkItemStatus): WorkItem[] {
  return state.items
    .filter((item) => item.status === status)
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
}
