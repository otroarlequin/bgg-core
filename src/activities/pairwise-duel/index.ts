import type {
  DuelComparison,
  DuelSession,
  GamePeriodSummary,
} from "../../domain/types.js";
import type { QueryGamesPlayedInPeriodParams } from "../../query/plays.js";
import type { ActivityContext } from "../types.js";

export type DuelPoolFilters = Omit<
  QueryGamesPlayedInPeriodParams,
  "from" | "to" | "minPlays" | "includeIncomplete"
>;

export interface PairwiseDuelParams {
  action: "create" | "next" | "choose" | "result" | "status" | "abandon";
  from?: string;
  to?: string;
  minPlays?: number;
  sessionId?: number;
  winnerBggId?: number;
  force?: boolean;
  filters?: DuelPoolFilters;
}

export interface PairwiseDuelOutput {
  session?: DuelSession;
  duel?: DuelComparison | null;
  winner?: GamePeriodSummary;
  message: string;
}

const pendingDuels = new Map<number, DuelComparison>();

function shufflePickTwo(ids: number[]): [number, number] | null {
  if (ids.length < 2) return null;
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return [copy[0], copy[1]];
}

function findSummary(
  summaries: GamePeriodSummary[],
  bggId: number,
): GamePeriodSummary {
  const found = summaries.find((s) => s.bggId === bggId);
  if (!found) throw new Error(`Juego ${bggId} no encontrado en el periodo`);
  return found;
}

function periodParamsFromSession(
  session: DuelSession,
): QueryGamesPlayedInPeriodParams {
  let filters: DuelPoolFilters = {};
  if (session.filtersJson) {
    try {
      filters = JSON.parse(session.filtersJson) as DuelPoolFilters;
    } catch {
      filters = {};
    }
  }
  return {
    from: session.periodFrom,
    to: session.periodTo,
    minPlays: session.minPlays,
    includeIncomplete: false,
    ...filters,
  };
}

export function createSession(
  ctx: ActivityContext,
  input: {
    from: string;
    to: string;
    minPlays?: number;
    force?: boolean;
    filters?: DuelPoolFilters;
  },
): DuelSession {
  const active = ctx.storage.duel.getActiveDuelSession(ctx.storage.db);
  if (active) {
    if (input.force) {
      ctx.storage.duel.abandonDuelSession(
        ctx.storage.db,
        active.id,
        new Date().toISOString(),
      );
      pendingDuels.delete(active.id);
    } else {
      throw new Error(
        `Ya hay una sesión activa (#${active.id}). Continúala o abandónala antes de crear otra.`,
      );
    }
  }

  const filters = input.filters ?? {};
  const games = ctx.queries.queryGamesPlayedInPeriod({
    from: input.from,
    to: input.to,
    minPlays: input.minPlays ?? 1,
    includeIncomplete: false,
    ...filters,
  });

  if (games.length < 2) {
    throw new Error(
      `Se necesitan al menos 2 juegos con estos filtros entre ${input.from} y ${input.to}. Encontrados: ${games.length}.`,
    );
  }

  return ctx.storage.duel.createDuelSession(ctx.storage.db, {
    periodFrom: input.from,
    periodTo: input.to,
    minPlays: input.minPlays ?? 1,
    remainingBggIds: games.map((g) => g.bggId),
    filtersJson: JSON.stringify(filters),
    startedAt: new Date().toISOString(),
  });
}

export function buildDuel(
  ctx: ActivityContext,
  sessionId: number,
): DuelComparison | null {
  const session = ctx.storage.duel.getDuelSession(ctx.storage.db, sessionId);
  if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);
  if (session.status === "completed") return null;

  const remaining = session.remainingBggIds;
  if (remaining.length <= 1) return null;

  const pair = shufflePickTwo(remaining);
  if (!pair) return null;

  const summaries = ctx.queries.queryGamesPlayedInPeriod(
    periodParamsFromSession(session),
  );

  const roundNumber =
    ctx.storage.duel.getDuelRoundCount(ctx.storage.db, sessionId) + 1;

  return {
    sessionId,
    roundNumber,
    candidateA: findSummary(summaries, pair[0]),
    candidateB: findSummary(summaries, pair[1]),
    remainingCount: remaining.length,
  };
}

export function peekNextDuel(
  ctx: ActivityContext,
  sessionId: number,
): DuelComparison | null {
  let duel = pendingDuels.get(sessionId);
  if (!duel) {
    duel = buildDuel(ctx, sessionId) ?? undefined;
    if (duel) pendingDuels.set(sessionId, duel);
  }
  return duel ?? null;
}

export function getResult(
  ctx: ActivityContext,
  sessionId: number,
): GamePeriodSummary | null {
  const session = ctx.storage.duel.getDuelSession(ctx.storage.db, sessionId);
  if (!session?.winnerBggId) return null;

  const summaries = ctx.queries.queryGamesPlayedInPeriod(
    periodParamsFromSession(session),
  );

  return summaries.find((s) => s.bggId === session.winnerBggId) ?? null;
}

