import type { Play, PlayPlayer } from "../../domain/types.js";
import type { Db } from "../database.js";
import { runTransaction } from "../database.js";
import { sqlNull } from "../sql-utils.js";

function upsertPlayData(db: Db, play: Play, players: PlayPlayer[]): void {
  db.prepare(
    `INSERT INTO plays (
      play_id, bgg_id, game_name, date, quantity, length,
      location, incomplete, nowinstats, comments, synced_at
    ) VALUES (
      @playId, @bggId, @gameName, @date, @quantity, @length,
      @location, @incomplete, @nowinstats, @comments, @syncedAt
    )
    ON CONFLICT(play_id) DO UPDATE SET
      bgg_id = excluded.bgg_id,
      game_name = excluded.game_name,
      date = excluded.date,
      quantity = excluded.quantity,
      length = excluded.length,
      location = excluded.location,
      incomplete = excluded.incomplete,
      nowinstats = excluded.nowinstats,
      comments = excluded.comments,
      synced_at = excluded.synced_at`,
  ).run({
    playId: play.playId,
    bggId: play.bggId,
    gameName: play.gameName,
    date: play.date,
    quantity: play.quantity,
    length: play.length,
    location: play.location,
    incomplete: play.incomplete ? 1 : 0,
    nowinstats: play.nowinstats ? 1 : 0,
    comments: sqlNull(play.comments),
    syncedAt: play.syncedAt,
  });

  db.prepare("DELETE FROM play_players WHERE play_id = ?").run(play.playId);

  const insertPlayer = db.prepare(
    `INSERT INTO play_players (
      play_id, username, userid, name, score, win, color, rating
    ) VALUES (
      @playId, @username, @userid, @playerName, @score, @win, @color, @rating
    )`,
  );

  const seen = new Set<string>();
  for (const player of players) {
    const key = `${player.username}|${player.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    insertPlayer.run({
      playId: player.playId,
      username: player.username,
      userid: sqlNull(player.userid),
      playerName: player.name,
      score: player.score,
      win: player.win ? 1 : 0,
      color: player.color,
      rating: sqlNull(player.rating),
    });
  }
}

export function upsertPlay(db: Db, play: Play, players: PlayPlayer[]): void {
  runTransaction(db, () => upsertPlayData(db, play, players));
}

export function upsertPlays(
  db: Db,
  items: Array<{ play: Play; players: PlayPlayer[] }>,
): number {
  runTransaction(db, () => {
    for (const item of items) {
      upsertPlayData(db, item.play, item.players);
    }
  });
  return items.length;
}

export function getLatestPlayDate(db: Db): string | null {
  const row = db
    .prepare("SELECT MAX(date) AS max_date FROM plays")
    .get() as { max_date: string | null } | undefined;
  return row?.max_date ?? null;
}
