import { createActivityContext } from "../activities/context.js";
import { runPairwiseDuel } from "../activities/pairwise-duel/index.js";
import {
  getNumberArg,
  getStringArg,
  parseArgs,
} from "./args.js";

function formatDuelSummary(
  duel: NonNullable<Awaited<ReturnType<typeof runPairwiseDuel>>["duel"]>,
): void {
  const fmt = (g: typeof duel.candidateA) =>
    [
      `${g.name} (#${g.bggId})`,
      `  Partidas: ${g.playCount}`,
      `  Tiempo: ${g.totalMinutes} min`,
      `  Periodo: ${g.firstPlay} → ${g.lastPlay}`,
      g.personalRating ? `  Rating personal: ${g.personalRating}` : null,
      g.designers.length ? `  Diseñadores: ${g.designers.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  console.log(
    `\n=== Duelo #${duel.roundNumber} (${duel.remainingCount} en competencia) ===\n`,
  );
  console.log("A:\n" + fmt(duel.candidateA));
  console.log("\nB:\n" + fmt(duel.candidateB));
  console.log(
    `\nElige con: npm run activity:duel -- choose --winner ${duel.candidateA.bggId}  (o ${duel.candidateB.bggId})`,
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const positional = argv.filter((a) => !a.startsWith("--"));

  const resolvedAction = (getStringArg(args, "action") ??
    positional[0] ??
    (getStringArg(args, "from") && getStringArg(args, "to")
      ? "create"
      : getNumberArg(args, "winner") !== undefined
        ? "choose"
        : "status")) as
    | "create"
    | "next"
    | "choose"
    | "result"
    | "status";

  const ctx = createActivityContext();
  const output = await runPairwiseDuel(
    {
      action: resolvedAction,
      from: getStringArg(args, "from"),
      to: getStringArg(args, "to"),
      minPlays: getNumberArg(args, "min-plays"),
      sessionId: getNumberArg(args, "session"),
      winnerBggId: getNumberArg(args, "winner"),
    },
    ctx,
  );

  console.log(output.message);
  if (output.session) {
    console.log(
      `Sesión #${output.session.id} | restantes: ${output.session.remainingBggIds.length}`,
    );
  }
  if (output.duel) formatDuelSummary(output.duel);
  if (output.winner) {
    console.log(`\nGanador: ${output.winner.name} (#${output.winner.bggId})`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
