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

export interface ShelfOfShameItem {
  bggId: number;
  name: string;
  subtype: string;
  yearPublished: number | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  lastModified: string | null;
  numPlays: number;
  personalRating: number | null;
  weight: number | null;
}

export interface WhatToPlaySuggestion {
  bggId: number;
  name: string;
  subtype: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  weight: number | null;
  personalRating: number | null;
  bggRating: number | null;
  numPlays: number;
  designers: string[];
  score: number;
  reasons: string[];
}

export interface PlayCalendarDay {
  date: string;
  playCount: number;
}

export interface PlayCalendarResult {
  from: string;
  to: string;
  days: PlayCalendarDay[];
  currentStreak: number;
  bestStreak: number;
  daysWithPlays: number;
  totalPlays: number;
}

export interface PlayCalendarDayPlay {
  playId: number;
  bggId: number;
  gameName: string;
  quantity: number;
  thumbnailUrl: string | null;
}

export type SmartWishlistMode = "balance" | "more" | "gaps";

export type SmartWishlistReasonKind =
  | "fit_mechanic"
  | "fit_designer"
  | "fit_category"
  | "gap_mechanic"
  | "gap_designer"
  | "gap_category"
  | "similar_loved"
  | "fresh_vs_owned"
  | "crowded_clone"
  | "priority"
  | "discovery_seed"
  | "missing_data";

export interface SmartWishlistReason {
  kind: SmartWishlistReasonKind;
  strength: "high" | "medium" | "low";
  headline: string;
  detail?: string;
}

export interface SmartWishlistGap {
  facet: "mechanic" | "designer" | "category";
  value: string;
  kind: "strong" | "soft" | "saturated";
  taste: number;
  ownedCount: number;
}

export interface SmartWishlistFacetTaste {
  facet: "mechanic" | "designer" | "category";
  value: string;
  taste: number;
  rawTaste: number;
  ownedCount: number;
  totalPlays: number;
}

export interface SmartWishlistCoveredGap {
  facet: "mechanic" | "designer" | "category";
  value: string;
}

export interface SmartWishlistSuggestion {
  source: "local" | "discovery";
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  yearPublished: number | null;
  subtype: string | null;
  wishlistPriority: number | null;
  score: number;
  breakdown: {
    fit: number;
    gap: number;
    novelty: number;
    priority: number;
  };
  reasons: SmartWishlistReason[];
  coveredGaps: SmartWishlistCoveredGap[];
  tasteFacets: SmartWishlistCoveredGap[];
  discoverySeed?: string;
}

export interface SmartWishlistResult {
  profile: {
    topMechanics: SmartWishlistFacetTaste[];
    topDesigners: SmartWishlistFacetTaste[];
    topCategories: SmartWishlistFacetTaste[];
    ownedCount: number;
    playSignalCount: number;
    summary: string;
  };
  gaps: SmartWishlistGap[];
  localSuggestions: SmartWishlistSuggestion[];
  discoverySuggestions: SmartWishlistSuggestion[];
  discoveryStatus: {
    available: boolean;
    message?: string;
  };
}

export interface HotnessScoutResult {
  status: {
    ok: boolean;
    message?: string;
  };
  mode: SmartWishlistMode;
  hotRankTotal: number;
  candidatesFetched: number;
  alreadyOwnedSkipped: number;
  suggestions: SmartWishlistSuggestion[];
  profile: SmartWishlistResult["profile"];
}

export interface SyncApiResult {
  ok: boolean;
  message?: string;
  collection?: { count: number; incremental: boolean };
  plays?: { count: number; incremental: boolean };
  durationMs: number;
}

