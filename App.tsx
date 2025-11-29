import React, { useState, useCallback } from 'react';
import { LayoutGrid, Sparkles, Skull, Lock, Key, Smile, Coins, Play, Gamepad2, BookOpen, HelpCircle, RefreshCw, X, Gift, Trophy, ArrowLeftRight, SkipBack, SkipForward, MessageSquare, FlaskConical, Save, Flag, Settings, ChevronDown, Pause, ShoppingCart, User, Unlock, Map as MapIcon } from 'lucide-react';
import { Card, GameState, Pile, Rank, Suit, MoveContext, Encounter, GameEffect, Wander, WanderChoice, MinigameResult } from './types';
import { EFFECTS_REGISTRY, getCardColor, generateNewBoard } from './data/effects';
import { WANDER_REGISTRY } from './data/wanders';
import { Minigames } from './utils/minigames';

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

const generateRunPlan = (rng?: () => number): Encounter[] => {
   const encounters: Encounter[] = [];
   const fears = EFFECTS_REGISTRY.filter(e => e.type === 'fear');
   const dangers = EFFECTS_REGISTRY.filter(e => e.type === 'danger');

   const shuffledFears = shuffleArray([...fears], rng);
   const shuffledDangers = shuffleArray([...dangers], rng);

   for (let i = 0; i < 15; i++) {
      const isDanger = (i + 1) % 3 === 0;
      const goal = Math.floor(150 + (i / 14) * (4200 - 150));
      const effect = isDanger ? (shuffledDangers[i % shuffledDangers.length] || dangers[0]) : (shuffledFears[i % shuffledFears.length] || fears[0]);

      encounters.push({
         index: i,
         type: isDanger ? 'danger' : 'fear',
         effectId: effect.id,
         goal: goal,
         completed: false
      });
   }
   return encounters;
};

const initialGameState = (): GameState => {
  return generateNewBoard(0, 150, 1, 1);
};

