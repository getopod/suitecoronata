import { PATTERN_DEFINITIONS } from './engine/definitions/patterns';
import React, { useState, useCallback, useEffect } from 'react';
import { LayoutGrid, Skull, Lock, Key, Smile, Coins, Play, Gamepad2, BookOpen, HelpCircle, RefreshCw, X, Gift, Trophy, ArrowLeftRight, SkipBack, SkipForward, MessageSquare, FlaskConical, Save, Flag, Settings, ChevronDown, Pause, ShoppingCart, User, Unlock, Map as MapIcon, BarChart3, Link as LinkIcon, Bug, Clock, Menu, Target, PlusCircle, Wand2, Ghost } from 'lucide-react';
import { Card, GameState, Pile, Rank, Suit, MoveContext, Encounter, GameEffect, Wander, WanderChoice, WanderState, MinigameResult, PlayerStats, RunHistoryEntry, RunEncounterRecord } from './types';
import { getCardColor, generateNewBoard, EFFECTS_REGISTRY, setEffectsRng, resetEffectsRng } from './data/effects';
import { isHighestRank, isNextHigherInOrder, isNextLowerInOrder } from './utils/rankOrder';
import { Minigames } from './utils/minigames';
import { loadPlayerStats, savePlayerStats, recordRunCompletion, getWinRate, formatDuration, getRelativeTime } from './utils/playerStats';
import ResponsiveIcon from './components/ResponsiveIcon';
import { WANDER_REGISTRY } from './data/wanders';
import { useEffectDebugger } from './hooks/useEffectDebugger';
import { detectConflicts } from './utils/effectDebug';
import { CLASSIC_GAMES } from './src/classic/games';
import { convertCoronataPilesToClassic, convertClassicPilesToCoronata } from './src/classic/types';

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

// Format time for classic mode timer
const formatTime = (seconds: number): string => {
   const mins = Math.floor(seconds / 60);
   const secs = seconds % 60;
   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const generateRunPlan = (effectsRegistry: GameEffect[], rng?: () => number): Encounter[] => {
   const encounters: Encounter[] = [];
   const curses = effectsRegistry.filter(e => e.type === 'curse');

   // If no effects, generate simple encounters with no effect
   if (curses.length === 0) {
      for (let i = 0; i < 10; i++) {
         const goal = Math.floor(150 + (i / 9) * (4200 - 150));
         encounters.push({
            index: i,
            type: 'curse',
            effectId: '', // No effect
            goal: goal,
            completed: false
         });
      }
      return encounters;
   }

   const shuffledCurses = shuffleArray([...curses], rng);

   for (let i = 0; i < 10; i++) {
      const goal = Math.floor(150 + (i / 9) * (4200 - 150));
      const effect = shuffledCurses[i % shuffledCurses.length];

      encounters.push({
         index: i,
         type: 'curse',
         effectId: effect?.id || '',
         goal: goal,
         completed: false
      });
   }
   return encounters;
};

const initialGameState = (mode: string = 'coronata'): GameState => {
  return generateNewBoard(0, 150, 1, 1, false, false, mode);
};

// Helper to get effective rank/suit (uses locked values if present)
const getEffectiveRank = (card: Card): Rank => card.meta?.lockedRank ?? card.rank;
const getEffectiveSuit = (card: Card): Suit => card.meta?.lockedSuit ?? card.suit;

const isStandardMoveValid = (movingCards: Card[], targetPile: Pile, patriarchyMode: boolean = false): boolean => {
  if (movingCards.length === 0) return false;
  const leader = movingCards[0];
  const leaderRank = getEffectiveRank(leader);
  const leaderSuit = getEffectiveSuit(leader);
  const targetTop = targetPile.cards[targetPile.cards.length - 1];

  if (targetPile.type === 'tableau') {
    // Queen is high by default (stack rank 13), Kings high if patriarchy mode
    if (!targetTop) return getStackRank(leaderRank, patriarchyMode) === 13;
    const targetRank = getEffectiveRank(targetTop);
    const targetSuit = getEffectiveSuit(targetTop);
    // Opposite color and target's stack rank must be one higher than leader's
    return (getCardColor(leaderSuit) !== getCardColor(targetSuit) && getStackRank(targetRank, patriarchyMode) === getStackRank(leaderRank, patriarchyMode) + 1);
  }
  if (targetPile.type === 'foundation') {
    if (movingCards.length > 1) return false;
    if (!targetTop) {
      // Aces can only go to their matching suit foundation
      return leaderRank === 1 && targetPile.id === `foundation-${leaderSuit}`;
    }
    const targetRank = getEffectiveRank(targetTop);
    const targetSuit = getEffectiveSuit(targetTop);
    // Must match suit of foundation's first card and be next rank (foundation uses normal rank order A,2,3...K)
    return leaderSuit === targetSuit && leaderRank === targetRank + 1;
  }
  return false;
};

// Removed duplicate findValidMoves - using the useCallback version inside the component that properly handles effects

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
   // --- Explicit curse icon mappings for missing icons ---
   schrodingersdeck: 'schrodingersdeck',
   counterfeiting: 'Counterfeiting',
   towerofbabel: 'towerofbabel',
   eattherich: 'eattherich',
   cagedbakeneko: 'cagedbakeneko',
   moodswings: 'moodswings',
   fogwar: 'fogofwar',
   revolvingdoor: 'revolvingdoor',
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

// Icon helper - converts effect name to icon path
const getEffectIcon = (nameOrId: string, type: 'exploit' | 'curse' | 'blessing') => {
   const lower = (nameOrId || '').toLowerCase();
   
   // 1. Check synonyms (using ID-like keys)
   if (ICON_SYNONYMS[lower]) {
      return `/icons/${encodeURIComponent(ICON_SYNONYMS[lower])}.png`;
   }

   // 2. Try replacing underscores with spaces
   if (lower.includes('_')) {
      return `/icons/${encodeURIComponent(lower.replace(/_/g, ' '))}.png`;
   }

   // 3. Try replacing spaces with underscores
   const asId = lower.replace(/\s+/g, '_').replace(/&/g, 'and').replace(/[^a-z0-9_]/g, '');
   if (ICON_SYNONYMS[asId]) {
       return `/icons/${encodeURIComponent(ICON_SYNONYMS[asId])}.png`;
   }

   // 4. Default: use name
   return `/icons/${encodeURIComponent(lower)}.png`;
};

// Category icons
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
   // Patterns category uses fortune icon
   pattern: '/icons/fortune.png',
   patterns: '/icons/fortune.png',
};

