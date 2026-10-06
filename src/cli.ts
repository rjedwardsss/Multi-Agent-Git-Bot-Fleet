import { runFleet } from "./fleet.js";

function readTicks(argv: string[]) {
  const flag = argv.indexOf("--ticks");
  if (flag >= 0 && argv[flag + 1]) {
    const parsed = Number(argv[flag + 1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 8;
}

const ticks = readTicks(process.argv.slice(2));
const state = runFleet(ticks);

console.log("Multi-Agent Git-Bot Fleet (simulation only)");
console.log("No GitHub API writes, no pushes, no remotes modified.");
console.log(`ticks=${state.tick}`);
console.log("\nAgents:");
for (const agent of state.agents) {
  console.log(`- ${agent.name}: ${agent.specialty}, handled=${agent.handled}`);
}

console.log("\nBoard:");
for (const item of state.items) {
  console.log(
    `- #${item.id} ${item.type} [${item.status}/${item.phase}] p${item.priority} ${item.title}` +
      `${item.owner ? ` owner=${item.owner}` : ""}` +
      ` files=${item.files.join(",")}`,
  );
}

console.log("\nFiles:");
for (const file of state.files) {
  console.log(
    `- ${file.path} rev=${file.revision}` +
      `${file.lockedBy ? ` lockedBy=${file.lockedBy}` : ""}`,
  );
}

console.log("\nAction log:");
for (const entry of state.log.slice(-16)) {
  console.log(`- ${entry}`);
}
