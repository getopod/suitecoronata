/**
 * Pattern Registry Types
 *
 * This module defines the type system for the declarative rules engine.
 * Patterns are reusable building blocks that can be composed to create effects.
 */

import { Card, Pile, GameState, MoveContext, Rank, Suit } from '../../types';

// =============================================================================
// Core Pattern Context
// =============================================================================

/**
 * Context passed to all pattern evaluators
 */
export interface PatternContext {
  /** The card(s) being moved */
  moving: Card;
  /** The target card (top of destination pile), if any */
  target?: Card;
  /** The source pile */
  sourcePile: Pile;
  /** The destination pile */
  targetPile: Pile;
  /** Full game state */
  state: GameState;
  /** Move context from the game engine */
  moveContext: MoveContext;
  /** All cards being moved (for stack operations) */
  cards: Card[];
}

/**
 * Extended context for scoring operations
 */
export interface ScoreContext extends PatternContext {
  /** Current score value being modified */
  currentScore: number;
}

/**
 * Extended context for coin operations
 */
export interface CoinContext extends PatternContext {
  /** Current coin delta being modified */
  currentDelta: number;
}

/**
 * Extended context for state operations
 */
export interface StateContext {
  state: GameState;
  activeEffects: string[];
}

// =============================================================================
// Pattern Evaluator Types
// =============================================================================

/**
 * Movement pattern evaluator - returns whether a move is allowed
 */
export type MovementEvaluator = (
  context: PatternContext,
  params?: Record<string, any>
) => boolean;

/**
 * Score pattern evaluator - returns modified score
 */
export type ScoreEvaluator = (
  context: ScoreContext,
  params?: Record<string, any>
) => number;

/**
 * Coin pattern evaluator - returns modified coin delta
 */
export type CoinEvaluator = (
  context: CoinContext,
  params?: Record<string, any>
) => number;

/**
 * Visual pattern evaluator - returns card visual modifications
 */
export type VisualEvaluator = (
  card: Card,
  pile: Pile | undefined,
  state: GameState,
  params?: Record<string, any>
) => Partial<Card>;

/**
 * State action evaluator - returns state modifications
 */
export type StateEvaluator = (
  context: StateContext,
  params?: Record<string, any>
) => Partial<GameState>;

/**
 * Trigger evaluator - returns whether a trigger condition is met
 */
export type TriggerEvaluator = (
  state: GameState,
  context?: MoveContext,
  params?: Record<string, any>
) => boolean;

// =============================================================================
// Pattern IDs - Movement
// =============================================================================

/** Rank-based movement patterns (Section 1 from docs) */
export type RankPatternId =
  | 'alternate_descending'      // 1.1 Standard Solitaire
  | 'alternate_ascending'       // 1.2 Reverse Build
  | 'ignore_color'              // 1.3 Same Color Allowed
  | 'ignore_rank'               // 1.4 Same Rank Allowed (color only)
  | 'any_move'                  // 1.5 Wild Rank
  | 'same_rank'                 // 1.6 Exact Rank Match
  | 'rank_within_range'         // 1.7 Rank Within Range (±N)
  | 'prime_only'                // 1.8 Prime Number Ranks Only
  | 'parity_phase'              // 1.9 Even/Odd Rank Restrictions
  | 'rank_multiply'             // 1.10 Rank Multiplication
  | 'rank_divide'               // 1.11 Rank Division
  | 'rank_sum'                  // 1.12 Rank Sum
  | 'rank_difference'           // 1.13 Rank Difference
  | 'rank_modulo'               // 1.14 Rank Modulo
  | 'up_or_down';               // Build up or down (charlatan)

/** Suit-based movement patterns (Section 2 from docs) */
export type SuitPatternId =
  | 'same_suit_ascending'       // 2.1 Standard Foundation
  | 'same_color_ascending'      // 2.2 Color-based Foundation
  | 'opposite_color_ascending'  // 2.3 Opposite Color Foundation
  | 'suit_rotation'             // 2.4 Suit Rotation
  | 'suit_pairing'              // 2.5 Suit Pairing (Red/Black pairs)
  | 'any_suit_ascending'        // 2.6 Any Suit Foundation
  | 'suit_prohibition'          // 2.7 Suit Prohibition
  | 'suit_groups'               // 2.8 Suit Groups
  | 'same_suit_any_order';      // Foundation ignores rank (anarchist)

