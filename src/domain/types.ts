export type GameSubtype = "boardgame" | "boardgameexpansion" | "boardgameaccessory";

export interface Game {
  bggId: number;
  name: string;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  weight: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  designers: string[];
  artists: string[];
  publishers: string[];
  mechanics: string[];
  categories: string[];
  languageDependence: string | null;
  bggRating: number | null;
  bggRank: number | null;
  thingSyncedAt: string;
}

export interface CollectionEntry {
  collId: number;
  bggId: number;
  subtype: GameSubtype;
  name: string;
  yearPublished: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  own: boolean;
  prevOwned: boolean;
  forTrade: boolean;
  want: boolean;
  wantToPlay: boolean;
  wantToBuy: boolean;
  wishlist: boolean;
  preordered: boolean;
  hasParts: boolean;
  wantParts: boolean;
  personalRating: number | null;
  comment: string | null;
  wishlistPriority: number | null;
  numPlays: number;
  bggRating: number | null;
  bggRank: number | null;
  lastModified: string | null;
  syncedAt: string;
}

export interface Play {
  playId: number;
  bggId: number;
  gameName: string;
  date: string;
  quantity: number;
  length: number;
  location: string;
  incomplete: boolean;
  nowinstats: boolean;
  comments: string | null;
  syncedAt: string;
}

export interface PlayPlayer {
  playId: number;
  username: string;
  userid: number | null;
  name: string;
  score: string;
  win: boolean;
  color: string;
  rating: number | null;
}

export interface GameSummary {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  designers: string[];
  weight: number | null;
  personalRating: number | null;
}

export interface PlaySummary extends Play {
  players: PlayPlayer[];
  thumbnailUrl: string | null;
}

export interface GamePeriodSummary {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  designers: string[];
  weight: number | null;
  personalRating: number | null;
  playCount: number;
  totalMinutes: number;
  firstPlay: string;
  lastPlay: string;
  wins: number;
  winRate: number | null;
}

export interface CollectionQueryResult extends CollectionEntry {
  gameWeight: number | null;
  gameDesigners: string[];
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  gameArtists: string[];
  gamePublishers: string[];
  gameDescription: string | null;
}

export type DuelSessionStatus = "active" | "completed";

export interface DuelSession {
  id: number;
  periodFrom: string;
  periodTo: string;
  minPlays: number;
  status: DuelSessionStatus;
  winnerBggId: number | null;
  remainingBggIds: number[];
  filtersJson: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface DuelRound {
  id: number;
  sessionId: number;
  roundNumber: number;
  candidateABggId: number;
  candidateBBggId: number;
  winnerBggId: number;
  decidedAt: string;
}

export interface DuelComparison {
  sessionId: number;
  roundNumber: number;
  candidateA: GamePeriodSummary;
  candidateB: GamePeriodSummary;
  remainingCount: number;
}

export type SyncResource = "collection" | "plays" | "things";