export function submitChoiceForPending(
  ctx: ActivityContext,
  sessionId: number,
  winnerBggId: number,
): DuelSession {
  const duel = pendingDuels.get(sessionId);
  if (!duel) throw new Error("No hay duelo pendiente. Ejecuta 'next' primero.");

  const session = ctx.storage.duel.getDuelSession(ctx.storage.db, sessionId);
  if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);

  if (
    winnerBggId !== duel.candidateA.bggId &&
    winnerBggId !== duel.candidateB.bggId
  ) {
    throw new Error(
      "El ganador debe ser uno de los dos candidatos del duelo actual",
    );
  }

  const loserBggId =
    winnerBggId === duel.candidateA.bggId
      ? duel.candidateB.bggId
      : duel.candidateA.bggId;

  ctx.storage.duel.insertDuelRound(ctx.storage.db, {
    sessionId,
    roundNumber: duel.roundNumber,
    candidateABggId: duel.candidateA.bggId,
    candidateBBggId: duel.candidateB.bggId,
    winnerBggId,
    decidedAt: new Date().toISOString(),
  });

  pendingDuels.delete(sessionId);

  const remaining = session.remainingBggIds.filter((id) => id !== loserBggId);

  if (remaining.length === 1) {
    ctx.storage.duel.completeDuelSession(
      ctx.storage.db,
      sessionId,
      remaining[0],
      new Date().toISOString(),
    );
  } else {
    ctx.storage.duel.updateDuelSessionRemaining(
      ctx.storage.db,
      sessionId,
      remaining,
    );
  }

  const updated = ctx.storage.duel.getDuelSession(ctx.storage.db, sessionId);
  if (!updated) throw new Error("Error al actualizar sesión");
  return updated;
}

export async function runPairwiseDuel(
  params: PairwiseDuelParams,
  ctx: ActivityContext,
): Promise<PairwiseDuelOutput> {
  switch (params.action) {
    case "create": {
      if (!params.from || !params.to) {
        throw new Error("create requiere --from y --to");
      }
      const session = createSession(ctx, {
        from: params.from,
        to: params.to,
        minPlays: params.minPlays,
        force: params.force,
        filters: params.filters,
      });
      return {
        session,
        message: `Sesión #${session.id} creada con ${session.remainingBggIds.length} juegos.`,
      };
    }
    case "abandon": {
      const session =
        params.sessionId !== undefined
          ? ctx.storage.duel.getDuelSession(ctx.storage.db, params.sessionId)
          : ctx.storage.duel.getActiveDuelSession(ctx.storage.db);
      if (!session || session.status !== "active") {
        return { message: "No hay sesión activa para abandonar." };
      }
      ctx.storage.duel.abandonDuelSession(
        ctx.storage.db,
        session.id,
        new Date().toISOString(),
      );
      pendingDuels.delete(session.id);
      return {
        message: `Sesión #${session.id} abandonada.`,
      };
    }
    case "status": {
      const session =
        params.sessionId !== undefined
          ? ctx.storage.duel.getDuelSession(ctx.storage.db, params.sessionId)
          : ctx.storage.duel.getActiveDuelSession(ctx.storage.db);
      if (!session) {
        return { message: "No hay sesión activa." };
      }
      return {
        session,
        message: `Sesión #${session.id}: ${session.remainingBggIds.length} juegos restantes (${session.status}).`,
      };
    }
    case "next": {
      const sessionId =
        params.sessionId ??
        ctx.storage.duel.getActiveDuelSession(ctx.storage.db)?.id;
      if (!sessionId) throw new Error("No hay sesión activa. Usa create primero.");

      pendingDuels.delete(sessionId);
      const duel = peekNextDuel(ctx, sessionId);
      if (!duel) {
        const winner = getResult(ctx, sessionId);
        return {
          duel: null,
          winner: winner ?? undefined,
          message: winner
            ? `Torneo completado. Ganador: ${winner.name}`
            : "No hay más duelos.",
        };
      }
      return {
        duel,
        message: `Duelo #${duel.roundNumber}: ${duel.candidateA.name} vs ${duel.candidateB.name}`,
      };
    }
    case "choose": {
      const sessionId =
        params.sessionId ??
        ctx.storage.duel.getActiveDuelSession(ctx.storage.db)?.id;
      if (!sessionId) throw new Error("No hay sesión activa.");
      if (params.winnerBggId === undefined) {
        throw new Error("choose requiere --winner <bgg_id>");
      }

      const session = submitChoiceForPending(
        ctx,
        sessionId,
        params.winnerBggId,
      );
      if (session.status === "completed" && session.winnerBggId) {
        const winner = getResult(ctx, sessionId);
        return {
          session,
          winner: winner ?? undefined,
          message: winner
            ? `¡Ganador del periodo: ${winner.name}!`
            : "Sesión completada.",
        };
      }
      return {
        session,
        message: `Elección registrada. Quedan ${session.remainingBggIds.length} juegos.`,
      };
    }
    case "result": {
      const sessionId =
        params.sessionId ??
        ctx.storage.duel.getActiveDuelSession(ctx.storage.db)?.id;
      if (!sessionId) throw new Error("Indica --session o crea una sesión.");
      const winner = getResult(ctx, sessionId);
      return {
        winner: winner ?? undefined,
        message: winner
          ? `Ganador: ${winner.name} (${winner.playCount} partidas en el periodo)`
          : "Aún no hay ganador.",
      };
    }
    default:
      throw new Error(`Acción desconocida: ${String(params.action)}`);
  }
}

export const pairwiseDuelActivity = {
  id: "pairwise-duel",
  name: "Duel ranking del periodo",
  kind: "interactive" as const,
  description:
    "Comparación por pares con eliminación para elegir el mejor juego de un periodo.",
  run: runPairwiseDuel,
};