/** Stack movement patterns (Section 4 from docs) */
export type StackPatternId =
  | 'single_card_only'          // 4.1 Single Cards Only
  | 'allow_foundation_source'   // 4.2 Allow Moving from Foundation
  | 'allow_waste_target'        // 4.3 Allow Moving to Waste
  | 'no_tableau_to_tableau'     // 4.4 No Tableau-to-Tableau
  | 'no_foundation_plays'       // 4.5 No Foundation Plays
  | 'all_face_up'               // 4.6 Only Complete Stacks
  | 'some_face_down'            // 4.7 Only Partial Stacks
  | 'stack_size_limit'          // 4.8 Stack Size Limits
  | 'sequential_stack'          // 4.9 Sequential Stack Only
  | 'same_suit_stack'           // 4.10 Same Suit Stack Only
  | 'no_locked_cards'           // 4.11 Locked Cards Cannot Move
  | 'only_revealed'             // 4.12 Only Revealed Cards Can Move
  | 'buried_face_up';           // Allow playing buried face-up cards (thief)

/** Special rank conditions (Section 3 from docs) */
export type SpecialRankPatternId =
  | 'ace_high_or_low'           // 3.1 Ace Can Be High or Low
  | 'kings_on_empty'            // 3.2 Only Kings on Empty Tableau
  | 'aces_on_empty'             // 3.3 Only Aces on Empty Foundation
  | 'face_card_rules'           // 3.4 Face Cards Special Rules
  | 'seven_wild'                // 3.5 Seven as Wild/Portal
  | 'rank_zero_wild'            // 3.6 Rank 0 (Special Cards)
  | 'sequential_pairing'        // 3.7 Sequential Pairing
  | 'fibonacci_sequence'        // 3.8 Fibonacci Sequence
  | 'prime_chain'               // 3.9 Prime Number Chain
  | 'crown_card'                // Mad King's crown cards
  | 'wild_card';                // Wild cards can go anywhere

// =============================================================================
// Pattern IDs - Scoring
// =============================================================================

export type ScorePatternId =
  // Basic modifiers (Section 1)
  | 'flat_bonus'                // 1.1 Flat Bonus/Penalty
  | 'percentage_multiplier'     // 1.2 Percentage Multipliers
  | 'conditional_target'        // 1.3 Conditional by Target
  | 'conditional_source'        // 1.4 Conditional by Source
  | 'conditional_suit'          // 1.5 Conditional by Suit/Color
  | 'conditional_rank'          // 1.6 Conditional by Rank
  | 'move_count_bonus'          // 1.7 Move Count Based
  | 'card_count_bonus'          // 1.8 Card Count Based
  | 'time_bonus'                // 1.9 Time Based
  // Complex logic (Section 2)
  | 'rank_based_scoring'        // 2.1 Rank-based Scoring
  | 'sequence_scoring'          // 2.2 Sequence-based Scoring
  | 'count_based_scoring'       // 2.3 Count-based Scoring
  | 'pattern_scoring'           // 2.4 Pattern Recognition
  | 'achievement_scoring'       // 2.5 Achievement-based Scoring
  | 'combo_multiplier'          // 2.6 Combo/Multiplier Scoring
  | 'progressive_scaling'       // 2.7 Progressive Scaling
  | 'streak_multiplier'         // Consecutive same-suit (hoarder)
  | 'compound_multiplier'       // Progressive multiplier (compound interest)
  // Reset/Override (Section 3)
  | 'score_cap'                 // 3.5 Cap Maximum Score
  | 'score_floor';              // 3.6 Floor Minimum Score

// =============================================================================
// Pattern IDs - Coins
// =============================================================================