const isStandardMoveValid = (movingCards: Card[], targetPile: Pile): boolean => {
  if (movingCards.length === 0) return false;
  const leader = movingCards[0];
  const targetTop = targetPile.cards[targetPile.cards.length - 1];
  if (targetPile.type === 'tableau') {
    if (!targetTop) return leader.rank === 13;
    return (getCardColor(leader.suit) !== getCardColor(targetTop.suit) && targetTop.rank === leader.rank + 1);
  }
  if (targetPile.type === 'foundation') {
    if (movingCards.length > 1) return false;
    if (!targetTop) return leader.rank === 1;
    if (targetPile.id.includes(leader.suit)) return leader.rank === targetTop.rank + 1;
    return false;
  }
  return false;
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

// ==========================================
// 5. COMPONENT: APP
// ==========================================

export default function SolitaireEngine() {
  const [currentView, setCurrentView] = useState<'home' | 'game'>('home');
  const [runPlan, setRunPlan] = useState<Encounter[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState());
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [selectedPileId, setSelectedPileId] = useState<string | null>(null);
  const [hintTargets, setHintTargets] = useState<string[]>([]);
  
  const [activeDrawer, setActiveDrawer] = useState<'pause' | 'exploit' | 'curse' | 'blessing' | 'shop' | 'feedback' | 'test' | 'settings' | 'resign' | 'blessing_select' | null>(null);
  const [shopInventory, setShopInventory] = useState<GameEffect[]>([]);
  const [blessingChoices, setBlessingChoices] = useState<GameEffect[]>([]);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossaryTab, setGlossaryTab] = useState<'dangers'|'fears'|'blessings'|'exploits'|'curses'>('dangers');
  const [testAmount, setTestAmount] = useState(100);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackChecks, setFeedbackChecks] = useState<Record<string, boolean>>({});

  const isEffectReady = (id: string, state: GameState) => {
     if (id === 'lobbyist') return state.coins >= 100;
     if (id === 'street_smarts') return state.coins >= 25;
     return true;
  };

  const resolveWanderEffect = (effects: any[]) => {
    let updates: Partial<GameState> = {};
    let newOwned = [...gameState.ownedEffects];
    let newActive = [...activeEffects];
    
    const apply = (effs: any[]) => {
      for (const eff of effs) {
        if (eff.type === 'modify_coin') updates.coins = (updates.coins ?? gameState.coins) + eff.params[0];
        if (eff.type === 'modify_score') updates.score = (updates.score ?? gameState.score) + eff.params[0];
        if (eff.type === 'modify_coin_pct') updates.coins = Math.floor((updates.coins ?? gameState.coins) * (1 + eff.params[0]));
        if (eff.type === 'modify_score_pct') updates.score = Math.floor((updates.score ?? gameState.score) * (1 + eff.params[0]));
        if (eff.type === 'modify_next_score_goal_pct') updates.currentScoreGoal = Math.floor((gameState.currentScoreGoal) * (1 + eff.params[0]));
        
        if (eff.type === 'add_random_curse') { 
            const curse = EFFECTS_REGISTRY.filter(e => e.type === 'curse')[Math.floor(Math.random() * 5)]; 
            if (curse && !newOwned.includes(curse.id)) { newOwned.push(curse.id); newActive.push(curse.id); } 
        }
        if (eff.type === 'add_specific_curse') {
            const cid = eff.params[0];
            if (!newOwned.includes(cid)) { newOwned.push(cid); newActive.push(cid); }
        }
        if (eff.type === 'add_random_blessing') { 
            const b = EFFECTS_REGISTRY.filter(e => e.type === 'blessing')[Math.floor(Math.random() * 5)]; 
            if (b && !newOwned.includes(b.id)) { newOwned.push(b.id); } // Blessings don't activate immediately
        }
        if (eff.type === 'add_blessing_by_id') {
            const bid = eff.params[0];
            if (!newOwned.includes(bid)) { newOwned.push(bid); }
        }
        if (eff.type === 'add_random_exploit') { 
            const x = EFFECTS_REGISTRY.filter(e => e.type === 'exploit')[Math.floor(Math.random() * 5)]; 
            if (x && !newOwned.includes(x.id)) { newOwned.push(x.id); newActive.push(x.id); } 
        }
        if (eff.type === 'remove_curse') { 
            const curses = newActive.filter(id => EFFECTS_REGISTRY.find(e => e.id === id)?.type === 'curse'); 
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
    setActiveEffects(newActive);
  };

  const startWanderPhase = () => {
     setActiveDrawer(null);
     setGameState(prev => ({ ...prev, wanderRound: 1 }));
     triggerWanderSelection();
  };

  const triggerWanderSelection = () => {
     const validWanders = WANDER_REGISTRY.filter(w => {
         if (w.isHidden) return false; 
         if (w.conditions?.minEncounter && gameState.runIndex < w.conditions.minEncounter) return false;
         return true;
     });
     
     const opts = validWanders.sort(() => 0.5 - Math.random()).slice(0, 3);
     setGameState(prev => ({ ...prev, wanderState: 'selection', wanderOptions: opts, activeWander: null, wanderResultText: null }));
  };

  const chooseWanderOption = (wander: any) => { setGameState(prev => ({ ...prev, wanderState: 'active', activeWander: wander })); };
  const resolveWander = (choice: WanderChoice) => { resolveWanderEffect(choice.effects); setGameState(prev => ({ ...prev, wanderState: 'result', wanderResultText: choice.result })); };
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
     EFFECTS_REGISTRY.forEach(e => { if (e.chargeReset === 'encounter' && e.maxCharges) newCharges[e.id] = e.maxCharges; });
     const nextIdx = gameState.runIndex + 1;
     if (nextIdx < runPlan.length) {
        const nextEncounter = runPlan[nextIdx];
        
        // Retain only Exploits/Curses/Dangers (Blessings must be played)
        const keptEffects = activeEffects.filter(id => { 
            const e = EFFECTS_REGISTRY.find(x => x.id === id); 
            return e?.type === 'exploit' || e?.type === 'curse' || e?.type === 'epic' || e?.type === 'legendary'; 
        });
        
        // Generate Board
        const newBoard = generateNewBoard(0, gameState.coins, gameState.scoreMultiplier, gameState.coinMultiplier);
        
        // Inject Owned Blessings into Deck
        const ownedBlessings = gameState.ownedEffects.filter(id => {
            const e = EFFECTS_REGISTRY.find(x => x.id === id);
            return e?.type === 'blessing';
        });
        
        const blessingCards: Card[] = ownedBlessings.map(bid => {
            const def = EFFECTS_REGISTRY.find(e => e.id === bid);
            return {
                id: `blessing-${bid}-${Math.random()}`,
                suit: 'special',
                rank: 0,
                faceUp: false,
                meta: { isBlessing: true, effectId: bid, name: def?.name || 'Blessing' }
            };
        });
        
        newBoard.piles.deck.cards = [...newBoard.piles.deck.cards, ...blessingCards].sort(() => 0.5 - Math.random());

        // Update State
        setActiveEffects([...keptEffects, nextEncounter.effectId]);
        setGameState(prev => ({ 
            ...prev, 
            piles: newBoard.piles, 
            score: 0, 
            coins: prev.coins, 
            runIndex: nextIdx, 
            currentScoreGoal: nextEncounter.goal, 
            isLevelComplete: false, 
            charges: newCharges, 
            wanderState: 'none' 
        }));
     } else { alert("Run Complete!"); setCurrentView('home'); }
  };

  const startRun = () => {
      // support seeded plan generation if a seed is set in localStorage
      const rawSeed = (() => { try { return localStorage.getItem('solitaire_seed_v1'); } catch { return null; } })();
      const seedNum = rawSeed ? Number(rawSeed) : null;
      const rng = seedNum ? createSeededRng(seedNum) : undefined;

      const plan = generateRunPlan(rng);
      const firstEncounter = plan[0];
      let freshState = initialGameState();
      if (firstEncounter) freshState.currentScoreGoal = firstEncounter.goal;

      // Apply first encounter onActivate if present (mirror geminicoronata behavior)
      let initialActive: string[] = firstEncounter ? [firstEncounter.effectId] : [];
      const firstEff = firstEncounter ? EFFECTS_REGISTRY.find(e => e.id === firstEncounter.effectId) : undefined;
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

      setRunPlan(plan);
      setGameState(freshState);
      setShopInventory([]);

      // Set initial active effects and show the game
      setActiveEffects(initialActive);
      setCurrentView('game');

      // Trigger initial blessing selection (unchanged)
      const blessings = EFFECTS_REGISTRY.filter(e => e.type === 'blessing').sort(() => 0.5 - Math.random());
      setBlessingChoices(blessings);
      setActiveDrawer('blessing_select');
  };

  const getEffects = useCallback(() => { return EFFECTS_REGISTRY.filter(e => activeEffects.includes(e.id)); }, [activeEffects]);

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

  const handleCardClick = (pileId: string, cardIndex: number) => {
    const pile = gameState.piles[pileId];
    if (!pile) return;
    const clickedCard = cardIndex >= 0 ? pile.cards[cardIndex] : null;

    // Special Card Interactions (Blessing/Items) in Hand
    if (clickedCard && pileId === 'hand' && clickedCard.meta?.isBlessing) {
        // Play Blessing
        const effectId = clickedCard.meta.effectId;
        setActiveEffects(prev => [...prev, effectId]);
        
        // Remove from hand (Exhaust)
        const newCards = [...pile.cards];
        newCards.splice(cardIndex, 1);
        setGameState(prev => ({ ...prev, piles: { ...prev.piles, hand: { ...pile, cards: newCards } } }));
        return;
    }

    if (clickedCard && clickedCard.meta?.locked) {
       const hasPanopticon = activeEffects.includes('panopticon');
       if (hasPanopticon) {
          setGameState(prev => ({ ...prev, activeMinigame: { type: 'darts', title: 'Break the Lock', context: { pileId, cardIndex } } }));
          return;
       }
       if (canAfford(10)) { const newCards = [...pile.cards]; newCards[cardIndex] = { ...clickedCard, meta: { ...clickedCard.meta, locked: false } }; setGameState(prev => ({ ...prev, coins: prev.coins - 10, piles: { ...prev.piles, [pileId]: { ...pile, cards: newCards } } })); } 
       return; 
    }
    
    if (pile.locked) {
        if (activeEffects.includes('street_smarts') && canAfford(25)) {
             setGameState(prev => ({ ...prev, coins: prev.coins - 25, piles: { ...prev.piles, [pileId]: { ...pile, locked: false } } }));
        }
        return;
    }
    
    if (gameState.interactionMode === 'discard_select') { if (pileId === 'hand' && cardIndex >= 0) { const newCards = [...pile.cards]; newCards.splice(cardIndex, 1); const charges = gameState.charges['knock_on_wood'] - 1; setGameState(prev => ({ ...prev, piles: { ...prev.piles, hand: { ...pile, cards: newCards } }, interactionMode: 'normal', charges: { ...prev.charges, knock_on_wood: charges } })); } return; }
    
    if (!gameState.selectedCardIds) {
      if (pile.type === 'deck') { discardAndDrawHand(); return; }
      if (!clickedCard) return;
      if (pile.type === 'hand') { setGameState(prev => ({ ...prev, selectedCardIds: [clickedCard.id] })); setSelectedPileId(pileId); return; }
      if (pile.type === 'tableau') { if (clickedCard.faceUp) { const stack = pile.cards.slice(cardIndex).map(c => c.id); setGameState(prev => ({ ...prev, selectedCardIds: stack })); setSelectedPileId(pileId); return; } else if (cardIndex === pile.cards.length - 1) { const newCards = [...pile.cards]; newCards[cardIndex] = { ...clickedCard, faceUp: true }; setGameState(prev => ({ ...prev, piles: { ...prev.piles, [pileId]: { ...pile, cards: newCards } } })); return; } }
      if (pile.type === 'foundation' && pile.cards.length > 0) { setGameState(prev => ({ ...prev, selectedCardIds: [clickedCard.id] })); setSelectedPileId(pileId); return; }
      return;
    }
    attemptMove(gameState.selectedCardIds, selectedPileId!, pileId);
    setGameState(prev => ({ ...prev, selectedCardIds: null }));
    setSelectedPileId(null);
  };
  
  const handleDoubleClick = (pileId: string, cardIndex: number) => {
      const pile = gameState.piles[pileId];
      if (!pile || cardIndex < 0) return;
      const card = pile.cards[cardIndex];
      
      // Auto-Play Blessing Logic
      if (pileId === 'hand' && card.meta?.isBlessing) {
          const effectId = card.meta.effectId;
          setActiveEffects(prev => [...prev, effectId]);
          const newCards = [...pile.cards];
          newCards.splice(cardIndex, 1);
          setGameState(prev => ({ ...prev, piles: { ...prev.piles, hand: { ...pile, cards: newCards } } }));
          return;
      }

      // Only single card auto-move logic for now to stay simple
      if (cardIndex !== pile.cards.length - 1) return;

      // 1. Try Foundations
      const foundationKeys = Object.keys(gameState.piles).filter(k => k.startsWith('foundation'));
      for (const fid of foundationKeys) {
          if (isStandardMoveValid([card], gameState.piles[fid])) {
              attemptMove([card.id], pileId, fid);
              return;
          }
      }
      
      // 2. Try Tableaus (Only if exactly one valid target)
      const tableauKeys = Object.keys(gameState.piles).filter(k => k.startsWith('tableau') && k !== pileId);
      const validTableaus = tableauKeys.filter(tid => isStandardMoveValid([card], gameState.piles[tid]));
      
      if (validTableaus.length === 1) {
          attemptMove([card.id], pileId, validTableaus[0]);
      }
  };

  const discardAndDrawHand = () => {
    const deck = gameState.piles['deck'];
    const hand = gameState.piles['hand'];
    const oldHand = hand.cards.map(c => ({ ...c, faceUp: false }));
    let newDeckCards = [...deck.cards, ...oldHand]; 
    const drawCount = activeEffects.includes('five_finger_discount') ? 10 : 5; 
    const drawn = newDeckCards.splice(0, drawCount).map(c => ({ ...c, faceUp: true }));
    let newState: GameState = { ...gameState, piles: { ...gameState.piles, deck: { ...deck, cards: newDeckCards }, hand: { ...hand, cards: drawn } }, lastActionType: 'shuffle' as const };
    
    const context: MoveContext = { source: 'hand', target: 'deck', cards: oldHand };
    const effects = getEffects();
    let minigameTrigger: string | undefined;

    effects.forEach(eff => {
       if (eff.onMoveComplete) {
          const result = eff.onMoveComplete(newState, context);
          if (result.triggerMinigame) minigameTrigger = result.triggerMinigame;
          const { triggerMinigame, ...stateUpdates } = result;
          newState = { ...newState, ...stateUpdates };
       }
    });

    if (minigameTrigger) {
       newState.activeMinigame = { type: minigameTrigger, title: minigameTrigger.toUpperCase() };
    }

    setGameState(newState);
  };

  const attemptMove = (cardIds: string[], sourcePileId: string, targetPileId: string) => {
    if (sourcePileId === targetPileId) return;
    let finalTargetPileId = targetPileId;
    const effects = getEffects();
    const sourcePile = gameState.piles[sourcePileId];
    const movingCards = sourcePile.cards.filter(c => cardIds.includes(c.id));
    if (movingCards.length === 0) return;

    let context: MoveContext = { source: sourcePileId, target: targetPileId, cards: movingCards };
    effects.forEach(eff => {
       if (eff.interceptMove) {
          const mod = eff.interceptMove(context, gameState);
          if (mod.target) finalTargetPileId = mod.target;
       }
    });
    
    const targetPile = gameState.piles[finalTargetPileId];
    let valid = isStandardMoveValid(movingCards, targetPile);
    effects.forEach(eff => {
       if (eff.canMove) {
          const res = eff.canMove(movingCards, sourcePile, targetPile, valid, gameState);
          if (res !== undefined) valid = res;
       }
    });

    if (!valid) return;

    const newSourceCards = sourcePile.cards.filter(c => !cardIds.includes(c.id));
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
  };

  const completeLevel = () => {
     setShowLevelComplete(false);
     const currentEncounter = runPlan[gameState.runIndex];
     if (currentEncounter.type === 'danger') {
        const blessings = EFFECTS_REGISTRY.filter(e => e.type === 'blessing').sort(() => 0.5 - Math.random());
        setBlessingChoices(blessings); 
        setActiveDrawer('blessing_select');
     } else {
        openShop();
     }
  };
  
  const openShop = () => {
     const exploits = EFFECTS_REGISTRY.filter(e => e.type === 'exploit').sort(() => 0.5 - Math.random()).slice(0, 4);
     const curses = EFFECTS_REGISTRY.filter(e => e.type === 'curse').sort(() => 0.5 - Math.random()).slice(0, 4);
     setShopInventory([...exploits, ...curses]);
     setActiveDrawer('shop');
  };

  const toggleEffect = (id: string, forceState?: boolean) => {
      setActiveEffects(prev => {
         const isActive = prev.includes(id);
         if (forceState === true && isActive) return prev;
         if (forceState === false && !isActive) return prev;
         if (isActive) return prev.filter(e => e !== id);
         const effect = EFFECTS_REGISTRY.find(e => e.id === id);
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
     if ((effect as any).type === 'exploit' || (effect as any).type === 'blessing') {
        if (gameState.coins >= (effect.cost || 50)) {
           setGameState(p => ({ ...p, coins: p.coins - (effect.cost || 50), ownedEffects: [...p.ownedEffects, effect.id] }));
           if ((effect as any).type !== 'blessing') {
               toggleEffect(effect.id, true);
           }
        }
     } else if ((effect as any).type === 'curse') {
        setGameState(p => ({ ...p, coins: p.coins + 50, ownedEffects: [...p.ownedEffects, effect.id] }));
        toggleEffect(effect.id, true); 
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
               className="absolute w-11 h-16 bg-blue-800 rounded border border-white shadow-md flex items-center justify-center"
               style={{ top: `${pileId.includes('tableau') ? index * 10 : 0}px` }}
               onClick={(e) => { e.stopPropagation(); handleCardClick(pileId, index); }}
               onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(pileId, index); }}
               aria-label={`Face down card ${card.id}`}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDoubleClick(pileId, index); } }}
            >
               <div className="w-8 h-12 border border-blue-400/30 rounded flex items-center justify-center"><LayoutGrid className="text-blue-300 opacity-50" size={16} /></div>
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
        <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${visualCard.faceUp ? 'rotate-y-0' : 'rotate-y-180'}`}>
          <div className={`absolute inset-0 backface-hidden bg-white rounded shadow-md flex flex-col items-center justify-between p-0.5 border border-gray-300 ${isHintTarget || isSelected ? 'ring-2 ring-yellow-400' : ''}`}
               style={{ opacity: visualCard.meta?.disabled ? 0.5 : 1, filter: visualCard.meta?.hiddenDimension ? 'grayscale(100%) blur(2px)' : 'none' }}>
             
             {/* Special Blessing Card Rendering */}
             {visualCard.meta?.isBlessing ? (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                     <Sparkles size={16} className="text-purple-500 mb-1" />
                     <div className="text-[6px] font-bold leading-tight text-purple-800">{visualCard.meta.name}</div>
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
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-blue-800 rounded border border-white shadow-md flex items-center justify-center">
             <div className="w-8 h-12 border border-blue-400/30 rounded flex items-center justify-center"><LayoutGrid className="text-blue-300 opacity-50" size={16} /></div>
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
  const currentThreat = EFFECTS_REGISTRY.find(e => e.id === currentEncounter?.effectId);

  if (currentView === 'home') {
     return (
        <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4 gap-8">
           <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-blue-600">SOLITAIRE<br/>ROGUE</h1>
              <p className="text-slate-400">Build your deck. Break the rules.</p>
           </div>
           <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <button onClick={startRun} className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold text-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"><Play fill="currentColor" /> Play</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Gamepad2 size={18}/> Modes</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><BookOpen size={18}/> How To</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2" onClick={() => setShowGlossary(true)}><HelpCircle size={18}/> Glossary</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><RefreshCw size={18}/> Updates</button>
              <button className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><User size={18}/> Profile</button>
              <button onClick={() => setActiveDrawer('settings')} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Settings size={18}/> Settings</button>
           </div>
           {showGlossary && (
              <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold">Glossary</h2>
                    <button onClick={() => setShowGlossary(false)}><X /></button>
                 </div>
                 <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                    {['dangers', 'fears', 'blessings', 'exploits', 'curses'].map(cat => (
                       <button key={cat} onClick={() => setGlossaryTab(cat as any)} className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${glossaryTab === cat ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{cat}</button>
                    ))}
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2">
                    {EFFECTS_REGISTRY.filter(e => {
                       if (glossaryTab === 'dangers') return e.type === 'danger';
                       if (glossaryTab === 'fears') return e.type === 'fear';
                       if (glossaryTab === 'blessings') return e.type === 'blessing';
                       if (glossaryTab === 'exploits') return ['exploit', 'epic', 'legendary', 'rare', 'uncommon'].includes(e.type);
                       if (glossaryTab === 'curses') return e.type === 'curse';
                       return false;
                    }).map(e => (
                       <div key={e.id} className="p-3 bg-slate-800 rounded border border-slate-700">
                          <div className="flex justify-between items-start">
                            <div className="font-bold text-blue-300">{e.name}</div>
                            <div className="text-[10px] uppercase text-slate-500 border border-slate-600 px-1 rounded">{e.rarity || 'Common'}</div>
                          </div>
                          <div className="text-slate-400 text-sm mt-1">{e.description}</div>
                          {e.cost && <div className="text-xs text-yellow-500 mt-1 flex items-center gap-1"><Coins size={10}/> {e.cost}</div>}
                       </div>
                    ))}
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

  return (
    <div className="h-screen w-full bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden relative">
      <div className="flex-1 w-full max-w-2xl mx-auto p-2 pb-48 overflow-y-auto">
        <div className="grid grid-cols-7 gap-1 mb-4">
                <div className="relative w-full aspect-[2/3]">
                   <button type="button" className="w-full h-full bg-blue-900 border border-slate-600 rounded flex items-center justify-center" onClick={() => discardAndDrawHand()} aria-label="Draw from deck">
                        <div className="absolute -top-2 -left-1 bg-slate-700 text-[8px] px-1 rounded-full border border-slate-500 z-10">Draw</div>
                        {gameState.piles.deck.cards.length > 0 ? <div className="font-bold text-blue-300 text-xs">{gameState.piles.deck.cards.length}</div> : <RefreshCw className="text-slate-600 w-4 h-4" />}
                   </button>
                </div>
           <div className="col-span-2 flex items-center justify-center">
              {currentThreat && (
                 <button type="button" aria-label={`Threat: ${currentThreat.name}`} className="w-11 h-16 bg-red-900/50 border-2 border-red-500/50 rounded flex flex-col items-center justify-center text-center p-0.5 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]" onClick={() => alert(`${currentThreat.name}: ${currentThreat.description}`)}>
                    <Skull size={12} className="text-red-400 mb-0.5" />
                    <div className="text-[6px] font-bold leading-tight text-red-200 line-clamp-2">{currentThreat.name}</div>
                    <div className="text-[5px] text-red-300 leading-tight line-clamp-3 opacity-75">{currentThreat.description}</div>
                 </button>
              )}
           </div>
                {foundationPiles.map(pile => (
                   <div key={pile.id} className="relative w-full aspect-[2/3] bg-slate-800/50 rounded border border-slate-700 flex items-center justify-center">
                      {pile.cards.length === 0 ? (
                         <button type="button" aria-label={`Empty foundation ${pile.id}`} className="text-xl opacity-20 text-white bg-transparent border-0" onClick={() => handleCardClick(pile.id, -1)}>♠</button>
                      ) : null}
                      {pile.cards.map((c, i) => renderCard(c, i, pile.id))}
                   </div>
                ))}
        </div>
        <div className="grid grid-cols-7 gap-1 h-full">
               {tableauPiles.map(pile => (
                  <div key={pile.id} className="relative w-full h-full">
                      {pile.locked && <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-red-500"><Lock size={10} /></div>}
                      {pile.cards.length === 0 && (
                         <button type="button" aria-label={`Empty ${pile.id}`} className="absolute inset-0 w-full h-full bg-transparent" onClick={() => handleCardClick(pile.id, -1)} />
                      )}
                      {pile.cards.map((c, idx) => renderCard(c, idx, pile.id))}
                  </div>
               ))}
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
         <div className="absolute top-0 left-0 w-full flex justify-center">
             <div className="relative w-full max-w-md h-0"> 
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-0 pointer-events-auto">
                    {gameState.piles.hand.cards.map((c, i) => renderCard(c, i, 'hand', gameState.piles.hand.cards.length))}
                 </div>
             </div>
         </div>
         <div className={`bg-slate-900 border-t border-slate-800 p-2 w-full max-w-md mx-auto transition-transform duration-300 ${activeDrawer ? '-translate-y-64' : 'translate-y-0'} z-50 relative pointer-events-auto`}>
            {gameState.interactionMode === 'discard_select' && (
               <div className="bg-orange-900/80 text-orange-200 text-xs text-center p-1 mb-1 rounded animate-pulse">Select a card in HAND to discard</div>
            )}
            <div className="flex justify-between px-2 mb-2 relative group">
               {runPlan.map((enc, i) => {
                  const eff = EFFECTS_REGISTRY.find(e => e.id === enc.effectId);
                  const cls = `w-2 h-2 rounded-full ${i < gameState.runIndex ? 'bg-green-500' : i === gameState.runIndex ? 'bg-white animate-pulse' : enc.type === 'danger' ? 'bg-red-900' : 'bg-slate-700'}`;
                  return (
                     <button
                        key={i}
                        type="button"
                        className={cls}
                        onClick={() => alert(`${enc.type.toUpperCase()}: ${eff?.name}\n${eff?.description}`)}
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
               <button onClick={() => setActiveDrawer(activeDrawer === 'pause' ? null : 'pause')} className={`p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 border border-slate-700 ${activeDrawer === 'pause' ? 'bg-slate-700' : ''}`}><Pause size={16} /></button>
               {['exploit', 'curse', 'blessing'].map((type) => {
                  const hasReady = EFFECTS_REGISTRY.filter(e => e.type === type && isEffectReady(e.id, gameState) && (gameState.ownedEffects.includes(e.id) || gameState.debugUnlockAll)).length > 0;
                  return (
                     <button key={type} onClick={() => setActiveDrawer(activeDrawer === type ? null : type as any)} 
                        className={`flex-1 py-2 rounded text-[10px] font-bold border flex items-center justify-center gap-1 
                        ${activeDrawer === type ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 border-slate-700'}
                        ${hasReady ? 'ring-1 ring-yellow-400 text-yellow-100 bg-yellow-900/20' : ''}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}s
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Drawer Content */}
         {activeDrawer && (
            <div className="absolute bottom-0 left-0 w-full h-64 bg-slate-800 border-t border-slate-700 p-4 pb-16 overflow-y-auto z-40 animate-in slide-in-from-bottom-10 pointer-events-auto">
               <div className="max-w-md mx-auto">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">{activeDrawer === 'pause' ? 'Menu' : activeDrawer === 'shop' ? 'The Trade' : activeDrawer === 'feedback' ? 'Feedback' : activeDrawer === 'test' ? 'Test UI' : activeDrawer === 'settings' ? 'Settings' : activeDrawer === 'blessing_select' ? 'Select a Blessing' : `${activeDrawer} Registry`}</h3>
                     <button onClick={() => setActiveDrawer(null)}><ChevronDown className="text-slate-500" /></button>
                  </div>
                  {activeDrawer === 'pause' ? (
                     <div className="grid grid-cols-4 gap-2">
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><SkipBack size={16} /><span className="text-[8px]">Prev</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><Play size={16} /><span className="text-[8px]">Play/Pause</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><SkipForward size={16} /><span className="text-[8px]">Next</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('feedback')}><MessageSquare size={16} /><span className="text-[8px]">Feedback</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('test')}><FlaskConical size={16} /><span className="text-[8px]">Test UI</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600"><Save size={16} /><span className="text-[8px]">Save</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('resign')}><Flag size={16} /><span className="text-[8px]">Resign</span></button>
                        <button className="p-2 bg-slate-700 rounded flex flex-col items-center gap-1 text-slate-300 hover:bg-slate-600" onClick={() => setActiveDrawer('settings')}><Settings size={16} /><span className="text-[8px]">Settings</span></button>
                     </div>
                  ) : activeDrawer === 'test' ? (
                     <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                           <input type="number" value={testAmount} onChange={(e) => setTestAmount(Number.parseInt((e.target as HTMLInputElement).value, 10) || 0)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white w-24" />
                           <span className="text-xs text-slate-400">Amount</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <button className="bg-yellow-600 text-white p-2 rounded font-bold flex items-center justify-center gap-2" onClick={() => setGameState(p => ({...p, coins: p.coins + testAmount}))}><Coins size={16}/> Add Coins</button>
                           <button className="bg-emerald-600 text-white p-2 rounded font-bold flex items-center justify-center gap-2" onClick={() => setGameState(p => ({...p, score: p.score + testAmount}))}><Trophy size={16}/> Add Score</button>
                        </div>
                        <button className="bg-purple-600 text-white p-2 rounded font-bold flex items-center justify-center gap-2" onClick={() => setGameState(p => ({...p, debugUnlockAll: !p.debugUnlockAll}))}><Unlock size={16} /> Toggle All</button>
                        <button className="text-xs text-slate-500 underline mt-4" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
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
                              {EFFECTS_REGISTRY.map(e => (
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
                           <button className="flex-1 bg-red-600 text-white py-3 rounded font-bold" onClick={() => { setCurrentView('home'); setActiveDrawer(null); }}>Give Up</button>
                        </div>
                     </div>
                  ) : activeDrawer === 'settings' ? (
                     <div className="flex flex-col gap-4">
                        {['Gameplay', 'Audio', 'Display', 'Data', 'Other'].map(cat => (
                           <div key={cat} className="border-b border-slate-700 pb-2">
                              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{cat}</h4>
                              <div className="flex items-center justify-between text-sm text-slate-200">
                                 <span>Example Option</span>
                                 <div className="w-8 h-4 bg-slate-600 rounded-full relative"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div></div>
                              </div>
                           </div>
                        ))}
                        <button className="text-xs text-slate-500 underline" onClick={() => setActiveDrawer('pause')}>Back to Menu</button>
                     </div>
                  ) : activeDrawer === 'blessing_select' ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-center text-sm text-slate-300 mb-2">Choose a Blessing to add to your deck</div>
                        <div className="grid grid-cols-1 gap-2">
                           {blessingChoices.slice(0,4).map(item => (
                              <div key={item.id} className="p-2 rounded border border-slate-600 bg-slate-700/50 flex justify-between items-center hover:bg-slate-700 cursor-pointer"
                                   onClick={() => {
                                      setGameState(p => ({ ...p, ownedEffects: [...p.ownedEffects, item.id] }));
                                      // Don't activate, just own. It will be added to deck next encounter.
                                      // Special case for startRun: We are already in encounter 0. 
                                      // We need to inject it NOW if we want to use it this turn?
                                      // Or just wait for next? Usually "Add to deck" implies immediate availability or next shuffle.
                                      // Since we are at start of run, let's inject into deck immediately.
                                      if (gameState.runIndex === 0 && gameState.score === 0) {
                                          const card: Card = {
                                              id: `blessing-${item.id}-${Math.random()}`,
                                              suit: 'special', rank: 0, faceUp: false,
                                              meta: { isBlessing: true, effectId: item.id, name: item.name }
                                          };
                                          setGameState(p => ({
                                              ...p,
                                              piles: {
                                                  ...p.piles,
                                                  deck: { ...p.piles.deck, cards: [...p.piles.deck.cards, card].sort(() => 0.5 - Math.random()) }
                                              }
                                          }));
                                          setActiveDrawer(null);
                                      } else {
                                          openShop();
                                      }
                                   }}>
                                 <div><div className="font-bold text-slate-200 text-xs">{item.name}</div><div className="text-slate-400 text-[10px]">{item.description}</div></div>
                                 <Gift size={16} className="text-blue-400" />
                              </div>
                           ))}
                        </div>
                     </div>
                  ) : activeDrawer === 'shop' ? (
                     <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-1 gap-2">
                           {shopInventory.map(item => (
                              <div key={item.id} className="p-2 rounded border border-slate-600 bg-slate-700/50 flex justify-between items-center">
                                 <div><div className="font-bold text-slate-200 text-xs">{item.name}</div><div className="text-slate-400 text-[10px]">{item.description}</div></div>
                                 <button className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={() => buyEffect(item)}>{(item as any).type === 'exploit' ? `Buy ${item.cost || 50}` : 'Take (+50)'}</button>
                              </div>
                           ))}
                        </div>
                        <button onClick={startWanderPhase} className="w-full py-3 mt-4 rounded bg-emerald-600 text-white font-bold flex items-center justify-center gap-2">Depart <ArrowLeftRight size={16}/></button>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 gap-2">
                        {EFFECTS_REGISTRY.filter(e => {
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
                           
                           return (
                              <button
                                 key={effect.id}
                                 type="button"
                                 onClick={() => { if ((effect as any).type !== 'blessing') toggleEffect(effect.id); }}
                                 aria-label={`Toggle effect ${effect.name}`}
                                 className={`p-2 rounded border cursor-pointer text-xs flex justify-between items-center transition-all ${isActive ? 'bg-purple-900/60 border-purple-500' : 'bg-slate-700/30 border-slate-600'} ${isReady ? 'ring-1 ring-yellow-400 bg-yellow-900/20' : ''}`}>
                                 <div>
                                     <div className="font-bold text-slate-200 flex gap-1 items-center">
                                         {effect.name} 
                                         {effect.maxCharges && <span className="text-[9px] bg-slate-600 px-1 rounded text-white">{charges}/{effect.maxCharges}</span>}
                                     </div>
                                     <div className="text-slate-400 text-[10px]">{effect.description}</div>
                                 </div>
                                 {isActive && <div className="w-2 h-2 bg-green-400 rounded-full"></div>}
                              </button>
                           );
                        })}
                        {gameState.ownedEffects.length === 0 && !gameState.debugUnlockAll && <div className="text-center text-slate-500 text-xs py-4">No effects owned yet. Visit the Trade!</div>}
                     </div>
                  )}
               </div>
            </div>
         )}
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