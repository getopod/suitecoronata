import React, { useState, useCallback } from 'react';
import { LayoutGrid, Skull, Lock, Key, Smile, Coins, Play, Gamepad2, BookOpen, HelpCircle, RefreshCw, X, Gift, Trophy, ArrowLeftRight, SkipBack, SkipForward, MessageSquare, FlaskConical, Save, Flag, Settings, ChevronDown, Pause, ShoppingCart, User, Unlock, Map as MapIcon, BarChart3, Link as LinkIcon, Bug } from 'lucide-react';
import { Card, GameState, Pile, Rank, Suit, MoveContext, Encounter, GameEffect, Wander, WanderChoice, MinigameResult, PlayerStats, RunHistoryEntry, RunEncounterRecord } from './types';
import { getCardColor, generateNewBoard, EFFECTS_REGISTRY } from './data/effects';
import { isHighestRank, isNextHigherInOrder, isNextLowerInOrder } from './utils/rankOrder';
import { Minigames } from './utils/minigames';
import { loadPlayerStats, savePlayerStats, recordRunCompletion, getWinRate, formatDuration, getRelativeTime } from './utils/playerStats';
import ResponsiveIcon from './components/ResponsiveIcon';
import { WANDER_REGISTRY } from './data/wanders';

// ==========================================
// INJECTABLE REGISTRIES (defaults to empty for decoupled UI)
// ==========================================
// To use with effects/items, import and pass them:
//   import { EFFECTS_REGISTRY } from './data/effects';
//   import { WANDER_REGISTRY } from './data/wanders';
//   <SolitaireEngine effectsRegistry={EFFECTS_REGISTRY} wanderRegistry={WANDER_REGISTRY} />

interface SolitaireEngineProps {
  effectsRegistry?: GameEffect[];
  wanderRegistry?: Wander[];
}

// ==========================================
// CONSTANTS & UTILS
// ==========================================

// Seeded RNG helper (simple LCG) and Fisher-Yates shuffle helper
const createSeededRng = (seed: number) => {
   let s = seed >>> 0;
   return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
   };
};

const shuffleArray = <T,>(arr: T[], rng?: () => number): T[] => {
   const out = arr.slice();
   const r = rng ?? Math.random;
   for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
   }
   return out;
};

const generateRunPlan = (effectsRegistry: GameEffect[], rng?: () => number): Encounter[] => {
   const encounters: Encounter[] = [];
   const fears = effectsRegistry.filter(e => e.type === 'fear');
   const dangers = effectsRegistry.filter(e => e.type === 'danger');

   // If no effects, generate simple encounters with no effect
   if (fears.length === 0 && dangers.length === 0) {
      for (let i = 0; i < 15; i++) {
         const isDanger = (i + 1) % 3 === 0;
         const goal = Math.floor(150 + (i / 14) * (4200 - 150));
         encounters.push({
            index: i,
            type: isDanger ? 'danger' : 'fear',
            effectId: '', // No effect
            goal: goal,
            completed: false
         });
      }
      return encounters;
   }

   const shuffledFears = shuffleArray([...fears], rng);
   const shuffledDangers = shuffleArray([...dangers], rng);

   for (let i = 0; i < 15; i++) {
      const isDanger = (i + 1) % 3 === 0;
      const goal = Math.floor(150 + (i / 14) * (4200 - 150));
      const effect = isDanger 
         ? (shuffledDangers[i % shuffledDangers.length] || shuffledFears[0]) 
         : (shuffledFears[i % shuffledFears.length] || shuffledDangers[0]);

      encounters.push({
         index: i,
         type: isDanger ? 'danger' : 'fear',
         effectId: effect?.id || '',
         goal: goal,
         completed: false
      });
   }
   return encounters;
};

const initialGameState = (): GameState => {
  return generateNewBoard(0, 150, 1, 1);
};

const isStandardMoveValid = (movingCards: Card[], targetPile: Pile, patriarchyMode: boolean = false): boolean => {
  if (movingCards.length === 0) return false;
  const leader = movingCards[0];
  const targetTop = targetPile.cards[targetPile.cards.length - 1];
  if (targetPile.type === 'tableau') {
    // Queen is high by default (stack rank 13), Kings high if patriarchy mode
    if (!targetTop) return getStackRank(leader.rank, patriarchyMode) === 13;
    // Opposite color and target's stack rank must be one higher than leader's
    return (getCardColor(leader.suit) !== getCardColor(targetTop.suit) && getStackRank(targetTop.rank, patriarchyMode) === getStackRank(leader.rank, patriarchyMode) + 1);
  }
  if (targetPile.type === 'foundation') {
    if (movingCards.length > 1) return false;
    if (!targetTop) {
      // Aces can only go to their matching suit foundation
      return leader.rank === 1 && targetPile.id === `foundation-${leader.suit}`;
    }
    // Must match suit of foundation's first card and be next rank (foundation uses normal rank order A,2,3...K)
    return leader.suit === targetTop.suit && leader.rank === targetTop.rank + 1;
  }
  return false;
};

// Find all valid move targets for a set of cards
const findValidMoves = (
  movingCards: Card[], 
  sourcePileId: string, 
  _sourceCardIndex: number, 
  piles: Record<string, Pile>,
  patriarchyMode: boolean = false
): { tableauIds: string[]; foundationIds: string[] } => {
  const tableauIds: string[] = [];
  const foundationIds: string[] = [];
  
  for (const [pileId, pile] of Object.entries(piles)) {
    if (pileId === sourcePileId) continue; // Can't move to same pile
    if (pile.locked) continue; // Can't move to locked piles
    
    if (isStandardMoveValid(movingCards, pile, patriarchyMode)) {
      if (pile.type === 'tableau') {
        tableauIds.push(pileId);
      } else if (pile.type === 'foundation') {
        foundationIds.push(pileId);
      }
    }
  }
  
  return { tableauIds, foundationIds };
};

// UI helper: human-readable rank display
const getRankDisplay = (r: Rank) => {
   if (r === 0) return '';
   if ((r as number) === -1) return '?';
   if (r === 1) return 'A';
   if (r === 11) return 'J';
   if (r === 12) return 'Q';
   if (r === 13) return 'K';
   return r;
};

// Stack rank helper: By default Queens are high for tableau stacking (Q, K, J, 10, 9...3, 2, A)
// If patriarchy mode is enabled, Kings are high (standard solitaire order)
// Q(12) -> 13 (highest by default), K(13) -> 12 by default
const getStackRank = (r: Rank, patriarchyMode: boolean = false): number => {
   if (patriarchyMode) return r; // Standard: K=13 highest
   if (r === 12) return 13; // Queen is highest
   if (r === 13) return 12; // King goes under Queen
   return r;
};

