import { GameEffect, Suit, Card, Rank, Pile, GameState } from '../../types';

export const getCardColor = (suit: Suit) => {
  if (suit === 'special') return 'purple';
  return (suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black');
};

export const generateNewBoard = (currentScore: number, currentCoins: number, scoreMult: number, coinMult: number, hardMode: boolean = false, randomChaos: boolean = false): GameState => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];
  suits.forEach(suit => {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: `${suit}-${r}-${Math.random()}`, suit, rank: r as Rank, faceUp: false });
    }
  });
  
  if (randomChaos) {
     deck.forEach(c => {
        c.rank = Math.ceil(Math.random() * 13) as Rank;
        c.suit = suits[Math.floor(Math.random() * 4)];
     });
  }
  
  deck.sort(() => Math.random() - 0.5);

  const piles: Record<string, Pile> = {};
  for (let i = 0; i < 7; i++) {
    const count = hardMode ? 0 : i + 1;
    const pileCards = deck.splice(0, count);
    if (pileCards.length > 0) pileCards[pileCards.length - 1].faceUp = true;
    piles[`tableau-${i}`] = { id: `tableau-${i}`, type: 'tableau', cards: pileCards };
  }
  ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
    piles[`foundation-${suit}`] = { id: `foundation-${suit}`, type: 'foundation', cards: [] };
  });
  
  const handCards = deck.splice(0, 5).map(c => ({ ...c, faceUp: true }));
  piles['deck'] = { id: 'deck', type: 'deck', cards: deck };
  piles['hand'] = { id: 'hand', type: 'hand', cards: handCards };

  return {
    piles,
    score: currentScore,
    coins: currentCoins,
    moves: 0,
    selectedCardIds: null,
    effectState: {},
    scoreMultiplier: scoreMult,
    coinMultiplier: coinMult,
    runIndex: 0,
    currentScoreGoal: 150,
    ownedEffects: [],
    isLevelComplete: false,
    isGameOver: false,
    startTime: Date.now(),
    seed: Math.random().toString(36).substring(7),
    debugUnlockAll: false,
    activeMinigame: null,
    minigameResult: null,
    wanderState: 'none',
    wanderRound: 0,
    wanderOptions: [],
    activeWander: null,
    wanderResultText: null,
    interactionMode: 'normal',
    charges: {}
  };
};