export default function SolitaireEngine({ 
   effectsRegistry = EFFECTS_REGISTRY, 
   wanderRegistry = WANDER_REGISTRY 
}: SolitaireEngineProps = {}) {
   // Placeholder undo function. Replace with real undo logic as needed.
   function undoLastMove() {
      alert('Undo not yet implemented.');
   }
  const [currentView, setCurrentView] = useState<'home' | 'game'>('home');
  const [runPlan, setRunPlan] = useState<Encounter[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState());
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [selectedPileId, setSelectedPileId] = useState<string | null>(null);
   const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
   const [hintTargets, setHintTargets] = useState<string[]>([]);
   const [selectionColor, setSelectionColor] = useState<'none' | 'green' | 'yellow' | 'red'>('none');
   const [highlightedMoves, setHighlightedMoves] = useState<{ tableauIds: string[]; foundationIds: string[] }>({ tableauIds: [], foundationIds: [] });
  
  // Classic mode state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Player Stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => loadPlayerStats());
  const [runStartData, setRunStartData] = useState<{ startTime: number; startCoins: number; encounterLog: RunEncounterRecord[] } | null>(null);
   const [activeDrawer, setActiveDrawer] = useState<'pause' | 'exploit' | 'curse' | 'blessing' | 'patterns' | 'shop' | 'feedback' | 'test' | 'settings' | 'resign' | 'blessing_select' | 'inventory' | null>(null);
  const [shopInventory, setShopInventory] = useState<GameEffect[]>([]);
  const [blessingChoices, setBlessingChoices] = useState<GameEffect[]>([]);
  const [patternDrawer, setPatternDrawer] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
   // Left-floating menu state removed — inventory now uses the unified bottom drawer

  // Animation state
  const [floatingElements, setFloatingElements] = useState<Array<{ id: number; text: string; x: number; y: number; color: string; isMult?: boolean }>>([]);
  const [activeBanner, setActiveBanner] = useState<{ id: number; name: string; icon: string; effectId?: string } | null>(null);
  const [curseBanner, setCurseBanner] = useState<{ effectId: string; name: string; description: string } | null>(null);
  const [animatingCards, setAnimatingCards] = useState<Map<string, string>>(new Map());
   // When set, this drawer is intentionally non-closable by the collapse button
   const [nonClosableDrawer, setNonClosableDrawer] = useState<'blessing_select' | 'shop' | null>(null);
   // Shop tab state (buy / sell / continue)
   const [shopTab, setShopTab] = useState<'buy' | 'sell' | 'continue'>('buy');
   // Whether blessing select is shown before starting an encounter
   const [preEncounterBlessing, setPreEncounterBlessing] = useState(false);

   // Game mode selector state
   const [expandedModes, setExpandedModes] = useState<Set<string>>(new Set());
   const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

   // Enable effect debugger in development
   const debug = useEffectDebugger(process.env.NODE_ENV === 'development');

   // Animation helpers
   const spawnFloating = useCallback((text: string, x: number, y: number, color: string, isMult: boolean = false) => {
     const id = Date.now() + Math.random();
     setFloatingElements(prev => [...prev, { id, text, x, y, color, isMult }]);
     setTimeout(() => {
       setFloatingElements(prev => prev.filter(e => e.id !== id));
     }, 2500); // Increased from 1000 to match new animation duration
   }, []);

   const spawnBanner = useCallback((name: string, icon: string, effectId?: string) => {
     const id = Date.now();
     setActiveBanner({ id, name, icon, effectId });
     setTimeout(() => {
       setActiveBanner(prev => prev?.id === id ? null : prev);
     }, 3000);
   }, []);

   const showCurseBanner = useCallback((effectId: string, name: string, description: string) => {
     setCurseBanner({ effectId, name, description });
   }, []);

   const triggerCardAnimation = useCallback((cardIds: string[], animClass: string) => {
     setAnimatingCards(prev => {
       const next = new Map(prev);
       cardIds.forEach(id => next.set(id, animClass));
       return next;
     });
     setTimeout(() => {
       setAnimatingCards(prev => {
         const next = new Map(prev);
         cardIds.forEach(id => next.delete(id));
         return next;
       });
     }, 450);
   }, []);

   // Validate effects on mount (development only)
   useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
         debug.printValidation(effectsRegistry);
      }
   }, []); // eslint-disable-line react-hooks/exhaustive-deps

   // Check for effect conflicts when activeEffects changes
   useEffect(() => {
      if (activeEffects.length > 1 && process.env.NODE_ENV === 'development') {
         const effectDefs = effectsRegistry.filter(e => activeEffects.includes(e.id));
         const conflicts = detectConflicts(effectDefs);

         const blocking = conflicts.filter(c => c.severity === 'blocking');
         if (blocking.length > 0) {
            console.error('❌ BLOCKING EFFECT CONFLICTS:', blocking);
         }

         const warnings = conflicts.filter(c => c.severity === 'warning');
         if (warnings.length > 0) {
            console.warn('⚠️ Effect warnings:', warnings);
         }
      }
   }, [activeEffects, effectsRegistry, debug]);

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
      // Patterns: always show pattern definitions in the drawer
      if (activeDrawer === 'patterns') return effectsRegistry.filter(e => e.type === 'pattern');
      // Owned effect lists for exploit/curse/blessing drawers
      if (['exploit', 'curse', 'blessing'].includes(activeDrawer)) {
         return effectsRegistry.filter(e => {
            const isOwned = gameState.ownedEffects.includes(e.id) || gameState.debugUnlockAll;
            const isActive = activeEffects.includes(e.id);
            // For curses, only show currently active curses
            if (activeDrawer === 'curse') {
               return ['curse'].includes(e.type) && isActive;
            }
            // For other drawers, show owned effects
            if (!isOwned) return false;
            if (activeDrawer === 'exploit') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
            if (activeDrawer === 'blessing') return ['blessing'].includes(e.type);
            return false;
         });
      }
      return [] as GameEffect[];
   }, [activeDrawer, blessingChoices, shopInventory, gameState.ownedEffects, gameState.debugUnlockAll, effectsRegistry, activeEffects]);

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
  const [glossaryTab, setGlossaryTab] = useState<'blessings'|'exploits'|'curses'|'patterns'>('blessings');
  const [profileTab, setProfileTab] = useState<'stats'|'feats'|'recaps'>('stats');
  const [expandedAchievement, setExpandedAchievement] = useState<number | null>(null);
  const [expandedSettingsSection, setExpandedSettingsSection] = useState<string | null>(null);
  
  // Settings state - load from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('solitaire_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          confirmResign: parsed.confirmResign ?? true,
          supportPatriarchy: parsed.supportPatriarchy ?? false,
          klondikeEnabled: parsed.klondikeEnabled ?? false,
          klondikeDraw: parsed.klondikeDraw ?? '3',
          klondikeScoring: parsed.klondikeScoring ?? 'standard',
          spiderEnabled: parsed.spiderEnabled ?? false,
          spiderSuits: parsed.spiderSuits ?? '4',
          freecellEnabled: parsed.freecellEnabled ?? false,
          freecellAutoMove: parsed.freecellAutoMove ?? true,
          musicEnabled: parsed.musicEnabled ?? false,
          sfxEnabled: parsed.sfxEnabled ?? false,
          masterVolume: parsed.masterVolume ?? 50,
          musicVolume: parsed.musicVolume ?? 50,
          sfxVolume: parsed.sfxVolume ?? 50,
          menuMusic: parsed.menuMusic ?? true,
          gameplayMusic: parsed.gameplayMusic ?? true,
          shopMusic: parsed.shopMusic ?? true,
          wanderMusic: parsed.wanderMusic ?? true,
          cardFlip: parsed.cardFlip ?? true,
          cardPlace: parsed.cardPlace ?? true,
          invalidMove: parsed.invalidMove ?? true,
          scorePoints: parsed.scorePoints ?? true,
          levelComplete: parsed.levelComplete ?? true,
          uiClicks: parsed.uiClicks ?? true,
          reduceMotion: parsed.reduceMotion ?? false,
          highContrast: parsed.highContrast ?? false,
          colorBlindMode: parsed.colorBlindMode ?? 'off',
          cardBack: parsed.cardBack ?? 'card-back',
          cardAnimations: parsed.cardAnimations ?? true,
          theme: parsed.theme ?? 'dark',
          language: parsed.language ?? 'en',
          sarcasmLevel: parsed.sarcasmLevel ?? 0,
          hogwartsHouse: parsed.hogwartsHouse ?? 'undecided',
          cheatCode: '',
        };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return {
      confirmResign: true,
      supportPatriarchy: false,
      klondikeEnabled: false,
      klondikeDraw: '3' as '1' | '3',
      klondikeScoring: 'standard' as 'standard' | 'vegas' | 'none',
      spiderEnabled: false,
      spiderSuits: '4' as '1' | '2' | '4',
      freecellEnabled: false,
      freecellAutoMove: true,
      musicEnabled: false,
      sfxEnabled: false,
      masterVolume: 50,
      musicVolume: 50,
      sfxVolume: 50,
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
      reduceMotion: false,
      highContrast: false,
      colorBlindMode: 'off',
      cardBack: 'card-back',
      cardAnimations: true,
      theme: 'dark',
      language: 'en',
      sarcasmLevel: 0,
      hogwartsHouse: 'undecided',
      cheatCode: '',
    };
  });
  const [callParentsCount, setCallParentsCount] = useState(0);
  const [showParentsPopup, setShowParentsPopup] = useState(false);
  const [cheatResponse, setCheatResponse] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const [testAmount, setTestAmount] = useState(100);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackChecks, setFeedbackChecks] = useState<Record<string, boolean>>({});

  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem('solitaire_settings_v1', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  // Auto-advance when score goal is reached or classic game is won
  React.useEffect(() => {
    if (currentView === 'game' && !gameState.isLevelComplete && !showLevelComplete) {
      // Check if this is a classic solitaire mode
      const classicGame = CLASSIC_GAMES[selectedMode];
      if (classicGame) {
        // Use classic game win condition
        const classicPiles = convertCoronataPilesToClassic(gameState.piles);
        const classicState = {
          piles: classicPiles,
          score: gameState.score,
          moves: gameState.moves,
          history: []
        };
        if (classicGame.winCondition(classicState)) {
          setGameState(p => ({ ...p, isLevelComplete: true }));
          setShowLevelComplete(true);
        }
      } else {
        // Use coronata score-based win condition
        if (gameState.score >= gameState.currentScoreGoal) {
          setGameState(p => ({ ...p, isLevelComplete: true }));
          setShowLevelComplete(true);
        }
      }
    }
  }, [gameState.score, gameState.currentScoreGoal, gameState.isLevelComplete, gameState.piles, gameState.moves, currentView, showLevelComplete, selectedMode]);

   // Timer for classic modes
   React.useEffect(() => {
      const classicGame = CLASSIC_GAMES[selectedMode];
      if (classicGame && currentView === 'game' && !gameState.isLevelComplete && !showLevelComplete) {
         setIsTimerRunning(true);
         const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
         }, 1000);
         return () => clearInterval(interval);
      } else {
         setIsTimerRunning(false);
      }
   }, [selectedMode, currentView, gameState.isLevelComplete, showLevelComplete]);

  // Reset timer when starting a new game
  React.useEffect(() => {
    if (currentView === 'game') {
      setElapsedTime(0);
    }
  }, [currentView]);

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
        if (eff.type === 'random_outcome') { 
            if (Math.random() < eff.params[0]) apply(eff.params[1]); else apply(eff.params[2]); 
        }
      }
    };
    apply(effects);
    setGameState(prev => ({ ...prev, ...updates, ownedEffects: newOwned }));
      setActiveEffects(Array.from(new Set(newActive)));
  };

  const startWanderPhase = () => {
     setActiveDrawer(null);
     setGameState(prev => ({ ...prev, wanderRound: 1 }));
     triggerWanderSelection();
  };

  const triggerWanderSelection = () => {
     let validWanders = wanderRegistry.filter(w => {
         if (w.isHidden) return false;
         if (w.conditions?.minEncounter && gameState.runIndex < w.conditions.minEncounter) return false;
         // Filter out wanders that have already been seen this run
         if (gameState.seenWanders && gameState.seenWanders.includes(w.id)) return false;
         return true;
     });

     const opts = validWanders.sort(() => 0.5 - Math.random()).slice(0, 3);
     setGameState(prev => ({ ...prev, wanderState: 'selection', wanderOptions: opts, activeWander: null, wanderResultText: null }));
  };

  const chooseWanderOption = (wander: any) => {
    // Mark this wander as seen
    setGameState(prev => ({
      ...prev,
      wanderState: 'active',
      activeWander: wander,
      seenWanders: [...(prev.seenWanders || []), wander.id]
    }));
  };
  
  const resolveWander = (choice: WanderChoice) => {
    // Handle both old-style effects array and new-style onChoose callback
    if (choice.onChoose) {
      // Create wander state from gameState
      const wanderState: WanderState = {
        resources: {
          coins: gameState.coins || 0,
          handSize: gameState.resources?.handSize || 5,
          shuffles: gameState.resources?.shuffles || 0,
          discards: gameState.resources?.discards || 0,
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
            items: gameState.run?.inventory?.items || [],
            fortunes: gameState.run?.inventory?.fortunes || [],
          },
          unlockedWanders: gameState.run?.unlockedWanders || [],
          activeQuests: gameState.run?.activeQuests || [],
          statuses: gameState.run?.statuses || [],
          forcedCurse: gameState.run?.forcedCurse,
        },
        activeExploits: activeEffects.filter(id => {
          const e = effectsRegistry.find(x => x.id === id);
          return e?.type === 'exploit' || e?.type === 'epic' || e?.type === 'legendary';
        }),
        score: { current: gameState.score || 0 },
        effectState: { ...gameState.effectState },
        rules: { ...gameState.rules },
      };
      
      // Wanders expect ctx.gameState and return modified state
      const resultState = choice.onChoose({ gameState: wanderState, rng: Math.random });
      
      // Map the returned wander state back to gameState format
      if (resultState) {
        const updates: Partial<GameState> = {};
        
        // Map resources back
        if (resultState.resources?.coins !== undefined) {
          updates.coins = resultState.resources.coins;
        }
        if (resultState.resources) {
          updates.resources = {
            handSize: resultState.resources.handSize ?? gameState.resources?.handSize ?? 5,
            shuffles: resultState.resources.shuffles ?? gameState.resources?.shuffles ?? 0,
            discards: resultState.resources.discards ?? gameState.resources?.discards ?? 0,
          };
        }
        
        // Map score back
        if (resultState.score?.current !== undefined) {
          updates.score = resultState.score.current;
        }
        
        // Map effectState back (e.g., nextScoreGoalModifier, discardBonus, shuffleBonus)
        if (resultState.effectState) {
          updates.effectState = { ...gameState.effectState, ...resultState.effectState };
        }
        
        // Map rules back
        if (resultState.rules) {
          updates.rules = { ...gameState.rules, ...resultState.rules };
        }
        
        // Map inventory back to ownedEffects and activeEffects
            if (resultState.run?.inventory) {
               const inv = resultState.run.inventory;
               const newOwned = new Set<string>(gameState.ownedEffects);
               const newActive = new Set<string>(activeEffects);
          
               if (inv.exploits) inv.exploits.forEach((id: string) => { newOwned.add(id); newActive.add(id); });
               if (inv.curses) inv.curses.forEach((id: string) => { newOwned.add(id); newActive.add(id); });
               if (inv.blessings) inv.blessings.forEach((id: string) => newOwned.add(id));
          
               updates.ownedEffects = Array.from(newOwned);
               setActiveEffects(Array.from(newActive));
          
               // Map items, fortunes, etc.
               updates.run = {
                  ...gameState.run,
                  inventory: {
                     items: inv.items || gameState.run?.inventory?.items || [],
                     fortunes: inv.fortunes || gameState.run?.inventory?.fortunes || [],
                  },
                  unlockedWanders: resultState.run.unlockedWanders || gameState.run?.unlockedWanders || [],
                  activeQuests: resultState.run.activeQuests || gameState.run?.activeQuests || [],
                  statuses: resultState.run.statuses || gameState.run?.statuses || [],
                  forcedCurse: resultState.run.forcedCurse,
               };
            }
        
        // Apply updates and set result text
        setGameState(prev => ({ 
          ...prev, 
          ...updates, 
          wanderState: 'result', 
          wanderResultText: choice.result 
        }));
      } 
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
        // Check if blessing select should be shown before this encounter
        if (nextIdx > 0 && nextIdx % 3 === 0) {
           const blessings = effectsRegistry.filter(e => e.type === 'blessing').sort(() => 0.5 - Math.random());
           const blessingOptions = blessings.slice(0, 5);
           setBlessingChoices(blessingOptions);
           setActiveDrawer('blessing_select');
           setNonClosableDrawer('blessing_select');
           setPreEncounterBlessing(true);
           // Clear wander state before showing blessing selection
           setGameState(prev => ({ ...prev, wanderState: 'none', wanderRound: 0, runIndex: nextIdx, charges: newCharges }));
           return;
        }

        let nextEncounter = runPlan[nextIdx];
        
        // Check if a wander forced the next curse
        if (gameState.run?.forcedCurse) {
          const forcedEffect = effectsRegistry.find(e => e.id === gameState.run.forcedCurse);
          if (forcedEffect && (forcedEffect.type === 'curse' || forcedEffect.type === 'epic' || forcedEffect.type === 'legendary')) {
            nextEncounter = {
              ...nextEncounter,
              effectId: gameState.run.forcedCurse,
              type: 'curse'
            };
          }
        }
        
        // Retain only persistent effects (blessings now persist like exploits/curses)
        // But exclude curses - they should only be active for their specific encounter
        const keptEffects = activeEffects.filter(id => { 
            const e = effectsRegistry.find(x => x.id === id); 
            return e?.type === 'exploit' || e?.type === 'epic' || e?.type === 'legendary' || e?.type === 'blessing'; 
        });
        
        // Generate Board
        const newBoard = generateNewBoard(0, gameState.coins, gameState.scoreMultiplier, gameState.coinMultiplier, false, false, 'coronata');

        // Calculate new active effects list
        let nextActiveEffects = [...keptEffects];
        if (nextEncounter.effectId) nextActiveEffects.push(nextEncounter.effectId);
        // For final encounter, add a second curse
        if (nextIdx === 9) {
           const curses = effectsRegistry.filter(e => e.type === 'curse' && e.id !== nextEncounter.effectId);
           if (curses.length > 0) {
              const extraCurse = shuffleArray(curses)[0];
              nextActiveEffects.push(extraCurse.id);
           }
        }
        nextActiveEffects = Array.from(new Set(nextActiveEffects));

        // Sort effects by application order: curse -> exploit -> blessing
        nextActiveEffects.sort((a, b) => {
           const effectA = effectsRegistry.find(e => e.id === a);
           const effectB = effectsRegistry.find(e => e.id === b);
           const typeOrder = { 'curse': 0, 'exploit': 1, 'blessing': 2 };
           const orderA = typeOrder[effectA?.type as keyof typeof typeOrder] ?? 3;
           const orderB = typeOrder[effectB?.type as keyof typeof typeOrder] ?? 3;
           return orderA - orderB;
        });

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
            wanderRound: 0,
            lastActionType: 'none',
            // Clear forcedCurse after using it
            run: {
              ...gameState.run,
              forcedCurse: undefined
            },
            effectState: { scoredTableau: [], scoredFoundation: [] },
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

        // Show curse introduction banner for ALL curses in this encounter
        const activeCurses = nextActiveEffects
           .map(eid => effectsRegistry.find(e => e.id === eid))
           .filter(e => e && e.type === 'curse');

        if (activeCurses.length > 0) {
           // Show banner for the first curse (can be expanded to show all)
           const curse = activeCurses[0];
           showCurseBanner(curse.id, curse.name, curse.description);
        }
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
      // Restore RNG to original implementation to avoid leaking deterministic RNG
      try { resetEffectsRng(); } catch {}
      alert("Run Complete!"); 
      setCurrentView('home'); 
     }
  };

  const startRun = (modeOverride?: string) => {
    const mode = modeOverride || selectedMode;
    // Ensure selectedMode state is updated if override is provided
    if (modeOverride && modeOverride !== selectedMode) {
      setSelectedMode(modeOverride);
    }
    if (mode === 'coronata') {
      // support seeded plan generation if a seed is set in localStorage
      const rawSeed = (() => { try { return localStorage.getItem('solitaire_seed_v1'); } catch { return null; } })();
      const seedNum = rawSeed ? Number(rawSeed) : null;
      const rng = seedNum ? createSeededRng(seedNum) : undefined;

      // Inject deterministic RNG for effect logic when a seed is provided
      if (rng) setEffectsRng(rng); else resetEffectsRng();

      const plan = generateRunPlan(effectsRegistry, rng);
      const firstEncounter = plan[0];
      let freshState = initialGameState(mode);
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

      // Sort effects by application order: curse -> exploit -> blessing
      initialActive.sort((a, b) => {
         const effectA = effectsRegistry.find(e => e.id === a);
         const effectB = effectsRegistry.find(e => e.id === b);
         const typeOrder = { 'curse': 0, 'exploit': 1, 'blessing': 2 };
         const orderA = typeOrder[effectA?.type as keyof typeof typeOrder] ?? 3;
         const orderB = typeOrder[effectB?.type as keyof typeof typeOrder] ?? 3;
         return orderA - orderB;
      });

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
      const blessingOptions = blessings.slice(0, 5);
      setBlessingChoices(blessingOptions);
      setActiveDrawer('blessing_select');
      // Prevent collapsing the blessing picker at run start
      setNonClosableDrawer('blessing_select');
    } else {
      // Classic mode
      const freshState = initialGameState(mode);
      setGameState(freshState);
      setCurrentView('game');
      setActiveEffects([]);
      setActiveDrawer(null);
      setNonClosableDrawer(null);
    }
  };

  // Sort effects by type: curse → exploit → blessing for predictable execution order
   const getEffects = useCallback(() => {
      // Improved effect sorting: curse → exploit → epic → legendary → rare → uncommon → blessing → passive
      const typeOrder: Record<string, number> = {
         curse: 0,
         exploit: 1,
         epic: 2,
         legendary: 3,
         rare: 4,
         uncommon: 5,
         blessing: 6,
         passive: 7
      };
      // Include patterns automatically + active effects
      const patternIds = effectsRegistry.filter(e => e.type === 'pattern').map(e => e.id);
      const allActiveIds = [...new Set([...patternIds, ...activeEffects])];

      return effectsRegistry
         .filter(e => allActiveIds.includes(e.id))
         .sort((a, b) => {
            const orderA = typeOrder[a.type] ?? 999;
            const orderB = typeOrder[b.type] ?? 999;
            // If same type, sort by name for consistency
            if (orderA === orderB) {
               return (a.name || '').localeCompare(b.name || '');
            }
            return orderA - orderB;
         });
   }, [activeEffects, effectsRegistry]);

  // Find valid move destinations for a card/stack
  const findValidMoves = useCallback((movingCardIds: string[], sourcePileId: string): { tableauIds: string[]; foundationIds: string[] } => {
    // Check if this is a classic solitaire mode
    const classicGame = CLASSIC_GAMES[selectedMode];
    if (classicGame) {
      const classicPiles = convertCoronataPilesToClassic(gameState.piles);
      const classicSourcePile = classicPiles[sourcePileId];

      if (!classicSourcePile) return { tableauIds: [], foundationIds: [] };

      // Find the card index
      const cardIndex = classicSourcePile.findIndex(c => c.id === movingCardIds[0]);
      if (cardIndex === -1) return { tableauIds: [], foundationIds: [] };

      // Check if cards can be dragged
      if (!classicGame.canDrag(sourcePileId, cardIndex, classicSourcePile)) {
        return { tableauIds: [], foundationIds: [] };
      }

      const tableauIds: string[] = [];
      const foundationIds: string[] = [];

      // Check all possible target piles
      Object.keys(classicPiles).forEach(pileId => {
        if (pileId === sourcePileId) return;

        const targetPile = classicPiles[pileId];
        const moveAttempt = {
          cardIds: movingCardIds,
          sourcePileId,
          targetPileId: pileId
        };

        if (classicGame.canDrop(moveAttempt, targetPile, {
          piles: classicPiles,
          score: gameState.score,
          moves: gameState.moves,
          history: []
        })) {
          if (pileId.startsWith('tableau')) {
            tableauIds.push(pileId);
          } else if (pileId.startsWith('foundation')) {
            foundationIds.push(pileId);
          }
        }
      });

      return { tableauIds, foundationIds };
    }

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

      Object.entries(gameState.piles).forEach(([pileId, pile]) => {
         const pileTyped = pile as Pile;
         if (pileTyped && pileTyped.type === 'tableau' && pileId !== sourcePileId) {
            if (!pileTyped.locked) {
               let valid = isStandardMoveValid(movingCards, pileTyped, settings.supportPatriarchy);
               // Apply effect canMove hooks
               effects.forEach(eff => {
                  if (eff.canMove) {
                     try {
                        const res = eff.canMove(movingCards, sourcePile, pileTyped, valid, gameState);
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
            const pileTyped = pile as Pile;
            if (pileTyped && pileTyped.type === 'foundation') {
               let valid = isStandardMoveValid(movingCards, pileTyped, settings.supportPatriarchy);
               console.log(`[findValidMoves] Foundation ${pileId}: card=${movingCards[0]?.rank}${movingCards[0]?.suit}, topCard=${pileTyped.cards[pileTyped.cards.length-1]?.rank}${pileTyped.cards[pileTyped.cards.length-1]?.suit}, valid=${valid}`);
               effects.forEach(eff => {
                  if (eff.canMove) {
                     try {
                        const res = eff.canMove(movingCards, sourcePile, pileTyped, valid, gameState);
                        if (res !== undefined) {
                           console.log(`[findValidMoves] Effect ${eff.id} changed valid from ${valid} to ${res}`);
                           valid = res;
                        }
                     } catch (e) { /* ignore */ }
                  }
               });
               if (valid) foundationIds.push(pileId);
            }
         });
      }

    return { tableauIds, foundationIds };
  }, [gameState, getEffects, settings.supportPatriarchy, selectedMode]);

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
      const movingCardIds = movingCards.map(c => c.id);
      const moves = findValidMoves(movingCardIds, pileId);
      const allTargets = [...moves.tableauIds, ...moves.foundationIds];
      const color: 'red' | 'green' | 'yellow' | 'none' = allTargets.length === 0 ? 'red' : allTargets.length === 1 ? 'green' : 'yellow';

      setGameState(prev => ({ ...prev, selectedCardIds: movingCardIds }));
      setSelectedPileId(pileId);
      setSelectedCardIndex(cardIndex);
      // Disable hints/outlines for Fog of War
      if (activeEffects.includes('fog_of_war_variant')) {
         setHintTargets([]);
         setSelectionColor('none');
         setHighlightedMoves({ tableauIds: [], foundationIds: [] });
      } else {
         setHintTargets(allTargets);
         setSelectionColor(color);
         setHighlightedMoves({ tableauIds: moves.tableauIds, foundationIds: moves.foundationIds });
      }
   };

  const handleCardClick = (pileId: string, cardIndex: number) => {
    const pile = gameState.piles[pileId];
    if (!pile) return;
    const clickedCard = cardIndex >= 0 ? pile.cards[cardIndex] : null;

    // Key unlock flow - if a key is selected and user clicks a locked pile/card
    if (gameState.selectedCardIds && gameState.selectedCardIds.length === 1) {
       const selectedPile = gameState.piles[selectedPileId!];
       const selectedCard = selectedPile?.cards.find(c => c.id === gameState.selectedCardIds![0]);

       if (selectedCard?.meta?.isKey) {
          // Check if clicked on a locked pile
          if (pile.locked) {
             const newPiles = { ...gameState.piles };
             newPiles[pileId] = { ...pile, locked: false };

             // Remove the key card from its pile
             const keyPile = newPiles[selectedPileId!];
             newPiles[selectedPileId!] = { ...keyPile, cards: keyPile.cards.filter(c => c.id !== selectedCard.id) };

             setGameState(prev => ({ ...prev, piles: newPiles, selectedCardIds: null }));
             setSelectedPileId(null);
             setSelectedCardIndex(-1);
             return;
          }
          // Check if clicked on a locked card
          if (clickedCard?.meta?.locked) {
             const newPiles = { ...gameState.piles };
             const newCards = [...pile.cards];
             newCards[cardIndex] = { ...clickedCard, meta: { ...clickedCard.meta, locked: false } };
             newPiles[pileId] = { ...pile, cards: newCards };

             // Remove the key card from its pile
             const keyPile = newPiles[selectedPileId!];
             newPiles[selectedPileId!] = { ...keyPile, cards: keyPile.cards.filter(c => c.id !== selectedCard.id) };

             setGameState(prev => ({ ...prev, piles: newPiles, selectedCardIds: null }));
             setSelectedPileId(null);
             setSelectedCardIndex(-1);
             return;
          }
       }
    }

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
    
    // Check if this is a classic solitaire mode
    const classicGame = CLASSIC_GAMES[selectedMode];
    if (classicGame) {
      // Handle stock clicks for classic games
      if (pileId === 'stock' || pileId === 'deck') {
        const classicPiles = convertCoronataPilesToClassic(gameState.piles);
        const result = classicGame.onStockClick?.({
          piles: classicPiles,
          score: gameState.score,
          moves: gameState.moves,
          history: []
        });

        if (result) {
          const newCoronataPiles = convertClassicPilesToCoronata(result.piles);
          setGameState(prev => ({
            ...prev,
            piles: newCoronataPiles,
            score: result.score ?? prev.score,
            moves: result.moves ?? prev.moves,
            customData: result.customData ?? prev.customData,
            history: [...prev.history, prev]
          }));
        }
        return;
      }

      // Handle card clicks for classic games
      if (pileId.startsWith('tableau') || pileId.startsWith('foundation') || pileId === 'waste') {
        if (!clickedCard && cardIndex === -1) {
          // Empty pile click - try to move selected cards here
          if (gameState.selectedCardIds) {
            const moved = attemptMove(gameState.selectedCardIds, selectedPileId!, pileId);
            if (moved) clearSelection();
          }
          return;
        }
        if (clickedCard) {
          if (gameState.selectedCardIds) {
            // Try to move to this card's pile
            const moved = attemptMove(gameState.selectedCardIds, selectedPileId!, pileId);
            if (moved) {
              clearSelection();
              return;
            }
          } else {
            // Select this card
            selectCardAndCompute(pileId, cardIndex);
            return;
          }
        }
      }
      return;
    }
    
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
      // Disable automove for Fog of War
      if (activeEffects.includes('fog_of_war_variant')) return;

      const pile = gameState.piles[pileId];
      if (!pile || cardIndex < 0) return;
      const card = pile.cards[cardIndex];
      if (!card.faceUp) return;
      if (cardIndex !== pile.cards.length - 1) return; // only top card auto-move

      const moves = findValidMoves([card.id], pileId);

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
    const oldHand = hand.cards.filter(c => (!c.meta?.persistent && (!c.meta?.charges || c.meta.charges <= 0))).map(c => ({ ...c, faceUp: false }));
    const persistentCards = hand.cards.filter(c => c.meta?.persistent || (c.meta?.charges && c.meta.charges > 0));
    let newDeckCards = [...deck.cards, ...oldHand];
    const drawCount = 5;
    const drawn = newDeckCards.splice(0, drawCount).map(c => ({ ...c, faceUp: true }));

    let nextState: GameState = {
      ...state,
      piles: {
        ...state.piles,
        deck: { ...deck, cards: newDeckCards },
        hand: { ...hand, cards: [...persistentCards, ...drawn] }
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
    let targetPile = gameState.piles[targetPileId];
    const movingCards = sourcePile.cards.filter(c => cardIds.includes(c.id));
    if (movingCards.length === 0) return false;

    // Check if this is a classic solitaire mode
    const classicGame = CLASSIC_GAMES[selectedMode];
    if (classicGame) {
      // Use classic game rules
      const classicPiles = convertCoronataPilesToClassic(gameState.piles);
      const classicSourcePile = classicPiles[sourcePileId];
      const classicTargetPile = classicPiles[targetPileId];

      if (!classicSourcePile || !classicTargetPile) return false;

      // Find the card index in the source pile
      const cardIndex = classicSourcePile.findIndex(c => c.id === cardIds[0]);
      if (cardIndex === -1) return false;

      // Check if the cards can be dragged
      if (!classicGame.canDrag(sourcePileId, cardIndex, classicSourcePile)) return false;

      // Check if the move is valid
      const moveAttempt = {
        cardIds,
        sourcePileId,
        targetPileId
      };

      if (!classicGame.canDrop(moveAttempt, classicTargetPile, {
        piles: classicPiles,
        score: gameState.score,
        moves: gameState.moves,
        history: []
      })) {
        console.log('Classic move not valid');
        return false;
      }

      // Perform the move
      const newSourceCards = sourcePile.cards.filter(c => !cardIds.includes(c.id));
      // Auto-flip top card when exposed (standard solitaire behavior)
      if (sourcePile.type === 'tableau' && newSourceCards.length > 0) {
        const newTop = newSourceCards[newSourceCards.length - 1];
        if (!newTop.faceUp) newSourceCards[newSourceCards.length - 1] = { ...newTop, faceUp: true };
      }
      const newTargetCards = [...targetPile.cards, ...movingCards];
      const newPiles = { ...gameState.piles, [sourcePileId]: { ...sourcePile, cards: newSourceCards }, [targetPileId]: { ...targetPile, cards: newTargetCards } };

      setGameState(prev => ({
        ...prev,
        piles: newPiles,
        moves: prev.moves + 1,
        history: [...prev.history, prev]
      }));

      return true;
    }

    let context: MoveContext = { source: sourcePileId, target: targetPileId, cards: movingCards };
    effects.forEach(eff => {
       if (eff.interceptMove) {
          const mod = eff.interceptMove(context, gameState);
          if (mod.target) finalTargetPileId = mod.target;
       }
    });
    
    targetPile = gameState.piles[finalTargetPileId];

    const baseMoves = findValidMoves(cardIds, sourcePileId);
    let valid = baseMoves.tableauIds.includes(finalTargetPileId) || baseMoves.foundationIds.includes(finalTargetPileId);

    effects.forEach(eff => {
       if (eff.canMove) {
          const res = eff.canMove(movingCards, sourcePile, targetPile, valid, gameState);
          if (res !== undefined) valid = res;
       }
    });

    if (!valid) {
      console.log('Move not valid:', { cardIds, sourcePileId, targetPileId, baseMoves, effects: effects.map(e => e.id) });
      return false;
    }

    // Handle charged cards
    if (sourcePileId === 'hand') {
      movingCards.forEach(card => {
        if (card.meta?.charges > 0) {
          const cardInHand = sourcePile.cards.find(c => c.id === card.id);
          if (cardInHand) {
            cardInHand.meta = { ...cardInHand.meta, charges: cardInHand.meta.charges - 1 };
            card.meta = { ...card.meta, charges: card.meta.charges - 1 };
          }
        }
      });
    }

    const newSourceCards = sourcePile.cards.filter(c => !cardIds.includes(c.id) || (c.meta?.charges && c.meta.charges > 0));
    // Auto-flip top card when exposed (standard solitaire behavior)
    if (sourcePile.type === 'tableau' && newSourceCards.length > 0) { const newTop = newSourceCards[newSourceCards.length - 1]; if (!newTop.faceUp) newSourceCards[newSourceCards.length - 1] = { ...newTop, faceUp: true }; }

    // Lock wild cards to the card they're played on
    const lockedMovingCards = movingCards.map((card: Card) => {
      if (card.meta?.isWild && !card.meta?.lockedRank && !card.meta?.lockedSuit) {
        // Determine what card the wild is being played on
        let lockToCard = null;
        if (targetPile.cards.length > 0) {
          // Lock to top card of target pile
          lockToCard = targetPile.cards[targetPile.cards.length - 1];
        } else if (targetPile.type === 'foundation') {
          // On empty foundation, lock to Ace
          lockToCard = { rank: 1 as Rank, suit: targetPile.meta?.requiredSuit || 'hearts' };
        } else if (targetPile.type === 'tableau') {
          // On empty tableau, lock to King
          lockToCard = { rank: 13 as Rank, suit: card.suit };
        }

        if (lockToCard) {
          return {
            ...card,
            meta: {
              ...card.meta,
              lockedRank: lockToCard.rank,
              lockedSuit: lockToCard.suit
            }
          };
        }
      }
      return card;
    });

    const newTargetCards = [...targetPile.cards, ...lockedMovingCards];
    const newPiles = { ...gameState.piles, [sourcePileId]: { ...sourcePile, cards: newSourceCards }, [finalTargetPileId]: { ...targetPile, cards: newTargetCards } };

    let scoreDelta = 0;
    const card = lockedMovingCards[0];
    const scoredTableau = gameState.effectState?.scoredTableau || [];
    const scoredFoundation = gameState.effectState?.scoredFoundation || [];
    
    if (targetPile.type === 'tableau' && !scoredTableau.includes(card.id)) { 
      scoreDelta += card.rank;
      scoredTableau.push(card.id);
    }
    else if (targetPile.type === 'foundation' && !scoredFoundation.includes(card.id)) { 
      scoreDelta += card.rank * 2;
      scoredFoundation.push(card.id);
    }

    const baseScore = scoreDelta;
    effects.forEach(eff => {
       if (eff.calculateScore) scoreDelta = eff.calculateScore(scoreDelta, context, gameState);
    });
    const multiplier = baseScore > 0 ? Math.round(scoreDelta / baseScore) : 1;

    let coinDelta = 0;
    effects.forEach(eff => {
        if (eff.calculateCoinTransaction) coinDelta = eff.calculateCoinTransaction(coinDelta, context, gameState);
    });

    let minigameTrigger = null;
    let nextState = { ...gameState, piles: newPiles, moves: gameState.moves + 1, score: gameState.score + scoreDelta, coins: gameState.coins + coinDelta, effectState: { ...gameState.effectState, scoredTableau, scoredFoundation } };
    
    effects.forEach(eff => {
       if (eff.onMoveComplete) {
          const prevState = { ...nextState };
          const result = eff.onMoveComplete(nextState, { source: sourcePileId, target: finalTargetPileId, cards: lockedMovingCards });
          if (result.triggerMinigame) minigameTrigger = result.triggerMinigame;
          nextState = { ...nextState, ...result };

          // Show banner when effect triggers something significant
          const coinChange = (result.coins || nextState.coins) - prevState.coins;
          const scoreChange = (result.score || nextState.score) - prevState.score;

          if (coinChange > 0 && coinChange >= 20) {
             spawnBanner(`+${coinChange} COINS`, 'fa-coins', eff.id);
          } else if (scoreChange > 0 && scoreChange >= 50) {
             spawnBanner(`+${scoreChange} POINTS`, 'fa-star', eff.id);
          } else if (result.triggerMinigame) {
             spawnBanner(`${eff.name.toUpperCase()} ACTIVATED!`, 'fa-gamepad', eff.id);
          }
       }
    });

    if (minigameTrigger) {
       nextState.activeMinigame = { type: minigameTrigger, title: minigameTrigger.toUpperCase() };
    }

    setGameState(nextState);

    // Trigger card movement animation
    const animClass = sourcePileId === 'hand' ? 'anim-hand-to-pile' :
                      targetPile.type === 'foundation' ? 'anim-to-foundation' :
                      'anim-move-stack';
    triggerCardAnimation(lockedMovingCards.map(c => c.id), animClass);

    // Show floating score/coin indicators
    if (scoreDelta > 0 || coinDelta > 0 || multiplier > 1) {
      const targetEl = document.querySelector(`[data-pile-id="${finalTargetPileId}"]`);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        if (scoreDelta > 0) {
          spawnFloating(`+${scoreDelta}`, centerX, centerY, 'text-blue-400');
        }
        if (coinDelta > 0) {
          spawnFloating(`🪙+${coinDelta}`, centerX, centerY + 20, 'text-amber-400');
        }
        if (multiplier > 1) {
          spawnFloating(`×${multiplier}`, centerX, centerY - 25, 'text-purple-400 text-2xl', true);
        }
      }
    }

    // Check for foundation completion and show banner
    if (targetPile.type === 'foundation' && newTargetCards.length === 13) {
      spawnBanner('FOUNDATION COMPLETE', 'fa-crown');
    }

    // Multiplier banner removed - now using floating text only for all multipliers

    // Check for newly activated effects
    const newActives = nextState.activeItemIds?.filter(id => !gameState.activeItemIds?.includes(id)) || [];
    if (newActives.length > 0) {
      const newEffect = effectsRegistry.find(e => e.id === newActives[0]);
      if (newEffect) {
        spawnBanner(newEffect.name.toUpperCase(), newEffect.type === 'curse' ? 'fa-skull' : 'fa-bolt');
      }
    }

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
           type: 'curse',
           name: effectDef?.name || `Level ${gameState.runIndex + 1}`,
           passed: true
        };
        setRunStartData(prev => prev ? { ...prev, encounterLog: [...prev.encounterLog, encounterRecord] } : null);
     }
     
     const reward = currentEncounter.type === 'curse' ? 75 : 0;
     setGameState(prev => ({ ...prev, coins: prev.coins + reward, score: 0 }));
     
     // Deactivate all curses at the end of an encounter
     setActiveEffects(prev => prev.filter(id => {
        const e = effectsRegistry.find(x => x.id === id);
        return e?.type !== 'curse';
     }));
     
     // Always open shop after encounter completion
     openShop(true);
  };
  
   const openShop = (lock: boolean = false) => {
       const owned = gameState.ownedEffects || [];
       const exploits = effectsRegistry.filter(e => e.type === 'exploit' && !owned.includes(e.id)).sort(() => 0.5 - Math.random()).slice(0, 4);

       // Always show shop (use placeholder items if empty)
       let shopItems = [...exploits];
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
         if (!effect) return prev;
         
         // Check curse limit
         if (effect.type === 'curse') {
            const activeCurses = prev.filter(eid => {
               const e = effectsRegistry.find(ef => ef.id === eid);
               return e?.type === 'curse';
            });
            const isEncounter10 = gameState.runIndex === 9;
            const maxCurses = isEncounter10 ? 3 : 1;
            if (activeCurses.length >= maxCurses) return prev;
         }
         
         if (effect.onActivate) {
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

  // Determine whether an effect is currently activatable given the game state.
  // This is a lightweight guard used by the UI to gray-out unavailable effects.
  const isEffectReady = (id: string, state: GameState): boolean => {
     const eff = effectsRegistry.find(e => e.id === id);
     if (!eff) return false;
     // If effect has a coin cost, ensure player can afford it
     if (typeof eff.cost === 'number' && (state.coins ?? 0) < eff.cost) return false;
     // If effect uses charges, require at least one charge available
     if (typeof eff.maxCharges === 'number') {
        const c = state.charges?.[id];
        if (c === undefined || c <= 0) return false;
     }
     return true;
  };

  const convertScoreToCoin = () => {
    if (!activeEffects.includes('whore')) return;
    if (gameState.score < 5) return; // Need at least 5 score
    const converted = Math.floor(gameState.score / 5);
    setGameState(prev => ({
      ...prev,
      score: prev.score - converted * 5,
      coins: prev.coins + converted
    }));
  };

  const convertCoinToScore = () => {
    if (!activeEffects.includes('whore')) return;
    if (gameState.coins < 1) return; // Need at least 1 coin
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - 1,
      score: prev.score + 4
    }));
  };

  // Metrocard - buy a key for 25% of coins
  const buyKeyWithTaxLoophole = () => {
    if (!activeEffects.includes('metrocard')) return;
    if (gameState.coins <= 0) return;
    const cost = Math.floor(gameState.coins * 0.25);
    const hand = gameState.piles['hand'];
    const key: Card = {
      id: `key-${Date.now()}`,
      suit: 'special',
      rank: 0 as Rank,
      faceUp: true,
      meta: { isKey: true, universal: true }
    };
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - cost,
      piles: { ...prev.piles, hand: { ...hand, cards: [...hand.cards, key] } }
    }));
  };

  // Switcheroo - undo last 3 plays for 20% coin
  const undoWithSwitcheroo = () => {
    if (!activeEffects.includes('switcheroo')) return;
    const cost = Math.floor(gameState.coins * 0.2);
    if (gameState.coins < cost) return;
    const snapshots = gameState.effectState?.lastSnapshots || [];
    if (snapshots.length < 3) return;
    const snapshot = snapshots[snapshots.length - 3];
    setGameState(prev => ({ ...snapshot, coins: prev.coins - cost }));
  };

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
        const wild: Card = { id: `momentum-wild-${Math.random()}`, rank: 0 as Rank, suit: 'special', faceUp: true, meta: { isWild: true } };
        setGameState(prev => ({
           ...prev,
           piles: { ...prev.piles, hand: { ...prev.piles.hand, cards: [...prev.piles.hand.cards, wild] } },
           effectState: { ...prev.effectState, momentum: current - 3 }
        }));
     } else if (type === 'unlock' && current >= 5) {
        // Unlock random locked tableau
        const locked = (Object.values(gameState.piles) as any[]).filter(p => p.type === 'tableau' && p.locked);
        if (locked.length > 0) {
           const target = locked[Math.floor(Math.random() * locked.length)];
           setGameState(prev => ({
              ...prev,
              piles: { ...prev.piles, [target.id]: { ...(target as any), locked: false } },
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
               : 'ring-rose-400'
      : '';
    const color = getCardColor(visualCard.suit);
    
    
    let handStyle = {};
    // Hand cards stick to top of bottom bar, raise when selected
    if (pileId === 'hand') {
       const xOffset = (index - (totalCards - 1) / 2) * 52;
       handStyle = {
           position: 'absolute',
           bottom: isSelected ? '0px' : '-32px',
           left: '50%',
           marginLeft: `${xOffset}px`,
           transform: 'translateY(0)',
           zIndex: 50 + index,
           transition: 'bottom 0.2s ease'
       };
    }
    
    if (!visualCard.faceUp) {
       return (
          <button
             key={`${card.id}-${pileId}-${index}`}
             className="absolute w-[50px] h-[73px] rounded border border-slate-700 shadow-md overflow-hidden"
             style={{ top: `${pileId.includes('tableau') ? index * 18 : 0}px` }}
             onClick={(e) => { e.stopPropagation(); handleCardClick(pileId, index); }}
             onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(pileId, index); }}
             aria-label={`Face down card ${card.id}`}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDoubleClick(pileId, index); } }}
          >
             <img src={`/icons/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
          </button>
       );
    }
    // Special rendering for keys - just the icon, no card face
    if (visualCard.meta?.isKey && visualCard.faceUp) {
      const charges = visualCard.meta?.charges;
      const isTricksterKey = visualCard.meta?.isTricksterKey;
      return (
         <button
            key={`${card.id}-${pileId}-${index}`}
            type="button"
            className={`absolute w-[50px] h-[73px] bg-transparent select-none flex items-center justify-center ${isSelected ? 'ring-4 ring-yellow-400' : ''} relative`}
            style={pileId === 'hand' ? handStyle : { top: `${pileId.includes('tableau') ? index * 12 : 0}px`, zIndex: index }}
            onClick={(e) => { e.stopPropagation(); handleCardClick(pileId, index); }}
            aria-label={isTricksterKey ? `Trickster Key (${charges} charges)` : "Key - Click to select, then click locked tableau to unlock"}
         >
            <img src="/icons/key.png" alt="Key" className="w-8 h-8 drop-shadow-lg" />
            {isTricksterKey && charges !== undefined && (
              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[14px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-400">
                {charges}
              </span>
            )}
         </button>
      );
    }

      // For classic games, don't apply positioning here (handled by parent container)
      const isClassicGame = CLASSIC_GAMES[selectedMode];
      const cardStyle = pileId === 'hand' ? handStyle :
                                 isClassicGame ? { zIndex: index } :
                                 { top: `${pileId.includes('tableau') ? index * 18 : 0}px`, zIndex: index };

      // Improved animation class logic
      const cardAnimClass = animatingCards.get(card.id)
         ? `animated-card ${animatingCards.get(card.id)}`
         : '';

      return (
             <button
                  key={`${card.id}-${pileId}-${index}`}
                  type="button"
                  className={`${isClassicGame ? 'relative' : 'absolute'} w-[50px] h-[73px] bg-transparent perspective-1000 select-none transition-transform hover:scale-105 hover:brightness-110 cursor-pointer ${cardAnimClass}`}
                  style={cardStyle}
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
                         <div className="relative h-full w-full rounded overflow-hidden">
                               <img src="/icons/charlatan.png" alt="Wild" className="absolute inset-0 w-full h-full object-cover" />
                               {visualCard.meta?.lockedRank && visualCard.meta?.lockedSuit && (
                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                   <div className="text-center">
                                     <div className={`text-xl font-bold ${visualCard.meta.lockedSuit === 'hearts' || visualCard.meta.lockedSuit === 'diamonds' ? 'text-red-500' : 'text-white'}`}>
                                       {getRankDisplay(visualCard.meta.lockedRank)}
                                     </div>
                                     <div className={`text-2xl ${visualCard.meta.lockedSuit === 'hearts' || visualCard.meta.lockedSuit === 'diamonds' ? 'text-red-500' : 'text-white'}`}>
                                       {visualCard.meta.lockedSuit === 'hearts' ? '♥' : visualCard.meta.lockedSuit === 'diamonds' ? '♦' : visualCard.meta.lockedSuit === 'clubs' ? '♣' : '♠'}
                                     </div>
                                   </div>
                                 </div>
                               )}
                         </div>
                   ) : (
                         <>
                              <div className={`w-full flex justify-between font-bold text-[14px] leading-none ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                              {visualCard.meta?.hideSuitIcon ? (
                               <div className={`text-lg md:text-4xl ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>?</div>
                            ) : (
                               <div className={`text-lg md:text-4xl ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{visualCard.suit === 'hearts' ? '♥' : visualCard.suit === 'diamonds' ? '♦' : visualCard.suit === 'clubs' ? '♣' : '♠'}</div>
                            )}
                              <div className={`w-full flex justify-between font-bold text-[14px] leading-none rotate-180 ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                         </>
                   )}
                   {visualCard.meta?.showLock && <div className="absolute top-0 right-0 text-red-500"><Lock size={10} /></div>}
                   {visualCard.meta?.showKey && <div className="absolute top-0 left-0 text-yellow-500"><Key size={10} /></div>}
                   {visualCard.meta?.showWild && <div className="absolute top-0 left-0 text-fuchsia-500"><Smile size={10} /></div>}
                   {visualCard.meta?.showFake && <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><Skull size={24} className="text-red-900" /></div>}
               </div>
               <div className="absolute inset-0 backface-hidden rotate-y-180 rounded border border-slate-700 shadow-md overflow-hidden">
                   <img src={`/icons/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
               </div>
                  </div>
             </button>
      );
  };
  
  // ... (Rest of Component - Render Logic - Identical) ...
  // ...
   // Render a hand card for the compact HUD (inline, not absolutely positioned)
   const renderHandCardHUD = (card: Card, index: number) => {
      let visualCard = { ...card };
      const pile = gameState.piles['hand'];
      const effects = getEffects();
      for (const eff of effects) {
          if (eff.transformCardVisual) {
               visualCard = { ...visualCard, ...eff.transformCardVisual(card, pile) };
          }
      }

      const isSelected = gameState.selectedCardIds?.includes(card.id);
      const isHintTarget = hintTargets.includes('hand') && index === (pile?.cards?.length || 0) - 1;
      const ringColor = isSelected || isHintTarget
         ? selectionColor === 'green'
             ? 'ring-emerald-400'
             : selectionColor === 'yellow'
                  ? 'ring-amber-300'
                  : selectionColor === 'red'
                      ? 'ring-rose-400'
                      : 'ring-rose-400'
         : '';

      const cardAnimClass = animatingCards.get(card.id)
         ? `animated-card ${animatingCards.get(card.id)}`
         : '';

      // Face-down HUD representation
      if (!visualCard.faceUp) {
          return (
               <button
                   key={`${card.id}-hand-hud-${index}`}
                   className="w-[50px] h-[73px] rounded border border-slate-700 shadow-md overflow-hidden bg-transparent"
                   onClick={(e) => { e.stopPropagation(); handleCardClick('hand', index); }}
                   onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick('hand', index); }}
                   aria-label={`Face down card ${index + 1}`}>
                   <img src={`/icons/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
               </button>
          );
      }

      // Key special-case (smaller round icon)
      if (visualCard.meta?.isKey && visualCard.faceUp) {
         const charges = visualCard.meta?.charges;
         const isTricksterKey = visualCard.meta?.isTricksterKey;
         return (
             <button
                  key={`${card.id}-hand-key-${index}`}
                  type="button"
                  className={`w-[50px] h-[73px] bg-transparent select-none flex items-center justify-center ${isSelected ? 'ring-4 ring-yellow-400' : ''} relative`}
                  onClick={(e) => { e.stopPropagation(); handleCardClick('hand', index); }}
                  onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick('hand', index); }}
                  aria-label={isTricksterKey ? `Trickster Key (${charges} charges)` : "Key - Click to select"}
             >
                  <img src="/icons/key.png" alt="Key" className="w-8 h-8 drop-shadow-lg" />
                  {isTricksterKey && charges !== undefined && (
                     <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[14px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-400">
                        {charges}
                     </span>
                  )}
             </button>
         );
      }

      const color = getCardColor(visualCard.suit);

      return (
         <button
               key={`${card.id}-hand-${index}`}
               type="button"
               className={`w-[50px] h-[73px] bg-transparent perspective-1000 select-none transition-transform hover:scale-105 hover:brightness-110 cursor-pointer ${cardAnimClass}`}
               onClick={(e) => { e.stopPropagation(); handleCardClick('hand', index); }}
               onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick('hand', index); }}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDoubleClick('hand', index); } }}
               aria-label={`${getRankDisplay(visualCard.rank)} ${visualCard.suit} card`}
         >
            <div className={`relative w-full h-full transform-style-3d ${settings.cardAnimations ? 'duration-500 transition-transform' : ''} ${visualCard.faceUp ? 'rotate-y-0' : 'rotate-y-180'}`}>
               <div className={`absolute inset-0 backface-hidden bg-white rounded shadow-md flex flex-col items-center justify-between p-0.5 border border-gray-300 ${ringColor ? `ring-2 ${ringColor}` : ''}`} style={{ opacity: visualCard.meta?.disabled ? 0.5 : 1, filter: visualCard.meta?.hiddenDimension ? 'grayscale(100%) blur(2px)' : 'none' }}>
                  {visualCard.meta?.isBlessing ? (
                           <div className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-b from-purple-100 to-purple-200 rounded">
                                    <ResponsiveIcon name={visualCard.meta.effectId || visualCard.meta.name || ''} fallbackType="blessing" size={24} className="mb-0.5" />
                                    <div className="text-[8px] font-bold leading-tight text-purple-800 px-0.5">{visualCard.meta.name}</div>
                           </div>
                  ) : visualCard.meta?.isWild ? (
                           <div className="relative h-full w-full rounded overflow-hidden">
                                    <img src="/icons/charlatan.png" alt="Wild" className="absolute inset-0 w-full h-full object-cover" />
                                    {visualCard.meta?.lockedRank && visualCard.meta?.lockedSuit && (
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <div className="text-center">
                                          <div className={`text-2xl md:text-3xl font-bold ${visualCard.meta.lockedSuit === 'hearts' || visualCard.meta.lockedSuit === 'diamonds' ? 'text-red-500' : 'text-white'}`}>
                                            {getRankDisplay(visualCard.meta.lockedRank)}
                                          </div>
                                          <div className={`text-3xl md:text-5xl ${visualCard.meta.lockedSuit === 'hearts' || visualCard.meta.lockedSuit === 'diamonds' ? 'text-red-500' : 'text-white'}`}>
                                            {visualCard.meta.lockedSuit === 'hearts' ? '♥' : visualCard.meta.lockedSuit === 'diamonds' ? '♦' : visualCard.meta.lockedSuit === 'clubs' ? '♣' : '♠'}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                           </div>
                  ) : (
                           <>
                                  <div className={`w-full flex justify-between font-bold text-[14px] leading-none ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                                  <div className={`text-lg md:text-4xl ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{visualCard.suit === 'hearts' ? '♥' : visualCard.suit === 'diamonds' ? '♦' : visualCard.suit === 'clubs' ? '♣' : '♠'}</div>
                                  <div className={`w-full flex justify-between font-bold text-[14px] leading-none rotate-180 ${color === 'red' ? 'text-red-600' : 'text-slate-800'}`}><span>{getRankDisplay(visualCard.rank)}</span></div>
                           </>
                  )}
                  {visualCard.meta?.showLock && <div className="absolute top-0 right-0 text-red-500"><Lock size={10} /></div>}
                  {visualCard.meta?.showKey && <div className="absolute top-0 left-0 text-yellow-500"><Key size={10} /></div>}
                  {visualCard.meta?.showWild && <div className="absolute top-0 left-0 text-fuchsia-500"><Smile size={10} /></div>}
                  {visualCard.meta?.showFake && <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><Skull size={24} className="text-red-900" /></div>}
               </div>
               <div className="absolute inset-0 backface-hidden rotate-y-180 rounded border border-slate-700 shadow-md overflow-hidden">
                     <img src={`/icons/${settings.cardBack}.png`} alt="Card back" className="w-full h-full object-cover" />
               </div>
            </div>
         </button>
      );
   };
   const foundationPiles = (Object.values(gameState.piles) as Pile[]).filter(p => p.type === 'foundation').sort((a, b) => a.id.localeCompare(b.id));
   const tableauPiles = (Object.values(gameState.piles) as Pile[]).filter(p => p.type === 'tableau').sort((a, b) => {
      // Sort tableau piles: regular tableau (0-6) first, then babel piles (0-3)
      const aNum = Number.parseInt(a.id.split('-')[1] as string, 10);
      const bNum = Number.parseInt(b.id.split('-')[1] as string, 10);
      const aIsBabel = a.id.startsWith('babel');
      const bIsBabel = b.id.startsWith('babel');
      if (aIsBabel && !bIsBabel) return 1; // babel comes after tableau
      if (!aIsBabel && bIsBabel) return -1; // tableau comes before babel
      return aNum - bNum; // same type, sort by number
   });

   // Calculate dynamic zoom based on actual tableau count and foundation count
   const tableauCount = tableauPiles.length;
   const visibleTableauCount = tableauPiles.filter(p => !p.hidden).length;
   const foundationCount = foundationPiles.length + (gameState.piles['shadow-realm'] ? 1 : 0);

   // Improved zoom logic for classic/coronata modes
   let zoomScale = 1;
   if (CLASSIC_GAMES[selectedMode]) {
      // Classic mode: fit tableaus with 2px gaps and 2px margins
      const cardWidth = 50;
      const gap = 2;
      const margin = 2;
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
      const requiredWidth = (tableauCount * cardWidth) + ((tableauCount - 1) * gap) + (margin * 2);
      zoomScale = Math.min(1, (screenWidth - 4) / requiredWidth);
   } else {
      // Coronata mode: maintain consistent spacing, zoom out for extra tableaus
      const BASE_TABLEAU_COUNT = 7;
      const cardWidth = 50;
      const gap = 2;
      const margin = 2;
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;

      // Use base count for width calculation to maintain consistent spacing
      const baseRequiredWidth = (Math.max(BASE_TABLEAU_COUNT, foundationCount) * cardWidth) + ((Math.max(BASE_TABLEAU_COUNT, foundationCount) - 1) * gap) + (margin * 2);

      // Apply base responsive zoom
      let baseZoom = Math.min(1, (screenWidth - 4) / baseRequiredWidth);

      // Apply additional zoom if tableau count exceeds base
      const tableauZoom = tableauCount > BASE_TABLEAU_COUNT ? BASE_TABLEAU_COUNT / tableauCount : 1;

      zoomScale = baseZoom * tableauZoom;
   }
   const maxWidth = 'auto';

  const currentEncounter = runPlan[gameState.runIndex];
  const currentThreat = effectsRegistry.find(e => e.id === currentEncounter?.effectId);

  if (currentView === 'home') {
     // Game modes data
     const gameModes = [
        { id: 'coronata', name: 'Coronata', desc: 'A rogue-like experience. 10 games to win.', unlocked: true, hasStars: true },
        { id: 'klondike', name: 'Klondike (Draw 1)', desc: 'Classic solitaire: draw 1 card.', unlocked: true, hasStars: false },
        { id: 'klondike3', name: 'Klondike (Draw 3)', desc: 'Classic solitaire: draw 3 cards.', unlocked: true, hasStars: false },
        { id: 'spider1', name: 'Spider (1 Suit)', desc: 'Build sequences of the same suit. 1 suit variant.', unlocked: true, hasStars: false },
        { id: 'spider2', name: 'Spider (2 Suits)', desc: 'Build sequences of the same suit. 2 suit variants.', unlocked: true, hasStars: false },
        { id: 'spider4', name: 'Spider (4 Suits)', desc: 'Build sequences of the same suit. 4 suit variants.', unlocked: true, hasStars: false },
        { id: 'freecell', name: 'FreeCell', desc: 'Strategic solitaire with free cells for temporary storage.', unlocked: true, hasStars: false },
        { id: 'seahaven', name: 'Seahaven Towers', desc: '10 Tableau columns, 4 Free Cells. Tableaus build down in same suit.', unlocked: true, hasStars: false },
        { id: 'yukon', name: 'Yukon', desc: 'You can move any face-up card, regardless of what is on top of it.', unlocked: true, hasStars: false },
        { id: 'russian', name: 'Russian Solitaire', desc: 'Groups of cards can be moved regardless of sequence. Tableaus build down in same suit.', unlocked: true, hasStars: false },
        { id: 'scorpion', name: 'Scorpion', desc: 'You can move any face-up card, along with any cards on top of it.', unlocked: true, hasStars: false },
        { id: 'wasp', name: 'Wasp', desc: 'All cards are dealt face-up. You can move any card (and cards on top of it).', unlocked: true, hasStars: false },
        { id: 'golf', name: 'Golf', desc: 'Move all cards from the tableaus to the waste pile.', unlocked: true, hasStars: false },
        { id: 'pyramid', name: 'Pyramid', desc: 'Clear the pyramid by removing pairs of cards that sum to 13.', unlocked: true, hasStars: false },
        { id: 'tripeaks', name: 'TriPeaks', desc: 'Move all cards from the peaks to the waste pile.', unlocked: true, hasStars: false },
        { id: 'fortythieves', name: 'Forty Thieves', desc: 'Move one card at a time. Tableaus build down in same suit.', unlocked: true, hasStars: false },
        { id: 'bakers', name: 'Baker\'s Dozen', desc: 'Kings are moved to the bottom of their piles during the deal.', unlocked: true, hasStars: false },
        { id: 'easthaven', name: 'EastHaven', desc: 'Tableaus build down alternating color. Clicking stock deals 1 card to all 7 tableaus.', unlocked: true, hasStars: false },
        { id: 'canfield', name: 'Canfield', desc: 'Foundations start with a random rank. Tableaus build down alternating color.', unlocked: true, hasStars: false },
        { id: 'castle', name: 'Beleaguered Castle', desc: 'Aces are removed to foundations at start. Only one card can be moved at a time.', unlocked: true, hasStars: false },
        { id: 'bus', name: 'Bus Driver', desc: '1 deck. All cards dealt face up to 10 piles. Move one card at a time.', unlocked: true, hasStars: false },
        { id: 'clock', name: 'Clock Solitaire', desc: 'Foundations are arranged in a clock. Each foundation builds up to the correct number.', unlocked: true, hasStars: false },
        { id: 'calculation', name: 'Calculation', desc: 'Foundations built in specific intervals.', unlocked: true, hasStars: false },
        { id: 'aces_up', name: 'Aces Up', desc: 'Remove all cards except the 4 Aces.', unlocked: true, hasStars: false },
        { id: 'labelle', name: 'La Belle Lucie', desc: '18 fans of 3 cards. Foundations build up in suit.', unlocked: true, hasStars: false },
        { id: 'cruel', name: 'Cruel', desc: 'Aces start in foundations. Tableaus build down in suit.', unlocked: true, hasStars: false },
     ];

     // How to play pages
     const howToPages = [
        { title: 'Goal', content: 'Score points by moving cards to the Foundation piles. Build up from Ace to Queen, same suit. Reach the target score to clear each encounter!' },
        { title: 'Moving Cards', content: 'Tap a card to select it, then tap a valid destination. In tableau, stack cards in descending order, alternating colors (red on black, black on red).' },
        { title: 'The Deck', content: 'Tap the deck to draw cards. You can move the top card of the draw pile to tableau or foundation piles.' },
        { title: 'Encounters', content: 'Each run has 10 encounters. All encounters are Curses that apply negative effects. Completing a curse lets you pick a blessing.' },
        { title: 'Effects', content: 'Exploits help you. Curses hurt you. Blessings are powerful cards added to your deck. Collect them from the shop and wanders!' },
        { title: 'The Shop', content: 'After Fear encounters, visit the Trade. Spend coins on Exploits or take Curses for bonus coins. Choose wisely!' },
        { title: 'Wanders', content: 'Between encounters, you\'ll face random events. Make choices that can reward you with coins, effects, or... consequences.' },
        { title: 'Winning', content: 'Beat all 10 encounters to complete a run. Your final score depends on coins, effects collected, and time taken. Good luck!' },
     ];

     // Updates/changelog data
     const updates = [
        { version: 'v0.4.0', date: 'Dec 18, 2025', changes: ['Added Modes & profile screen', 'Wired up Settings UI', 'Trimmed more effects (155 to 57)'] },
        { version: 'v0.3.0', date: 'Dec 11, 2025', changes: ['Decoupled UI', 'First stage of effect trimming', 'Logic & reporting tweaks'] },
        { version: 'v0.2.0', date: 'Dec 8, 2025', changes: ['Wander events system', 'Shop & trading', 'Blessing refinement', 'Run planning'] },
        { version: 'v0.1.0', date: 'Dec 1, 2025', changes: ['Initial prototype', 'Basic solitaire gameplay', 'Score system', 'Card rendering'] },
     ];

     return (
      <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-12 gap-8">
      <div className="text-center space-y-6">
         <img src="/icons/logo-48x72.png" alt="Coronata" className="w-20 h-auto mx-auto mb-2" />
         <h1 className="text-5xl font-black ">CORONATA</h1>

      </div>
      <div className="grid grid-cols-3 gap-8 w-full">
         <button onClick={() => setShowModes(true)} className="flex items-center justify-center"><Play fill="currentcolor" className="w-20 h-20"/></button>
         <button onClick={() => setShowHowTo(true)} className="flex items-center justify-center"><img src="/icons/howto.png" alt="How To" className="w-20 h-20" /></button>
         <button className="flex items-center justify-center" onClick={() => setShowGlossary(true)}><img src="/icons/glossary.png" alt="Glossary" className="w-20 h-20" /></button>
         <button onClick={() => setShowUpdates(true)} className="flex items-center justify-center"><RefreshCw size={65}/></button>
         <button onClick={() => setShowProfile(true)} className="flex items-center justify-center"><User size={65}/></button>
         <button onClick={() => setShowSettings(true)} className="flex items-center justify-center"><img src="/icons/settings.png" alt="Settings" className="w-20 h-20" /></button>
      </div>

           {/* MODES PANEL - Enhanced accordion style */}
           {showModes && (() => {
              const toggleMode = (id: string) => {
                 if (expandedModes.has(id)) {
                    // Collapse this mode
                    setExpandedModes(new Set());
                    setExpandedSections(prev => new Set(Array.from(prev).filter(s => !s.startsWith(`${id}-`))));
                 } else {
                    // Expand only this mode, collapse all others
                    setExpandedModes(new Set([id]));
                    setExpandedSections(new Set());
                 }
              };

              const toggleSection = (id: string) => {
                 const newExpanded = new Set(expandedSections);
                 if (newExpanded.has(id)) newExpanded.delete(id);
                 else newExpanded.add(id);
                 setExpandedSections(newExpanded);
              };

              const renderDifficulty = (id: string) => {
                 const difficulties: Record<string, number> = {
                    'coronata': 5,
                    'spider4': 5, 'fortythieves': 4, 'cruel': 4, 'scorpion': 4,
                    'spider2': 3, 'yukon': 3, 'russian': 3,
                    'klondike3': 2, 'freecell': 2, 'seahaven': 2,
                    'klondike': 1, 'spider1': 1
                 };
                 const stars = difficulties[id] || 2;
                 return '⭐'.repeat(stars);
              };

              return (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Select Game Mode</h2>
                    <button onClick={() => setShowModes(false)}><X /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2">
                    {gameModes.map(mode => {
                       const isExpanded = expandedModes.has(mode.id);
                       return (
                          <div key={mode.id} className="bg-slate-800/50 rounded-lg border border-slate-700">
                             <button
                                onClick={() => toggleMode(mode.id)}
                                className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors rounded-lg"
                             >
                                <div className="flex items-center gap-3 flex-1">
                                   <div className={`w-2 h-2 rounded-full ${selectedMode === mode.id ? 'bg-purple-500' : 'bg-transparent'}`} />
                                   <div className="flex-1 text-left">
                                      <div className="font-bold text-white flex items-center gap-2">
                                         {mode.name}
                                         {!mode.unlocked && <Lock size={12} className="text-slate-500" />}
                                      </div>
                                      <div className="text-xs text-slate-400">{renderDifficulty(mode.id)}</div>
                                   </div>
                                </div>
                                <div className="text-slate-400">{isExpanded ? '▼' : '▶'}</div>
                             </button>

                             {isExpanded && (
                                <div className="px-3 pb-3 space-y-2">
                                   <div className="border-l-2 border-purple-500/30 pl-3">
                                      <button
                                         onClick={() => toggleSection(`${mode.id}-objective`)}
                                         className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white py-1"
                                      >
                                         <span>Objective</span>
                                         <span className="text-xs text-slate-500">
                                            {expandedSections.has(`${mode.id}-objective`) ? '▼' : '▶'}
                                         </span>
                                      </button>
                                      {expandedSections.has(`${mode.id}-objective`) && (
                                         <div className="text-sm text-slate-400 mt-1 pl-2">{mode.desc}</div>
                                      )}
                                   </div>

                                   <div className="border-l-2 border-purple-500/30 pl-3">
                                      <button
                                         onClick={() => toggleSection(`${mode.id}-howto`)}
                                         className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white py-1"
                                      >
                                         <span>How to Play</span>
                                         <span className="text-xs text-slate-500">
                                            {expandedSections.has(`${mode.id}-howto`) ? '▼' : '▶'}
                                         </span>
                                      </button>
                                      {expandedSections.has(`${mode.id}-howto`) && (
                                         <div className="text-sm text-slate-400 mt-1 pl-2">
                                            {mode.id === 'coronata' ? (
                                               <div className="space-y-1">
                                                  <p>• Build DOWN on tableaus, alternating colors</p>
                                                  <p>• Build UP on foundations, same suit</p>
                                                  <p>• Queens are high (Q→K→J→10...)</p>
                                                  <p>• Score: tableaus (1x), foundations (2x)</p>
                                               </div>
                                            ) : mode.id.startsWith('klondike') ? (
                                               <div className="space-y-1">
                                                  <p>• Tableaus: DOWN, alternate colors</p>
                                                  <p>• Foundations: UP, same suit (A→K)</p>
                                                  <p>• Only Kings fill empty tableaus</p>
                                               </div>
                                            ) : mode.id.startsWith('spider') ? (
                                               <div className="space-y-1">
                                                  <p>• Build DOWN on tableaus (any suit)</p>
                                                  <p>• Complete K→A sequences to remove</p>
                                                  <p>• Stock deals 1 card to each tableau</p>
                                               </div>
                                            ) : mode.id === 'freecell' ? (
                                               <div className="space-y-1">
                                                  <p>• Tableaus: DOWN, alternate colors</p>
                                                  <p>• 4 free cells for temporary storage</p>
                                                  <p>• Foundations: UP, same suit</p>
                                               </div>
                                            ) : (<p>Standard solitaire rules apply</p>)}
                                         </div>
                                      )}
                                   </div>

                                   <button
                                      onClick={() => {
                                         setSelectedMode(mode.id);
                                         setShowModes(false);
                                         startRun(mode.id);
                                      }}
                                      disabled={!mode.unlocked}
                                      className={`w-full mt-2 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                                         'bg-emerald-600 hover:bg-emerald-500 text-white'
                                      } ${!mode.unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                   >
                                      PLAY
                                   </button>
                                </div>
                             )}
                          </div>
                       );
                    })}

                    <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-600 bg-slate-800/30">
                       <div className="text-center">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                             <RefreshCw size={18} className="text-slate-500" />
                          </div>
                          <div className="text-xs text-slate-500 mt-1">More coming soon!</div>
                       </div>
                    </div>
                 </div>
              </div>
              );
           })()}

           {/* PROFILE PANEL */}
           {showProfile && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Profile</h2>
                    <button onClick={() => setShowProfile(false)}><X /></button>
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
                          {tab === 'recaps' ? 'History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                       </button>
                    ))}
                 </div>

                 <div className="flex-1 overflow-y-auto">
                    {/* STATS TAB */}
                    {profileTab === 'stats' && (
                       <>
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
                                { emoji: '⚔️', name: 'Curse Breaker I', req: '25 curses completed', reward: 'Curse Breaker I', unlocked: false },
                                { emoji: '🗡️', name: 'Curse Breaker II', req: '50 curses completed', reward: 'Curse Breaker II', unlocked: false },
                                { emoji: '🔱', name: 'Curse Breaker III', req: '100 curses completed', reward: 'Curse Breaker III', unlocked: false },
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
                                            {feat.unlocked && <span className="text-[14px] bg-emerald-600 px-1.5 py-0.5 rounded">Unlocked</span>}
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
                                            <img src={categoryIcons.exploit} alt="" className="w-[18px] h-[18px]" />
                                            <span className="uppercase tracking-wider text-[14px]">Exploits</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.exploits.map((effectId, i) => (
                                               <ResponsiveIcon name={effectId} fallbackType="exploit" size={20} className="rounded" />
                                            ))}
                                         </div>
                                      </div>
                                      {/* Curses */}
                                      <div className="bg-slate-700/50 rounded-lg p-2">
                                         <div className="flex items-center gap-1 mb-1.5 text-slate-400">
                                            <img src={categoryIcons.curse} alt="" className="w-[18px] h-[18px]" />
                                            <span className="uppercase tracking-wider text-[14px]">Curses</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.curses.map((effectId, i) => (
                                               <ResponsiveIcon name={effectId} fallbackType="curse" size={20} className="rounded" />
                                            ))}
                                         </div>
                                      </div>
                                      {/* Blessings */}
                                      <div className="bg-slate-700/50 rounded-lg p-2">
                                         <div className="flex items-center gap-1 mb-1.5 text-slate-400">
                                            <img src={categoryIcons.blessing} alt="" className="w-[18px] h-[18px]" />
                                            <span className="uppercase tracking-wider text-[14px]">Blessings</span>
                                         </div>
                                         <div className="flex flex-wrap gap-1">
                                            {run.blessings.map((effectId, i) => (
                                               <ResponsiveIcon name={effectId} fallbackType="blessing" size={20} className="w-5 h-5 rounded" />
                                            ))}
                                         </div>
                                      </div>
                                   </div>

                                   {/* Encounter Progress Bar */}
                                   <div>
                                      <div className="flex items-center gap-1 mb-1.5 text-slate-400 text-[14px] uppercase tracking-wider">
                                         <MapIcon size={20} />
                                         <span>Curses ({run.encounters.filter(e => e.passed).length}/10)</span>
                                      </div>
                                      <div className="grid grid-cols-10 gap-1">
                                         {run.encounters.map((enc, i) => {
                                            let colorClass = 'bg-slate-600'; // grey for not completed
                                            if (enc.passed) {
                                               colorClass = 'bg-emerald-600'; // green for completed
                                            } else if (run.result === 'lost') {
                                               colorClass = 'bg-red-600'; // red for resigned/lost
                                            }
                                            return (
                                               <div
                                                  key={i}
                                                  className={`h-6 rounded-sm flex items-center justify-center ${colorClass}`}
                                                  title={`${enc.name}${enc.passed ? ' (Completed)' : run.result === 'lost' ? ' (Failed)' : ' (Not Reached)'}`}>
                                                  <img src={categoryIcons.curse} alt="" className="w-[18px] h-[18px] opacity-80" />
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
                                <div className="p-3 bg-slate-700/50 rounded-lg mb-2">
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

                                {/* Other Classic Modes - Simple toggle list */}
                                <div className="space-y-1">
                                   {[
                                      { id: 'seahaven', name: 'Seahaven Towers', desc: '10 columns, free cells' },
                                      { id: 'yukon', name: 'Yukon', desc: 'Move face-up cards freely' },
                                      { id: 'russian', name: 'Russian Solitaire', desc: 'Move groups regardless of sequence' },
                                      { id: 'scorpion', name: 'Scorpion', desc: 'Move cards with those on top' },
                                      { id: 'wasp', name: 'Wasp', desc: 'All cards face-up' },
                                      { id: 'golf', name: 'Golf', desc: 'Move cards to waste pile' },
                                      { id: 'pyramid', name: 'Pyramid', desc: 'Remove pairs summing to 13' },
                                      { id: 'tripeaks', name: 'TriPeaks', desc: 'Clear the three peaks' },
                                      { id: 'fortythieves', name: 'Forty Thieves', desc: 'One card at a time' },
                                      { id: 'bakers', name: 'Baker\'s Dozen', desc: 'Kings on bottom' },
                                      { id: 'easthaven', name: 'EastHaven', desc: 'Deal to all tableaus' },
                                      { id: 'canfield', name: 'Canfield', desc: 'Random starting rank' },
                                      { id: 'castle', name: 'Beleaguered Castle', desc: 'Aces start in foundations' },
                                      { id: 'bus', name: 'Bus Driver', desc: '10 piles, all face-up' },
                                      { id: 'clock', name: 'Clock Solitaire', desc: 'Build to clock numbers' },
                                      { id: 'calculation', name: 'Calculation', desc: 'Specific intervals' },
                                      { id: 'aces_up', name: 'Aces Up', desc: 'Remove all but Aces' },
                                      { id: 'labelle', name: 'La Belle Lucie', desc: '18 fans of 3' },
                                      { id: 'cruel', name: 'Cruel', desc: 'Aces start out' }
                                   ].map(mode => (
                                      <div key={mode.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                                         <div>
                                            <div className="font-medium text-xs">{mode.name}</div>
                                            <div className="text-[14px] text-slate-500">{mode.desc}</div>
                                         </div>
                                         <button onClick={() => setSettings(s => ({...s, [`${mode.id}Enabled`]: !s[`${mode.id}Enabled` as keyof typeof s]}))} className={`w-10 h-5 ${(settings as any)[`${mode.id}Enabled`] ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors shrink-0`}>
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${(settings as any)[`${mode.id}Enabled`] ? 'right-0.5' : 'left-0.5'}`}></div>
                                         </button>
                                      </div>
                                   ))}
                                   <div className="text-xs text-purple-400 mt-2">🚧 Coming soon!</div>
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
                                         <img src={`/icons/${back.id}.png`} alt={back.name} className="w-full h-full object-cover" />
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
                                   <option value="Latin">Latin</option>
                                   <option value="pirate">Pirate</option>
                                   <option value="bird">Bird</option>
                                   <option value="pirate">Pirate</option>
                                   <option value="chooseforme">Choose for me</option>
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
                                <div className="font-medium text-sm mb-1">Feeling Lucky?</div>
                                <div className="flex gap-2">
                                   <input
                                      type="text"
                                      value={settings.cheatCode}
                                      onChange={(e) => setSettings(s => ({...s, cheatCode: e.target.value}))}
                                      placeholder=""
                                      className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm"
                                   />
                                   <button
                                      onClick={() => {
                                         const code = settings.cheatCode.toLowerCase().trim();
                                         setCheatResponse("Nice try, but that's not a real cheat code.");
                                         setSettings(s => ({...s, cheatCode: ''}));
                                      }}
                                      className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-sm font-bold"
                                   >
                                      Try
                                   </button>
                                </div>
                                {cheatResponse && (
                                   <div className="text-xs text-purple-400 mt-2 italic">{cheatResponse}</div>
                                )}
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
                                <span className="text-slate-500"></span>
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

                                }}
                                className="w-full p-3 bg-slate-700/50 rounded-lg text-left hover:bg-slate-700 flex justify-between items-center">
                                <span className="text-sm">Call Your Parents</span>
                                <span className="text-slate-500"></span>
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
                                <div className="font-bold text-lg">Coronata</div>
                             </div>
                             <div className="text-xs text-slate-400 text-center">
                                A rogue-like game based on Klondike & inspired by Balatro.
                             </div>
<div className="flex gap-2">                             
                                <button className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">
                                   Discord
                                </button>
                                <button className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">
                                   Website
                                </button>
<button onClick={() => setShowCredits(true)}
                                className="flex-1 p-2 bg-slate-700/50 rounded-lg text-center hover:bg-slate-700 text-xs">Credits</button>

                             </div>
                             <div className="text-[14px] text-slate-500 text-center pt-2">
                                Made with obsession and questionable life choices.
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
                             <div className="text-4xl mb-2"></div>
                             <div className="font-bold text-xl">Coronata</div>
                             <div className="text-xs text-slate-400">Pre-release</div>
                          </div>
                          <div className="space-y-4 text-sm">
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Design & Development</div>
                                <div className="text-slate-300">Me</div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Art Direction</div>
                                <div className="text-slate-300">Just me<div className="text-slate-500 text-xs">Send help</div></div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Music & Sound</div>
                                <div className="text-slate-300">Just me<div className="text-slate-500 text-xs">Send help</div></div>
                             </div>
                             <div>
                                <div className="text-purple-400 font-bold text-xs uppercase mb-1">Special Thanks</div>
                                <div className="text-slate-300">Anyone who's never heard of a rogue-like.</div>
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
                       {(['blessings', 'exploits', 'curses', 'patterns'] as const).map(cat => (
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
                          {glossaryTab === 'patterns' ? (
                                  <div className="overflow-y-auto max-h-96 space-y-2">
                                     {PATTERN_DEFINITIONS.map(p => {
                                       // Use exploit style for patterns
                                       const rarityColors = getRarityColor(p.rarity);
                                       return (
                                         <div key={p.id} className={`p-3 rounded border ${rarityColors?.bg || 'bg-slate-800'} ${rarityColors?.border || 'border-slate-700'} flex gap-3`}>
                                           <ResponsiveIcon name={p.id || p.name} fallbackType="exploit" size={40} className="w-10 h-10 rounded shrink-0" alt={p.name} />
                                           <div className="flex-1 min-w-0">
                                             <div className="flex justify-between items-start gap-2">
                                               <div className="font-bold text-white truncate">{p.name}</div>
                                               <div className={`text-[14px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${rarityColors?.text || ''} ${rarityColors?.bg || ''} border ${rarityColors?.border || ''}`}>{p.rarity || 'Common'}</div>
                                             </div>
                                             <div className="text-slate-300 text-sm mt-1">{p.description}</div>
                                           </div>
                                         </div>
                                       );
                                     })}
                                  </div>
                    ) : effectsRegistry.length === 0 ? (
                       <div className="text-center text-slate-500 py-8">No effects loaded</div>
                    ) : effectsRegistry.filter(e => {
                       if (glossaryTab === 'blessings') return e.type === 'blessing';
                       if (glossaryTab === 'exploits') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
                       if (glossaryTab === 'curses') return e.type === 'curse';
                       return false;
                    }).map(e => {
                       const rarityColors = getRarityColor(e.rarity);
                       const effectType = e.type === 'blessing' ? 'blessing' : e.type === 'curse' ? 'curse' : 'exploit';
                       return (
                       <div key={e.id} className={`p-3 rounded border ${rarityColors.bg} ${rarityColors.border} flex gap-3`}>
                          <ResponsiveIcon name={e.id || e.name} fallbackType={effectType} size={40} className="w-10 h-10 rounded shrink-0" alt={e.name} />
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start gap-2">
                               <div className="font-bold text-white truncate">{e.name}</div>
                               <div className={`text-[14px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} ${rarityColors.bg} border ${rarityColors.border}`}>{e.rarity || 'Common'}</div>
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
                       <button key={opt.id} type="button" onClick={() => chooseWanderOption(opt)} aria-label={`Wander option: ${opt.label}`} className="bg-slate-800/80 border border-slate-600 hover:border-purple-400 p-6 rounded-xl transition-all hover:scale-[1.02] shadow-xl text-left group">
                          <h3 className="text-xl font-bold mb-2">{opt.label}</h3>
                          <p className="text-slate-400 text-sm hidden group-hover:block">{opt.description}</p>
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
      
      {/* Classic Mode Top Bar - REMOVED, using bottom bar only */}
      {false && CLASSIC_GAMES[selectedMode] && currentView === 'game' && (
        <div className="fixed top-0 left-0 right-0 h-[60px] px-3 md:px-6 backdrop-blur-md z-30 border-b-2 border-white/20 shadow-lg bg-slate-900/95">
          <div className="flex flex-row justify-between items-center h-full w-full">
            {/* Left Section */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <button onClick={() => setActiveDrawer('pause')} className="p-2 bg-white/10 hover:bg-white/25 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95" title="Menu">
                <Menu size={18} />
              </button>
              
              <div className="hidden sm:flex items-center gap-1.5 text-sm font-mono bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/20">
                <Clock size={16} />
                <span className="font-bold">{formatTime(elapsedTime)}</span>
              </div>
              
              <div className="hidden sm:flex items-center gap-1.5 text-sm font-mono bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/20">
                <Play size={16} />
                <span className="font-bold">{gameState.moves}</span>
              </div>
            </div>
            
            {/* Center Section - Score */}
            <div className="flex-shrink-0">
              <div className="bg-black/50 px-4 md:px-6 py-2 rounded-xl text-base font-bold border-2 border-white/30 shadow-lg backdrop-blur-sm">
                <span className="text-yellow-300">Score: {gameState.score}</span>
              </div>
            </div>
            
            {/* Right Section */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => {
                  if (gameState.history.length > 0) {
                    const prev = gameState.history[gameState.history.length - 1];
                    setGameState({ ...prev, history: gameState.history.slice(0, -1) });
                  }
                }}
                disabled={gameState.history.length === 0}
                className="p-2 bg-white/10 hover:bg-white/25 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                title="Undo"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classic Game Layout - Uses absolute positioning from layout() */}
      {CLASSIC_GAMES[selectedMode] ? (
        <div
          className="flex-1 w-full mx-auto pb-40 overflow-x-auto overflow-visible relative"
          style={{ height: 'calc(100vh - 140px)' }}
          onClick={() => {
            // Deselect cards when clicking background
            setSelectedPileId(null);
            setSelectedCardIndex(null);
            setHintTargets([]);
            setSelectionColor('none');
          }}
        >
          {(() => {
            const classicGame = CLASSIC_GAMES[selectedMode];
            const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
            const screenHeight = typeof window !== 'undefined' ? window.innerHeight - 140 : 600;
            const layoutInfo = classicGame.layout(screenWidth, screenHeight);
            const { piles: pileConfigs, cardWidth, cardHeight } = layoutInfo;

            return pileConfigs.map(config => {
              const pile = gameState.piles[config.id];
              if (!pile) return null;

              const isHighlighted = highlightedMoves.foundationIds.includes(config.id) || highlightedMoves.tableauIds.includes(config.id);
              const ringColor = selectionColor === 'green' ? 'ring-green-400' : selectionColor === 'yellow' ? 'ring-amber-300' : 'ring-red-400';

              // Render cards in this pile
              const renderPileCards = () => {
                if (pile.cards.length === 0) {
                  // Empty pile placeholder
                  return (
                    <div className={`w-full h-full bg-slate-800/30 rounded border border-slate-700 ${isHighlighted ? `ring-2 ${ringColor}` : ''} flex items-center justify-center`}>
                      {config.type === 'stock' && <div className="text-slate-600 text-xs">Stock</div>}
                      {config.type === 'waste' && <div className="text-slate-600 text-xs">Waste</div>}
                      {config.type === 'foundation' && <div className="text-slate-600 text-2xl opacity-20">🃏</div>}
                      {config.type === 'cell' && <div className="text-slate-600 text-xs">Cell</div>}
                      <button
                        type="button"
                        aria-label={`Empty ${config.type} ${config.id}`}
                        className="absolute inset-0 w-full h-full bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(config.id, -1);
                        }}
                      />
                    </div>
                  );
                }

                return pile.cards.map((card, idx) => {
                  let top = 0;
                  if (config.fan === 'down' && config.fanSpacing) {
                    top = idx * config.fanSpacing;
                  }

                  // Override the renderCard positioning for classic games
                  const classicCard = renderCard(card, idx, config.id);
                  return (
                    <div key={`${card.id}-${idx}`} className="absolute" style={{ top: `${top}px`, left: 0, zIndex: idx }}>
                      {classicCard}
                    </div>
                  );
                });
              };

              return (
                <div
                  key={config.id}
                  className="absolute"
                  style={{
                    left: `${config.x}px`,
                    top: `${config.y}px`,
                    width: `${cardWidth}px`,
                    height: config.fan === 'down' ? 'auto' : `${cardHeight}px`,
                    minHeight: `${cardHeight}px`
                  }}
                  onClick={(e) => {
                    if (config.type === 'stock' && pile.cards.length > 0) {
                      e.stopPropagation();
                      handleCardClick(config.id, pile.cards.length - 1);
                    }
                  }}
                >
                  {renderPileCards()}
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* Coronata Mode Layout - Uses flex/grid */
        <div className={`flex-1 w-full mx-auto p-[2px] pb-40 overflow-x-auto overflow-visible`} style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}>
          <div className="flex justify-center mb-4">
            <div className="grid gap-[2px] transition-transform duration-700" style={{
               gridTemplateColumns: `repeat(${foundationPiles.length + (gameState.piles['shadow-realm'] ? 1 : 0)}, minmax(0, 50px))`,
               transform: (() => {
                  const pendingFlips = gameState.effectState?.pendingFlips || [];
                  let scaleX = 1;
                  let scaleY = 1;
                  pendingFlips.forEach((flip: string) => {
                     if (flip === 'horizontal') scaleX *= -1;
                     if (flip === 'vertical') scaleY *= -1;
                  });
                  return pendingFlips.length > 0 ? `scale(${scaleX}, ${scaleY})` : 'none';
               })()
            }}>
                  {/* Shadow Realm Pile */}
                  {gameState.piles['shadow-realm'] && (
                     <div
                        className="relative w-[50px] h-[73px] bg-purple-900/30 border border-purple-500/50 rounded flex items-center justify-center cursor-pointer hover:bg-purple-900/50 transition-colors"
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

                  {foundationPiles.map(pile => {
                     const suitSymbol = pile.id.includes('hearts') ? '♥' : pile.id.includes('diamonds') ? '♦' : pile.id.includes('clubs') ? '♣' : '♠';
                     const suitColor = pile.id.includes('hearts') || pile.id.includes('diamonds') ? 'text-red-600' : 'text-white';
                     const isHighlighted = highlightedMoves.foundationIds.includes(pile.id);
                     const ringColor = selectionColor === 'green' ? 'ring-green-400' : selectionColor === 'yellow' ? 'ring-amber-300' : 'ring-red-400';
                     const shadowColor = selectionColor === 'green' ? 'shadow-[0_0_0_2px_rgba(74,222,128,0.25)]' : selectionColor === 'yellow' ? 'shadow-[0_0_0_2px_rgba(251,191,36,0.25)]' : 'shadow-[0_0_0_2px_rgba(248,113,113,0.25)]';
                     return (
                     <div key={pile.id} data-pile-id={pile.id} className={`relative w-[50px] h-[73px] bg-slate-800/50 rounded border border-slate-700 flex items-center justify-center ${isHighlighted ? `ring-2 ${ringColor} ${shadowColor}` : ''}`}>
                        {pile.cards.length === 0 ? (
                           <div className="relative w-full h-full flex items-center justify-center">
                              <span className={`text-xl opacity-20 ${suitColor}`}>{suitSymbol}</span>
                              <button type="button" aria-label={`Empty foundation ${pile.id}`} className={`absolute top-0 left-0 w-[50px] h-[73px] bg-transparent ${isHighlighted ? `ring-2 ${ringColor} rounded` : ''}`} onClick={() => handleCardClick(pile.id, -1)} />
                           </div>
                        ) : null}
                        {pile.cards.map((c, i) => renderCard(c, i, pile.id))}
                     </div>
                     );
                  })}
            </div>
          </div>

          {/* Active Effect HUDs */}
          {(activeEffects.includes('ritual_components') || activeEffects.includes('momentum_tokens')) && (
             <div className="flex justify-center gap-4 mb-2 animate-in fade-in slide-in-from-top-2">
                {activeEffects.includes('ritual_components') && (
                   <div className="flex items-center gap-1 bg-slate-800/80 p-1.5 rounded border border-slate-700">
                      <span className="text-[14px] text-slate-400 uppercase font-bold mr-1">Ritual</span>
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
                         <span className="text-[14px] text-slate-400 uppercase font-bold">Momentum</span>
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

          <div className="flex justify-center">
            <div className="grid gap-x-[2px] h-full transition-transform duration-700" style={{
               gridTemplateColumns: `repeat(${tableauCount}, minmax(0, 50px))`,
               transform: (() => {
                  const pendingFlips = gameState.effectState?.pendingFlips || [];
                  let scaleX = 1;
                  let scaleY = 1;
                  pendingFlips.forEach((flip: string) => {
                     if (flip === 'horizontal') scaleX *= -1;
                     if (flip === 'vertical') scaleY *= -1;
                  });
                  return pendingFlips.length > 0 ? `scale(${scaleX}, ${scaleY})` : 'none';
               })()
            }}>
                 {tableauPiles.map(pile => {
                    const isLinked = activeEffects.includes('linked_fates') && gameState.effectState?.linkedTableaus?.includes(pile.id);
                    const isLinkedTurn = isLinked && gameState.effectState?.lastLinkedPlayed !== pile.id;
                    const isParasite = activeEffects.includes('parasite_pile') && gameState.effectState?.parasiteTarget === pile.id;
                    const isHighlighted = highlightedMoves.tableauIds.includes(pile.id);

                    return (
                    <div key={pile.id} data-pile-id={pile.id} className={`relative w-full h-full ${isLinked ? 'border-t-2 border-purple-500/50 rounded-t-lg pt-1' : ''} ${isParasite ? 'border-t-2 border-green-500/50 rounded-t-lg pt-1' : ''} ${pile.hidden ? 'invisible pointer-events-none' : ''}`}>
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
                        {pile.cards.length === 0 && (() => {
                           const ringColor = selectionColor === 'green' ? 'ring-green-400' : selectionColor === 'yellow' ? 'ring-amber-300' : 'ring-red-400';
                           return (
                              <div className="relative w-[50px] h-[73px]">
                                 <div className={`w-full h-full bg-slate-800/50 rounded border border-slate-700 ${isHighlighted ? `ring-2 ${ringColor}` : ''}`}></div>
                                 <button type="button" aria-label={`Empty ${pile.id}`} className="absolute inset-0 w-full h-full bg-transparent" onClick={() => handleCardClick(pile.id, -1)} />
                              </div>
                           );
                        })()}
                        {pile.cards.map((c, idx) => renderCard(c, idx, pile.id))}
                    </div>
                 )})}
            </div>
          </div>
        </div>
      )}

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
                           {activeDrawer === 'pause' ? '' 
                            : activeDrawer === 'shop' ? '' 
                            : activeDrawer === 'feedback' ? 'Feedback' 
                            : activeDrawer === 'test' ? '' 
                            : activeDrawer === 'settings' ? 'Settings' 
                            : activeDrawer === 'blessing_select' ? 'Select a Blessing' 
                            : activeDrawer.charAt(0).toUpperCase() + activeDrawer.slice(1)}
                        </h3>
                        {nonClosableDrawer === activeDrawer ? (
                           <div style={{ width: 28 }} />
                        ) : (
                           <button onClick={() => { setActiveDrawer(null); setNonClosableDrawer(null); }}><ChevronDown className="text-slate-500" /></button>
                        )}
                     </div>
                     <div className="max-w-md mx-auto">
                        {activeDrawer === 'pause' ? (
                           <div className="grid grid-cols-5 gap-1">
                           <button className=" rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600"><img src="/icons/save.png" alt="" className="w-8 h-8" /></button>
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('resign')}><img src="/icons/resign.png" alt="" className="w-8 h-8" /></button>
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('feedback')}><img src="/icons/feedback.png" alt="" className="w-8 h-8" /></button>
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('test')}><FlaskConical size={32} /></button>
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('settings')}><img src="/icons/settings.png" alt="" className="w-8 h-8" /></button>
                           </div>
                        ) : activeDrawer === 'inventory' ? (
                           <div className="grid grid-cols-4 gap-1">
                              {/* Use explicit PNGs per request: exploits.png for exploits */}
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('exploit')} aria-label="Exploits"><img src="/icons/exploits.png" alt="Exploits" className="w-8 h-8" /></button>
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('blessing')} aria-label="Blessings"><ResponsiveIcon name="blessing" fallbackType="blessing" size={32} className="w-8 h-8" /></button>
                              {/* Use fortune.png for the Patterns button */}
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('patterns')} aria-label="Patterns"><img src="/icons/fortune.png" alt="Patterns" className="w-8 h-8" /></button>
                              {/* Open the pause drawer (save/resign/test/feedback/settings) */}
                              <button className="rounded flex flex-col items-center gap-0.5 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('pause')} aria-label="Pause"><img src="/icons/pause.png" alt="Pause" className="w-8 h-8" /></button>
                           </div>
                        ) : activeDrawer === 'shop' ? (
                           <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-1 gap-2">
                                {shopTab === 'buy' && shopInventory.map(item => {
                                    const rarityColors = getRarityColor(item.rarity);
                                    const itemType = item.type === 'curse' ? 'curse' : item.type === 'blessing' ? 'blessing' : 'exploit';
                                    const isOwned = gameState.ownedEffects.includes(item.id);
                                    return (
                                    <div key={item.id} className={`p-2 rounded border ${rarityColors.border} ${rarityColors.bg} flex items-center gap-3`}>
                                       <ResponsiveIcon name={item.id || item.name} fallbackType={itemType} size={32} className="w-8 h-8 rounded shrink-0" alt={item.name} />
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                             <span className="font-bold text-white text-xs truncate">{item.name}</span>
                                             <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{item.rarity || 'Common'}</span>
                                          </div>
                                          <div className="text-slate-400 text-[14px]">{item.description}</div>
                                       </div>
                                       <button
                                         className={`text-white px-2 py-1 rounded text-xs font-bold shrink-0 flex items-center gap-1 ${isOwned ? 'bg-transparent cursor-not-allowed' : gameState.coins >= (item.cost || 50) ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                         onClick={() => buyEffect(item)}
                                         disabled={gameState.coins < (item.cost || 50) || isOwned}>
                                         {isOwned ? (
                                            <img src="/icons/destitution.png" alt="Sold out" className="w-5 h-5" />
                                         ) : (
                                            <>
                                               <ResponsiveIcon name="coin" fallbackType="exploit" size={18} className="w-[18px] h-[18px]" alt="coin" />
                                               <span>{item.cost || 50}</span>
                                            </>
                                         )}
                                       </button>
                                    </div>
                                 );})}

                                {shopTab === 'sell' && (() => {
                                   const ownedExploits = effectsRegistry.filter(e => (['exploit','epic','legendary','rare','uncommon'].includes(e.type)) && gameState.ownedEffects.includes(e.id));
                                   if (ownedExploits.length === 0) return <div className="text-center text-slate-500 text-xs py-4">Nothing to sell!</div>;
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
                                               <div className="text-slate-400 text-[14px]">{item.description}</div>
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
                                 <div className="text-[14px] text-slate-500 mb-2 uppercase">Related Effects</div>
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
                           <div className="flex flex-col gap-2">
                              {/* Audio - Collapsible */}
                              <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                                 <button
                                    onClick={() => setExpandedSettingsSection(expandedSettingsSection === 'audio' ? null : 'audio')}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-800">
                                    <div className="flex items-center gap-2">
                                       <img src="/icons/volume.png" alt="" className="w-4 h-4" />
                                       <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider">Audio</h3>
                                    </div>
                                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedSettingsSection === 'audio' ? 'rotate-180' : ''}`} />
                                 </button>
                                 {expandedSettingsSection === 'audio' && (
                                    <div className="space-y-3 p-3 pt-0 animate-in fade-in slide-in-from-top-2">
                                       {/* Master Volume */}
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

                              {/* Display - Collapsible */}
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
                                          <div><div className="font-medium text-sm">Theme</div><div className="text-xs text-slate-400">Color scheme</div></div>
                                          <select value={settings.theme} onChange={(e) => setSettings(s => ({...s, theme: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm">
                                             <option value="dark">Dark</option>
                                             <option value="light">Light</option>
                                             <option value="system">System</option>
                                             <option value="oled">OLED</option>
                                          </select>
                                       </div>
                                       <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                          <div><div className="font-medium text-sm">Card Animations</div><div className="text-xs text-slate-400">Smooth animations</div></div>
                                          <button onClick={() => setSettings(s => ({...s, cardAnimations: !s.cardAnimations}))} className={`w-12 h-6 ${settings.cardAnimations ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.cardAnimations ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                       </div>
                                       <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                          <div><div className="font-medium text-sm">Reduce Motion</div><div className="text-xs text-slate-400">Minimize animations</div></div>
                                          <button onClick={() => setSettings(s => ({...s, reduceMotion: !s.reduceMotion}))} className={`w-12 h-6 ${settings.reduceMotion ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.reduceMotion ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                       </div>
                                       <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                          <div><div className="font-medium text-sm">High Contrast</div><div className="text-xs text-slate-400">Better visibility</div></div>
                                          <button onClick={() => setSettings(s => ({...s, highContrast: !s.highContrast}))} className={`w-12 h-6 ${settings.highContrast ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.highContrast ? 'right-0.5' : 'left-0.5'}`}></div></button>
                                       </div>
                                       <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                          <div><div className="font-medium text-sm">Card Back</div><div className="text-xs text-slate-400">Design preference</div></div>
                                          <select value={settings.cardBack} onChange={(e) => setSettings(s => ({...s, cardBack: e.target.value}))} className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs">
                                             <option value="card-back">Classic</option>
                                             <option value="heratic">Heretic</option>
                                             <option value="midas">Midas</option>
                                             <option value="molten">Molten</option>
                                             <option value="sacred">Sacred</option>
                                             <option value="sands">Sands</option>
                                             <option value="shattered">Shattered</option>
                                             <option value="shrouded">Shrouded</option>
                                             <option value="verdant">Verdant</option>
                                             <option value="withered">Withered</option>
                                          </select>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                        ) : activeDrawer === 'gameplay_settings' ? (
                           <div className="flex flex-col gap-2">
                              <label className="flex items-center justify-between text-sm text-slate-300 bg-slate-700/30 p-2 rounded">
                                 <span>Confirm Resign</span>
                                 <button onClick={() => setSettings(s => ({...s, confirmResign: !s.confirmResign}))} className={`w-12 h-6 ${settings.confirmResign ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}>
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.confirmResign ? 'right-0.5' : 'left-0.5'}`}></div>
                                 </button>
                              </label>
                              <label className="flex items-center justify-between text-sm text-slate-300 bg-slate-700/30 p-2 rounded">
                                 <div>
                                    <div>Support Patriarchy</div>
                                    <div className="text-[14px] text-slate-400">Kings high instead of Queens</div>
                                 </div>
                                 <button onClick={() => setSettings(s => ({...s, supportPatriarchy: !s.supportPatriarchy}))} className={`w-12 h-6 ${settings.supportPatriarchy ? 'bg-emerald-600' : 'bg-slate-600'} rounded-full relative transition-colors`}>
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.supportPatriarchy ? 'right-0.5' : 'left-0.5'}`}></div>
                                 </button>
                              </label>

                              <button className="text-xs text-slate-500 underline mt-2" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
                           </div>
                        ) : activeDrawer === 'test' ? (
                           <div className="flex flex-col gap-2 p-2">
                              <div className="text-xs text-slate-400 uppercase font-bold">Quick Actions</div>
                              <div className="flex gap-2">
                                 <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded flex items-center justify-center" onClick={() => setGameState(p => ({ ...p, score: p.currentScoreGoal }))} title="Complete Goal"><Target size={18} /></button>
                                 <button className="bg-green-600 hover:bg-green-700 text-white p-2 rounded flex items-center justify-center" onClick={() => setGameState(p => ({ ...p, coins: p.coins + 100 }))} title="+100 Coins"><PlusCircle size={18} /></button>
                                 <button className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded flex items-center justify-center" onClick={() => setGameState(p => ({...p, debugUnlockAll: !p.debugUnlockAll}))} title="Toggle All Unlocks"><Unlock size={18} /></button>
                              </div>

                              <div className="text-xs text-slate-400 uppercase font-bold mt-2">Trigger Effect</div>
                              <select className="bg-slate-800 text-white px-2 py-1.5 rounded text-sm border border-slate-600" onChange={(e) => {
                                 const effectId = e.target.value;
                                 if (effectId) {
                                    setGameState(p => ({ ...p, ownedEffects: [...p.ownedEffects, effectId] }));
                                    toggleEffect(effectId, true);
                                    e.target.value = '';
                                 }
                              }}>
                                 <option value="">Select exploit/pattern...</option>
                                 {effectsRegistry.filter(e => e.type === 'exploit' || e.type === 'pattern').map(effect => (
                                    <option key={effect.id} value={effect.id}>{effect.name} ({effect.type})</option>
                                 ))}
                              </select>

                              <div className="text-xs text-slate-400 uppercase font-bold mt-2">Force Curse</div>
                              <select className="bg-slate-800 text-white px-2 py-1.5 rounded text-sm border border-slate-600" onChange={(e) => {
                                 const curseId = e.target.value;
                                 if (curseId) {
                                    // Find next encounter index
                                    const nextIndex = gameState.runIndex + 1;
                                    if (nextIndex < runPlan.length) {
                                       // Update run plan to use this curse
                                       const newPlan = [...runPlan];
                                       newPlan[nextIndex] = { ...newPlan[nextIndex], effectId: curseId };
                                       setRunPlan(newPlan);
                                    }
                                    e.target.value = '';
                                 }
                              }}>
                                 <option value="">Select curse for next encounter...</option>
                                 {effectsRegistry.filter(e => e.type === 'curse').map(curse => (
                                    <option key={curse.id} value={curse.id}>{curse.name}</option>
                                 ))}
                              </select>

                              <button className="text-xs text-slate-500 underline mt-2" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
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
                                         if (preEncounterBlessing) {
                                            // Pre-encounter blessing: start the encounter
                                            setPreEncounterBlessing(false);
                                            setActiveDrawer(null);
                                            setNonClosableDrawer(null);
                                            startNextEncounter();
                                         } else if (gameState.runIndex === 0) {
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
                                          <div className="text-slate-400 text-[14px]">{item.description}</div>
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
                                 const isActive = activeEffects.includes(e.id);
                                 // Patterns drawer: always show pattern definitions
                                 if (activeDrawer === 'patterns') {
                                    return e.type === 'pattern';
                                 }
                                 // For curses, only show the currently active curse (the current encounter's curse)
                                 if (activeDrawer === 'curse') {
                                    const isCurseType = ['curse', 'fear', 'danger'].includes(e.type);
                                    return isCurseType && isActive;
                                 }
                                 // For other drawers, only show owned effects
                                 if (!isOwned) return false;
                                 if (activeDrawer === 'exploit') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
                                 if (activeDrawer === 'blessing') return ['blessing'].includes(e.type);
                                 return false;
                              }).sort((a,b) => {
                                 const aReady = isEffectReady(a.id, gameState);
                                 const bReady = isEffectReady(b.id, gameState);
                                 return (aReady === bReady) ? 0 : aReady ? -1 : 1;
                              }).map(effect => {
                                 // Treat patterns as always-active in the patterns drawer
                                 const isActive = effect.type === 'pattern' || activeEffects.includes(effect.id);
                                 const isReady = isEffectReady(effect.id, gameState);
                                 const charges = gameState.charges[effect.id] ?? effect.maxCharges;
                                 const rarityColors = getRarityColor(effect.rarity);
                                 
                                 const effectType = effect.type === 'curse' ? 'curse' : effect.type === 'fear' ? 'fear' : effect.type === 'danger' ? 'danger' : effect.type === 'blessing' ? 'blessing' : effect.type === 'passive' ? 'passive' : 'exploit';
                                 return (
                                    <button
                                       key={effect.id}
                                       type="button"
                                       onClick={() => {
                                          // Curses (curse/fear/danger) and patterns cannot be toggled off
                                          const isCurseType = ['curse', 'fear', 'danger'].includes(effect.type);
                                          const isPassive = effect.type === 'passive';
                                          // Always-on exploits cannot be toggled off once active
                                          const alwaysOnIds = ['whore', 'metrocard', 'breaking_entering', 'insider_trading', 'switcheroo'];
                                          const isAlwaysOn = alwaysOnIds.includes(effect.id) && isActive;
                                          if (isCurseType || isPassive || isAlwaysOn) return;
                                          toggleEffect(effect.id);
                                       }}
                                       aria-label={`Toggle effect ${effect.name}`}
                                       className={`p-2 rounded border text-xs flex items-center gap-3 transition-all ${isActive ? 'bg-purple-900/60 border-purple-500' : `${rarityColors.bg} ${rarityColors.border}`} ${['curse', 'fear', 'danger', 'passive'].includes(effect.type) || (['whore', 'metrocard', 'breaking_entering', 'insider_trading', 'switcheroo'].includes(effect.id) && isActive) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                       <ResponsiveIcon name={effect.id || effect.name} fallbackType={effectType === 'passive' ? 'exploit' : effectType} size={32} className="w-8 h-8 rounded shrink-0" alt={effect.name} />
                                       <div className="flex-1 min-w-0 text-left">
                                           <div className="font-bold text-white text-sm flex gap-1 items-center flex-wrap">
                                               <span className="truncate">{effect.name}</span>
                                               {effect.type === 'passive' && <span className="text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 bg-cyan-900/50 text-cyan-300 border border-cyan-500">Always On</span>}
                                               <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-bold shrink-0 ${rarityColors.text} border ${rarityColors.border}`}>{effect.rarity || 'Common'}</span>
                                               {effect.maxCharges && <span className="text-[9px] bg-slate-600 px-1 rounded text-white shrink-0">{charges}/{effect.maxCharges}</span>}
                                           </div>
                                           <div className="text-white text-sm">{effect.description}</div>
                                           {effect.id === 'whore' && isActive && (
                                              <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  onClick={convertScoreToCoin}
                                                  disabled={gameState.score < 5}
                                                  className="text-[14px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-1">
                                                  5 Score → 1 Coin
                                                </button>
                                                <button
                                                  onClick={convertCoinToScore}
                                                  disabled={gameState.coins < 1}
                                                  className="text-[14px] px-2 py-1 rounded bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-1">
                                                  1 Coin → 4 Score
                                                </button>
                                              </div>
                                           )}
                                           {effect.id === 'metrocard' && isActive && (
                                              <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  onClick={buyKeyWithTaxLoophole}
                                                  disabled={gameState.coins <= 0}
                                                  className="text-[14px] px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-1">
                                                  Buy Key (25% Coin)
                                                </button>
                                              </div>
                                           )}
                                           {effect.id === 'switcheroo' && isActive && (
                                              <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  onClick={undoWithSwitcheroo}
                                                  disabled={gameState.coins < Math.floor(gameState.coins * 0.2) || (gameState.effectState?.lastSnapshots || []).length < 3}
                                                  className="text-[14px] px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-1">
                                                  Undo (20% Coin)
                                                </button>
                                              </div>
                                           )}
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

            {/* Bottom Bar - Different for Classic vs Coronata modes */}
            {!CLASSIC_GAMES[selectedMode] ? (
               <>
                  {/* Coronata Mode - Compact HUD: left menu card, centered hand (rendered above), right discard card */}
                  <div className="relative w-full h-[73px] flex items-end justify-center">
                     {/* Left card-shaped menu button (Bag of Holding icon) */}
                               <div className="absolute left-[1px] bottom-0">
                                    <button
                                       onClick={() => {
                                          // If drawer is locked and active, respect the lock
                                          if (nonClosableDrawer && activeDrawer === nonClosableDrawer && (activeDrawer === 'inventory' || activeDrawer === 'pause')) return;
                                          // If inventory or pause is open, close them; otherwise open inventory
                                          if (activeDrawer === 'inventory' || activeDrawer === 'pause') {
                                             setActiveDrawer(null);
                                             setNonClosableDrawer(null);
                                          } else {
                                             toggleDrawer('inventory');
                                          }
                                       }}
                                       className={`relative w-[50px] h-[73px] rounded border border-slate-700 shadow-md overflow-hidden bg-slate-800 flex items-center justify-center pointer-events-auto`} aria-label="Inventory">
                                        <img src="/icons/bagofholding.png" alt="Bag of Holding" className="w-7 h-7" />
                                    </button>
                               </div>

                     {/* Center: player's hand with overlapping cards */}
                    <div className="absolute left-[52px] right-[52px] bottom-0 flex items-center justify-center pointer-events-none">
                       <div className="relative flex items-center justify-center" style={{
                          width: (() => {
                             const numCards = gameState.piles.hand.cards.length;
                             if (numCards === 0) return '0px';
                             const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 104 : 256;
                             const cardWidth = 50;
                             const totalWidth = numCards * cardWidth;
                             return totalWidth <= availableWidth ? `${totalWidth}px` : `${availableWidth}px`;
                          })(),
                          height: '73px'
                       }}>
                          {gameState.piles.hand.cards.map((c, i) => {
                             const numCards = gameState.piles.hand.cards.length;
                             const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 104 : 256;
                             const cardWidth = 50;
                             const totalWidth = numCards * cardWidth;
                             const spacing = totalWidth <= availableWidth ? cardWidth : Math.max(10, (availableWidth - cardWidth) / Math.max(1, numCards - 1));

                             return (
                                <div key={`hand-overlap-${c.id}-${i}`} className="absolute pointer-events-auto" style={{ left: `${i * spacing}px`, zIndex: i }}>
                                   {renderHandCardHUD(c, i)}
                                </div>
                             );
                          })}
                       </div>
                    </div>

                     {/* Right card-shaped discard/draw button (no card back) */}
                     <div className="absolute right-[1px] bottom-0">
                        <button type="button" onClick={() => discardAndDrawHand()} aria-label="Discard/Draw" className="relative w-[50px] h-[73px] rounded border border-blue-700 shadow-md overflow-hidden bg-blue-900 flex items-center justify-center pointer-events-auto hover:brightness-110">
                           <img src="/icons/foundation.png" alt="Discard" className="w-6 h-6 opacity-90" />
                           {gameState.piles.deck.cards.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-slate-700 text-[14px] px-1 rounded-full border border-slate-500 leading-none">{gameState.piles.deck.cards.length}</span>
                           )}
                        </button>
                     </div>
                  </div>

                  {/* Coronata Mode - Run Progress Bar (between player hand & score bar) */}
                  <div className="flex justify-between px-1 my-2 gap-0.5 relative group">
                     {runPlan.map((enc, i) => {
                        const eff = effectsRegistry.find(e => e.id === enc.effectId);
                        const isCompleted = i < gameState.runIndex;
                        const isCurrent = i === gameState.runIndex;
                        const iconClass = isCompleted ? 'opacity-80' : isCurrent ? 'opacity-100' : 'opacity-40 grayscale';
                        const iconStyle = isCurrent ? { filter: 'brightness(1.5) saturate(1.5) hue-rotate(-15deg)' } : {};
                        const isCurrentCurse = isCurrent && enc.type === 'curse';
                        return (
                           <button
                              key={i}
                              type="button"
                              className={`w-8 h-8 rounded flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500/10 border-2 border-green-500' : isCurrent ? 'bg-orange-500/10 border-2 border-orange-500 animate-pulse' : 'bg-slate-700/10 border-2 border-slate-700'}`}
                              onClick={() => isCurrentCurse ? toggleDrawer('curse') : alert(`${enc.type.toUpperCase()}: ${eff?.name || 'Level ' + (i+1)}\n${eff?.description || 'Score goal: ' + enc.goal}`)}
                              aria-label={`Encounter ${i + 1} ${enc.type} ${eff?.name ?? ''}`}>
                                             <span className={`w-8 h-8 object-contain aspect-square stroke-2 fill-none ${iconClass}`} style={{ ...iconStyle, stroke: 'currentColor', fill: 'none' }}>
                                                <ResponsiveIcon name={enc.effectId} fallbackType="curse" size={32} className="w-8 h-8" alt={eff?.name || ''} />
                                             </span>
                           </button>
                        );
                     })}
                  </div>

                  {/* Coronata Mode - Score Bar (below player hand) */}
                  <div className="flex items-center gap-2 mt-0 mb-2">
                     <div className="flex-1">
                        <div className="w-full bg-slate-800 h-5 rounded-full overflow-hidden border border-slate-700 relative flex items-center justify-center px-1">
                           <div className="absolute inset-0 bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, (gameState.score / gameState.currentScoreGoal) * 100)}%` }} />
                           <span className="relative z-10 text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{gameState.score} / {gameState.currentScoreGoal}</span>
                        </div>
                     </div>
                  </div>
               </>
            ) : (
               <>
                  {/* Classic Mode - Single Row with all buttons */}
                  <div className="flex w-full gap-1">
                     <button onClick={() => toggleDrawer('pause')} className={`p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 border border-slate-700 ${activeDrawer === 'pause' ? 'bg-slate-700' : ''}`}>
                        <img src="/icons/pause.png" alt="Pause" className="w-[18px] h-[18px]" />
                     </button>
                     <button type="button" onClick={() => {/* TODO: Undo logic */}} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 border border-slate-700">
                        <img src="/icons/back.png" alt="Undo" className="w-[18px] h-[18px]" />
                     </button>
                     <button type="button" onClick={() => discardAndDrawHand()} aria-label="Draw from deck" className="p-2 bg-blue-900 hover:bg-blue-800 rounded text-blue-300 border border-blue-700 relative">
                        <img src="/icons/foundation.png" alt="Draw" className="w-[18px] h-[18px]" />
                        {gameState.piles.deck?.cards?.length > 0 && (
                           <span className="absolute -top-1 -right-1 bg-slate-700 text-[8px] px-1 rounded-full border border-slate-500 leading-none">{gameState.piles.deck.cards.length}</span>
                        )}
                     </button>
                     <button className="flex-1 py-1.5 rounded text-[14px] font-bold border border-slate-700 bg-slate-800 text-slate-400 flex flex-col items-center justify-center gap-0.5">
                        <Clock size={18} />
                        <span>{formatTime(elapsedTime)}</span>
                     </button>
                     <button className="flex-1 py-1.5 rounded text-[14px] font-bold border border-slate-700 bg-slate-800 text-slate-400 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[18px]">📊</span>
                        <span>{gameState.score}</span>
                     </button>
                     <button className="flex-1 py-1.5 rounded text-[14px] font-bold border border-slate-700 bg-slate-800 text-slate-400 flex flex-col items-center justify-center gap-0.5">
                        <Play size={18} />
                        <span>{gameState.moves}</span>
                     </button>
                  </div>
               </>
            )}
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

      {/* Floating Score/Coin Indicators */}
      {floatingElements.map(el => (
         <div
            key={el.id}
            className={`floating-text fixed ${el.color} ${el.isMult ? 'mult-pop' : ''}`}
            style={{ left: el.x, top: el.y }}
         >
            {el.text}
         </div>
      ))}

      {/* Effect Banner */}
      {activeBanner && (
         <div className="effect-banner fixed top-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900 px-8 py-4 rounded-2xl border-4 border-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.8)] animate-in zoom-in-95 duration-300">
            {activeBanner.effectId ? (
               <ResponsiveIcon name={activeBanner.effectId} fallbackType="blessing" size={48} className="effect-icon-flash" />
            ) : (
               <i className={`fa ${activeBanner.icon} text-yellow-400 text-4xl effect-icon-flash`} />
            )}
            <span className="text-white font-black text-2xl tracking-wider drop-shadow-lg">{activeBanner.name}</span>
         </div>
      )}

      {/* Dismissible Curse Introduction Banner */}
      {curseBanner && (
         <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-red-900 via-purple-900 to-black p-8 rounded-3xl border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.9)] max-w-md mx-4 animate-in zoom-in-95 duration-500">
               <div className="flex flex-col items-center gap-6">
                  <ResponsiveIcon name={curseBanner.effectId} fallbackType="curse" size={80} className="animate-pulse" />
                  <h2 className="text-white font-black text-3xl tracking-wider text-center drop-shadow-lg">{curseBanner.name}</h2>
                  <p className="text-white text-center text-3xl leading-relaxed">{curseBanner.description}</p>
                  <button
                     onClick={() => setCurseBanner(null)}
                     className="bg-red-600 hover:bg-red-500 text-white font-bold text-xl px-8 py-4 rounded-xl border-2 border-red-400 shadow-lg transition-all hover:scale-105"
                  >
                     ACCEPT CURSE
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}