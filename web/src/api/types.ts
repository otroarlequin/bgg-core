export interface TopGameSummary {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  value: number;
}

export interface CollectionSummary {
  total: number;
  owned: number;
  wishlist: number;
  preordered: number;
  wantToPlay: number;
  avgPersonalRating: number | null;
  topByPlays: TopGameSummary[];
}

export interface PlaysSummary {
  totalPlays: number;
  uniqueGames: number;
  uniqueBaseGames: number;
  uniqueExpansions: number;
  hIndex: number;
  totalMinutes: number;
  totalHours: number;
  topPlayed: TopGameSummary[];
  topPlayedPhysical: TopGameSummary[];
  topPlayedVirtual: TopGameSummary[];
}

export interface DashboardSummary {
  collection: CollectionSummary;
  plays: PlaysSummary;
}

export interface CollectionItem {
  collId: number;
  bggId: number;
  subtype: string;
  name: string;
  yearPublished: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  own: boolean;
  wishlist: boolean;
  personalRating: number | null;
  numPlays: number;
  bggRating: number | null;
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

export interface PlayPlayer {
  playId: number;
  username: string;
  name: string;
  score: string;
  win: boolean;
  color: string;
}

export interface PlayItem {
  playId: number;
  bggId: number;
  gameName: string;
  date: string;
  quantity: number;
  length: number;
  location: string;
  incomplete: boolean;
  comments: string | null;
  thumbnailUrl: string | null;
  players: PlayPlayer[];
}

export interface PlayStats {
  totalPlays: number;
  uniqueGames: number;
  uniqueBaseGames: number;
  uniqueExpansions: number;
  hIndex: number;
  totalMinutes: number;
  totalHours: number;
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

export interface DuelComparison {
  sessionId: number;
  roundNumber: number;
  candidateA: GamePeriodSummary;
  candidateB: GamePeriodSummary;
  remainingCount: number;
}

export interface DuelSession {
  id: number;
  periodFrom: string;
  periodTo: string;
  minPlays: number;
  status: "active" | "completed";
  winnerBggId: number | null;
  remainingBggIds: number[];
  filtersJson?: string | null;
}

export interface DuelPoolFilters {
  includeExpansions?: boolean;
  ownedOnly?: boolean;
  excludeVirtual?: boolean;
  designer?: string;
  categories?: string[];
  mechanics?: string[];
  languageDependence?: string;
  players?: number;
  maxWeight?: number;
}

export interface DuelOutput {
  session?: DuelSession;
  duel?: DuelComparison | null;
  winner?: GamePeriodSummary;
  message: string;
}

export interface CollectionQueryParams {
  own?: boolean;
  wishlist?: boolean;
  preordered?: boolean;
  minPlays?: number;
  includeExpansions?: boolean;
  designer?: string;
  artist?: string;
  publisher?: string;
  categories?: string[];
  mechanics?: string[];
  languageDependence?: string;
  players?: number;
  sortBy?: "name" | "rating" | "plays" | "weight";
  limit?: number;
}

export interface CollectionFacets {
  designers: string[];
  artists: string[];
  publishers: string[];
  categories: string[];
  mechanics: string[];
  languageDependence: string[];
  playersMin: number;
  playersMax: number;
}

export interface PlaysQueryParams {
  from?: string;
  to?: string;
  bggId?: number;
  includeIncomplete?: boolean;
}

export type MatchFacet =
  | "designer"
  | "artist"
  | "publisher"
  | "mechanic"
  | "category"
  | "languageDependence";

export type PurchaseDecision =
  | "interesado"
  | "esperar"
  | "descartar"
  | "sin_decision";

export interface CollectionStatusFlags {
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  wishlistPriority: number | null;
}

export interface CandidateGameView {
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
  personalRating: number | null;
  numPlays: number;
  collectionStatus: CollectionStatusFlags | null;
  subtype: string | null;
}

export interface MatchGameRow {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  personalRating: number | null;
  numPlays: number;
  weight: number | null;
  subtype: string;
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  similarity?: number;
}

export interface PurchaseAnalysis {
  candidate: CandidateGameView;
  alreadyInCollection: boolean;
  overlap: {
    top10MeanPercent: number;
    topSimilar: MatchGameRow[];
    hint: string;
  };
}

export interface FacetMatchesResult {
  facet: MatchFacet;
  value: string;
  total: number;
  items: MatchGameRow[];
}

export interface BggSearchHit {
  bggId: number;
  name: string;
  yearPublished: number | null;
  type: string;
}

export interface PurchaseValidatorOutput {
  message: string;
  bggId?: number;
  searchResults?: BggSearchHit[];
  analysis?: PurchaseAnalysis;
  matches?: FacetMatchesResult;
  savedReviewId?: number;
}