export const EFFECTS_REGISTRY: GameEffect[] = [
  // ⚔️ DANGERS
  { id: 'rules_of_3', name: '3 Rules of 3', type: 'danger', rarity: 'common', cost: 80, description: '3rd card play removes 3 cards from deck.', onMoveComplete: (s, c) => { if(c.source==='deck'||c.source==='hand')return{}; const cnt=(s.effectState.ruleOf3Counter||0)+1; if(cnt>=3){ const d=s.piles['deck']; if(d.cards.length>0) return{piles:{...s.piles, deck:{...d, cards:d.cards.slice(0,-3)}}, effectState:{...s.effectState, ruleOf3Counter:0}}; return{effectState:{...s.effectState, ruleOf3Counter:0}}; } return{effectState:{...s.effectState, ruleOf3Counter:cnt}}; } },
  { id: 'caged_bakeneko', name: 'Caged Bakeneko', type: 'danger', rarity: 'rare', cost: 140, description: 'Tableaus locked. Find Keys.', onActivate: (s) => { const np = {...s.piles}; Object.keys(np).filter(k=>k.startsWith('tableau')).slice(0,3).forEach(k=>np[k].locked=true); return {piles:np}; } },
  { id: 'death_dishonor', name: 'Death before Dishonor', type: 'danger', rarity: 'rare', cost: 150, description: 'Shuffle/Discard penalizes score.', onMoveComplete: (state, context) => (context.source === 'hand' && context.target === 'deck') ? { score: Math.floor(state.score * 0.9) } : {} },
  { id: 'doppelganger', name: 'Doppelgänger', type: 'danger', rarity: 'epic', cost: 190, description: '10 deck cards are fake (0 pts).', onActivate: (s) => { const d=s.piles['deck']; const idx=new Set<number>(); while(idx.size<10 && idx.size < d.cards.length) idx.add(Math.floor(Math.random()*d.cards.length)); const nc=d.cards.map((c,i)=>idx.has(i)?{...c, meta:{...c.meta, isFake:true}}:c); return{piles:{...s.piles, deck:{...d, cards:nc}}}; }, calculateScore: (sc, c) => c.cards.some(k=>k.meta?.isFake)?0:sc, transformCardVisual: (c) => c.meta?.isFake&&c.faceUp?{meta:{...c.meta, showFake:true}}:{} },
  { id: 'excommunication', name: 'Excommunication', type: 'danger', rarity: 'legendary', cost: 240, description: 'No foundation plays allowed.', canMove: (c,s,t) => t.type==='foundation'?false:undefined },
  { id: 'herding_cats', name: 'Herding Cats', type: 'danger', rarity: 'rare', cost: 120, description: '33% for tableau plays to stumble.', interceptMove: (c, s) => (c.target.includes('tableau') && Math.random()<0.33) ? {target:`tableau-${Math.floor(Math.random()*7)}`} : {} },
  { id: 'hostile_takeover', name: 'Hostile Takeover', type: 'danger', rarity: 'epic', cost: 200, description: 'Only suit visible. Rank not shown.', transformCardVisual: (card) => card.faceUp ? { ...card, rank: -1 as unknown as Rank } : {} },
  { id: 'ignorance', name: 'Ignorance', type: 'danger', rarity: 'common', cost: 90, description: 'No Spades or Hearts.', canMove: (c) => c.some(k=>k.suit==='spades'||k.suit==='hearts')?false:undefined, transformCardVisual: (c)=> (c.suit==='spades'||c.suit==='hearts')?{meta:{...c.meta, disabled:true}}:{} },
  { id: 'mandatory_minimum', name: 'Mandatory Minimum', type: 'danger', rarity: 'rare', cost: 130, description: 'Remove 2 cards per shuffle.', onMoveComplete: (s,c) => (c.source==='hand'&&c.target==='deck')?{}:{} },
  { id: 'not_gaslighting', name: 'Not Gaslighting', type: 'danger', rarity: 'rare', cost: 160, description: 'Change face up suit & rank per shuffle.', onMoveComplete: (s,c) => (c.source === 'hand' && c.target === 'deck') ? { piles: {...s.piles} } : {} }, 
  { id: 'schrodingers_deck', name: "Schrödinger's Deck", type: 'danger', rarity: 'epic', cost: 180, description: 'Tableau piles flicker in/out of reality.', onMoveComplete: (s) => { if(Math.random()<0.2){ const id = `tableau-${Math.floor(Math.random()*7)}`; const p = s.piles[id]; if(p) return {piles:{...s.piles, [id]:{...p, hidden: !p.hidden}}}; } return {}; }, canMove: (c,s,t) => (s.hidden||t.hidden) ? false : undefined, transformCardVisual: (c,p) => p?.hidden ? {meta:{...c.meta, hiddenDimension:true}} : {} },
  { id: 'stranglehold', name: 'Stranglehold', type: 'danger', rarity: 'rare', cost: 150, description: 'No tableau to tableau plays.', canMove: (c,s,t) => (s.type==='tableau'&&t.type==='tableau')?false:undefined },
  { id: 'sultan_of_swat', name: 'Sultan of Swat', type: 'danger', rarity: 'legendary', cost: 230, description: 'Red foundations locked until 20 cards scored.' },

  // 😱 FEARS
  { id: 'ball_chain', name: 'Ball & Chain', type: 'fear', rarity: 'common', cost: 70, description: '50% chance tableau plays return to deck.' },
  { id: 'clever_disguise', name: 'Clever Disguise', type: 'fear', rarity: 'rare', cost: 140, description: 'Foundation score is Blackjack hand.' },
  { id: 'cooked_books', name: 'Cooked Books', type: 'fear', rarity: 'rare', cost: 120, description: 'Lose points equal to coins gained.' },
  { id: 'crown_of_martyr', name: 'Crown of Martyr', type: 'fear', rarity: 'epic', cost: 190, description: 'King to Foundation resets Tableau.' },
  { id: 'dementia', name: 'Dementia', type: 'fear', rarity: 'rare', cost: 150, description: 'Randomize hand suits every 10 moves.' },
  { id: 'deregulation', name: 'Deregulation', type: 'fear', rarity: 'rare', cost: 160, description: 'Face down tableau shuffled per 12 plays.' },
  { id: 'eat_the_rich', name: 'Eat the Rich', type: 'fear', rarity: 'common', cost: 100, description: 'Tableau have equal cards at start.' },
  { id: 'endless_hunger', name: 'Endless Hunger', type: 'fear', rarity: 'common', cost: 80, description: 'Tableau plays -5 coin.' },
  { id: 'functional_alcoholic', name: 'Functional Alcoholic', type: 'fear', rarity: 'epic', cost: 200, description: '30% stumble random, success 2x.' },
  { id: 'gerrymandering', name: 'Gerrymandering', type: 'fear', rarity: 'rare', cost: 130, description: '-2 Tableau disabled.' },
  { id: 'hyperfixation', name: 'Hyperfixation', type: 'fear', rarity: 'epic', cost: 180, description: 'Discard costs 20 coin.' },
  { id: 'identity_theft', name: 'Identity Theft', type: 'fear', rarity: 'rare', cost: 140, description: 'Tableau 7 disabled.' },
  { id: 'mood_swings', name: 'Mood Swings', type: 'fear', rarity: 'rare', cost: 120, description: 'Odd/Even ranks score 0 periodically.' },
  { id: 'one_armed_bandit', name: 'One-Armed Bandit', type: 'fear', rarity: 'epic', cost: 190, description: '7s trigger Slots.', onMoveComplete: (s, c) => c.cards[0].rank === 7 ? { triggerMinigame: 'slots' } : {} },
  { id: 'panopticon', name: 'Panopticon', type: 'fear', rarity: 'legendary', cost: 240, description: 'Revealed cards lock. Darts to unlock.', transformCardVisual: (c) => c.meta?.locked ? {meta:{...c.meta, showLock:true}} : {} },
  { id: 'russian_roulette', name: 'Russian Roulette', type: 'fear', rarity: 'rare', cost: 150, description: 'Foundation play triggers Roulette.', onMoveComplete: (s, c) => c.target.includes('foundation') ? { triggerMinigame: 'roulette' } : {} },
  { id: 'schizophrenia', name: 'Schizophrenia', type: 'fear', rarity: 'epic', cost: 200, description: 'Randomize ranks periodically.' },
  { id: 'switcheroo', name: 'Switcheroo', type: 'fear', rarity: 'legendary', cost: 250, description: 'Shuffle face-up tableau on cycle.' },

  // ✨ BLESSINGS
  { id: 'alchemist', name: 'Alchemist', type: 'blessing', rarity: 'rare', cost: 140, description: 'Swap scoring & coins.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => ({ effectState: { ...state.effectState, alchemistActive: !state.effectState.alchemistActive } }), calculateScore: (score, context, state) => state.effectState.alchemistActive ? 0 : score, calculateCoinTransaction: (delta, context, state) => state.effectState.alchemistActive ? delta + (context.target.includes('foundation') ? 10 : 5) : delta },
  { id: 'blacksmith', name: 'Blacksmith', type: 'blessing', rarity: 'common', cost: 90, description: 'Choose ±1 rank for plays.', canMove: (cards, source, target, defaultAllowed) => { if (defaultAllowed) return true; const moving = cards[0]; const top = target.cards[target.cards.length - 1]; if (top) { if (target.type === 'tableau') { if (getCardColor(moving.suit) !== getCardColor(top.suit) && Math.abs(moving.rank - top.rank) === 1) return true; } if (target.type === 'foundation') { if (moving.suit === top.suit && Math.abs(moving.rank - top.rank) === 1) return true; } } return defaultAllowed; } },
  { id: 'charlatan', name: 'Charlatan', type: 'blessing', rarity: 'rare', cost: 130, description: 'Reverse build order.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => ({ effectState: { ...state.effectState, charlatanActive: !state.effectState.charlatanActive } }), canMove: (cards, source, target, defaultAllowed, state) => { if (state.effectState.charlatanActive && target.type === 'tableau' && cards.length > 0) { const moving = cards[0]; const top = target.cards[target.cards.length - 1]; if (top) { const isColorAlt = getCardColor(moving.suit) !== getCardColor(top.suit); if (isColorAlt && top.rank === moving.rank - 1) return true; } } return defaultAllowed; } },
  { id: 'hoarder', name: 'Hoarder', type: 'blessing', rarity: 'rare', cost: 150, description: 'Consecutive suit plays +100%.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => ({ effectState: { ...state.effectState, hoarderActive: true } }), calculateScore: (score, context, state) => { if (state.effectState.hoarderActive && context.cards[0].suit === state.effectState.lastPlayedSuit) return score * 2; return score; }, onMoveComplete: (state, context) => ({ effectState: { ...state.effectState, lastPlayedSuit: context.cards[0].suit } }) },
  { id: 'impersonator', name: 'Impersonator', type: 'blessing', rarity: 'rare', cost: 160, description: 'Combine 2 suits for 5 plays.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => ({ effectState: { ...state.effectState, impersonatorCount: 5 } }), canMove: (cards, source, target, defaultAllowed, state) => { if ((state.effectState.impersonatorCount || 0) > 0 && target.type === 'tableau') { const moving = cards[0]; const top = target.cards[target.cards.length - 1]; if (top && getCardColor(moving.suit) === getCardColor(top.suit) && top.rank === moving.rank + 1) return true; } return defaultAllowed; }, onMoveComplete: (state) => { if ((state.effectState.impersonatorCount || 0) > 0) { return { effectState: { ...state.effectState, impersonatorCount: state.effectState.impersonatorCount - 1 } }; } return {}; } },
  { id: 'jester', name: 'Jester', type: 'blessing', rarity: 'common', cost: 80, description: 'Add 1 wild card to hand.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => { const newPiles = { ...state.piles }; const wildCard: Card = { id: `jester-${Math.random()}`, rank: 0, suit: 'special', faceUp: true, meta: { isWild: true } }; newPiles['hand'].cards = [...newPiles['hand'].cards, wildCard]; return { piles: newPiles }; }, canMove: (cards) => cards[0].meta?.isWild ? true : false, transformCardVisual: (card) => card.meta?.isWild ? { meta: { ...card.meta, showWild: true } } : {} },
  { id: 'klabautermann', name: 'Klabautermann', type: 'blessing', rarity: 'uncommon', cost: 100, description: 'Skip 1 fear encounter.', maxCharges: 2, chargeReset: 'run' },
  { id: 'knock_on_wood', name: 'Knock on Wood', type: 'blessing', rarity: 'common', cost: 50, description: 'Choose card to discard.', maxCharges: 3, chargeReset: 'encounter', onActivate: (state) => ({ interactionMode: 'discard_select' }) },
  { id: 'lobbyist', name: 'Lobbyist', type: 'blessing', rarity: 'epic', cost: 190, description: 'Earn 100 coins to remove curse.' },
  { id: 'maneki_neko', name: 'Maneki-neko', type: 'blessing', rarity: 'epic', cost: 180, description: 'Tableau ignore suit, Foundation ignore rank.', canMove: (cards, source, target, defaultAllowed) => { const moving = cards[0]; const top = target.cards[target.cards.length - 1]; if (!top) return defaultAllowed; if (target.type === 'tableau') return top.rank === moving.rank + 1; if (target.type === 'foundation') return moving.suit === top.suit; return defaultAllowed; } },
  { id: 'martyr', name: 'Martyr', type: 'blessing', rarity: 'epic', cost: 200, description: 'Sacrifice foundation to unlock tableau.' },
  { id: 'oracle', name: 'Oracle', type: 'blessing', rarity: 'rare', cost: 140, description: 'Shuffle suits in deck.', maxCharges: 2, chargeReset: 'encounter', onActivate: (state) => { const newPiles = { ...state.piles }; const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']; newPiles['deck'].cards = newPiles['deck'].cards.map(c => ({ ...c, suit: suits[Math.floor(Math.random() * 4)] })); return { piles: newPiles }; } },
  { id: 'pedant', name: 'Pedant', type: 'blessing', rarity: 'rare', cost: 150, description: '10 Foundation plays = +1 Tableau.', onMoveComplete: (state, context) => { if (context.target.includes('foundation')) { const c = (state.effectState.pedantCount || 0) + 1; if (c >= 10) { const id = `tableau-${Object.keys(state.piles).filter(k=>k.startsWith('tableau')).length}`; return { piles: {...state.piles, [id]: {id, type:'tableau', cards:[]} }, effectState: {...state.effectState, pedantCount: 0} }; } return { effectState: {...state.effectState, pedantCount: c} }; } return {}; } },
  { id: 'schemer', name: 'Schemer', type: 'blessing', rarity: 'rare', cost: 120, description: 'Play from foundation to tableau.', canMove: (cards, s, t, d) => (s.type === 'foundation' && t.type === 'tableau') ? true : d },
  { id: 'sycophant', name: 'Sycophant', type: 'blessing', rarity: 'epic', cost: 180, description: 'Ignore suit/rank on tableau.' },
  { id: 'thief', name: 'Thief', type: 'blessing', rarity: 'rare', cost: 160, description: 'Take buried cards to hand.', canMove: (cards, s, t, d) => (s.type === 'tableau' && t.type === 'hand') ? true : d },
  { id: 'tortoiseshell', name: 'Tortoiseshell', type: 'blessing', rarity: 'rare', cost: 140, description: 'Tableau ignore rank, Foundation ignore suit.', canMove: (cards, source, target, defaultAllowed) => { const moving = cards[0]; const top = target.cards[target.cards.length - 1]; if (!top) return defaultAllowed; if (target.type === 'tableau') return getCardColor(moving.suit) !== getCardColor(top.suit); if (target.type === 'foundation') return moving.rank === top.rank + 1; return defaultAllowed; } },
  { id: 'trickster', name: 'Trickster', type: 'blessing', rarity: 'rare', cost: 130, description: 'Unlock a tableau.', maxCharges: 3, chargeReset: 'encounter', onActivate: (state) => { const locked = Object.values(state.piles).filter(p => p.type === 'tableau' && p.locked); if (locked.length > 0) { const t = locked[0]; return { piles: { ...state.piles, [t.id]: { ...t, locked: false } } }; } return {}; } },
  { id: 'vagrant', name: 'Vagrant', type: 'blessing', rarity: 'epic', cost: 190, description: 'Tableau cards face up.', transformCardVisual: (c, p) => p?.type === 'tableau' ? { faceUp: true } : {} },
  { id: 'wizard', name: 'Wizard', type: 'blessing', rarity: 'legendary', cost: 230, description: '10 Tableau plays = +1 Foundation.', onMoveComplete: (state, context) => { if (context.target.includes('tableau')) { const c = (state.effectState.wizardCount || 0) + 1; if (c >= 10) { const id = `foundation-extra-${Date.now()}`; return { piles: {...state.piles, [id]: {id, type:'foundation', cards:[]} }, effectState: {...state.effectState, wizardCount: 0} }; } return { effectState: {...state.effectState, wizardCount: c} }; } return {}; } },

  // 🌀 EXPLOITS
  { id: 'angel_investor', name: 'Angel Investor', type: 'exploit', rarity: 'epic', cost: 200, description: '4 Jacks = +100 coins.' },
  { id: 'bag_of_holding', name: 'Bag of Holding', type: 'exploit', rarity: 'rare', cost: 140, description: '+2 cards to tableau on start.' },
  { id: 'bait_switch', name: 'Bait & Switch', type: 'exploit', rarity: 'common', cost: 80, description: 'Aces High or Low.' },
  { id: 'beginners_luck', name: "Beginner's Luck", type: 'exploit', rarity: 'rare', cost: 130, description: 'Bonus for playing drawn card.' },
  { id: 'compound_interest', name: 'Compound Interest', type: 'exploit', rarity: 'rare', cost: 150, description: '4 Eights trigger Slots.', onMoveComplete: (s) => { const eights = Object.values(s.piles).reduce((acc, p) => acc + p.cards.filter(c => c.faceUp && c.rank === 8).length, 0); return (eights >= 4 && !s.effectState.compoundTriggered) ? { triggerMinigame: 'slots', effectState: {...s.effectState, compoundTriggered:true} } : {}; } },
  { id: 'counting_cards', name: 'Counting Cards', type: 'exploit', rarity: 'rare', cost: 160, description: 'Face cards always face up.', transformCardVisual: (c) => (c.rank >= 11 || c.rank === 1) ? { faceUp: true } : {} },
  { id: 'creative_accounting', name: 'Creative Accounting', type: 'exploit', rarity: 'epic', cost: 190, description: 'Foundation complete +50 coin.' },
  { id: 'cracked_rock', name: 'Cracked Rock', type: 'exploit', rarity: 'legendary', cost: 240, description: 'Hard Mode NG+.' },
  { id: 'daruma_karma', name: 'Daruma Karma', type: 'exploit', rarity: 'rare', cost: 120, description: 'Lucky suit x3 points.' },
  { id: 'diplomatic_immunity', name: 'Diplomatic Immunity', type: 'exploit', rarity: 'rare', cost: 140, description: 'Just-revealed ignore rank.', canMove: (c,s,t,d,st) => (c.length>0 && c[0].id === st.effectState.justRevealedCardId && t.type === 'tableau') ? true : d },
  { id: 'executive_order', name: 'Executive Order', type: 'exploit', rarity: 'legendary', cost: 250, description: 'Move Foundation -> Tableau.' },
  { id: 'fountain_youth', name: 'Fountain of Youth', type: 'exploit', rarity: 'rare', cost: 150, description: 'Reshuffle foundations.' },
  { id: 'five_finger_discount', name: 'Five-Finger Discount', type: 'exploit', rarity: 'rare', cost: 130, description: 'Draw 5 cards.' },
  { id: 'gift_gab', name: 'Gift of Gab', type: 'exploit', rarity: 'epic', cost: 180, description: 'Reveal +10 coin.' },
  { id: 'get_out_of_jail_free', name: 'Get Out of Jail Free', type: 'exploit', rarity: 'rare', cost: 140, description: '4 Aces trigger Pinball.', onMoveComplete: (s) => { const aces = Object.values(s.piles).reduce((acc, p) => acc + p.cards.filter(c => c.faceUp && c.rank === 1).length, 0); return (aces >= 4 && !s.effectState.jailTriggered) ? { triggerMinigame: 'pinball', effectState: {...s.effectState, jailTriggered:true} } : {}; } },
  { id: 'golden_parachute', name: 'Golden Parachute', type: 'exploit', rarity: 'rare', cost: 160, description: '4 Sixes = +200 coins.', onMoveComplete: (s) => { const sixes = Object.values(s.piles).reduce((acc, p) => acc + p.cards.filter(c => c.faceUp && c.rank === 6).length, 0); return (sixes >= 4 && !s.effectState.parachuteTriggered) ? { coins: s.coins + 200, effectState: {...s.effectState, parachuteTriggered:true} } : {}; } },
  { id: 'insider_trading', name: 'Insider Trading', type: 'exploit', rarity: 'rare', cost: 150, description: 'Pay points to unlock foundation.' },
  { id: 'kindness_strangers', name: 'Kindness of Strangers', type: 'exploit', rarity: 'rare', cost: 120, description: '500 Score = +100 Coins.' },
  { id: 'legitimate_business', name: 'Legitimate Business', type: 'exploit', rarity: 'rare', cost: 140, description: 'Convert Score to Coins.' },
  { id: 'liquid_assets', name: 'Liquid Assets', type: 'exploit', rarity: 'rare', cost: 130, description: 'Convert Coins to Score.' },
  { id: 'loaded_deck', name: 'Loaded Deck', type: 'exploit', rarity: 'epic', cost: 200, description: 'Duplicate face-down cards.' },
  { id: 'martial_law', name: 'Martial Law', type: 'exploit', rarity: 'legendary', cost: 230, description: 'Kings pretend to be Queens.' },
  { id: 'master_debater', name: 'Master Debater', type: 'exploit', rarity: 'legendary', cost: 250, description: 'Remove curse (Free).' },
  { id: 'metro_card', name: 'Metro Card', type: 'exploit', rarity: 'rare', cost: 150, description: 'Unlock all piles.', onActivate: (state) => { const newPiles = { ...state.piles }; let changed = false; Object.keys(newPiles).forEach(pid => { if (newPiles[pid].locked) { newPiles[pid] = { ...newPiles[pid], locked: false }; changed = true; } }); if (changed) return { piles: newPiles }; return {}; } },
  { id: 'nepotism', name: 'Nepotism', type: 'exploit', rarity: 'rare', cost: 140, description: 'Queen summons Ace.' },
  { id: 'nice_rock', name: 'Nice Rock', type: 'exploit', rarity: 'legendary', cost: 240, description: 'New Game+.' },
  { id: 'noble_eightfold_path', name: 'Noble Eightfold Path', type: 'rare', description: '4 Eights trigger Blackjack.', cost: 160, onMoveComplete: (s) => { const eights = Object.values(s.piles).reduce((acc, p) => acc + p.cards.filter(c => c.faceUp && c.rank === 8).length, 0); return (eights >= 4 && !s.effectState.blackjackTriggered) ? { triggerMinigame: 'blackjack', effectState: {...s.effectState, blackjackTriggered:true} } : {}; }},
  { id: 'offshore_account', name: 'Offshore Account', type: 'exploit', rarity: 'common', cost: 90, description: 'Pay to cycle hand.' },
  { id: 'path_least_resistance', name: 'Path of Least Resistance', type: 'exploit', rarity: 'legendary', cost: 230, description: 'Foundation +15 pts.' },
  { id: 'quintessence', name: 'Quintessence', type: 'exploit', rarity: 'legendary', cost: 250, description: '+2 Foundations.' },
  { id: 'synchronicity', name: 'Synchronicity', type: 'exploit', rarity: 'rare', cost: 140, description: 'Win bonus for face down.' },
  { id: 'reverse_psychology', name: 'Reverse Psychology', type: 'exploit', rarity: 'epic', cost: 190, description: 'Swap Hand/Deck top.' },
  { id: 'rose_colored_glasses', name: 'Rose Colored Glasses', type: 'exploit', rarity: 'rare', cost: 150, description: '3 Sevens trigger Poker.', onMoveComplete: (s) => { const sevens = Object.values(s.piles).reduce((acc, p) => acc + p.cards.filter(c => c.faceUp && c.rank === 7).length, 0); return (sevens >= 3 && !s.effectState.pokerTriggered) ? { triggerMinigame: 'poker', effectState: {...s.effectState, pokerTriggered:true} } : {}; } },
  { id: 'sleight_of_hand', name: 'Sleight of Hand', type: 'exploit', rarity: 'epic', cost: 200, description: 'Coin rebate.' },
  { id: 'slush_fund', name: 'Slush Fund', type: 'exploit', rarity: 'rare', cost: 130, description: 'Allow Debt.' },
  { id: 'smoke_mirrors', name: 'Smoke & Mirrors', type: 'exploit', rarity: 'epic', cost: 180, description: 'Pay to split tableau.' },
  { id: 'stolen_valor', name: 'Stolen Valor', type: 'exploit', rarity: 'common', cost: 100, description: 'Play from foundations for -10 points.', canMove: (cards, source, target, defaultAllowed) => { if (source.type === 'foundation' && target.type === 'tableau') { const moving = cards[0]; const targetCard = target.cards[target.cards.length - 1]; if (!targetCard) return moving.rank === 13; return (getCardColor(moving.suit) !== getCardColor(targetCard.suit) && targetCard.rank === moving.rank + 1); } return defaultAllowed; }, calculateScore: (score, context) => { if (context.source.includes('foundation') && context.target.includes('tableau')) { return score - 10; } return score; } },
  { id: 'strange_rock', name: 'Strange Rock', type: 'exploit', rarity: 'legendary', cost: 240, description: 'Chaos Mode NG+.' },
  { id: 'street_smarts', name: 'Street Smarts', type: 'exploit', rarity: 'epic', cost: 190, description: 'Pay to unlock tableau.' },
  { id: 'trust_fund', name: 'Trust Fund', type: 'exploit', rarity: 'rare', cost: 160, description: 'Pay to fill foundation.' },
  { id: 'uncle_timmy_boo', name: 'Uncle Timmy Boo', type: 'exploit', rarity: 'legendary', cost: 250, description: '5 Queens = Win Big.' },
  { id: 'venture_capitol', name: 'Venture Capitol', type: 'exploit', rarity: 'rare', cost: 120, description: 'Sell cards.' },
  { id: 'weighted_dice', name: 'Weighted Dice', type: 'exploit', rarity: 'rare', cost: 130, description: 'Head start.' },
  { id: 'breaking_and_entering', name: 'Breaking & Entering', type: 'exploit', rarity: 'common', cost: 10, description: 'Unlock a pile for 10 coins.' },

  // 🕱 CURSES
  { id: 'analysis_paralysis', name: 'Analysis Paralysis', type: 'curse', rarity: 'common', cost: 80, description: 'Foundation scores 0 but gives coin.' },
  { id: 'annuit_coeptis', name: 'Annuit Coeptis', type: 'curse', rarity: 'rare', cost: 140, description: 'Tableau -coin, Foundation +coin.' },
  { id: 'broken_heart', name: 'Broken Heart', type: 'curse', rarity: 'rare', cost: 130, description: 'Hearts -10 pts.' },
  { id: 'collateral_damage', name: 'Collateral Damage', type: 'curse', rarity: 'common', cost: 70, description: 'Flip adjacent face-down.' },
  { id: 'counterfeiting', name: 'Counterfeiting', type: 'curse', rarity: 'common', cost: 100, description: 'Next card morphs.' },
  { id: 'delusions_grandeur', name: 'Delusions of Grandeur', type: 'curse', rarity: 'common', cost: 90, description: 'Red scores, Black 0.' },
  { id: 'destitution', name: 'Destitution', type: 'curse', rarity: 'rare', cost: 150, description: 'Merge foundations, -50% pts.' },
  { id: 'esrevinu_etanretla', name: 'Esrevinu Etanretla', type: 'curse', rarity: 'epic', cost: 200, description: 'Mirror rules.' },
  { id: 'flesh_wound', name: 'Flesh Wound', type: 'curse', rarity: 'common', cost: 80, description: 'Wound in hand.' },
  { id: 'fog_of_war', name: 'Fog of War', type: 'curse', rarity: 'rare', cost: 160, description: "Can't move stacks." },
  { id: 'forged_signature', name: 'Forged Signature', type: 'curse', rarity: 'rare', cost: 140, description: 'Face cards wild, 0 score.' },
  { id: 'gluttony', name: 'Gluttony', type: 'curse', rarity: 'rare', cost: 150, description: '3x gain, 2x cost.' },
  { id: 'insomnia', name: 'Insomnia', type: 'curse', rarity: 'common', cost: 70, description: 'Cycle costs 50% score.' },
  { id: 'malnourishment', name: 'Malnourishment', type: 'curse', rarity: 'rare', cost: 130, description: '-25% pts, 1.5x coin.' },
  { id: 'malocchio', name: 'Malocchio', type: 'curse', rarity: 'rare', cost: 120, description: 'Foundation blocked/bonus RNG.' },
  { id: 'moon_toad_cheeks', name: 'Moon Toad Cheeks', type: 'curse', rarity: 'common', cost: 90, description: '1 Foundation missing. Others x2.' },
  { id: 'mulligan', name: 'Mulligan', type: 'curse', rarity: 'epic', cost: 190, description: 'Shuffle board every 5 moves.' },
  { id: 'ponzi_scheme', name: 'Ponzi Scheme', type: 'curse', rarity: 'common', cost: 100, description: 'Spade/Club penalty.' },
  { id: 'predatory_lending', name: 'Predatory Lending', type: 'curse', rarity: 'rare', cost: 140, description: 'Stake coins.' },
  { id: 'prick_conscience', name: 'Prick of Conscience', type: 'curse', rarity: 'rare', cost: 160, description: 'Tableau -pts, Foundation +pts.' },
  { id: 'starving_artist', name: 'Starving Artist', type: 'curse', rarity: 'common', cost: 80, description: 'Moves cost coin.' },
  { id: 'veil_uncertainty', name: 'Veil of Uncertainty', type: 'curse', rarity: 'legendary', cost: 230, description: 'No foundations. Tableau x4.' },
  { id: 'fools_gold', name: "Fool's Gold", type: 'curse', rarity: 'common', cost: 70, description: '50% chance 0 coin gain.' },
];
