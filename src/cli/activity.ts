import { createActivityContext } from "../activities/context.js";
import { listActivities, requireActivity } from "../activities/registry.js";
import {
  getNumberArg,
  getStringArg,
  parseArgs,
} from "./args.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const activityId = argv.find((a) => !a.startsWith("--"));

  if (!activityId || args.help === true) {
    console.log("Uso: npm run activity -- <id> [--flags...]\n");
    console.log("Actividades disponibles:");
    for (const activity of listActivities()) {
      console.log(`  ${activity.id} (${activity.kind}) — ${activity.description}`);
    }
    return;
  }

  const activity = requireActivity(activityId);
  const ctx = createActivityContext();

  if (activityId === "pairwise-duel") {
    const result = await activity.run(
      {
        action: (getStringArg(args, "action") ?? "status") as
          | "create"
          | "next"
          | "choose"
          | "result"
          | "status",
        from: getStringArg(args, "from"),
        to: getStringArg(args, "to"),
        minPlays: getNumberArg(args, "min-plays"),
        sessionId: getNumberArg(args, "session"),
        winnerBggId: getNumberArg(args, "winner"),
      },
      ctx,
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await activity.run(args, ctx);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