export type CoinPatternId =
  // Basic modifiers
  | 'coin_flat_bonus'           // 1.1 Flat Gain/Loss
  | 'coin_multiplier'           // 1.2 Multipliers
  | 'coin_conditional_target'   // 1.3 Conditional by Action
  | 'coin_conditional_card'     // 1.4 Conditional by Card
  | 'score_percentage'          // 1.5 Percentage of Score
  | 'coin_move_based'           // 1.6 Move-based
  | 'coin_time_based'           // 1.7 Time-based
  | 'coin_stack_based'          // 1.8 Stack-based
  // Achievement-based
  | 'foundation_completion'     // 2.1 Complete a Foundation
  | 'visible_card_bonus'        // 2.2 Visible Card Conditions
  // Gambling
  | 'random_outcome'            // 3.1 Random Win/Loss
  | 'wager_system'              // 3.2 Wager System
  | 'progressive_jackpot';      // 3.3 Progressive Jackpot

// =============================================================================
// Pattern IDs - Visual
// =============================================================================

export type VisualPatternId =
  | 'force_face_up'             // 1.4 Force Face Up
  | 'force_face_down'           // 1.5 Force Face Down
  | 'conditional_face_up'       // 1.6 Conditionally Face Up
  | 'hide_suit'                 // 1.2 Hide Suit
  | 'hide_rank'                 // 1.1 Hide Rank
  | 'highlight'                 // 1.9 Highlight
  | 'glow_effect'               // 1.13 Glow Effect
  | 'opacity'                   // 1.15 Transparency
  | 'face_cards_visible';       // Face cards always visible (insider trading)

// =============================================================================
// Pattern IDs - State Actions
// =============================================================================

export type StateActionId =
  | 'add_piles'                 // Add tableau/foundation piles
  | 'remove_piles'              // Remove piles
  | 'lock_piles'                // Lock specific piles
  | 'unlock_piles'              // Unlock specific piles
  | 'add_card_to_pile'          // Add a special card to a pile
  | 'scatter_cards'             // Scatter cards across piles
  | 'set_effect_state'          // Set effectState properties
  | 'shuffle_pile'              // Shuffle a specific pile
  | 'reshuffle_all'             // Reshuffle all cards
  | 'return_to_deck'            // Return cards to deck
  | 'duplicate_deck';           // Duplicate all deck cards (counterfeiting)

// =============================================================================
// Pattern IDs - Triggers
// =============================================================================

export type TriggerPatternId =
  // Probability
  | 'chance'                    // Random chance
  // Target/Source
  | 'target_type'               // Target pile type
  | 'source_type'               // Source pile type
  | 'target_pile'               // Specific target pile
  | 'source_pile'               // Specific source pile
  // Card properties
  | 'card_rank'                 // Card rank equals
  | 'card_suit'                 // Card suit equals
  | 'card_color'                // Card color equals
  | 'card_meta'                 // Card has meta property
  // State
  | 'move_count'                // Moves % N == 0
  | 'score_threshold'           // Score >= N
  | 'coin_threshold'            // Coins >= N
  | 'goal_percentage'           // Score >= X% of goal
  // Pile state
  | 'pile_empty'                // Pile is empty
  | 'pile_full'                 // Pile has N cards
  | 'foundation_complete'       // Foundation has 13 cards
  | 'all_foundations_complete'  // All foundations complete
  // Card visibility
  | 'visible_rank_count'        // N cards of rank visible
  | 'face_cards_visible'        // All face cards visible
  // Events
  | 'reveal'                    // Card was just revealed
  | 'just_revealed_card'        // Moving the just-revealed card
  | 'encounter_start'           // Encounter starting
  | 'encounter_end'             // Encounter ending
  | 'deck_cycle';               // Deck was recycled

// =============================================================================
// Minigame Trigger Configuration
// =============================================================================

export interface MinigameTrigger {
  /** Pattern to detect */
  pattern: string;
  /** Minigame to trigger */
  minigame: string;
  /** EffectState flag to track if triggered */
  flagKey: string;
  /** Additional state changes on trigger */
  onTrigger?: (state: GameState) => Partial<GameState>;
}

// =============================================================================
// Rule Definition Types
// =============================================================================

/**
 * Movement rule configuration - combines rank, suit, and stack patterns
 */
export interface MovementRule {
  /** Rank pattern to use */
  rank?: RankPatternId | SpecialRankPatternId;
  /** Suit pattern to use */
  suit?: SuitPatternId;
  /** Stack pattern to use */
  stack?: StackPatternId;
  /** Additional parameters for patterns */
  params?: Record<string, any>;
  /** Pile types this rule applies to */
  appliesTo?: ('tableau' | 'foundation' | 'hand' | 'deck' | 'waste')[];
}