// Rarity color helper - returns Tailwind classes for rarity
const getRarityColor = (rarity?: string): { bg: string; text: string; border: string } => {
   const r = (rarity || 'common').toLowerCase();
   switch (r) {
      case 'uncommon': return { bg: 'bg-green-900/30', text: 'text-green-300', border: 'border-green-600' };
      case 'rare': return { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-500' };
      case 'epic': return { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-500' };
      case 'legendary': return { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-500' };
      default: return { bg: 'bg-slate-700/30', text: 'text-slate-400', border: 'border-slate-600' };
   }
};



// Small synonyms map for common registry keys vs actual filenames
const ICON_SYNONYMS: Record<string, string> = {
  coins: 'coin',
  coin: 'coin',
  fortunes: 'fortune',
  fortune: 'fortune',
  blessings: 'blessing',
  blessing: 'blessing',
  curses: 'curse',
  curse: 'curse',
  hand: 'hand size',
  'hand size': 'hand size',
  shuffle: 'shuffle',
  shuffles: 'shuffle',
  discard: 'discard',
  discards: 'discard',
  exploit: 'exploit',
  exploits: 'exploit',
  danger: 'danger',
  dangers: 'danger',
  fear: 'fear',
  fears: 'fear',
  barricade: 'barricade',
  resign: 'resign',
  orangehelp: 'orangehelp',
  purplehelp: 'purplehelp',
  whitehelp: 'whitehelp',
  notdanger: 'notdanger',
  history: 'run history',
  'run history': 'run history',
  ghost: 'sign in',
  'sign in': 'sign in',
  signin: 'sign in',
  feats: 'feats',
  ascension: 'ascension',
  settings: 'settings',
  setting: 'settings',
  // UI/Menu icons
  back: 'back',
  save: 'save',
  pause: 'pause',
  play: 'play',
  volume: 'volume',
  mute: 'volume',
  sound: 'volume',
  close: 'close',
  exit: 'close',
  feedback: 'feedback',
  glossary: 'glossary',
  login: 'login',
  signup: 'sign up',

  // Registry ID to Filename Mappings
  bait_switch: 'baitandswitch',
  stolen_valor: 'stolenvalor',
  creative_accounting: 'creativeaccounting',
  martial_law: 'martiallaw',
  path_least_resistance: 'pathofleastresistance',
  gift_gab: 'giftofgab',
  beginners_luck: 'beginnersluck',
  diplomatic_immunity: 'diplomaticimmunity',
  angel_investor: 'angelinvestor',
  bag_of_holding: 'bagofholding',
  street_smarts: 'streetsmarts',
  legitimate_business: 'legitimatebusiness',
  liquid_assets: 'liquidassets',
  fountain_youth: 'fountainofyouth',
  insider_trading: 'insidertrading',
  daruma_karma: 'duarmakarma',
  golden_parachute: 'goldenparachute',
  
  // Native Effects Mappings
  alchemist: 'alchemy',
  'fog-of-war': 'fogofwar',
  'moon-toad-cheeks': 'moontoadcheeks',
};

// Icon helper - converts effect name to icon path with type fallback
const getEffectIcon = (nameOrId: string, type: 'exploit' | 'curse' | 'blessing' | 'danger' | 'fear') => {
   const lower = (nameOrId || '').toLowerCase();
   
   // 1. Check synonyms (using ID-like keys)
   if (ICON_SYNONYMS[lower]) {
      return `/icons/${encodeURIComponent(ICON_SYNONYMS[lower])}.png`;
   }

   // 2. Try replacing underscores with spaces (e.g. "above_the_law" -> "above the law.png")
   if (lower.includes('_')) {
      return `/icons/${encodeURIComponent(lower.replace(/_/g, ' '))}.png`;
   }

   // 3. Try replacing spaces with underscores (e.g. "Bait & Switch" -> "bait_switch" -> "baitandswitch")
   // This handles cases where we passed the Name but the file/synonym is keyed by ID
   // First, try to map Name to ID-like string
   const asId = lower.replace(/\s+/g, '_').replace(/&/g, 'and').replace(/[^a-z0-9_]/g, '');
   if (ICON_SYNONYMS[asId]) {
       return `/icons/${encodeURIComponent(ICON_SYNONYMS[asId])}.png`;
   }

   // 4. Default: use name directly
   return `/icons/${encodeURIComponent(lower)}.png`;
};

// Category icon paths
const categoryIcons: Record<string, string> = {
   danger: '/icons/danger.png',
   dangers: '/icons/danger.png',
   fear: '/icons/fear.png',
   fears: '/icons/fear.png',
   blessing: '/icons/blessing.png',
   blessings: '/icons/blessing.png',
   exploit: '/icons/exploit.png',
   exploits: '/icons/exploit.png',
   curse: '/icons/curse.png',
   curses: '/icons/curse.png',
};

// ==========================================
// 5. COMPONENT: APP
// ==========================================

export default function SolitaireEngine({ 
  effectsRegistry = EFFECTS_REGISTRY, 
  wanderRegistry = WANDER_REGISTRY 
}: SolitaireEngineProps = {}) {
  const [currentView, setCurrentView] = useState<'home' | 'game'>('home');
  const [runPlan, setRunPlan] = useState<Encounter[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState());
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [selectedPileId, setSelectedPileId] = useState<string | null>(null);
   const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
   const [hintTargets, setHintTargets] = useState<string[]>([]);
   const [selectionColor, setSelectionColor] = useState<'none' | 'green' | 'yellow' | 'red'>('none');
   const [highlightedMoves, setHighlightedMoves] = useState<{ tableauIds: string[]; foundationIds: string[] }>({ tableauIds: [], foundationIds: [] });
  
  // Player Stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => loadPlayerStats());
  const [runStartData, setRunStartData] = useState<{ startTime: number; startCoins: number; encounterLog: RunEncounterRecord[] } | null>(null);
  
  const [activeDrawer, setActiveDrawer] = useState<'pause' | 'exploit' | 'curse' | 'blessing' | 'shop' | 'feedback' | 'test' | 'settings' | 'resign' | 'blessing_select' | null>(null);
  const [shopInventory, setShopInventory] = useState<GameEffect[]>([]);
  const [blessingChoices, setBlessingChoices] = useState<GameEffect[]>([]);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
   // When set, this drawer is intentionally non-closable by the collapse button
   const [nonClosableDrawer, setNonClosableDrawer] = useState<'blessing_select' | 'shop' | null>(null);
   // Shop tab state (buy / sell / continue)
   const [shopTab, setShopTab] = useState<'buy' | 'sell' | 'continue'>('buy');

   // Reset any non-closable lock when the drawer is closed by other means
   React.useEffect(() => {
      if (!activeDrawer && nonClosableDrawer) setNonClosableDrawer(null);
   }, [activeDrawer, nonClosableDrawer]);

   // Ensure ownedEffects is always a unique list. Some effect-resolution paths
   // may accidentally attempt to add an effect multiple times; normalize here
   // to guarantee the player never owns duplicate copies of the same effect.
   React.useEffect(() => {
      const owned = gameState.ownedEffects || [];
      const unique = Array.from(new Set(owned));
      if (unique.length !== owned.length) {
         setGameState(prev => ({ ...prev, ownedEffects: unique }));
      }
   }, [gameState.ownedEffects]);

   // Helper to toggle drawers while respecting non-closable locks.
   // If a drawer is locked (e.g. blessing_select or shop after encounter), prevent
   // any user interaction from closing it or opening other drawers until the flow
   // explicitly clears the lock.
   const toggleDrawer = (type: string) => {
      if (nonClosableDrawer && activeDrawer === nonClosableDrawer && type !== nonClosableDrawer) {
         // Locked: ignore attempts to switch to a different drawer
         return;
      }
      if (activeDrawer === type) {
         // Attempting to close the currently open drawer
         if (nonClosableDrawer === type) return; // respect lock
         setActiveDrawer(null);
      } else {
         setActiveDrawer(type as any);
      }
   };

   // Compute the items shown in the active drawer so we can size the drawer dynamically
   const drawerItems = React.useMemo(() => {
      if (!activeDrawer) return [] as GameEffect[];
      if (activeDrawer === 'blessing_select') return blessingChoices;
      if (activeDrawer === 'shop') return shopInventory;
      // Owned effect lists for exploit/curse/blessing drawers
      if (['exploit', 'curse', 'blessing'].includes(activeDrawer)) {
         return effectsRegistry.filter(e => {
            const isOwned = gameState.ownedEffects.includes(e.id) || gameState.debugUnlockAll;
            if (!isOwned) return false;
            if (activeDrawer === 'exploit') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
            if (activeDrawer === 'curse') return ['curse', 'fear', 'danger'].includes(e.type);
            if (activeDrawer === 'blessing') return ['blessing'].includes(e.type);
            return false;
         });
      }
      return [] as GameEffect[];
   }, [activeDrawer, blessingChoices, shopInventory, gameState.ownedEffects, gameState.debugUnlockAll, effectsRegistry]);

   const drawerVisibleCount = Math.min(drawerItems.length, 4);
   const DRAWER_ITEM_HEIGHT = 72; // px per row (approx)
   const DRAWER_BASE_HEIGHT = 140; // px for header/padding
   const drawerMaxHeightPx = `${DRAWER_BASE_HEIGHT + drawerVisibleCount * DRAWER_ITEM_HEIGHT}px`;
  
  // Home menu overlay states
  const [showGlossary, setShowGlossary] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [howToPage, setHowToPage] = useState(0);
  const [selectedMode, setSelectedMode] = useState('coronata');
  const [glossaryTab, setGlossaryTab] = useState<'dangers'|'fears'|'blessings'|'exploits'|'curses'>('dangers');
  const [profileTab, setProfileTab] = useState<'stats'|'feats'|'recaps'>('stats');
  const [expandedAchievement, setExpandedAchievement] = useState<number | null>(null);
  const [expandedSettingsSection, setExpandedSettingsSection] = useState<string | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    confirmResign: true,
    supportPatriarchy: false, // Kings high instead of Queens
    // Classic game modes
    klondikeEnabled: false,
    klondikeDraw: '3' as '1' | '3',
    klondikeScoring: 'standard' as 'standard' | 'vegas' | 'none',
    spiderEnabled: false,
    spiderSuits: '4' as '1' | '2' | '4',
    freecellEnabled: false,
    freecellAutoMove: true,
    // Audio
    musicEnabled: false,
    sfxEnabled: false,
    masterVolume: 50,
    musicVolume: 60,
    sfxVolume: 100,
    menuMusic: true,
    gameplayMusic: true,
    shopMusic: true,
    wanderMusic: true,
    cardFlip: true,
    cardPlace: true,
    invalidMove: true,
    scorePoints: true,
    levelComplete: true,
    uiClicks: true,
    // Display
    reduceMotion: false,
    highContrast: false,
    colorBlindMode: 'off',
    cardBack: 'card-back',
    cardAnimations: true,
    theme: 'dark',
    language: 'en',
    // Advanced (joke) settings
    sarcasmLevel: 50,
    hogwartsHouse: 'undecided',
    cheatCode: '',
  });
  const [callParentsCount, setCallParentsCount] = useState(0);
  const [showParentsPopup, setShowParentsPopup] = useState(false);
  const [cheatResponse, setCheatResponse] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const [testAmount, setTestAmount] = useState(100);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackChecks, setFeedbackChecks] = useState<Record<string, boolean>>({});

  // Auto-advance when score goal is reached
  React.useEffect(() => {
    if (currentView === 'game' && gameState.score >= gameState.currentScoreGoal && !gameState.isLevelComplete && !showLevelComplete) {
      setGameState(p => ({ ...p, isLevelComplete: true }));
      setShowLevelComplete(true);
    }
  }, [gameState.score, gameState.currentScoreGoal, gameState.isLevelComplete, currentView, showLevelComplete]);

  const isEffectReady = (id: string, state: GameState) => {
     if (id === 'lobbyist') return state.coins >= 100;
     return true;
  };

  // Placeholder wanders for when no wander registry is provided
  const PLACEHOLDER_WANDERS: Wander[] = [
    {
      id: 'placeholder_wander_1',
      label: 'The Crossroads',
      description: 'Two paths diverge before you. Each seems to promise something different.',
      type: 'wander',
      choices: [
        { label: 'Take the left path', result: 'You find a small cache of coins.', effects: [{ type: 'modify_coin', params: [15] }] },
        { label: 'Take the right path', result: 'A shortcut! You feel invigorated.', effects: [{ type: 'modify_score', params: [25] }] },
      ],
    },
    {
      id: 'placeholder_wander_2',
      label: 'The Merchant',
      description: 'A traveling merchant offers you a deal.',
      type: 'wander',
      choices: [
        { label: 'Trade coins for points (-20 coins)', result: 'A fair exchange.', effects: [{ type: 'modify_coin', params: [-20] }, { type: 'modify_score', params: [50] }] },
        { label: 'Decline politely', result: 'The merchant nods and moves on.', effects: [] },
      ],
    },
    {
      id: 'placeholder_wander_3',
      label: 'The Gamble',
      description: 'A mysterious figure offers you a wager.',
      type: 'wander',
      choices: [
        { label: 'Accept the bet', result: 'Fortune favors the bold!', effects: [{ type: 'modify_coin', params: [30] }] },
        { label: 'Walk away', result: 'Sometimes caution is wise.', effects: [{ type: 'modify_score', params: [10] }] },
      ],
    },
  ];

  const resolveWanderEffect = (effects: any[]) => {
    console.log('resolveWanderEffect called with:', effects);
    let updates: Partial<GameState> = {};
    let newOwned = [...gameState.ownedEffects];
    let newActive = [...activeEffects];
    
    const apply = (effs: any[]) => {
      if (!effs || !Array.isArray(effs)) {
        console.error('apply called with invalid effects:', effs);
        return;
      }
      for (const eff of effs) {
        if (eff.type === 'modify_coin') updates.coins = (updates.coins ?? gameState.coins) + eff.params[0];
        if (eff.type === 'modify_score') updates.score = (updates.score ?? gameState.score) + eff.params[0];
        if (eff.type === 'modify_coin_pct') updates.coins = Math.floor((updates.coins ?? gameState.coins) * (1 + eff.params[0]));
        if (eff.type === 'modify_score_pct') updates.score = Math.floor((updates.score ?? gameState.score) * (1 + eff.params[0]));
        if (eff.type === 'modify_next_score_goal_pct') updates.currentScoreGoal = Math.floor((gameState.currentScoreGoal) * (1 + eff.params[0]));
        
        if (eff.type === 'add_random_curse') { 
            const curse = effectsRegistry.filter(e => e.type === 'curse')[Math.floor(Math.random() * 5)]; 
            if (curse && !newOwned.includes(curse.id)) { newOwned.push(curse.id); newActive.push(curse.id); } 
        }
        if (eff.type === 'add_specific_curse') {
            const cid = eff.params[0];
            if (!newOwned.includes(cid)) { newOwned.push(cid); newActive.push(cid); }
        }
      if (eff.type === 'add_random_blessing') { 
         const b = effectsRegistry.filter(e => e.type === 'blessing')[Math.floor(Math.random() * 5)]; 
         if (b && !newOwned.includes(b.id)) { newOwned.push(b.id); if (!newActive.includes(b.id)) newActive.push(b.id); }
      }
      if (eff.type === 'add_blessing_by_id') {
         const bid = eff.params[0];
         if (!newOwned.includes(bid)) { newOwned.push(bid); if (!newActive.includes(bid)) newActive.push(bid); }
      }
        if (eff.type === 'add_random_exploit') { 
            const x = effectsRegistry.filter(e => e.type === 'exploit')[Math.floor(Math.random() * 5)]; 
            if (x && !newOwned.includes(x.id)) { newOwned.push(x.id); newActive.push(x.id); } 
        }
        if (eff.type === 'remove_curse') { 
            const curses = newActive.filter(id => effectsRegistry.find(e => e.id === id)?.type === 'curse'); 
            if (curses.length > 0) {
                const toRemove = curses[Math.floor(Math.random() * curses.length)];
                newActive = newActive.filter(id => id !== toRemove); 
            }
        }
        if (eff.type === 'random_outcome') { 
            if (Math.random() < eff.params[0]) apply(eff.params[1]); else apply(eff.params[2]); 
        }
      }
    };
    apply(effects);
    setGameState(prev => ({ ...prev, ...updates, ownedEffects: newOwned }));
      setActiveEffects(Array.from(new Set(newActive)));
  };

  // Duplicate PLACEHOLDER_WANDERS declaration removed - using the one above

  const startWanderPhase = () => {
     setActiveDrawer(null);
     setGameState(prev => ({ ...prev, wanderRound: 1 }));
     triggerWanderSelection();
  };

  const triggerWanderSelection = () => {
     let validWanders = wanderRegistry.filter(w => {
         if (w.isHidden) return false; 
         if (w.conditions?.minEncounter && gameState.runIndex < w.conditions.minEncounter) return false;
         return true;
     });
     
     // Use placeholder wanders if none available
     if (validWanders.length === 0) {
       validWanders = PLACEHOLDER_WANDERS;
     }
     
     const opts = validWanders.sort(() => 0.5 - Math.random()).slice(0, 3);
     setGameState(prev => ({ ...prev, wanderState: 'selection', wanderOptions: opts, activeWander: null, wanderResultText: null }));
  };

  const chooseWanderOption = (wander: any) => { setGameState(prev => ({ ...prev, wanderState: 'active', activeWander: wander })); };
  
  const resolveWander = (choice: WanderChoice) => {
    // Handle both old-style effects array and new-style onChoose callback
    if (choice.onChoose) {
      // Adapt gameState to format expected by wanders (claudecoronata structure)
      const adaptedState = {
        resources: {
          coins: gameState.coins || 0,
          handSize: 5,
          shuffles: 0,
          discards: 0,
        },
        run: {
          inventory: {
            exploits: activeEffects.filter(id => {
              const e = effectsRegistry.find(x => x.id === id);
              return e?.type === 'exploit' || e?.type === 'epic' || e?.type === 'legendary';
            }),
            curses: activeEffects.filter(id => {
              const e = effectsRegistry.find(x => x.id === id);
              return e?.type === 'curse';
            }),
            blessings: gameState.ownedEffects.filter(id => {
              const e = effectsRegistry.find(x => x.id === id);
              return e?.type === 'blessing';
            }),
          },
        },
        activeExploits: activeEffects.filter(id => {
          const e = effectsRegistry.find(x => x.id === id);
          return e?.type === 'exploit' || e?.type === 'epic' || e?.type === 'legendary';
        }),
      };
      
      const result = choice.onChoose({ state: adaptedState, rng: Math.random });
      
      // Map the returned state back to gameState format
      if (result && result.state) {
        const newState = result.state;
        const updates: Partial<GameState> = {};
        
        // Map resources back
        if (newState.resources?.coins !== undefined) {
          updates.coins = newState.resources.coins;
        }
        
        // Map inventory back to ownedEffects and activeEffects
        if (newState.run?.inventory) {
          const inv = newState.run.inventory;
          const newOwned = new Set(gameState.ownedEffects);
          const newActive = new Set(activeEffects);
          
          if (inv.exploits) inv.exploits.forEach((id: string) => { newOwned.add(id); newActive.add(id); });
          if (inv.curses) inv.curses.forEach((id: string) => { newOwned.add(id); newActive.add(id); });
          if (inv.blessings) inv.blessings.forEach((id: string) => newOwned.add(id));
          
          updates.ownedEffects = Array.from(newOwned);
          setActiveEffects(Array.from(newActive));
        }
        
        // Apply updates and set result text
        setGameState(prev => ({ 
          ...prev, 
          ...updates, 
          wanderState: 'result', 
          wanderResultText: result.message || choice.result 
        }));
      } else {
        // Fallback if onChoose doesn't return proper result
        setGameState(prev => ({ ...prev, wanderState: 'result', wanderResultText: choice.result }));
      }
    } else if (choice.effects) {
      // Old-style effects array (for PLACEHOLDER_WANDERS)
      resolveWanderEffect(choice.effects);
      setGameState(prev => ({ ...prev, wanderState: 'result', wanderResultText: choice.result }));
    } else {
      // No effects or onChoose - just show result
      setGameState(prev => ({ ...prev, wanderState: 'result', wanderResultText: choice.result }));
    }
  };
  
  const finishWander = () => {
     if (gameState.wanderRound < 2) {
         setGameState(prev => ({ ...prev, wanderRound: 2 }));
         triggerWanderSelection();
     } else {
         startNextEncounter();
     }
  };

  const startNextEncounter = () => {
     const newCharges = { ...gameState.charges };
     effectsRegistry.forEach(e => { if (e.chargeReset === 'encounter' && e.maxCharges) newCharges[e.id] = e.maxCharges; });
     const nextIdx = gameState.runIndex + 1;
     if (nextIdx < runPlan.length) {
        const nextEncounter = runPlan[nextIdx];
        
        // Retain only persistent effects (blessings now persist like exploits/curses)
        const keptEffects = activeEffects.filter(id => { 
            const e = effectsRegistry.find(x => x.id === id); 
            return e?.type === 'exploit' || e?.type === 'curse' || e?.type === 'epic' || e?.type === 'legendary' || e?.type === 'blessing'; 
        });
        
        // Generate Board
        const newBoard = generateNewBoard(0, gameState.coins, gameState.scoreMultiplier, gameState.coinMultiplier);

        // Calculate new active effects list
        let nextActiveEffects = [...keptEffects];
        if (nextEncounter.effectId) nextActiveEffects.push(nextEncounter.effectId);
      nextActiveEffects = Array.from(new Set(nextActiveEffects));

        // Prepare base state for the new encounter
        let nextState: GameState = { 
            ...gameState,
            piles: newBoard.piles, 
            score: 0, 
            moves: 0,
            selectedCardIds: null,
            activeMinigame: null,
            minigameResult: null,
            coins: gameState.coins, 
            runIndex: nextIdx, 
            currentScoreGoal: nextEncounter.goal, 
            isLevelComplete: false, 
            charges: newCharges, 
            wanderState: 'none',
            lastActionType: 'none'
        };

        // Apply onActivate for the new encounter effect
        const newEffectDef = effectsRegistry.find(e => e.id === nextEncounter.effectId);
        if (newEffectDef?.onActivate) {
           const changes = newEffectDef.onActivate(nextState, nextActiveEffects);
           if (changes) {
              const anyChanges = changes as any;
              if (anyChanges.newActiveEffects) {
                 nextActiveEffects = anyChanges.newActiveEffects;
                 delete anyChanges.newActiveEffects;
              }
              nextState = { ...nextState, ...anyChanges };
           }
        }

        // Apply onEncounterStart for ALL active effects
        nextActiveEffects.forEach(eid => {
           const def = effectsRegistry.find(e => e.id === eid);
           if (def?.onEncounterStart) {
              const changes = def.onEncounterStart(nextState);
              if (changes) {
                 nextState = { ...nextState, ...changes, effectState: { ...nextState.effectState, ...changes.effectState } };
              }
           }
        });

        // Draw opening hand automatically for the encounter
        const encounterEffects = effectsRegistry.filter(e => nextActiveEffects.includes(e.id));
        nextState = dealHand(nextState, encounterEffects);

        // Update State
        setActiveEffects(nextActiveEffects);
        setGameState(nextState);
     } else { 
        // Run complete - record victory
        if (runStartData) {
           const duration = Math.floor((Date.now() - runStartData.startTime) / 1000);
           const runEntry: RunHistoryEntry = {
              id: `run_${Date.now()}`,
              result: 'won',
              score: gameState.score,
              finalCoins: gameState.coins,
              date: new Date().toISOString(),
              mode: 'Coronata',
              duration,
              encountersCompleted: runPlan.filter(e => e.completed).length,
              totalEncounters: runPlan.length,
              exploits: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && (e.type === 'exploit' || e.type === 'epic' || e.type === 'legendary'))),
              curses: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && e.type === 'curse')),
              blessings: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && e.type === 'blessing')),
              encounters: runStartData.encounterLog,
              seed: gameState.seed,
           };
           const updatedStats = recordRunCompletion(playerStats, runEntry);
           setPlayerStats(updatedStats);
           savePlayerStats(updatedStats);
        }
        alert("Run Complete!"); 
        setCurrentView('home'); 
     }
  };

  const startRun = () => {
      // support seeded plan generation if a seed is set in localStorage
      const rawSeed = (() => { try { return localStorage.getItem('solitaire_seed_v1'); } catch { return null; } })();
      const seedNum = rawSeed ? Number(rawSeed) : null;
      const rng = seedNum ? createSeededRng(seedNum) : undefined;

      const plan = generateRunPlan(effectsRegistry, rng);
      const firstEncounter = plan[0];
      let freshState = initialGameState();
      if (firstEncounter) freshState.currentScoreGoal = firstEncounter.goal;

      // Apply first encounter onActivate if present (mirror geminicoronata behavior)
      let initialActive: string[] = firstEncounter?.effectId ? [firstEncounter.effectId] : [];
      const firstEff = firstEncounter?.effectId ? effectsRegistry.find(e => e.id === firstEncounter.effectId) : undefined;
      if (firstEff?.onActivate) {
         const changes = firstEff.onActivate(freshState, initialActive);
         if (changes) {
            // If effect returned a replacement 'newActiveEffects' array, respect it
            // and merge remaining state changes into the freshState
            const anyChanges = changes as any;
            if (anyChanges.newActiveEffects && Array.isArray(anyChanges.newActiveEffects)) {
               initialActive = anyChanges.newActiveEffects;
               const { newActiveEffects, ...rest } = anyChanges;
               freshState = { ...freshState, ...rest };
            } else {
               freshState = { ...freshState, ...changes };
            }
         }
      }

      // Auto-draw opening hand for the first encounter
      const initialEffectsList = effectsRegistry.filter(e => initialActive.includes(e.id));
      freshState = dealHand(freshState, initialEffectsList);

      // Initialize run tracking
      setRunStartData({
         startTime: Date.now(),
         startCoins: freshState.coins,
         encounterLog: []
      });

      setRunPlan(plan);
      setGameState(freshState);
      setShopInventory([]);

      // Set initial active effects and show the game
      setActiveEffects(initialActive);
      setCurrentView('game');

      // Always show blessing selection (use placeholder if no blessings available)
      const blessings = effectsRegistry.filter(e => e.type === 'blessing').sort(() => 0.5 - Math.random());
      const blessingOptions = blessings.length > 0 ? blessings : [
        { id: 'placeholder_blessing_1', name: 'Swift Hands', type: 'blessing', description: 'Draw an extra card each turn.', rarity: 'common', cost: 0 },
        { id: 'placeholder_blessing_2', name: 'Lucky Draw', type: 'blessing', description: 'Increased chance of finding rare cards.', rarity: 'uncommon', cost: 0 },
        { id: 'placeholder_blessing_3', name: 'Golden Touch', type: 'blessing', description: 'Earn bonus coins on foundation plays.', rarity: 'rare', cost: 0 },
      ] as GameEffect[];
      setBlessingChoices(blessingOptions);
      setActiveDrawer('blessing_select');
      // Prevent collapsing the blessing picker at run start
      setNonClosableDrawer('blessing_select');
  };

  const getEffects = useCallback(() => { return effectsRegistry.filter(e => activeEffects.includes(e.id)); }, [activeEffects, effectsRegistry]);

  // Find valid move destinations for a card/stack
  const findValidMoves = useCallback((movingCardIds: string[], sourcePileId: string): { tableauIds: string[]; foundationIds: string[] } => {
    const sourcePile = gameState.piles[sourcePileId];
    if (!sourcePile) return { tableauIds: [], foundationIds: [] };
    const movingCards = sourcePile.cards.filter(c => movingCardIds.includes(c.id));
    if (movingCards.length === 0) return { tableauIds: [], foundationIds: [] };

    const effects = getEffects();
    const tableauIds: string[] = [];
    const foundationIds: string[] = [];

    // Validate stack if moving from tableau
    let stackValid = true;
    if (sourcePile.type === 'tableau' && movingCards.length > 1) {
      // Check alternating colors and descending order
      for (let i = 0; i < movingCards.length - 1; i++) {
        const current = movingCards[i];
        const next = movingCards[i + 1];
        const patriarchyMode = settings.supportPatriarchy || false;
        if (getCardColor(current.suit) === getCardColor(next.suit) || getStackRank(current.rank, patriarchyMode) !== getStackRank(next.rank, patriarchyMode) + 1) {
          stackValid = false;
          break;
        }
      }
    }

    if (!stackValid) return { tableauIds: [], foundationIds: [] };

    // Check tableau destinations
    Object.entries(gameState.piles).forEach(([pileId, pile]) => {
      if (pile.type === 'tableau' && pileId !== sourcePileId) {
        if (!pile.locked) {
          let valid = isStandardMoveValid(movingCards, pile, settings.supportPatriarchy);
          // Apply effect canMove hooks
          effects.forEach(eff => {
            if (eff.canMove) {
              try {
                const res = eff.canMove(movingCards, sourcePile, pile, valid, gameState);
                if (res !== undefined) valid = res;
              } catch (e) { /* ignore */ }
            }
          });
          if (valid) tableauIds.push(pileId);
        }
      }
    });

    // Check foundation destinations (only for single cards)
    if (movingCards.length === 1) {
      Object.entries(gameState.piles).forEach(([pileId, pile]) => {
        if (pile.type === 'foundation') {
          let valid = isStandardMoveValid(movingCards, pile, settings.supportPatriarchy);
          effects.forEach(eff => {
            if (eff.canMove) {
              try {
                const res = eff.canMove(movingCards, sourcePile, pile, valid, gameState);
                if (res !== undefined) valid = res;
              } catch (e) { /* ignore */ }
            }
          });
          if (valid) foundationIds.push(pileId);
        }
      });
    }

    return { tableauIds, foundationIds };
  }, [gameState, getEffects, settings.supportPatriarchy]);

  const runMinigame = () => {
     if (!gameState.activeMinigame) return;
     const type = gameState.activeMinigame.type;
     let result;
     if (type === 'blackjack') result = Minigames.blackjack();
     else if (type === 'roulette') result = Minigames.roulette();
     else if (type === 'poker') result = Minigames.poker();
     else if (type === 'darts') result = Minigames.darts();
     else if (type === 'pool') result = Minigames.pool();
     else if (type === 'slots') result = Minigames.slots();
     else if (type === 'pinball') result = Minigames.pinball();
     setGameState(prev => ({ ...prev, minigameResult: result || { outcome: 'loss', reward: 0, text: 'Error' } }));
  };

  const claimMinigameReward = () => {
     if (!gameState.minigameResult) return;
     const reward = gameState.minigameResult.reward;
     if (gameState.activeMinigame?.type === 'darts' && gameState.minigameResult.outcome !== 'criticalLoss') {
        if (gameState.activeMinigame.context?.pileId) {
           const pile = gameState.piles[gameState.activeMinigame.context.pileId];
           const idx = gameState.activeMinigame.context.cardIndex;
           const newCards = [...pile.cards];
           newCards[idx].meta = { ...newCards[idx].meta, locked: false };
           setGameState(prev => ({ ...prev, piles: { ...prev.piles, [pile.id]: { ...pile, cards: newCards } } }));
        }
     } else {
        setGameState(prev => ({ ...prev, coins: prev.coins + reward, activeMinigame: null, minigameResult: null }));
     }
     setGameState(prev => ({ ...prev, activeMinigame: null, minigameResult: null }));
  };

  const handleShadowRealmClick = () => {
     const shadowPile = gameState.piles['shadow-realm'];
     if (!shadowPile || shadowPile.cards.length === 0) return;
     
     // Cost to summon: 10 coins
     const cost = 10;
     if (gameState.coins >= cost) {
        const card = shadowPile.cards[shadowPile.cards.length - 1];
        const newShadowCards = shadowPile.cards.slice(0, -1);
        const hand = gameState.piles['hand'];
        const newHandCards = [...hand.cards, card];
        
        setGameState(prev => ({
           ...prev,
           coins: prev.coins - cost,
           piles: {
              ...prev.piles,
              'shadow-realm': { ...shadowPile, cards: newShadowCards },
              hand: { ...hand, cards: newHandCards }
           }
        }));
     }
  };

  const spendMomentum = (type: 'wild' | 'unlock' | 'pts') => {
     const current = gameState.effectState?.momentum || 0;
     if (type === 'wild' && current >= 3) {
        const wild: Card = { id: `momentum-wild-${Math.random()}`, rank: 0, suit: 'special', faceUp: true, meta: { isWild: true } };
        setGameState(prev => ({
           ...prev,
           piles: { ...prev.piles, hand: { ...prev.piles.hand, cards: [...prev.piles.hand.cards, wild] } },
           effectState: { ...prev.effectState, momentum: current - 3 }
        }));
     } else if (type === 'unlock' && current >= 5) {
        // Unlock random tableau
        const locked = Object.values(gameState.piles).filter(p => p.type === 'tableau' && p.locked);
        if (locked.length > 0) {
           const target = locked[Math.floor(Math.random() * locked.length)];
           setGameState(prev => ({
              ...prev,
              piles: { ...prev.piles, [target.id]: { ...target, locked: false } },
              effectState: { ...prev.effectState, momentum: current - 5 }
           }));
        }
     } else if (type === 'pts' && current >= 1) {
        setGameState(prev => ({
           ...prev,
           score: prev.score + 100,
           effectState: { ...prev.effectState, momentum: current - 1 }
        }));
     }
  };

   const clearSelection = () => {
      setGameState(prev => ({ ...prev, selectedCardIds: null }));
      setSelectedPileId(null);
      setSelectedCardIndex(null);
      setHintTargets([]);
      setSelectionColor('none');
      setHighlightedMoves({ tableauIds: [], foundationIds: [] });
   };

   const selectCardAndCompute = (pileId: string, cardIndex: number) => {
      const pile = gameState.piles[pileId];
      if (!pile) return;
      const card = pile.cards[cardIndex];
      if (!card) return;
      if (!card.faceUp && pile.type === 'tableau') return; // selection only for face-up cards (tableau)

      const movingCards = pile.type === 'tableau' ? pile.cards.slice(cardIndex) : [card];
      const moves = findValidMoves(movingCards, pileId, cardIndex, gameState.piles, settings.supportPatriarchy);
      const allTargets = [...moves.tableauIds, ...moves.foundationIds];
      const color: 'red' | 'green' | 'yellow' | 'none' = allTargets.length === 0 ? 'red' : allTargets.length === 1 ? 'green' : 'yellow';

      setGameState(prev => ({ ...prev, selectedCardIds: movingCards.map(c => c.id) }));
      setSelectedPileId(pileId);
      setSelectedCardIndex(cardIndex);
      setHintTargets(allTargets);
      setSelectionColor(color);
      setHighlightedMoves({ tableauIds: moves.tableauIds, foundationIds: moves.foundationIds });
   };

  const handleCardClick = (pileId: string, cardIndex: number) => {
    const pile = gameState.piles[pileId];
    if (!pile) return;
    const clickedCard = cardIndex >= 0 ? pile.cards[cardIndex] : null;

    // Locked card unlock flow (Panopticon minigame or pay coins)
    if (clickedCard && clickedCard.meta?.locked) {
       const hasPanopticon = activeEffects.includes('panopticon');
       if (hasPanopticon) {
          setGameState(prev => ({ ...prev, activeMinigame: { type: 'darts', title: 'Break the Lock', context: { pileId, cardIndex } } }));
          return;
       }
       if (canAfford(10)) {
          const newCards = [...pile.cards];
          newCards[cardIndex] = { ...clickedCard, meta: { ...clickedCard.meta, locked: false } };
          setGameState(prev => ({ ...prev, coins: prev.coins - 10, piles: { ...prev.piles, [pileId]: { ...pile, cards: newCards } } }));
       }
       return;
    }
    
    if (pile.locked) {
        return;
    }
    
    if (gameState.interactionMode === 'discard_select') { if (pileId === 'hand' && cardIndex >= 0) { const newCards = [...pile.cards]; newCards.splice(cardIndex, 1); const charges = gameState.charges['knock_on_wood'] - 1; setGameState(prev => ({ ...prev, piles: { ...prev.piles, hand: { ...pile, cards: newCards } }, interactionMode: 'normal', charges: { ...prev.charges, knock_on_wood: charges } })); } return; }
    
    if (!gameState.selectedCardIds) {
      if (pile.type === 'deck') { discardAndDrawHand(); return; }
      if (!clickedCard) { clearSelection(); return; }
      if (pile.type === 'tableau') {
         if (!clickedCard.faceUp && cardIndex === pile.cards.length - 1) {
            const newCards = [...pile.cards];
            newCards[cardIndex] = { ...clickedCard, faceUp: true };
            setGameState(prev => ({ ...prev, piles: { ...prev.piles, [pileId]: { ...pile, cards: newCards } } }));
            clearSelection();
            return;
         }
         if (clickedCard.faceUp) { selectCardAndCompute(pileId, cardIndex); return; }
      }
      if (pile.type === 'hand' || pile.type === 'foundation') { selectCardAndCompute(pileId, cardIndex); return; }
      return;
    }

    // If clicking a different card in the same pile, treat as reselection (tableau stacks)
    if (pileId === selectedPileId && cardIndex >= 0 && pile.type === 'tableau' && clickedCard?.faceUp) {
       // If clicking the same card again, auto-move prioritizing foundation
       if (cardIndex === selectedCardIndex) {
          // Foundation takes priority - if any foundation is valid, move there
          if (highlightedMoves.foundationIds.length > 0) {
             const moved = attemptMove(gameState.selectedCardIds!, selectedPileId!, highlightedMoves.foundationIds[0], selectedCardIndex ?? undefined);
             if (moved) { clearSelection(); return; }
          }
          // Otherwise, if exactly one tableau target (green), auto-move there
          if (selectionColor === 'green' && highlightedMoves.tableauIds.length === 1) {
             const moved = attemptMove(gameState.selectedCardIds!, selectedPileId!, highlightedMoves.tableauIds[0], selectedCardIndex ?? undefined);
             if (moved) { clearSelection(); return; }
          }
       }
       selectCardAndCompute(pileId, cardIndex);
       return;
    }

    // Same for hand cards - auto-move on re-click, prioritizing foundation
    if (pileId === selectedPileId && pileId === 'hand' && cardIndex === selectedCardIndex) {
       // Foundation takes priority
       if (highlightedMoves.foundationIds.length > 0) {
          const moved = attemptMove(gameState.selectedCardIds!, selectedPileId!, highlightedMoves.foundationIds[0], selectedCardIndex ?? undefined);
          if (moved) { clearSelection(); return; }
       }
       // Otherwise, if exactly one tableau target (green), auto-move there
       if (selectionColor === 'green' && highlightedMoves.tableauIds.length === 1) {
          const moved = attemptMove(gameState.selectedCardIds!, selectedPileId!, highlightedMoves.tableauIds[0], selectedCardIndex ?? undefined);
          if (moved) { clearSelection(); return; }
       }
    }

    const moved = attemptMove(gameState.selectedCardIds, selectedPileId!, pileId, selectedCardIndex ?? undefined);
    if (moved) {
       clearSelection();
       return;
    }

    // If move failed, allow switching selection to the clicked card
    if (clickedCard) {
       if (pile.type === 'tableau' && clickedCard.faceUp) { selectCardAndCompute(pileId, cardIndex); return; }
       if (pile.type === 'hand' || pile.type === 'foundation') { selectCardAndCompute(pileId, cardIndex); return; }
    }
  };
  
  const handleDoubleClick = (pileId: string, cardIndex: number) => {
      const pile = gameState.piles[pileId];
      if (!pile || cardIndex < 0) return;
      const card = pile.cards[cardIndex];
      if (!card.faceUp) return;
      if (cardIndex !== pile.cards.length - 1) return; // only top card auto-move

      const moves = findValidMoves([card], pileId, cardIndex, gameState.piles, settings.supportPatriarchy);

      // Prefer foundations
      if (moves.foundationIds.length > 0) {
         const target = moves.foundationIds[0];
         const moved = attemptMove([card.id], pileId, target, cardIndex);
         if (moved) clearSelection();
         return;
      }

      // Only auto to tableau if exactly one option
      if (moves.tableauIds.length === 1) {
         const target = moves.tableauIds[0];
         const moved = attemptMove([card.id], pileId, target, cardIndex);
         if (moved) clearSelection();
      }
  };

  const dealHand = (state: GameState, effects: GameEffect[]): GameState => {
    const deck = state.piles['deck'];
    const hand = state.piles['hand'];
    const oldHand = hand.cards.map(c => ({ ...c, faceUp: false }));
    let newDeckCards = [...deck.cards, ...oldHand];
    const drawCount = 5;
    const drawn = newDeckCards.splice(0, drawCount).map(c => ({ ...c, faceUp: true }));

    let nextState: GameState = {
      ...state,
      piles: {
        ...state.piles,
        deck: { ...deck, cards: newDeckCards },
        hand: { ...hand, cards: drawn }
      },
      lastActionType: 'shuffle'
    };

    const context: MoveContext = { source: 'hand', target: 'deck', cards: oldHand };
    let minigameTrigger: string | undefined;

    effects.forEach(eff => {
       if (eff.onMoveComplete) {
          const result = eff.onMoveComplete(nextState, context);
          if ((result as any)?.triggerMinigame) minigameTrigger = (result as any).triggerMinigame;
          const { triggerMinigame, ...stateUpdates } = result as any;
          nextState = { ...nextState, ...stateUpdates };
       }
    });

    if (minigameTrigger) {
       nextState = { ...nextState, activeMinigame: { type: minigameTrigger, title: minigameTrigger.toUpperCase() } };
    }

    return nextState;
  };

  const discardAndDrawHand = () => {
    const effects = getEffects();
    setGameState(prev => dealHand(prev, effects));
  };

  const attemptMove = (cardIds: string[], sourcePileId: string, targetPileId: string, sourceCardIndex?: number): boolean => {
    if (sourcePileId === targetPileId) return false;
    let finalTargetPileId = targetPileId;
    const effects = getEffects();
    const sourcePile = gameState.piles[sourcePileId];
    const movingCards = sourcePile.cards.filter(c => cardIds.includes(c.id));
    if (movingCards.length === 0) return false;

    let context: MoveContext = { source: sourcePileId, target: targetPileId, cards: movingCards };
    effects.forEach(eff => {
       if (eff.interceptMove) {
          const mod = eff.interceptMove(context, gameState);
          if (mod.target) finalTargetPileId = mod.target;
       }
    });
    
    const targetPile = gameState.piles[finalTargetPileId];

    const baseMoves = findValidMoves(movingCards, sourcePileId, sourceCardIndex, gameState.piles, settings.supportPatriarchy);
    let valid = baseMoves.tableauIds.includes(finalTargetPileId) || baseMoves.foundationIds.includes(finalTargetPileId);

    effects.forEach(eff => {
       if (eff.canMove) {
          const res = eff.canMove(movingCards, sourcePile, targetPile, valid, gameState);
          if (res !== undefined) valid = res;
       }
    });

    if (!valid) return false;

    const newSourceCards = sourcePile.cards.filter(c => !cardIds.includes(c.id));
    // Auto-flip top card when exposed (standard solitaire behavior)
    if (sourcePile.type === 'tableau' && newSourceCards.length > 0) { const newTop = newSourceCards[newSourceCards.length - 1]; if (!newTop.faceUp) newSourceCards[newSourceCards.length - 1] = { ...newTop, faceUp: true }; }
    const newTargetCards = [...targetPile.cards, ...movingCards];
    const newPiles = { ...gameState.piles, [sourcePileId]: { ...sourcePile, cards: newSourceCards }, [finalTargetPileId]: { ...targetPile, cards: newTargetCards } };

    let scoreDelta = 0;
    const card = movingCards[0];
    if (targetPile.type === 'tableau' && !card.meta?.scoredTableau) { scoreDelta += card.rank; card.meta = { ...card.meta, scoredTableau: true }; } 
    else if (targetPile.type === 'foundation' && !card.meta?.scoredFoundation) { scoreDelta += card.rank * 2; card.meta = { ...card.meta, scoredFoundation: true }; }
    
    effects.forEach(eff => {
       if (eff.calculateScore) scoreDelta = eff.calculateScore(scoreDelta, context, gameState);
    });

    let coinDelta = 0;
    effects.forEach(eff => {
        if (eff.calculateCoinTransaction) coinDelta = eff.calculateCoinTransaction(coinDelta, context, gameState);
    });

    let minigameTrigger = null;
    let nextState = { ...gameState, piles: newPiles, moves: gameState.moves + 1, score: gameState.score + scoreDelta, coins: gameState.coins + coinDelta };
    
    effects.forEach(eff => {
       if (eff.onMoveComplete) {
          const result = eff.onMoveComplete(nextState, { source: sourcePileId, target: finalTargetPileId, cards: movingCards });
          if (result.triggerMinigame) minigameTrigger = result.triggerMinigame;
          nextState = { ...nextState, ...result };
       }
    });

    if (minigameTrigger) {
       nextState.activeMinigame = { type: minigameTrigger, title: minigameTrigger.toUpperCase() };
    }
    
    setGameState(nextState);
    
    if (nextState.score >= nextState.currentScoreGoal && !nextState.isLevelComplete) {
       setGameState(p => ({ ...p, isLevelComplete: true }));
       setShowLevelComplete(true);
    }

    return true;
  };

  const completeLevel = () => {
     setShowLevelComplete(false);
     const currentEncounter = runPlan[gameState.runIndex];
     if (!currentEncounter) return;
     
     // Track encounter completion
     if (runStartData) {
        const effectDef = effectsRegistry.find(e => e.id === currentEncounter.effectId);
        const encounterRecord: RunEncounterRecord = {
           type: currentEncounter.type === 'danger' ? 'danger' : 'fear',
           name: effectDef?.name || `Level ${gameState.runIndex + 1}`,
           passed: true
        };
        setRunStartData(prev => prev ? { ...prev, encounterLog: [...prev.encounterLog, encounterRecord] } : null);
     }
     
     const reward = currentEncounter.type === 'danger' ? 100 : currentEncounter.type === 'fear' ? 50 : 0;
     setGameState(prev => ({ ...prev, coins: prev.coins + reward, score: 0 }));
     if (currentEncounter.type === 'danger') {
        // Always show blessing selection after danger (use placeholder if empty)
        const blessings = effectsRegistry.filter(e => e.type === 'blessing').sort(() => 0.5 - Math.random());
        const blessingOptions = blessings.length > 0 ? blessings : [
          { id: 'placeholder_blessing_1', name: 'Swift Hands', type: 'blessing', description: 'Draw an extra card each turn.', rarity: 'common', cost: 0 },
          { id: 'placeholder_blessing_2', name: 'Lucky Draw', type: 'blessing', description: 'Increased chance of finding rare cards.', rarity: 'uncommon', cost: 0 },
          { id: 'placeholder_blessing_3', name: 'Golden Touch', type: 'blessing', description: 'Earn bonus coins on foundation plays.', rarity: 'rare', cost: 0 },
        ] as GameEffect[];
      setBlessingChoices(blessingOptions); 
      setActiveDrawer('blessing_select');
      // Lock the blessing selection so the player can't accidentally collapse it
      setNonClosableDrawer('blessing_select');
     } else {
        // Open shop as post-encounter flow and lock it to prevent accidental collapse
        openShop(true);
     }
  };
  
   const openShop = (lock: boolean = false) => {
       const owned = gameState.ownedEffects || [];
       const exploits = effectsRegistry.filter(e => e.type === 'exploit' && !owned.includes(e.id)).sort(() => 0.5 - Math.random()).slice(0, 4);
       const curses = effectsRegistry.filter(e => e.type === 'curse' && !owned.includes(e.id)).sort(() => 0.5 - Math.random()).slice(0, 4);

       // Always show shop (use placeholder items if empty)
       let shopItems = [...exploits, ...curses];
       if (shopItems.length === 0) {
          shopItems = [
             { id: 'placeholder_exploit_1', name: 'Card Counter', type: 'exploit', description: 'See the next card in the deck.', rarity: 'common', cost: 50 },
             { id: 'placeholder_exploit_2', name: 'Deep Pockets', type: 'exploit', description: 'Start with extra coins each encounter.', rarity: 'uncommon', cost: 75 },
             { id: 'placeholder_curse_1', name: 'Heavy Hands', type: 'curse', description: 'Cards cost more to play.', rarity: 'common', cost: 0 },
             { id: 'placeholder_curse_2', name: 'Bad Luck', type: 'curse', description: 'Reduced score from low cards.', rarity: 'uncommon', cost: 0 },
          ] as GameEffect[];
       }
       setShopInventory(shopItems);
       setShopTab('buy');
       setActiveDrawer('shop');
       setNonClosableDrawer(lock ? 'shop' : null);
   };

  const toggleEffect = (id: string, forceState?: boolean) => {
      setActiveEffects(prev => {
         const isActive = prev.includes(id);
         if (forceState === true && isActive) return prev;
         if (forceState === false && !isActive) return prev;
         if (isActive) return prev.filter(e => e !== id);
         const effect = effectsRegistry.find(e => e.id === id);
         if (effect?.onActivate) {
            const changes = effect.onActivate(gameState, prev);
            const anyChanges = changes as any;
            if (anyChanges && anyChanges.newActiveEffects && Array.isArray(anyChanges.newActiveEffects)) {
               const newActive = anyChanges.newActiveEffects as string[];
               const { newActiveEffects, ...rest } = anyChanges;
               setGameState(curr => ({ ...curr, ...rest }));
               return newActive;
            }
            if (changes) setGameState(curr => ({ ...curr, ...changes }));
         }
         return [...prev, id];
      });
  };

  const canAfford = (cost: number) => gameState.coins >= cost;

  const buyEffect = (effect: GameEffect) => {
     const cost = effect.cost || 50;
     if (gameState.coins < cost) return; // Can't afford
       // Prevent owning duplicates
       if (gameState.ownedEffects.includes(effect.id)) return;

       setGameState(p => ({ 
          ...p, 
          coins: p.coins - cost, 
          ownedEffects: [...p.ownedEffects, effect.id] 
       }));

       // Auto-activate all purchased effects (blessings now activate immediately)
       toggleEffect(effect.id, true);
  };

  const renderCard = (card: Card, index: number, pileId: string, totalCards: number = 0) => {
    let visualCard = { ...card };
    const pile = gameState.piles[pileId]; 
      const effects = getEffects();
      for (const eff of effects) {
         if (eff.transformCardVisual) {
            visualCard = { ...visualCard, ...eff.transformCardVisual(card, pile) };
         }
      }
    const isSelected = gameState.selectedCardIds?.includes(card.id);
    const isHintTarget = hintTargets.includes(pileId) && index === pile.cards.length - 1;
    const ringColor = isSelected || isHintTarget
      ? selectionColor === 'green'
         ? 'ring-emerald-400'
         : selectionColor === 'yellow'
            ? 'ring-amber-300'
            : selectionColor === 'red'
               ? 'ring-rose-400'
               : 'ring-yellow-300'
      : '';
    const color = getCardColor(visualCard.suit);
    
    
    let handStyle = {};
    // No transform on hover, just static position. Bottom 30px to peek out behind HUD.
    if (pileId === 'hand') {
       const xOffset = (index - (totalCards - 1) / 2) * 45; 
       handStyle = { 
           position: 'absolute', 
           bottom: '30px', 
           left: '50%', 
           marginLeft: `${xOffset}px`, 
           transform: 'translateY(0)', // No movement
           zIndex: index + 30, 
           transition: 'none' // Remove animation
       };
    }
    
    if (!visualCard.faceUp) {
       return (
          <button
             key={card.id}
             className="absolute w-11 h-16 rounded border border-slate-700 shadow-md overflow-hidden"
             style={{ top: `${pileId.includes('tableau') ? index * 10 : 0}px` }}
             onClick={(e) => { e.stopPropagation(); handleCardClick(pileId, index); }}
             onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(pileId, index); }}
             aria-label={`Face down card ${card.id}`}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDoubleClick(pileId, index); } }}
          >
             <img src={`/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
          </button>
       );
    }
    return (
         <button
            key={card.id}
            type="button"
            className={`absolute w-11 h-16 bg-transparent perspective-1000 select-none ${isSelected ? 'z-[60]' : ''}`}
            style={pileId === 'hand' ? handStyle : { top: `${pileId.includes('tableau') ? index * 12 : 0}px`, zIndex: isSelected ? 60 : index }}
            onClick={(e) => { e.stopPropagation(); handleCardClick(pileId, index); }}
            onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(pileId, index); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDoubleClick(pileId, index); } }}
            aria-label={`${getRankDisplay(visualCard.rank)} ${visualCard.suit} card`}
         >
        <div className={`relative w-full h-full transform-style-3d ${settings.cardAnimations ? 'duration-500 transition-transform' : ''} ${visualCard.faceUp ? 'rotate-y-0' : 'rotate-y-180'}`}>
            <div className={`absolute inset-0 backface-hidden bg-white rounded shadow-md flex flex-col items-center justify-between p-0.5 border border-gray-300 ${ringColor ? `ring-2 ${ringColor}` : ''}`}
               style={{ opacity: visualCard.meta?.disabled ? 0.5 : 1, filter: visualCard.meta?.hiddenDimension ? 'grayscale(100%) blur(2px)' : 'none' }}>
             
             {/* Special Blessing Card Rendering */}
             {visualCard.meta?.isBlessing ? (
                 <div className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-b from-purple-100 to-purple-200 rounded">
                     <ResponsiveIcon name={visualCard.meta.effectId || visualCard.meta.name || ''} fallbackType="blessing" size={24} className="mb-0.5" />
                     <div className="text-[5px] font-bold leading-tight text-purple-800 px-0.5">{visualCard.meta.name}</div>
                 </div>
             ) : visualCard.meta?.isWild ? (
                 <div className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-b from-blue-100 to-blue-200 rounded">
                     <div className="text-xl">🃏</div>
                     <div className="text-[6px] font-bold text-blue-800">WILD</div>
                 </div>
             ) : (
                 <>
                    <div className={`w-full flex justify-between font-bold text-[10px] leading-none ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                    <div className={`text-sm md:text-2xl ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{visualCard.suit === 'hearts' ? '♥' : visualCard.suit === 'diamonds' ? '♦' : visualCard.suit === 'clubs' ? '♣' : '♠'}</div>
                    <div className={`w-full flex justify-between font-bold text-[10px] leading-none rotate-180 ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                 </>
             )}
             
             {visualCard.meta?.showLock && <div className="absolute top-0 right-0 text-red-500"><Lock size={10} /></div>}
             {visualCard.meta?.showKey && <div className="absolute top-0 left-0 text-yellow-500"><Key size={10} /></div>}
             {visualCard.meta?.showWild && <div className="absolute top-0 left-0 text-fuchsia-500"><Smile size={10} /></div>}
             {visualCard.meta?.showFake && <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><Skull size={24} className="text-red-900" /></div>}
          </div>
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded border border-slate-700 shadow-md overflow-hidden">
             <img src={`/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
          </div>
            </div>
         </button>
      );
  };
  
  // ... (Rest of Component - Render Logic - Identical) ...
  // ...
   const foundationPiles = (Object.values(gameState.piles) as Pile[]).filter(p => p.type === 'foundation').sort((a, b) => a.id.localeCompare(b.id));
   const tableauPiles = (Object.values(gameState.piles) as Pile[]).filter(p => p.type === 'tableau').sort((a, b) => Number.parseInt(a.id.split('-')[1] as string, 10) - Number.parseInt(b.id.split('-')[1] as string, 10));
  const currentEncounter = runPlan[gameState.runIndex];
  const currentThreat = effectsRegistry.find(e => e.id === currentEncounter?.effectId);

  if (currentView === 'home') {
     // Game modes data
     const gameModes = [
        { id: 'coronata', name: 'Coronata', desc: 'The original rogue-like experience. 15 encounters with effects, shops, and wanders.', unlocked: true, hasStars: true },
        { id: 'klondike', name: 'Klondike', desc: 'Classic solitaire with a rogue-like twist. Draw 1 or 3 cards.', unlocked: true, hasStars: false },
        { id: 'spider', name: 'Spider', desc: 'Build sequences of the same suit. 1, 2, or 4 suit variants.', unlocked: true, hasStars: false },
        { id: 'freecell', name: 'FreeCell', desc: 'Strategic solitaire with free cells for temporary storage.', unlocked: true, hasStars: false },
     ];

     // How to play pages
     const howToPages = [
        { title: 'Goal', content: 'Score points by moving cards to the Foundation piles. Build up from Ace to King, same suit. Reach the target score to clear each encounter!' },
        { title: 'Moving Cards', content: 'Tap a card to select it, then tap a valid destination. In tableau, stack cards in descending order, alternating colors (red on black, black on red).' },
        { title: 'The Deck', content: 'Tap the deck to draw cards. You can move the top card of the draw pile to tableau or foundation piles.' },
        { title: 'Encounters', content: 'Each run has 15 encounters. Every 3rd encounter is a Danger (harder). Fears give you access to the shop. Dangers let you pick a blessing.' },
        { title: 'Effects', content: 'Exploits help you. Curses hurt you. Blessings are powerful cards added to your deck. Collect them from the shop and wanders!' },
        { title: 'The Shop', content: 'After Fear encounters, visit the Trade. Spend coins on Exploits or take Curses for bonus coins. Choose wisely!' },
        { title: 'Wanders', content: 'Between encounters, you\'ll face random events. Make choices that can reward you with coins, effects, or... consequences.' },
        { title: 'Winning', content: 'Beat all 15 encounters to complete a run. Your final score depends on coins, effects collected, and time taken. Good luck!' },
     ];

     // Updates/changelog data
     const updates = [
        { version: 'v0.4.0', date: 'Dec 7, 2024', changes: ['Added Modes menu', 'Added Profile screen', 'Full Settings UI', 'How To Play tutorial', 'Updates changelog'] },
        { version: 'v0.3.0', date: 'Dec 5, 2024', changes: ['Decoupled UI from backend', 'Placeholder content for all phases', 'UI works without effects'] },
        { version: 'v0.2.0', date: 'Dec 1, 2024', changes: ['Wander events system', 'Shop & trading', 'Blessing cards', 'Run planning'] },
        { version: 'v0.1.0', date: 'Nov 15, 2024', changes: ['Initial prototype', 'Basic solitaire gameplay', 'Score system', 'Card rendering'] },
     ];

     return (
        <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4 gap-8">
           <div className="text-center space-y-2">
              <img src="/logo-48x72.png" alt="Coronata" className="w-12 h-auto mx-auto mb-2" />
              <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-blue-600">CORONATA</h1>
              <p className="text-slate-400">Rogue-like Solitaire</p>
           </div>
           <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <button onClick={startRun} className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold text-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"><Play fill="currentColor" /> Play</button>
              <button onClick={() => setShowModes(true)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Gamepad2 size={18}/> Modes</button>
              <button onClick={() => setShowHowTo(true)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><BookOpen size={18}/> How To</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2" onClick={() => setShowGlossary(true)}><HelpCircle size={18}/> Glossary</button>
              <button onClick={() => setShowUpdates(true)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><RefreshCw size={18}/> Updates</button>
              <button onClick={() => setShowProfile(true)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><User size={18}/> Profile</button>
              <button onClick={() => setShowSettings(true)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Settings size={18}/> Settings</button>
           </div>

           {/* MODES PANEL */}
           {showModes && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Game Modes</h2>
                    <button onClick={() => setShowModes(false)}><X /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-3">
                    {gameModes.map(mode => (
                       <div 
                          key={mode.id}
                          onClick={() => mode.unlocked && setSelectedMode(mode.id)}
                          className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                             selectedMode === mode.id 
                                ? 'bg-purple-900/50 border-purple-500 ring-2 ring-purple-400' 
                                : mode.unlocked 
                                   ? 'bg-slate-800 border-slate-700 hover:border-slate-500' 
                                   : 'bg-slate-800/50 border-slate-700/50 opacity-50 cursor-not-allowed pointer-events-none'
                          }`}>
                          <div className="flex items-center gap-3">
                             <div className="flex-1">
                                <div className="font-bold text-white flex items-center gap-2">
                                   {mode.name}
                                   {!mode.unlocked && <Lock size={14} className="text-slate-500" />}
                                   {selectedMode === mode.id && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">Selected</span>}
                                </div>
                                <div className="text-sm text-slate-400">{mode.desc}</div>
                             </div>
                             <button 
                                className={`p-2 rounded-lg ${mode.hasStars ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' : 'bg-slate-700/30 text-slate-600 cursor-not-allowed'}`}
                                disabled={!mode.hasStars}
                                onClick={(e) => { e.stopPropagation(); if (mode.hasStars) alert('High Scores coming soon!'); }}>
                                <Trophy size={18} />
                             </button>
                          </div>
                       </div>
                    ))}
                    {/* Coming Soon */}
                    <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-600 bg-slate-800/30">
                       <div className="text-center">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center"><RefreshCw size={18} className="text-slate-500" /></div>
                          <div className="font-bold text-slate-400">More Modes Coming Soon</div>
                          <div className="text-xs text-slate-500 mt-1">Daily challenges, endless mode, custom runs & more!</div>
                       </div>
                    </div>
                 </div>
                 <div className="pt-4 border-t border-slate-700 mt-4">
                    <button 
                       onClick={() => { setShowModes(false); startRun(); }} 
                       className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg flex items-center justify-center gap-2">
                       <Play fill="currentColor" /> Start {gameModes.find(m => m.id === selectedMode)?.name}
                    </button>
                 </div>
              </div>
           )}

           {/* PROFILE PANEL */}
           {showProfile && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Profile</h2>
                    <button onClick={() => setShowProfile(false)}><X /></button>
                 </div>

                 {/* Avatar & Name */}
                 <div className="flex items-center gap-4 mb-4 p-4 bg-slate-800 rounded-xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-2xl">🃏</div>
                    <div>
                       <div className="font-bold text-xl">Player One</div>
                       <div className="text-slate-400 text-sm">Joined Nov 2024</div>
                    </div>
                 </div>

                 {/* Profile Tab Bar */}
                 <div className="flex gap-1 mb-4">
                    {(['stats', 'feats', 'recaps'] as const).map(tab => (
                       <button
                          key={tab}
                          onClick={() => setProfileTab(tab)}
                          className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                             profileTab === tab
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                          }`}>
                          {tab === 'stats' && <BarChart3 size={16} />}
                          {tab === 'feats' && <img src="/icons/feats.png" alt="" className="w-4 h-4" />}
                          {tab === 'recaps' && <img src="/icons/run history.png" alt="" className="w-4 h-4" />}
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                       </button>
                    ))}
                 </div>

                 <div className="flex-1 overflow-y-auto">
                    {/* STATS TAB */}
                    {profileTab === 'stats' && (
                       <>
                          {/* Debug: Show raw stats */}
                          {process.env.NODE_ENV === 'development' && (
                             <div className="mb-4 p-2 bg-slate-700/50 rounded text-xs">
                                <div>Stats loaded: {playerStats ? 'Yes' : 'No'}</div>
                                <div>Runs: {playerStats?.totalRuns || 0}</div>
                                <div>History length: {playerStats?.runHistory?.length || 0}</div>
                             </div>
                          )}
                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-6">
                             <div className="bg-slate-800 p-4 rounded-xl text-center">
                                <div className="text-3xl font-bold text-emerald-400">{playerStats.runsWon}</div>
                                <div className="text-xs text-slate-400 uppercase">Runs Won</div>
                             </div>
                             <div className="bg-slate-800 p-4 rounded-xl text-center">
                                <div className="text-3xl font-bold text-red-400">{playerStats.runsLost}</div>
                                <div className="text-xs text-slate-400 uppercase">Runs Lost</div>
                             </div>
                             <div className="bg-slate-800 p-4 rounded-xl text-center">
                                <div className="text-3xl font-bold text-yellow-400">{getWinRate(playerStats)}%</div>
                                <div className="text-xs text-slate-400 uppercase">Win Rate</div>
                             </div>
                             <div className="bg-slate-800 p-4 rounded-xl text-center">
                                <div className="text-3xl font-bold text-purple-400">{playerStats.totalEffectsFound}</div>
                                <div className="text-xs text-slate-400 uppercase">Effects Found</div>
                             </div>
                          </div>

                          {/* Recent Runs Summary */}
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-2">Recent Runs</h3>
                          <div className="space-y-2">
                             {playerStats.runHistory.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">No runs yet. Start your first run!</div>
                             ) : (
                                playerStats.runHistory.slice(0, 3).map((run, i) => (
                                   <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                                      <div className="flex items-center gap-2">
                                         {run.result === 'won' ? <Trophy size={16} className="text-yellow-400" /> : <Skull size={16} className="text-red-400" />}
                                         <span className="font-bold">{run.score}</span>
                                         <span className="text-slate-500 text-xs">({run.encountersCompleted}/{run.totalEncounters})</span>
                                      </div>
                                      <span className="text-slate-500 text-xs">{getRelativeTime(run.date)}</span>
                                   </div>
                                ))
                             )}
                          </div>
                       </>
                    )}

                    {/* FEATS TAB */}
                    {profileTab === 'feats' && (
                       <>
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-2">Feats (48 total)</h3>
                          <div className="space-y-2">
                             {[
                                // Speed feats
                                { emoji: '🏆', name: 'Speedrunner', req: 'Win a run in under 15 minutes', reward: 'Speed trophy', unlocked: false },
                                { emoji: '☄️', name: 'Comet', req: 'Win a run in under 7 minutes', reward: 'Comet badge', unlocked: false },
                                { emoji: '⚡', name: 'Going Pro', req: 'Win a run in under 5 minutes', reward: 'Pro speed', unlocked: false },
                                // Challenge feats
                                { emoji: '🎯', name: 'Minimalist', req: 'Win with no exploits', reward: 'Minimalist sash', unlocked: false },
                                { emoji: '💪', name: 'Self-Reliant', req: 'Win without blessings', reward: 'Self-reliant emblem', unlocked: false },
                                { emoji: '⛓️', name: 'Burdened', req: 'Win with 5+ curses', reward: 'Burden badge', unlocked: false },
                                { emoji: '🌋', name: 'Calamitous', req: 'Win with 10+ curses', reward: 'Calamity sigil', unlocked: false },
                                { emoji: '🧘', name: 'The Ascetic', req: 'Win with 0 coins spent', reward: 'Ascetic ribbon', unlocked: false },
                                { emoji: '🕳️', name: 'Embrace the Void', req: 'All 6 curse types active', reward: 'Void emblem', unlocked: false },
                                { emoji: '🔺', name: 'The Trifecta', req: 'No exploits, blessings, or coins used', reward: 'Trifecta badge', unlocked: false },
                                { emoji: '🥔', name: 'Peasantry', req: 'Never buy from Trader this run', reward: 'Peasant badge', unlocked: false },
                                // Milestone feats
                                { emoji: '👣', name: 'First Steps', req: 'Complete your first run (win or lose)', reward: 'Starter card back', unlocked: false },
                                { emoji: '🏆', name: 'First Victory', req: 'Win your first run', reward: 'Victory card back', unlocked: false },
                                { emoji: '✨', name: 'Glory', req: 'Win 3 consecutive runs', reward: 'Achievement', unlocked: false },
                                { emoji: '👑', name: 'Dominance', req: 'Win 10 consecutive runs', reward: 'Achievement', unlocked: false },
                                { emoji: '🌟', name: 'Immortality', req: 'Win 30 consecutive runs', reward: 'Achievement', unlocked: false },
                                // Ascension feats
                                { emoji: '🧗', name: 'The Climber', req: 'Win on ascension levels 1-10', reward: 'Ascension Mastery', unlocked: false },
                                { emoji: '👑', name: 'Crowning Glory', req: 'Ascension 10 + 10+ curses active', reward: 'Legendary crown', unlocked: false },
                                { emoji: '🐀', name: 'Packrat', req: '20+ curse cards in deck at victory', reward: 'Packrat chest', unlocked: false },
                                { emoji: '✨', name: 'Pristine', req: 'Win with zero curses gained', reward: 'Pristine laurel', unlocked: false },
                                { emoji: '🛡️', name: 'Untouchable', req: 'Ascension 5+ and no curses', reward: 'Untouchable crown', unlocked: false },
                                { emoji: '🧘', name: 'True Ascetic', req: 'Ascension 5+ with 0 coins spent', reward: 'True ascetic', unlocked: false },
                                // Hand size feats
                                { emoji: '💎', name: 'Glass Cannon', req: 'Permanent hand size <= 3', reward: 'Glass badge', unlocked: false },
                                { emoji: '📦', name: 'Hoarder', req: 'Permanent hand size >= 13', reward: 'Hoarder trophy', unlocked: false },
                                { emoji: '📚', name: 'Librarian', req: 'Permanent hand size >= 52', reward: 'Librarian tome', unlocked: false },
                                // Style feats
                                { emoji: '⬛', name: 'Monochrome', req: '90% plays from a single suit', reward: 'Monochrome medal', unlocked: false },
                                { emoji: '🎪', name: 'Maximalist', req: '15+ exploits acquired', reward: 'Maximalist banner', unlocked: false },
                                { emoji: '🙏', name: 'Favored', req: '15+ blessings used', reward: 'Favored amulet', unlocked: false },
                                { emoji: '👑', name: 'The True Crown', req: 'Asc10 + 0 coins + 0 exploits + 5+ curses', reward: 'True crown', unlocked: false },
                                // Encounter feats
                                { emoji: '1️⃣', name: 'One & Done', req: 'No reshuffles during encounter', reward: 'One&Done ribbon', unlocked: false },
                                { emoji: '⚙️', name: 'Efficiency', req: 'Win encounter in <=3 turns', reward: 'Efficiency gear', unlocked: false },
                                { emoji: '🙌', name: 'Look Ma, No Hands', req: 'Win without shuffles/discards', reward: 'Hands-free token', unlocked: false },
                                { emoji: '🏳️', name: "I've Seen Enough", req: 'Resign after 52+ plays', reward: 'White flag', unlocked: false },
                                { emoji: '🔀', name: 'Riffle', req: '10+ shuffles used', reward: 'Riffle ribbon', unlocked: false },
                                { emoji: '🧹', name: 'Cleanup', req: '15+ discards used', reward: 'Cleanup badge', unlocked: false },
                                // Card combo feats
                                { emoji: '🃏', name: 'Royal Decree', req: 'Play a 5-card same-suit straight in an encounter', reward: 'Royal decree', unlocked: false },
                                { emoji: '4️⃣', name: 'Four of a Kind', req: 'Play four-of-a-kind in an encounter', reward: 'Four-of-a-kind medal', unlocked: false },
                                { emoji: '📊', name: 'Full Sequence', req: 'Play 5-card straight in encounter', reward: 'Sequence sash', unlocked: false },
                                { emoji: '👸', name: 'Royal Court', req: 'Win encounter using only face cards', reward: 'Courtly cloak', unlocked: false },
                                // Wander feats
                                { emoji: '🚶', name: 'Wanderer 50', req: '50 wanders completed', reward: 'Wanderer medal', unlocked: false },
                                { emoji: '🏃', name: 'Wanderer 100', req: '100 wanders completed', reward: 'Wanderer trophy', unlocked: false },
                                { emoji: '🌍', name: 'Wanderer 500', req: '500 wanders completed', reward: 'Wanderer crown', unlocked: false },
                                // Combat feats
                                { emoji: '⚔️', name: 'Danger Seeker I', req: '25 dangers defeated', reward: 'Danger Seeker I', unlocked: false },
                                { emoji: '🗡️', name: 'Danger Seeker II', req: '50 dangers defeated', reward: 'Danger Seeker II', unlocked: false },
                                { emoji: '🔱', name: 'Danger Seeker III', req: '100 dangers defeated', reward: 'Danger Seeker III', unlocked: false },
                                // Win milestones
                                { emoji: '🎖️', name: 'Veteran', req: '10 wins', reward: 'Veteran badge', unlocked: false },
                                { emoji: '🏅', name: 'Champion', req: '25 wins', reward: 'Champion crest', unlocked: false },
                                { emoji: '🌟', name: 'Legend', req: '50 wins', reward: 'Legendary laurel', unlocked: false },
                                { emoji: '🏆', name: 'World Champion', req: '100 wins', reward: 'World champion trophy', unlocked: false },
                             ].map((feat, i) => (
                                <button
                                   key={i}
                                   onClick={() => setExpandedAchievement(expandedAchievement === i ? null : i)}
                                   className={`w-full p-3 rounded-lg text-left transition-all ${
                                      feat.unlocked ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-800/30 opacity-60'
                                   }`}>
                                   <div className="flex items-center gap-3">
                                      <span className={`text-2xl ${!feat.unlocked && 'grayscale'}`}>{feat.unlocked ? feat.emoji : '🔒'}</span>
                                      <div className="flex-1">
                                         <div className="font-bold text-sm flex items-center gap-2">
                                            {feat.name}
                                            {feat.unlocked && <span className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded">Unlocked</span>}
                                         </div>
                                         {expandedAchievement === i && (
                                            <div className="text-xs text-slate-400 mt-1 animate-in fade-in">
                                               <div>{feat.req}</div>
                                               <div className="text-yellow-500 mt-0.5">Reward: {feat.reward}</div>
                                            </div>
                                         )}
                                      </div>
                                      <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedAchievement === i ? 'rotate-180' : ''}`} />
                                   </div>
                                </button>
                             ))}
                          </div>
                       </>
                    )}

                    {/* RUN RECAPS TAB */}
                    {profileTab === 'recaps' && (
                       <>
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-3">Run History</h3>
                          <div className="space-y-4">
                             {playerStats.runHistory.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">No run history yet. Complete a run to see it here!</div>
                             ) : (
                                playerStats.runHistory.map((run) => (
                                <div key={run.id} className="bg-slate-800 rounded-xl p-4 space-y-3">
                                   {/* Run Header */}
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                         {run.result === 'won' 
                                            ? <Trophy size={20} className="text-yellow-400" /> 
                                            : <Skull size={20} className="text-red-400" />}
                                         <div>
                                            <div className="font-bold text-lg">{run.score.toLocaleString()}</div>
                                            <div className="text-xs text-slate-400">{run.mode} • {formatDuration(run.duration)}</div>
                                         </div>
                                      </div>
                                      <div className="text-xs text-slate-500">{getRelativeTime(run.date)}</div>
                                   </div>

                                   {/* Effects Row */}
                                   <div className="grid grid-cols-3 gap-2 text-xs">
                                      {/* Exploits */}
                                      <div className="bg-slate-700/50 rounded-lg p-2">
                                         <div className="flex items-center gap-1 mb-1.5 text-slate-400">
                                            <img src={categoryIcons.exploit} alt="" className="w-3 h-3" />
                                            <span className="uppercase tracking-wider text-[10px]">Exploits</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.exploits.map((effectId, i) => (
                                               <ResponsiveIcon key={i} name={effectId} fallbackType="exploit" size={20} className="rounded" />
                                            ))}
                                         </div>
                                      </div>
                                      {/* Curses */}
                                      <div className="bg-slate-700/50 rounded-lg p-2">
                                         <div className="flex items-center gap-1 mb-1.5 text-slate-400">
                                            <img src={categoryIcons.curse} alt="" className="w-3 h-3" />
                                            <span className="uppercase tracking-wider text-[10px]">Curses</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.curses.map((effectId, i) => (
                                               <ResponsiveIcon key={i} name={effectId} fallbackType="curse" size={20} className="rounded" />
                                            ))}
                                         </div>
                                      </div>
                                      {/* Blessings */}
                                      <div className="bg-slate-700/50 rounded-lg p-2">
                                         <div className="flex items-center gap-1 mb-1.5 text-slate-400">
                                            <img src={categoryIcons.blessing} alt="" className="w-3 h-3" />
                                            <span className="uppercase tracking-wider text-[10px]">Blessings</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.blessings.map((effectId, i) => (
                                               <ResponsiveIcon key={i} name={effectId} fallbackType="blessing" size={20} className="w-5 h-5 rounded" />
                                            ))}
                                         </div>
                                      </div>
                                   </div>

                                   {/* Encounter Progress Bar */}
                                   <div>
                                      <div className="flex items-center gap-1 mb-1.5 text-slate-400 text-[10px] uppercase tracking-wider">
                                         <MapIcon size={10} />
                                         <span>Journey ({run.encounters.filter(e => e.passed).length}/{run.encounters.length})</span>
                                      </div>
                                      <div className="flex gap-0.5">
                                         {run.encounters.map((enc, i) => {
                                            const iconMap: Record<string, string> = {
                                               danger: categoryIcons.danger,
                                               fear: categoryIcons.fear,
                                               wander: '/icons/wander.png',
                                               shop: '/icons/coin.png',
                                               boss: categoryIcons.danger,
                                            };
                                            return (
                                               <div 
                                                  key={i} 
                                                  className={`flex-1 h-6 rounded-sm flex items-center justify-center ${
                                                     enc.passed 
                                                        ? enc.type === 'boss' ? 'bg-yellow-600' : 'bg-emerald-600/80' 
                                                        : 'bg-red-600/80'
                                                  }`}
                                                  title={`${enc.name}${enc.passed ? '' : ' (Failed)'}`}>
                                                  <img src={iconMap[enc.type] || categoryIcons.danger} alt="" className="w-3 h-3 opacity-80" />
                                               </div>
                                            );
                                         })}
                                      </div>
                                   </div>
                                </div>
                             ))
                             )}
                          </div>
                       </>
                    )}
                 </div>
              </div>
           )}

           {/* SETTINGS PANEL */}
           {showSettings && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Settings</h2>
                    <button onClick={() => setShowSettings(false)}><X /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2">
                    {/* Gameplay - Collapsible */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'gameplay' ? null : 'gameplay')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Gameplay</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'gameplay' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'gameplay' && (
                          <div className="space-y-2 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Confirm Resign</div><div className="text-xs text-slate-400">Ask before giving up a run</div></div>
                                <button onClick={() => setSettings(s => ({...s, confirmResign: !s.confirmResign}))} className={`w-12 h-6 ${settings.confirmResign ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.confirmResign ? 'right-0.5' : 'left-0.5'}`}></div></button>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Support the Patriarchy</div><div className="text-xs text-slate-400">Kings are high instead of Queens</div></div>
                                <button onClick={() => setSettings(s => ({...s, supportPatriarchy: !s.supportPatriarchy}))} className={`w-12 h-6 ${settings.supportPatriarchy ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.supportPatriarchy ? 'right-0.5' : 'left-0.5'}`}></div></button>
                             </div>
                             
                             {/* Classic Modes Subsection */}
                             <div className="border-t border-slate-600 pt-3 mt-3">
                                <div className="text-xs text-slate-400 uppercase mb-3">Classic Modes</div>
                                <div className="text-xs text-slate-500 italic mb-3">Traditional solitaire without effects</div>
                                
                                {/* Klondike */}
                                <div className="p-3 bg-slate-700/50 rounded-lg mb-2">
                                   <div className="flex items-center justify-between mb-2">
                                      <div><div className="font-medium text-sm">Klondike</div><div className="text-xs text-slate-400">The classic solitaire</div></div>
                                      <button onClick={() => setSettings(s => ({...s, klondikeEnabled: !s.klondikeEnabled}))} className={`w-12 h-6 ${settings.klondikeEnabled ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.klondikeEnabled ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                   </div>
                                   {settings.klondikeEnabled && (
                                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-600">
                                         <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Draw</span>
                                            <div className="flex gap-1">
                                               <button onClick={() => setSettings(s => ({...s, klondikeDraw: '1'}))} className={`px-2 py-1 text-xs rounded ${settings.klondikeDraw === '1' ? 'bg-emerald-600' : 'bg-slate-600'}`}>1</button>
                                               <button onClick={() => setSettings(s => ({...s, klondikeDraw: '3'}))} className={`px-2 py-1 text-xs rounded ${settings.klondikeDraw === '3' ? 'bg-emerald-600' : 'bg-slate-600'}`}>3</button>
                                            </div>
                                         </div>
                                         <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Scoring</span>
                                            <select value={settings.klondikeScoring} onChange={(e) => setSettings(s => ({...s, klondikeScoring: e.target.value as 'standard' | 'vegas' | 'none'}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs">
                                               <option value="standard">Standard</option>
                                               <option value="vegas">Vegas</option>
                                               <option value="none">None</option>
                                            </select>
                                         </div>
                                         <div className="text-xs text-purple-400 mt-2">🚧 Coming soon!</div>
                                      </div>
                                   )}
                                </div>
                                
                                {/* Spider */}
                                <div className="p-3 bg-slate-700/50 rounded-lg mb-2">
                                   <div className="flex items-center justify-between mb-2">
                                      <div><div className="font-medium text-sm">Spider</div><div className="text-xs text-slate-400">Build sequences by suit</div></div>
                                      <button onClick={() => setSettings(s => ({...s, spiderEnabled: !s.spiderEnabled}))} className={`w-12 h-6 ${settings.spiderEnabled ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.spiderEnabled ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                   </div>
                                   {settings.spiderEnabled && (
                                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-600">
                                         <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Suits</span>
                                            <div className="flex gap-1">
                                               <button onClick={() => setSettings(s => ({...s, spiderSuits: '1'}))} className={`px-2 py-1 text-xs rounded ${settings.spiderSuits === '1' ? 'bg-emerald-600' : 'bg-slate-600'}`}>1</button>
                                               <button onClick={() => setSettings(s => ({...s, spiderSuits: '2'}))} className={`px-2 py-1 text-xs rounded ${settings.spiderSuits === '2' ? 'bg-emerald-600' : 'bg-slate-600'}`}>2</button>
                                               <button onClick={() => setSettings(s => ({...s, spiderSuits: '4'}))} className={`px-2 py-1 text-xs rounded ${settings.spiderSuits === '4' ? 'bg-emerald-600' : 'bg-slate-600'}`}>4</button>
                                            </div>
                                         </div>
                                         <div className="text-xs text-purple-400 mt-2">🚧 Coming soon!</div>
                                      </div>
                                   )}
                                </div>
                                
                                {/* Freecell */}
                                <div className="p-3 bg-slate-700/50 rounded-lg">
                                   <div className="flex items-center justify-between mb-2">
                                      <div><div className="font-medium text-sm">Freecell</div><div className="text-xs text-slate-400">Strategic solitaire with free cells</div></div>
                                      <button onClick={() => setSettings(s => ({...s, freecellEnabled: !s.freecellEnabled}))} className={`w-12 h-6 ${settings.freecellEnabled ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.freecellEnabled ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                   </div>
                                   {settings.freecellEnabled && (
                                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-600">
                                         <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Auto-move to Foundations</span>
                                            <button onClick={() => setSettings(s => ({...s, freecellAutoMove: !s.freecellAutoMove}))} className={`w-10 h-5 ${settings.freecellAutoMove ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.freecellAutoMove ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                         </div>
                                         <div className="text-xs text-purple-400 mt-2">🚧 Coming soon!</div>
                                      </div>
                                   )}
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* Audio - Collapsible (SFX + Music combined) */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'audio' ? null : 'audio')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Audio</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'audio' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'audio' && (
                          <div className="space-y-3 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             {/* Master */}
                             <div className="p-3 bg-slate-700/50 rounded-lg">
                                <div className="flex justify-between mb-2"><span className="text-sm">Master Volume</span><span className="text-slate-400 text-sm">{settings.masterVolume}%</span></div>
                                <input type="range" min="0" max="100" value={settings.masterVolume} onChange={(e) => setSettings(s => ({...s, masterVolume: Number(e.target.value)}))} className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                             </div>
                             {/* SFX Section */}
                             <div className="border-t border-slate-600 pt-3">
                                <div className="flex items-center justify-between mb-2">
                                   <div className="text-xs text-slate-400 uppercase">Sound Effects</div>
                                   <button onClick={() => setSettings(s => ({...s, sfxEnabled: !s.sfxEnabled}))} className={`w-10 h-5 ${settings.sfxEnabled ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.sfxEnabled ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                </div>
                                {settings.sfxEnabled && (
                                   <>
                                      <div className="p-3 bg-slate-700/50 rounded-lg mb-2">
                                         <div className="flex justify-between mb-2"><span className="text-sm">SFX Volume</span><span className="text-slate-400 text-sm">{settings.sfxVolume}%</span></div>
                                         <input type="range" min="0" max="100" value={settings.sfxVolume} onChange={(e) => setSettings(s => ({...s, sfxVolume: Number(e.target.value)}))} className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                                      </div>
                                      <div className="space-y-1">
                                         {[{key: 'cardFlip', label: 'Card Flip'}, {key: 'cardPlace', label: 'Card Place'}, {key: 'invalidMove', label: 'Invalid Move'}, {key: 'scorePoints', label: 'Score Points'}, {key: 'levelComplete', label: 'Level Complete'}, {key: 'uiClicks', label: 'UI Clicks'}].map(item => (
                                            <div key={item.key} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                                               <span className="text-xs">{item.label}</span>
                                               <button onClick={() => setSettings(s => ({...s, [item.key]: !s[item.key as keyof typeof s]}))} className={`w-10 h-5 ${settings[item.key as keyof typeof settings] ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[item.key as keyof typeof settings] ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                            </div>
                                         ))}
                                      </div>
                                   </>
                                )}
                             </div>
                             {/* Music Section */}
                             <div className="border-t border-slate-600 pt-3">
                                <div className="flex items-center justify-between mb-2">
                                   <div className="text-xs text-slate-400 uppercase">Music</div>
                                   <button onClick={() => setSettings(s => ({...s, musicEnabled: !s.musicEnabled}))} className={`w-10 h-5 ${settings.musicEnabled ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.musicEnabled ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                </div>
                                {settings.musicEnabled && (
                                   <>
                                      <div className="p-3 bg-slate-700/50 rounded-lg mb-2">
                                         <div className="flex justify-between mb-2"><span className="text-sm">Music Volume</span><span className="text-slate-400 text-sm">{settings.musicVolume}%</span></div>
                                         <input type="range" min="0" max="100" value={settings.musicVolume} onChange={(e) => setSettings(s => ({...s, musicVolume: Number(e.target.value)}))} className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                                      </div>
                                      <div className="space-y-1">
                                         {[{key: 'menuMusic', label: 'Menu Music'}, {key: 'gameplayMusic', label: 'Gameplay Music'}, {key: 'shopMusic', label: 'Shop Music'}, {key: 'wanderMusic', label: 'Wander Music'}].map(item => (
                                            <div key={item.key} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                                               <span className="text-xs">{item.label}</span>
                                               <button onClick={() => setSettings(s => ({...s, [item.key]: !s[item.key as keyof typeof s]}))} className={`w-10 h-5 ${settings[item.key as keyof typeof settings] ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[item.key as keyof typeof settings] ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                            </div>
                                         ))}
                                      </div>
                                   </>
                                )}
                             </div>
                          </div>
                       )}
                    </div>

                    {/* Display - Collapsible (with Accessibility settings moved here) */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'display' ? null : 'display')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Display</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'display' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'display' && (
                          <div className="space-y-2 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Theme</div><div className="text-xs text-slate-400">Color scheme preference</div></div>
                                <select value={settings.theme} onChange={(e) => setSettings(s => ({...s, theme: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm">
                                   <option value="dark">Dark</option>
                                   <option value="light">Light</option>
                                   <option value="system">System</option>
                                   <option value="oled">OLED Black</option>
                                </select>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Card Animations</div><div className="text-xs text-slate-400">Enable smooth card animations</div></div>
                                <button onClick={() => setSettings(s => ({...s, cardAnimations: !s.cardAnimations}))} className={`w-12 h-6 ${settings.cardAnimations ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.cardAnimations ? 'right-0.5' : 'left-0.5'}`}></div></button>
                             </div>
                             <div className="p-3 bg-slate-700/50 rounded-lg">
                                <div className="mb-2"><div className="font-medium text-sm">Card Backs</div><div className="text-xs text-slate-400">Choose your card back design</div></div>
                                <div className="grid grid-cols-4 gap-2">
                                   {[
                                      { id: 'card-back', name: 'Classic' },
                                      { id: 'blueprint', name: 'Blueprint' },
                                      { id: 'clockwork', name: 'Clockwork' },
                                      { id: 'cracked', name: 'Cracked' },
                                      { id: 'frodtbound', name: 'Frostbound' },
                                      { id: 'grim', name: 'Grim' },
                                      { id: 'heratic', name: 'Heretic' },
                                      { id: 'midas', name: 'Midas' },
                                      { id: 'molten', name: 'Molten' },
                                      { id: 'sacred', name: 'Sacred' },
                                      { id: 'sands', name: 'Sands' },
                                      { id: 'shattered', name: 'Shattered' },
                                      { id: 'shrouded', name: 'Shrouded' },
                                      { id: 'verdant', name: 'Verdant' },
                                      { id: 'withered', name: 'Withered' },
                                      { id: 'worn', name: 'Worn' },
                                   ].map(back => (
                                      <button
                                         key={back.id}
                                         onClick={() => setSettings(s => ({...s, cardBack: back.id}))}
                                         className={`relative aspect-[5/7] rounded border-2 overflow-hidden transition-all ${settings.cardBack === back.id ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-slate-600 hover:border-slate-500'}`}
                                      >
                                         <img src={`/${back.id}.png`} alt={back.name} className="w-full h-full object-cover" />
                                         {settings.cardBack === back.id && (
                                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                               <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                                            </div>
                                         )}
                                      </button>
                                   ))}
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Language</div><div className="text-xs text-slate-400">Display language</div></div>
                                <select value={settings.language} onChange={(e) => setSettings(s => ({...s, language: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm">
                                   <option value="en">English</option>
                                   <option value="es">Español</option>
                                   <option value="fr">Français</option>
                                   <option value="de">Deutsch</option>
                                   <option value="ja">日本語</option>
                                   <option value="pirate">🏴‍☠️ Pirate</option>
                                </select>
                             </div>
                             <div className="border-t border-slate-600 pt-2 mt-2">
                                <div className="text-xs text-slate-400 uppercase mb-2">Accessibility</div>
                                <div className="space-y-2">
                                   <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                      <div><div className="font-medium text-sm">Reduce Motion</div><div className="text-xs text-slate-400">Minimize animations throughout the app</div></div>
                                      <button onClick={() => setSettings(s => ({...s, reduceMotion: !s.reduceMotion}))} className={`w-12 h-6 ${settings.reduceMotion ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.reduceMotion ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                   </div>
                                   <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                      <div><div className="font-medium text-sm">High Contrast</div><div className="text-xs text-slate-400">Increase contrast for better visibility</div></div>
                                      <button onClick={() => setSettings(s => ({...s, highContrast: !s.highContrast}))} className={`w-12 h-6 ${settings.highContrast ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.highContrast ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                   </div>
                                   <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                      <div><div className="font-medium text-sm">Color Blind Mode</div><div className="text-xs text-slate-400">Adjust colors for color vision deficiency</div></div>
                                      <select value={settings.colorBlindMode} onChange={(e) => setSettings(s => ({...s, colorBlindMode: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm">
                                         <option value="off">Off</option>
                                         <option value="deuteranopia">Deuteranopia (Green-weak)</option>
                                         <option value="protanopia">Protanopia (Red-weak)</option>
                                         <option value="tritanopia">Tritanopia (Blue-weak)</option>
                                         <option value="achromatopsia">Achromatopsia (Monochrome)</option>
                                      </select>
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* Advanced - Collapsible (joke settings) */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'advanced' ? null : 'advanced')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Advanced</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'advanced' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'advanced' && (
                          <div className="space-y-3 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             <div className="p-3 bg-slate-700/50 rounded-lg">
                                <div className="flex justify-between mb-2"><span className="text-sm">Sarcasm Level</span><span className="text-slate-400 text-sm">{settings.sarcasmLevel}%</span></div>
                                <input type="range" min="0" max="100" value={settings.sarcasmLevel} onChange={(e) => setSettings(s => ({...s, sarcasmLevel: Number(e.target.value)}))} className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                                <div className="text-xs text-slate-500 mt-1 italic">
                                   {settings.sarcasmLevel < 25 ? "Wow, so sincere." : 
                                    settings.sarcasmLevel < 50 ? "Okay, moderately sarcastic." :
                                    settings.sarcasmLevel < 75 ? "Now we're talking." :
                                    "Oh, you're one of THOSE people."}
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <div><div className="font-medium text-sm">Hogwarts House</div><div className="text-xs text-slate-400">Very important for gameplay</div></div>
                                <select value={settings.hogwartsHouse} onChange={(e) => setSettings(s => ({...s, hogwartsHouse: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm">
                                   <option value="undecided">Undecided</option>
                                   <option value="gryffindor">🦁 Gryffindor</option>
                                   <option value="slytherin">🐍 Slytherin</option>
                                   <option value="ravenclaw">🦅 Ravenclaw</option>
                                   <option value="hufflepuff">🦡 Hufflepuff</option>
                                </select>
                             </div>
                             <div className="p-3 bg-slate-700/50 rounded-lg">
                                <div className="font-medium text-sm mb-1">Cheat Code</div>
                                <div className="text-xs text-slate-400 mb-2">Enter secret codes for... something?</div>
                                <div className="flex gap-2">
                                   <input 
                                      type="text" 
                                      value={settings.cheatCode} 
                                      onChange={(e) => setSettings(s => ({...s, cheatCode: e.target.value}))} 
                                      placeholder="Enter cheat code..."
                                      className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm"
                                   />
                                   <button 
                                      onClick={() => {
                                         const code = settings.cheatCode.toLowerCase().trim();
                                         const responses: Record<string, string> = {
                                            'iddqd': "This isn't DOOM, but nice try.",
                                            'hesoyam': "GTA doesn't work here either.",
                                            'konami': "↑↑↓↓←→←→BA... nothing happened.",
                                            'motherlode': "The Sims called, they want their cheat back.",
                                            'rosebud': "Seriously? That's ancient.",
                                            'money': "Wouldn't that be nice.",
                                            'god': "You wish.",
                                            'win': "That's not how this works.",
                                            'help': "No.",
                                            'please': "Manners won't help you here.",
                                            '': "You have to actually type something.",
                                         };
                                         setCheatResponse(responses[code] || "Nice try, but that's not a real cheat code.");
                                         setSettings(s => ({...s, cheatCode: ''}));
                                      }}
                                      className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-sm font-bold"
                                   >
                                      Try
                                   </button>
                                </div>
                                {cheatResponse && <div className="text-xs text-purple-400 mt-2 italic">{cheatResponse}</div>}
                             </div>
                          </div>
                       )}
                    </div>

                    {/* Data - Collapsible */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'data' ? null : 'data')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Data</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'data' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'data' && (
                          <div className="space-y-2 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             <button className="w-full p-3 bg-slate-700/50 rounded-lg text-left hover:bg-slate-700 flex justify-between items-center">
                                <span className="text-sm">Export Save Data</span>
                                <span className="text-slate-500">→</span>
                             </button>
                             <button className="w-full p-3 bg-slate-700/50 rounded-lg text-left hover:bg-slate-700 flex justify-between items-center">
                                <span className="text-sm">Import Save Data</span>
                                <span className="text-slate-500">→</span>
                             </button>
                             <button 
                                onClick={() => {
                                   const newCount = callParentsCount + 1;
                                   setCallParentsCount(newCount);
                                   if (newCount >= 3) {
                                      setShowParentsPopup(true);
                                      setCallParentsCount(0);
                                   }
                                }}
                                className="w-full p-3 bg-slate-700/50 rounded-lg text-left hover:bg-slate-700 flex justify-between items-center">
                                <span className="text-sm">Call Your Parents</span>
                                <span className="text-slate-500">📞</span>
                             </button>
                             <div className="border-t border-slate-600 pt-2 mt-2">
                                <div className="text-xs text-slate-400 uppercase mb-2">Danger Zone</div>
                                <div className="space-y-2">
                                   <button className="w-full p-3 bg-orange-900/30 border border-orange-800 rounded-lg text-left hover:bg-orange-900/50 text-orange-300 text-sm">
                                      Reset Statistics Only
                                   </button>
                                   <button className="w-full p-3 bg-red-900/30 border border-red-800 rounded-lg text-left hover:bg-red-900/50 text-red-300 text-sm">
                                      Reset All Progress
                                   </button>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* About - Collapsible */}
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                       <button 
                          onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'about' ? null : 'about')}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                          <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">About</h3>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'about' ? 'rotate-180' : ''}`} />
                       </button>
                       {expandedSettingsSection === 'about' && (
                          <div className="space-y-3 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                             <div className="text-center py-4">
                                <div className="text-3xl mb-2">🃏</div>
                                <div className="font-bold text-lg">Suite Coronata</div>
                                <div className="text-xs text-slate-400">v0.5.0</div>
                             </div>
                             <div className="text-xs text-slate-400 text-center">
                                A roguelike solitaire adventure with exploits, curses, and blessings.
                             </div>
                             <button 
                                onClick={() => setShowCredits(true)}
                                className="w-full p-3 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-sm">
                                View Credits
                             </button>
                             <div className="flex gap-2">
                                <button className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">
                                   🐦 Twitter
                                </button>
                                <button className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">
                                   💬 Discord
                                </button>
                                <button className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">
                                   🌐 Website
                                </button>
                             </div>
                             <div className="text-[10px] text-slate-500 text-center pt-2">
                                Made with ☕ and questionable life choices
                             </div>
                          </div>
                       )}
                    </div>
                 </div>

                 {/* Parents Popup */}
                 {showParentsPopup && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowParentsPopup(false)}>
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 text-center max-w-xs" onClick={e => e.stopPropagation()}>
                          <div className="text-4xl mb-4">💔</div>
                          <div className="text-lg font-bold mb-2">They miss you.</div>
                          <div className="text-sm text-slate-400 mb-4">Maybe give them an actual call sometime?</div>
                          <button onClick={() => setShowParentsPopup(false)} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded font-bold text-sm">Okay...</button>
                       </div>
                    </div>
                 )}

                 {/* Credits Popup */}
                 {showCredits && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowCredits(false)}>
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 max-w-sm max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                          <div className="text-center mb-6">
                             <div className="text-4xl mb-2">🃏</div>
                             <div className="font-bold text-xl">Suite Coronata</div>
                             <div className="text-xs text-slate-400">Credits</div>
                          </div>
                          <div className="space-y-4 text-sm">
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Design & Development</div>
                                <div className="text-slate-300">You (and your AI assistant)</div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Art Direction</div>
                                <div className="text-slate-300">The void, staring back</div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Music & Sound</div>
                                <div className="text-slate-300">Coming soon™</div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Special Thanks</div>
                                <div className="text-slate-300">Coffee, late nights, and everyone who believed in card games with too many features</div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Beta Testers</div>
                                <div className="text-slate-300">You, right now, reading this</div>
                             </div>
                             <div className="border-t border-slate-700 pt-4 text-center">
                                <div className="text-slate-500 text-xs">Made with React, TypeScript, Tailwind, and an unhealthy amount of determination</div>
                             </div>
                          </div>
                          <button onClick={() => setShowCredits(false)} className="w-full mt-6 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded font-bold text-sm">Close</button>
                       </div>
                    </div>
                 )}
              </div>
           )}

           {/* UPDATES PANEL */}
           {showUpdates && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Updates</h2>
                    <button onClick={() => setShowUpdates(false)}><X /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4">
                    {updates.map((update, i) => (
                       <div key={i} className={`p-4 rounded-xl border ${i === 0 ? 'bg-purple-900/20 border-purple-700' : 'bg-slate-800 border-slate-700'}`}>
                          <div className="flex justify-between items-center mb-2">
                             <span className="font-bold text-lg">{update.version}</span>
                             <span className="text-xs text-slate-400">{update.date}</span>
                          </div>
                          {i === 0 && <div className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded inline-block mb-2">Latest</div>}
                          <ul className="space-y-1">
                             {update.changes.map((change, j) => (
                                <li key={j} className="text-sm text-slate-300 flex items-start gap-2">
                                   <span className="text-emerald-400 mt-1">•</span>
                                   {change}
                                </li>
                             ))}
                          </ul>
                       </div>
                    ))}
                 </div>
              </div>
           )}

           {/* HOW TO PLAY PANEL */}
           {showHowTo && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">How To Play</h2>
                    <button onClick={() => { setShowHowTo(false); setHowToPage(0); }}><X /></button>
                 </div>
                 <div className="flex-1 flex flex-col">
                    {/* Page indicator */}
                    <div className="flex justify-center gap-1.5 mb-6">
                       {howToPages.map((_, i) => (
                          <button 
                             key={i} 
                             onClick={() => setHowToPage(i)}
                             className={`w-2 h-2 rounded-full transition-all ${i === howToPage ? 'bg-purple-500 w-6' : 'bg-slate-600'}`}
                          />
                       ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center">
                       <div className="text-center max-w-sm">
                          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center">
                             <span className="text-2xl font-bold text-slate-400">{howToPage + 1}</span>
                          </div>
                          <h3 className="text-2xl font-bold mb-4">{howToPages[howToPage].title}</h3>
                          <p className="text-slate-300 leading-relaxed">{howToPages[howToPage].content}</p>
                       </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3 pt-4 border-t border-slate-700">
                       <button 
                          onClick={() => setHowToPage(p => Math.max(0, p - 1))}
                          disabled={howToPage === 0}
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-bold">
                          Previous
                       </button>
                       {howToPage < howToPages.length - 1 ? (
                          <button 
                             onClick={() => setHowToPage(p => p + 1)}
                             className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold">
                             Next
                          </button>
                       ) : (
                          <button 
                             onClick={() => { setShowHowTo(false); setHowToPage(0); }}
                             className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold">
                             Got It!
                          </button>
                       )}
                    </div>
                 </div>
              </div>
           )}

           {/* GLOSSARY PANEL (existing) */}
           {showGlossary && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Glossary</h2>
                    <button onClick={() => setShowGlossary(false)}><X /></button>
                 </div>
                 <div className="flex gap-1 overflow-x-auto pb-2 mb-2">
                    {(['dangers', 'fears', 'blessings', 'exploits', 'curses'] as const).map(cat => (
                       <button 
                          key={cat} 
                          onClick={() => setGlossaryTab(cat)} 
                          className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                             glossaryTab === cat 
                                ? 'bg-slate-700 text-white' 
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                          }`}>
                          <img src={categoryIcons[cat]} alt="" className="w-6 h-6" />
                          <span className="capitalize">{cat}</span>
                       </button>
                    ))}
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2">
                    {effectsRegistry.length === 0 ? (
                       <div className="text-center text-slate-500 py-8">No effects loaded</div>
                    ) : effectsRegistry.filter(e => {
                       if (glossaryTab === 'dangers') return e.type === 'danger';
                       if (glossaryTab === 'fears') return e.type === 'fear';
                       if (glossaryTab === 'blessings') return e.type === 'blessing';
                       if (glossaryTab === 'exploits') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
                       if (glossaryTab === 'curses') return e.type === 'curse';
                       return false;
                    }).map(e => {
                       const rarityColors = getRarityColor(e.rarity);
                       const effectType = e.type === 'danger' ? 'danger' : e.type === 'fear' ? 'fear' : e.type === 'blessing' ? 'blessing' : e.type === 'curse' ? 'curse' : 'exploit';
                       return (
                       <div key={e.id} className={`p-3 rounded border ${rarityColors.bg} ${rarityColors.border} flex gap-3`}>
                          <ResponsiveIcon name={e.id || e.name} fallbackType={effectType} size={40} className="w-10 h-10 rounded shrink-0" alt={e.name} />
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start gap-2">
                               <div className="font-bold text-white truncate">{e.name}</div>
                               <div className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} ${rarityColors.bg} border ${rarityColors.border}`}>{e.rarity || 'Common'}</div>
                             </div>
                             <div className="text-slate-300 text-sm mt-1">{e.description}</div>
                             {Boolean(e.cost) && <div className="text-xs text-yellow-500 mt-1 flex items-center gap-1"><Coins size={10}/> {e.cost}</div>}
                          </div>
                       </div>
                    );})}
                 </div>
              </div>
           )}
        </div>
     );
  }

  if (gameState.wanderState !== 'none') {
     return (
        <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-slate-950"></div>
           {gameState.wanderState === 'selection' && (
              <div className="z-10 w-full max-w-md flex flex-col gap-6 animate-in zoom-in-95 duration-300">
                 <h2 className="text-2xl font-bold text-center text-purple-200">Choose Your Path</h2>
                 <div className="grid grid-cols-1 gap-4">
                    {gameState.wanderOptions.map(opt => (
                       <button key={opt.id} type="button" onClick={() => chooseWanderOption(opt)} aria-label={`Wander option: ${opt.label}`} className="bg-slate-800/80 border border-slate-600 hover:border-purple-400 p-6 rounded-xl transition-all hover:scale-[1.02] shadow-xl text-left">
                          <div className="flex items-center gap-3 mb-2"><MapIcon className="text-purple-400" /><h3 className="text-xl font-bold">{opt.label}</h3></div>
                          <p className="text-slate-400 text-sm">{opt.description}</p>
                       </button>
                    ))}
                 </div>
              </div>
           )}
           {gameState.wanderState === 'active' && gameState.activeWander && (
              <div className="z-10 w-full max-w-md flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                 <div className="bg-slate-800 border border-slate-600 p-6 rounded-xl shadow-2xl">
                    <h2 className="text-2xl font-bold text-purple-200 mb-2">{gameState.activeWander.label}</h2>
                    <p className="text-slate-300 mb-6 leading-relaxed">{gameState.activeWander.description}</p>
                    <div className="flex flex-col gap-3">
                       {gameState.activeWander.choices.map((choice, idx) => (
                          <button key={idx} onClick={() => resolveWander(choice)} className="w-full p-4 text-left bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-500 transition-colors group">
                             <div className="font-bold text-white group-hover:text-purple-300">{choice.label}</div>
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           )}
           {gameState.wanderState === 'result' && (
              <div className="z-10 w-full max-w-md text-center animate-in zoom-in-95">
                 <div className="bg-slate-800 border border-slate-600 p-8 rounded-xl shadow-2xl">
                    <div className="text-4xl mb-4">✨</div>
                    <p className="text-lg text-slate-200 mb-8">{gameState.wanderResultText}</p>
                    <button onClick={finishWander} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg">Continue Journey</button>
                 </div>
              </div>
           )}
        </div>
     );
  }

  // Theme class mapping
  const themeClasses = {
     dark: 'bg-slate-900 text-slate-100',
     light: 'bg-slate-100 text-slate-900',
     oled: 'bg-black text-slate-100',
     system: 'bg-slate-900 text-slate-100', // TODO: detect system preference
  };

  return (
    <div className={`h-screen w-full font-sans flex flex-col overflow-hidden relative ${themeClasses[settings.theme as keyof typeof themeClasses] || themeClasses.dark} ${settings.reduceMotion ? '[&_*]:!transition-none [&_*]:!animate-none' : ''}`}>
      <div className="flex-1 w-full max-w-2xl mx-auto p-2 pb-40 overflow-hidden">
        <div className="grid grid-cols-7 gap-1 mb-4">
                <div className="relative w-11 h-16">
                   <button type="button" className="w-full h-full bg-blue-900 border border-slate-600 rounded flex items-center justify-center" onClick={() => discardAndDrawHand()} aria-label="Draw from deck">
                        <div className="absolute -top-2 -left-1 bg-slate-700 text-[8px] px-1 rounded-full border border-slate-500 z-10">Draw</div>
                        {gameState.piles.deck.cards.length > 0 ? <div className="font-bold text-blue-300 text-xs">{gameState.piles.deck.cards.length}</div> : <RefreshCw className="text-slate-600 w-4 h-4" />}
                   </button>
                </div>
                
                {/* Shadow Realm Pile */}
                {gameState.piles['shadow-realm'] && (
                   <div 
                      className="relative w-11 h-16 bg-purple-900/30 border border-purple-500/50 rounded flex items-center justify-center cursor-pointer hover:bg-purple-900/50 transition-colors"
                      onClick={handleShadowRealmClick}
                      title="Shadow Realm: Click to summon back (10 coins)">
                      <div className="absolute -top-2 -left-1 bg-purple-900 text-[8px] px-1 rounded-full border border-purple-500 z-10">Realm</div>
                      {gameState.piles['shadow-realm'].cards.length === 0 ? (
                         <div className="text-purple-700 opacity-50"><Skull size={16} /></div>
                      ) : (
                         renderCard(gameState.piles['shadow-realm'].cards[gameState.piles['shadow-realm'].cards.length - 1], gameState.piles['shadow-realm'].cards.length - 1, 'shadow-realm')
                      )}
                   </div>
                )}

                <div className={`relative ${gameState.piles['shadow-realm'] ? 'col-span-1' : 'col-span-2'} h-16 flex items-center justify-center`}>
                   {/* Threat button - current danger/fear */}
                   {(currentThreat || currentEncounter) && (
                      <button type="button" aria-label={`Threat: ${currentThreat?.name || 'Level ' + ((currentEncounter?.index || 0) + 1)}`} className="w-full h-full bg-red-900/50 border-2 border-red-500/50 rounded flex flex-col items-center justify-center text-center p-1 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]" onClick={() => alert(`${currentThreat?.type?.toUpperCase() || currentEncounter?.type?.toUpperCase() || 'CHALLENGE'}: ${currentThreat?.name || 'Level ' + ((currentEncounter?.index || 0) + 1)}\n${currentThreat?.description || 'Score goal: ' + (currentEncounter?.goal || gameState.currentScoreGoal)}`)}>
                         <Skull size={20} className="text-red-400 mb-1" />
                         <div className="text-[8px] font-bold leading-tight text-red-200 line-clamp-2">{currentThreat?.name || 'Level ' + ((currentEncounter?.index || 0) + 1)}</div>
                      </button>
                   )}
                </div>
                {foundationPiles.map(pile => {
                   const suitSymbol = pile.id.includes('hearts') ? '♥' : pile.id.includes('diamonds') ? '♦' : pile.id.includes('clubs') ? '♣' : '♠';
                   const suitColor = pile.id.includes('hearts') || pile.id.includes('diamonds') ? 'text-red-600' : 'text-white';
                   const isHighlighted = highlightedMoves.foundationIds.includes(pile.id);
                   return (
                   <div key={pile.id} className={`relative w-11 h-16 bg-slate-800/50 rounded border border-slate-700 flex items-center justify-center ${isHighlighted ? 'ring-2 ring-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]' : ''}`}>
                      {pile.cards.length === 0 ? (
                         <button type="button" aria-label={`Empty foundation ${pile.id}`} className={`text-xl opacity-20 ${suitColor} bg-transparent border-0 ${isHighlighted ? 'ring-2 ring-amber-300 rounded' : ''}`} onClick={() => handleCardClick(pile.id, -1)}>{suitSymbol}</button>
                      ) : null}
                      {pile.cards.map((c, i) => renderCard(c, i, pile.id))}
                   </div>
                   );
                })}
        </div>

        {/* Active Effect HUDs */}
        {(activeEffects.includes('ritual_components') || activeEffects.includes('momentum_tokens')) && (
           <div className="flex justify-center gap-4 mb-2 animate-in fade-in slide-in-from-top-2">
              {activeEffects.includes('ritual_components') && (
                 <div className="flex items-center gap-1 bg-slate-800/80 p-1.5 rounded border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Ritual</span>
                    {['blood', 'bone', 'ash'].map((step, i) => {
                       const seq = gameState.effectState?.ritualSequence || [];
                       const done = seq.length > i; 
                       return <div key={step} className={`w-3 h-3 rounded-full border border-slate-600 ${done ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]' : 'bg-slate-900'}`} title={step} />;
                    })}
                 </div>
              )}
              {activeEffects.includes('momentum_tokens') && (
                 <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded border border-slate-700">
                    <div className="flex items-center gap-1">
                       <span className="text-[10px] text-slate-400 uppercase font-bold">Momentum</span>
                       <span className="text-sm font-bold text-blue-400">{gameState.effectState?.momentum || 0}</span>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={() => spendMomentum('wild')} disabled={(gameState.effectState?.momentum || 0) < 3} className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[9px] font-bold">Wild (3)</button>
                       <button onClick={() => spendMomentum('unlock')} disabled={(gameState.effectState?.momentum || 0) < 5} className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[9px] font-bold">Unlock (5)</button>
                       <button onClick={() => spendMomentum('pts')} disabled={(gameState.effectState?.momentum || 0) < 1} className="px-1.5 py-0.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[9px] font-bold">Pts (1)</button>
                    </div>
                 </div>
              )}
           </div>
        )}

        <div className="grid grid-cols-7 gap-1 h-full">
               {tableauPiles.map(pile => {
                  const isLinked = activeEffects.includes('linked_fates') && gameState.effectState?.linkedTableaus?.includes(pile.id);
                  const isLinkedTurn = isLinked && gameState.effectState?.lastLinkedPlayed !== pile.id;
                  const isParasite = activeEffects.includes('parasite_pile') && gameState.effectState?.parasiteTarget === pile.id;
                  const isHighlighted = highlightedMoves.tableauIds.includes(pile.id);

                  return (
                  <div key={pile.id} className={`relative w-full h-full ${isLinked ? 'border-t-2 border-purple-500/50 rounded-t-lg pt-1' : ''} ${isParasite ? 'border-t-2 border-green-500/50 rounded-t-lg pt-1' : ''}`}>
                      {/* Linked Fates Indicator */}
                      {isLinked && (
                         <div className={`absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center ${isLinkedTurn ? 'text-purple-400 animate-pulse' : 'text-slate-600 opacity-50'}`}>
                            <LinkIcon size={14} />
                            {!isLinkedTurn && <span className="text-[8px] uppercase font-bold bg-slate-900 px-1 rounded border border-slate-700">Wait</span>}
                         </div>
                      )}
                      
                      {/* Parasite Indicator */}
                      {isParasite && (
                         <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-green-500">
                            <Bug size={14} />
                            <div className="w-8 h-1 bg-slate-700 mt-0.5 rounded-full overflow-hidden border border-slate-600">
                               <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${((gameState.moves % 7) / 7) * 100}%` }} />
                            </div>
                         </div>
                      )}

                      {pile.locked && <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-red-500"><Lock size={10} /></div>}
                      {pile.cards.length === 0 && (
                         <button type="button" aria-label={`Empty ${pile.id}`} className={`absolute inset-0 w-full h-full bg-transparent ${isHighlighted ? 'ring-2 ring-amber-300 rounded-md' : ''}`} onClick={() => handleCardClick(pile.id, -1)} />
                      )}
                      {pile.cards.map((c, idx) => renderCard(c, idx, pile.id))}
                  </div>
               )})}
        </div>
      </div>

      {gameState.activeMinigame && (
         <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 animate-in zoom-in-95">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4 uppercase tracking-widest">{gameState.activeMinigame.title}</h2>
            <div className="w-64 h-64 bg-slate-800 border-4 border-yellow-500 rounded-xl flex flex-col items-center justify-center gap-4 p-4 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
               {!gameState.minigameResult ? (
                  <>
                     <div className="text-6xl animate-bounce">🎲</div>
                     <button onClick={runMinigame} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xl shadow-lg transform transition hover:scale-105">PLAY</button>
                  </>
               ) : (
                  <>
                     <div className="text-4xl">{gameState.minigameResult.outcome.includes('Win') ? '🎉' : '💀'}</div>
                     <div className="text-center">
                        <div className="text-lg font-bold text-white">{gameState.minigameResult.text}</div>
                        <div className={`text-2xl font-black mt-2 ${gameState.minigameResult.reward > 0 ? 'text-green-400' : 'text-red-400'}`}>
                           {gameState.minigameResult.reward > 0 ? '+' : ''}{gameState.minigameResult.reward}
                        </div>
                     </div>
                     <button onClick={claimMinigameReward} className="px-8 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-full mt-2">Continue</button>
                  </>
               )}
            </div>
         </div>
      )}

      <div className="fixed bottom-0 left-0 w-full z-50 flex flex-col justify-end pointer-events-none">
         {/* Hand cards - positioned relative to bottom panel */}
         <div className="w-full flex justify-center pointer-events-none">
             <div className="relative w-full max-w-md h-0"> 
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-0 pointer-events-auto">
                    {gameState.piles.hand.cards.map((c, i) => renderCard(c, i, 'hand', gameState.piles.hand.cards.length))}
                 </div>
             </div>
         </div>
         
         {/* Bottom control bar - always at bottom, with drawer expanding up from its top */}
         <div className={`bg-slate-900 border-t border-slate-800 p-2 w-full max-w-md mx-auto relative pointer-events-auto overflow-visible`}>
            {/* Drawer Content - positioned absolutely above the bottom bar, grows up until screen top then scrolls */}
            {activeDrawer && (
               <div className="absolute bottom-full left-0 w-full max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-800 border-t border-slate-700 animate-in slide-in-from-bottom-10 z-50">
                  <div className="p-4">
                     {activeDrawer === 'shop' && (
                        <div className="w-full mb-2">
                           <div className="grid grid-cols-3 gap-2">
                              <button onClick={() => setShopTab('buy')} className={`py-2 rounded font-bold ${shopTab === 'buy' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Buy</button>
                              <button onClick={() => setShopTab('sell')} className={`py-2 rounded font-bold ${shopTab === 'sell' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Sell</button>
                              <button onClick={() => { setShopTab('continue'); startWanderPhase(); }} className={`py-2 rounded font-bold ${shopTab === 'continue' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Continue</button>
                           </div>
                        </div>
                     )}
                     <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">
                           {activeDrawer === 'pause' ? 'Menu' 
                            : activeDrawer === 'shop' ? 'The Trade' 
                            : activeDrawer === 'feedback' ? 'Feedback' 
                            : activeDrawer === 'test' ? 'Test UI' 
                            : activeDrawer === 'settings' ? 'Settings' 
                            : activeDrawer === 'blessing_select' ? 'Select a Blessing' 
                            : `${activeDrawer} Registry`}
                        </h3>
                        {nonClosableDrawer === activeDrawer ? (
                           <div style={{ width: 28 }} />
                        ) : (
                           <button onClick={() => { setActiveDrawer(null); setNonClosableDrawer(null); }}><ChevronDown className="text-slate-500" /></button>
                        )}
                     </div>
                     <div className="max-w-md mx-auto mt-2">
                        {activeDrawer === 'pause' ? (
                           <div className="grid grid-cols-4 gap-2">
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><SkipBack size={16} /><span className="text-[8px]">Prev</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><Play size={16} /><span className="text-[8px]">Play/Pause</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><SkipForward size={16} /><span className="text-[8px]">Next</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('feedback')}><MessageSquare size={16} /><span className="text-[8px]">Feedback</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('test')}><FlaskConical size={16} /><span className="text-[8px]">Test UI</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><Save size={16} /><span className="text-[8px]">Save</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => {
                                 if (settings.confirmResign) {
                                    setActiveDrawer('resign');
                                 } else {
                                    setCurrentView('home');
                                    setActiveDrawer(null);
                                 }
                              }}><Flag size={16} /><span className="text-[8px]">Resign</span></button>
                              <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('settings')}><Settings size={16} /><span className="text-[8px]">Settings</span></button>
                           </div>
                        ) : activeDrawer === 'shop' ? (
                           <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-1 gap-2">
                                {shopTab === 'buy' && shopInventory.map(item => {
                                    const rarityColors = getRarityColor(item.rarity);
                                    const itemType = item.type === 'curse' ? 'curse' : item.type === 'blessing' ? 'blessing' : 'exploit';
                                    return (
                                    <div key={item.id} className={`p-2 rounded border ${rarityColors.border} ${rarityColors.bg} flex items-center gap-3`}>
                                       <ResponsiveIcon name={item.id || item.name} fallbackType={itemType} size={32} className="w-8 h-8 rounded shrink-0" alt={item.name} />
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                             <span className="font-bold text-white text-xs truncate">{item.name}</span>
                                             <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{item.rarity || 'Common'}</span>
                                          </div>
                                          <div className="text-slate-400 text-[10px]">{item.description}</div>
                                       </div>
                                       <button 
                                         className={`text-white px-2 py-1 rounded text-xs font-bold shrink-0 ${gameState.coins >= (item.cost || 50) ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                         onClick={() => buyEffect(item)}
                                         disabled={gameState.coins < (item.cost || 50)}>
                                         Buy {item.cost || 50}
                                       </button>
                                    </div>
                                 );})}

                                {shopTab === 'sell' && (() => {
                                   const ownedExploits = effectsRegistry.filter(e => (['exploit','epic','legendary','rare','uncommon'].includes(e.type)) && gameState.ownedEffects.includes(e.id));
                                   if (ownedExploits.length === 0) return <div className="text-center text-slate-500 text-xs py-4">No exploitable items to sell.</div>;
                                   return ownedExploits.map(item => {
                                      const rarityColors = getRarityColor(item.rarity);
                                      const sellPrice = Math.floor((item.cost || 50) / 2);
                                      return (
                                         <div key={item.id} className={`p-2 rounded border ${rarityColors.border} ${rarityColors.bg} flex items-center gap-3`}>
                                            <ResponsiveIcon name={item.id || item.name} fallbackType={'exploit'} size={32} className="w-8 h-8 rounded shrink-0" alt={item.name} />
                                            <div className="flex-1 min-w-0">
                                               <div className="flex items-center gap-2">
                                                  <span className="font-bold text-white text-xs truncate">{item.name}</span>
                                                  <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{item.rarity || 'Common'}</span>
                                               </div>
                                               <div className="text-slate-400 text-[10px]">{item.description}</div>
                                            </div>
                                            <button className={`text-white px-2 py-1 rounded text-xs font-bold shrink-0 bg-slate-700 hover:bg-slate-600`} onClick={() => {
                                               const price = sellPrice;
                                               setGameState(p => ({ ...p, coins: p.coins + price, ownedEffects: p.ownedEffects.filter(id => id !== item.id) }));
                                               // Deactivate effect if active
                                               if (activeEffects.includes(item.id)) toggleEffect(item.id, false);
                                            }}>Sell {sellPrice}</button>
                                         </div>
                                      );
                                   });
                                })()}
                              </div>
                           </div>
                        ) : activeDrawer === 'feedback' ? (
                           <div className="flex flex-col gap-3">
                              <div className="flex gap-2">
                                 {['bug', 'ui', 'effect', 'request'].map(t => (
                                    <button key={t} onClick={() => setFeedbackType(t)} className={`px-2 py-1 rounded text-xs uppercase font-bold ${feedbackType === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{t}</button>
                                 ))}
                              </div>
                              <textarea className="w-full h-20 bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white" placeholder="Describe issue or idea..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                              <div className="h-32 overflow-y-auto border border-slate-700 rounded bg-slate-900/50 p-2">
                                 <div className="text-[10px] text-slate-500 mb-2 uppercase">Related Effects</div>
                                 <div className="grid grid-cols-2 gap-1">
                                    {effectsRegistry.map(e => (
                                       <label key={e.id} className="flex items-center gap-2 text-xs text-slate-300">
                                          <input type="checkbox" checked={!!feedbackChecks[e.id]} onChange={() => setFeedbackChecks(p => ({...p, [e.id]: !p[e.id]}))} className="rounded bg-slate-700 border-slate-500" />
                                          {e.name}
                                       </label>
                                    ))}
                                 </div>
                              </div>
                              <button className="w-full bg-emerald-600 text-white py-2 rounded font-bold" onClick={() => { alert("Feedback Sent!"); setActiveDrawer('pause'); }}>Submit Report</button>
                           </div>
                        ) : activeDrawer === 'resign' ? (
                           <div className="flex flex-col gap-4 text-center">
                              <div className="text-slate-300 text-sm">Quit Run?</div>
                              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                                  <div className="bg-slate-700/50 p-2 rounded">Time: {Math.floor((Date.now() - gameState.startTime)/1000)}s</div>
                                  <div className="bg-slate-700/50 p-2 rounded">Seed: {gameState.seed}</div>
                              </div>
                              <div className="flex gap-3">
                                 <button className="flex-1 bg-slate-700 text-white py-3 rounded font-bold" onClick={() => setActiveDrawer('pause')}>Cancel</button>
                                 <button className="flex-1 bg-red-600 text-white py-3 rounded font-bold" onClick={() => { 
                                    // Record resignation
                                    if (runStartData) {
                                       const duration = Math.floor((Date.now() - runStartData.startTime) / 1000);
                                       const runEntry: RunHistoryEntry = {
                                          id: `run_${Date.now()}`,
                                          result: 'lost',
                                          score: gameState.score,
                                          finalCoins: gameState.coins,
                                          date: new Date().toISOString(),
                                          mode: 'Coronata',
                                          duration,
                                          encountersCompleted: runPlan.filter(e => e.completed).length,
                                          totalEncounters: runPlan.length,
                                          exploits: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && (e.type === 'exploit' || e.type === 'epic' || e.type === 'legendary'))),
                                          curses: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && e.type === 'curse')),
                                          blessings: gameState.ownedEffects.filter(id => effectsRegistry.find(e => e.id === id && e.type === 'blessing')),
                                          encounters: runStartData.encounterLog,
                                          seed: gameState.seed,
                                       };
                                       const updatedStats = recordRunCompletion(playerStats, runEntry);
                                       setPlayerStats(updatedStats);
                                       savePlayerStats(updatedStats);
                                    }
                                    setCurrentView('home'); 
                                    setActiveDrawer(null); 
                                 }}>Give Up</button>
                              </div>
                           </div>
                        ) : activeDrawer === 'settings' ? (
                           <div className="flex flex-col gap-4">
                              <label className="flex items-center justify-between text-sm text-slate-300"><span>Sound Effects</span><input type="checkbox" className="rounded bg-slate-700 border-slate-500" defaultChecked /></label>
                              <label className="flex items-center justify-between text-sm text-slate-300"><span>Music</span><input type="checkbox" className="rounded bg-slate-700 border-slate-500" defaultChecked /></label>
                              <label className="flex items-center justify-between text-sm text-slate-300"><span>Vibration</span><input type="checkbox" className="rounded bg-slate-700 border-slate-500" /></label>
                              <button className="text-xs text-slate-500 underline mt-4" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
                           </div>
                        ) : activeDrawer === 'test' ? (
                           <div className="flex flex-col gap-2">
                              <button className="bg-blue-600 text-white p-2 rounded font-bold" onClick={() => setGameState(p => ({ ...p, score: p.currentScoreGoal }))}>Complete Goal</button>
                              <button className="bg-green-600 text-white p-2 rounded font-bold" onClick={() => setGameState(p => ({ ...p, coins: p.coins + 100 }))}>+100 Coins</button>
                              <button className="bg-red-600 text-white p-2 rounded font-bold" onClick={() => setGameState(p => ({ ...p, coins: p.coins - 50 }))}>-50 Coins</button>
                              <button className="bg-purple-600 text-white p-2 rounded font-bold flex items-center justify-center gap-2" onClick={() => setGameState(p => ({...p, debugUnlockAll: !p.debugUnlockAll}))}><Unlock size={16} /> Toggle All</button>
                              <button className="text-xs text-slate-500 underline mt-4" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
                           </div>
                        ) : activeDrawer === 'blessing_select' ? (
                           <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-1 gap-2">
                                 {blessingChoices.map(item => {
                                    const rarityColors = getRarityColor(item.rarity);
                                    return (
                                    <div key={item.id} className={`p-2 rounded border ${rarityColors.border} ${rarityColors.bg} flex items-center gap-3 cursor-pointer hover:brightness-110`} onClick={() => {
                                         // Grant blessing and auto-activate it
                                         setGameState(p => ({ ...p, ownedEffects: [...p.ownedEffects, item.id] }));
                                         // Auto-activate the blessing (passives are always on, charged effects start ready)
                                         toggleEffect(item.id, true);
                                         setBlessingChoices([]);
                                         if (gameState.runIndex === 0) {
                                            // Closing initial blessing picker (allow choice to close)
                                            setActiveDrawer(null);
                                            setNonClosableDrawer(null);
                                         } else {
                                            // Open shop as part of post-encounter flow and lock it so it can't be collapsed
                                            openShop(true);
                                         }
                                         }}>
                                       <ResponsiveIcon name={item.id || item.name} fallbackType="blessing" size={32} className="w-8 h-8 rounded shrink-0" alt={item.name} />
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                             <span className="font-bold text-white text-xs truncate">{item.name}</span>
                                             <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{item.rarity || 'Common'}</span>
                                          </div>
                                          <div className="text-slate-400 text-[10px]">{item.description}</div>
                                       </div>
                                       <Gift size={16} className="text-purple-400 shrink-0" />
                                    </div>
                                 );})}
                              </div>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 gap-2">
                              {effectsRegistry.filter(e => {
                                 const isOwned = gameState.ownedEffects.includes(e.id) || gameState.debugUnlockAll;
                                 if (!isOwned) return false; 
                                 if (activeDrawer === 'exploit') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
                                 if (activeDrawer === 'curse') return ['curse', 'fear', 'danger'].includes(e.type);
                                 if (activeDrawer === 'blessing') return ['blessing'].includes(e.type);
                                 return false;
                              }).sort((a,b) => {
                                 const aReady = isEffectReady(a.id, gameState);
                                 const bReady = isEffectReady(b.id, gameState);
                                 return (aReady === bReady) ? 0 : aReady ? -1 : 1;
                              }).map(effect => {
                                 const isActive = activeEffects.includes(effect.id);
                                 const isReady = isEffectReady(effect.id, gameState);
                                 const charges = gameState.charges[effect.id] ?? effect.maxCharges;
                                 const rarityColors = getRarityColor(effect.rarity);
                                 
                                 const effectType = effect.type === 'curse' ? 'curse' : effect.type === 'fear' ? 'fear' : effect.type === 'danger' ? 'danger' : effect.type === 'blessing' ? 'blessing' : 'exploit';
                                 return (
                                    <button
                                       key={effect.id}
                                       type="button"
                                       onClick={() => {
                                          // Curses (curse/fear/danger) cannot be toggled off
                                          const isCurseType = ['curse', 'fear', 'danger'].includes(effect.type);
                                          if (isCurseType) return;
                                          toggleEffect(effect.id);
                                       }}
                                       aria-label={`Toggle effect ${effect.name}`}
                                       className={`p-2 rounded border text-xs flex items-center gap-3 transition-all ${isActive ? 'bg-purple-900/60 border-purple-500' : `${rarityColors.bg} ${rarityColors.border}`} ${isReady ? 'ring-1 ring-yellow-400' : ''} ${['curse', 'fear', 'danger'].includes(effect.type) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                       <ResponsiveIcon name={effect.id || effect.name} fallbackType={effectType} size={32} className="w-8 h-8 rounded shrink-0" alt={effect.name} />
                                       <div className="flex-1 min-w-0 text-left">
                                           <div className="font-bold text-white flex gap-1 items-center flex-wrap">
                                               <span className="truncate">{effect.name}</span>
                                               <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{effect.rarity || 'Common'}</span>
                                               {effect.maxCharges && <span className="text-[9px] bg-slate-600 px-1 rounded text-white shrink-0">{charges}/{effect.maxCharges}</span>}
                                           </div>
                                           <div className="text-slate-400 text-[10px]">{effect.description}</div>
                                       </div>
                                       {isActive && <div className="w-2 h-2 bg-green-400 rounded-full shrink-0"></div>}
                                    </button>
                                 );
                              })}
                              {gameState.ownedEffects.length === 0 && !gameState.debugUnlockAll && <div className="text-center text-slate-500 text-xs py-4">No effects owned yet. Visit the Trade!</div>}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}
            {gameState.interactionMode === 'discard_select' && (
               <div className="bg-orange-900/80 text-orange-200 text-xs text-center p-1 mb-1 rounded animate-pulse">Select a card in HAND to discard</div>
            )}
            <div className="flex justify-between px-2 mb-2 relative group">
               {runPlan.map((enc, i) => {
                  const eff = effectsRegistry.find(e => e.id === enc.effectId);
                  const cls = `w-2 h-2 rounded-full ${i < gameState.runIndex ? 'bg-green-500' : i === gameState.runIndex ? 'bg-white animate-pulse' : enc.type === 'danger' ? 'bg-red-900' : 'bg-slate-700'}`;
                  return (
                     <button
                        key={i}
                        type="button"
                        className={cls}
                        onClick={() => alert(`${enc.type.toUpperCase()}: ${eff?.name || 'Level ' + (i+1)}\n${eff?.description || 'Score goal: ' + enc.goal}`)}
                        aria-label={`Encounter ${i + 1} ${enc.type} ${eff?.name ?? ''}`}
                     />
                  );
               })}
            </div>
            <div className="flex items-center gap-2 mb-2">
               <div className="flex-1">
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
                     <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, (gameState.score / gameState.currentScoreGoal) * 100)}%` }} />
                  </div>
               </div>
               <div className="flex items-center gap-1 shrink-0 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                  <Coins size={12} className="text-yellow-400" />
                  <span className={`text-xs font-bold font-mono ${gameState.coins < 0 ? 'text-red-400' : 'text-yellow-400'}`}>{gameState.coins}</span>
               </div>
            </div>
            <div className="flex w-full gap-1">
               <button onClick={() => toggleDrawer('pause')} className={`p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 border border-slate-700 ${activeDrawer === 'pause' ? 'bg-slate-700' : ''}`}><Pause size={16} /></button>
               {(['exploit', 'curse', 'blessing'] as const).map((type) => {
                  const hasReady = effectsRegistry.some(e => e.type === type && isEffectReady(e.id, gameState) && (gameState.ownedEffects.includes(e.id) || gameState.debugUnlockAll));
                  return (
                               <button key={type} onClick={() => toggleDrawer(type as any)} 
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold border flex flex-col items-center justify-center gap-0.5 
                        ${activeDrawer === type ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 border-slate-700'}
                        ${hasReady ? 'ring-1 ring-yellow-400 text-yellow-100 bg-yellow-900/20' : ''}`}>
                        <img src={categoryIcons[type]} alt="" className="w-4 h-4" />
                        <span>{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                     </button>
                  );
               })}
            </div>
         </div>

      </div>

      {showLevelComplete && (
         <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
            <div className="bg-slate-800 border border-slate-600 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center">
               <Trophy size={48} className="text-yellow-400 mx-auto mb-4" />
               <h2 className="text-2xl font-bold text-white mb-2">Encounter Cleared!</h2>
               <p className="text-slate-400 mb-6">Goal reached: {gameState.score}</p>
               <button onClick={completeLevel} className="w-full py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold flex items-center justify-center gap-2">Move On <ShoppingCart size={16} /></button>
            </div>
         </div>
      )}
    </div>
  );
}