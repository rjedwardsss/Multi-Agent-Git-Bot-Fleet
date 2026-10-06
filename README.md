# Multi-Agent Git-Bot Fleet

A TypeScript Node simulation of a multi-agent repository maintenance fleet with handoffs, file locks, spawned backlog items, and parallel ticks.

Portfolio demo: https://rjedwards.dev/projects/git-bot-fleet

## Simulation-only guarantee

This project is intentionally in-memory and simulation-only. It does not call the GitHub API, does not use Octokit, does not push branches, and does not modify local or remote repositories.

## Agents

- `triage`: labels, priority, and handoffs
- `lint-fixer`: simulated lint patches
- `docs`: README / docs updates
- `deps`: dependency review

## Workflow

Each work item moves through phases: `intake → triaged → assigned → patching → review → resolved`. Agents lock simulated files; conflicts produce a `blocked` state until the lock clears. New issues can spawn while the fleet runs.

## Run

```bash
npm install
npm run smoke
# or
npx tsx src/cli.ts --ticks 10
```

The CLI ticks the fleet forward and prints the board, file locks, and action log.