/**
 * Scoring rule configuration
 */
export interface ScoringRule {
  /** Pattern to use */
  pattern: ScorePatternId;
  /** Trigger condition (optional) */
  trigger?: TriggerPatternId | string;
  /** Parameters for the pattern */
  params?: Record<string, any>;
}

/**
 * Coin rule configuration
 */
export interface CoinRule {
  /** Pattern to use */
  pattern: CoinPatternId;
  /** Trigger condition (optional) */
  trigger?: TriggerPatternId | string;
  /** Parameters for the pattern */
  params?: Record<string, any>;
}

/**
 * Visual rule configuration
 */
export interface VisualRule {
  /** Pattern to use */
  pattern: VisualPatternId;
  /** Trigger condition (optional) */
  trigger?: TriggerPatternId | string;
  /** Pile types this applies to */
  appliesTo?: ('tableau' | 'foundation' | 'hand' | 'deck' | 'waste')[];
  /** Parameters for the pattern */
  params?: Record<string, any>;
}

/**
 * State action configuration
 */
export interface StateAction {
  /** Action to perform */
  action: StateActionId;
  /** Trigger condition (optional) */
  trigger?: TriggerPatternId | string;
  /** Parameters for the action */
  params?: Record<string, any>;
}

// =============================================================================
// Effect Definition Type
// =============================================================================

/**
 * Declarative effect definition using patterns
 *
 * This is the main configuration type for defining effects without code.
 * Effects can be defined entirely through pattern references and parameters.
 */
export interface EffectDefinition {
  /** Unique effect ID */
  id: string;
  /** Display name */
  name: string;
  /** Effect type */
  type: 'blessing' | 'exploit' | 'curse' | 'pattern' | 'passive';
  /** Description shown to player */
  description: string;
  /** Rarity tier */
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** Coin cost in shop */
  cost?: number;
  /** Maximum charges */
  maxCharges?: number;
  /** When charges reset */
  chargeReset?: 'encounter' | 'run';

  /**
   * Movement modifications by pile type
   * These modify canMove behavior
   */
  movement?: {
    tableau?: MovementRule;
    foundation?: MovementRule;
    /** Both source and target rules */
    any?: MovementRule;
  };

  /**
   * Scoring modifications
   * Applied via calculateScore hook
   */
  scoring?: ScoringRule[];

  /**
   * Coin transaction modifications
   * Applied via calculateCoinTransaction hook
   */
  coins?: CoinRule[];

  /**
   * Visual transformations
   * Applied via transformCardVisual hook
   */
  visuals?: VisualRule[];

  /**
   * Actions to perform on activation (onActivate)
   */
  onActivate?: StateAction[];

  /**
   * Actions to perform on each move (onMoveComplete)
   */
  onMove?: StateAction[];

  /**
   * Actions to perform at encounter start
   */
  onEncounterStart?: StateAction[];

  /**
   * Effect state to track
   * Keys are initialized on activation
   */
  effectState?: Record<string, any>;

  /**
   * Custom handlers for complex effects that can't be expressed declaratively
   * These are merged with compiled handlers
   */
  custom?: {
    canMove?: (cards: Card[], source: Pile, target: Pile, defaultAllowed: boolean, state: GameState) => boolean | undefined;
    interceptMove?: (context: MoveContext, state: GameState) => Partial<MoveContext> | undefined;
    onMoveComplete?: (state: GameState, context: MoveContext) => Partial<GameState> & { triggerMinigame?: string; isLevelComplete?: boolean };
    onActivate?: (state: GameState, activeEffects: string[]) => Partial<GameState> & { newActiveEffects?: string[] };
    onEncounterStart?: (state: GameState) => Partial<GameState>;
    onEncounterComplete?: (state: GameState, context?: { reward?: number }) => Partial<GameState>;
    calculateScore?: (currentScore: number, context: MoveContext, state: GameState) => number;
    calculateCoinTransaction?: (currentDelta: number, context: MoveContext, state: GameState) => number;
    transformCardVisual?: (card: Card, pile?: Pile) => Partial<Card>;
  };
}
