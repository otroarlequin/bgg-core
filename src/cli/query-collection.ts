import { loadConfig } from "../config/index.js";
import { createDatabase } from "../storage/index.js";
import { createQueryService } from "../query/index.js";
import {
  getBooleanArg,
  getNumberArg,
  getStringArg,
  parseArgs,
} from "./args.js";

function parseListArg(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const queries = createQueryService(createDatabase(config.dbPath));

  const results = queries.queryCollection({
    own: getBooleanArg(args, "own") ? true : undefined,
    wishlist: getBooleanArg(args, "wishlist") ? true : undefined,
    minPlays: getNumberArg(args, "min-plays"),
    includeExpansions: getBooleanArg(args, "include-expansions") ? true : undefined,
    designer: getStringArg(args, "designer"),
    artist: getStringArg(args, "artist"),
    publisher: getStringArg(args, "publisher"),
    categories: parseListArg(getStringArg(args, "categories")),
    mechanics: parseListArg(getStringArg(args, "mechanics")),
    languageDependence: getStringArg(args, "language-dependence"),
    players: getNumberArg(args, "players"),
    sortBy: (getStringArg(args, "sort") as "name" | "rating" | "plays" | "weight") ?? "name",
    limit: getNumberArg(args, "limit"),
  });

  if (results.length === 0) {
    console.log("Sin resultados.");
    return;
  }

  for (const item of results) {
    const rating = item.personalRating ?? "-";
    const plays = item.numPlays;
    console.log(
      `[${item.bggId}] ${item.name} | rating: ${rating} | partidas: ${plays} | ${item.subtype}`,
    );
  }

  console.log(`\nTotal: ${results.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
