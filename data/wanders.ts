import type { Wander } from '../types';
import { EFFECTS_REGISTRY } from './effects';

const curses = EFFECTS_REGISTRY.filter(e => e.type === 'curse');
const exploits = EFFECTS_REGISTRY.filter(e => e.type === 'exploit');
const blessings = EFFECTS_REGISTRY.filter(e => e.type === 'blessing');
const fortunes: any[] = []; // Fortunes not needed for random selection in wanders

// ============================================================================
// HELPER UTILITIES FOR onChoose HANDLERS
// ============================================================================

function safeRng(ctx?: any): () => number {
  return (ctx && typeof ctx.rng === 'function') ? ctx.rng : Math.random;
}

function modifyCoin(state: any, amount: number) {
  if (!state) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      coins: (state.resources?.coins || 0) + amount
    }
  };
}

function modifyNextScoreGoalPct(state: any, pctDelta: number) {
  if (!state) return state;
  return {
    ...state,
    effectState: {
      ...state.effectState,
      nextScoreGoalModifier: (state.effectState?.nextScoreGoalModifier || 0) + pctDelta
    }
  };
}

function modifyHandSize(state: any, amount: number) {
  if (!state) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      handSize: Math.max(1, (state.resources?.handSize || 5) + amount)
    }
  };
}

function modifyShuffles(state: any, amount: number) {
  if (!state) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      shuffles: Math.max(0, (state.resources?.shuffles || 0) + amount)
    }
  };
}

function modifyDiscards(state: any, amount: number) {
  if (!state) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      discards: Math.max(0, (state.resources?.discards || 0) + amount)
    }
  };
}

function addRandomFromList(state: any, list: any[], inventoryKey: string, rng?: () => number) {
  if (!state?.run?.inventory) return state;
  const owned = new Set(state.run.inventory[inventoryKey] || []);
  const available = (list || []).filter((i: any) => !owned.has(i.id));
  if (available.length === 0) return state;
  const pick = available[Math.floor((rng || Math.random)() * available.length)];
  let newState = {
    ...state,
    run: {
      ...state.run,
      inventory: {
        ...state.run.inventory,
        [inventoryKey]: [...(state.run.inventory[inventoryKey] || []), pick.id]
      }
    }
  };
  
  // For exploits, also add to activeExploits array so they're recognized as active
  if (inventoryKey === 'exploits') {
    newState = {
      ...newState,
      activeExploits: [...(newState.activeExploits || []), pick.id]
    };
  }
  
  // Note: Passive effects work via canMove/calculateScore hooks automatically
  // onActivate is reserved for player-triggered abilities with charges
  
  return newState;
}

function addRandomCurse(state: any, rng?: () => number) {
  return addRandomFromList(state, curses, 'curses', rng);
}

function addRandomExploit(state: any, rarity: string | undefined, rng?: () => number) {
  let list = exploits || [];
  if (rarity) list = (exploits || []).filter((e: any) => e.rarity === rarity);
  return addRandomFromList(state, list, 'exploits', rng);
}

function addRandomBlessing(state: any, rng?: () => number) {
  return addRandomFromList(state, blessings, 'blessings', rng);
}

function addRandomFortune(state: any, rng?: () => number) {
  return addRandomFromList(state, fortunes, 'fortunes', rng);
}

function removeCurse(state: any, rng?: () => number) {
  if (!state?.run?.inventory?.curses?.length) return state;
  const idx = Math.floor((rng || Math.random)() * state.run.inventory.curses.length);
  const newCurses = [...state.run.inventory.curses];
  newCurses.splice(idx, 1);
  return {
    ...state,
    run: {
      ...state.run,
      inventory: {
        ...state.run.inventory,
        curses: newCurses
      }
    }
  };
}

function removeExploit(state: any, rng?: () => number) {
  if (!state?.run?.inventory?.exploits?.length) return state;
  const idx = Math.floor((rng || Math.random)() * state.run.inventory.exploits.length);
  const newExploits = [...state.run.inventory.exploits];
  newExploits.splice(idx, 1);
  return {
    ...state,
    run: {
      ...state.run,
      inventory: {
        ...state.run.inventory,
        exploits: newExploits
      }
    }
  };
}

function removeBlessing(state: any, rng?: () => number) {
  if (!state?.run?.inventory?.blessings?.length) return state;
  const idx = Math.floor((rng || Math.random)() * state.run.inventory.blessings.length);
  const newBlessings = [...state.run.inventory.blessings];
  newBlessings.splice(idx, 1);
  return {
    ...state,
    run: {
      ...state.run,
      inventory: {
        ...state.run.inventory,
        blessings: newBlessings
      }
    }
  };
}

// Additional helpers for full effect coverage
function addSpecificCurse(state: any, curseId: string) {
  if (!state?.run?.inventory) return state;
  const existing = state.run.inventory.curses || [];
  if (existing.includes(curseId)) return state;
  return { ...state, run: { ...state.run, inventory: { ...state.run.inventory, curses: [...existing, curseId] } } };
}

function addSpecificBlessing(state: any, blessingId: string) {
  if (!state?.run?.inventory) return state;
  const existing = state.run.inventory.blessings || [];
  if (existing.includes(blessingId)) return state;
  return { ...state, run: { ...state.run, inventory: { ...state.run.inventory, blessings: [...existing, blessingId] } } };
}

function addSpecificExploit(state: any, exploitId: string) {
  if (!state?.run?.inventory) return state;
  const existing = state.run.inventory.exploits || [];
  if (existing.includes(exploitId)) return state;
  return { ...state, run: { ...state.run, inventory: { ...state.run.inventory, exploits: [...existing, exploitId] } } };
}

function modifyScore(state: any, amount: number) {
  if (!state?.score) return state;
  return { ...state, score: { ...state.score, current: Math.max(0, (state.score.current || 0) + amount) } };
}

function setCoin(state: any, value: number) {
  if (!state?.resources) return state;
  return { ...state, resources: { ...state.resources, coins: Math.max(0, value) } };
}

function setShuffles(state: any, value: number) {
  if (!state?.resources) return state;
  return { ...state, resources: { ...state.resources, shuffles: Math.max(0, value) } };
}

function setDiscards(state: any, value: number) {
  if (!state?.resources) return state;
  return { ...state, resources: { ...state.resources, discards: Math.max(0, value) } };
}

function loseRandomCard(state: any, rng?: () => number) {
  if (!state?.deck?.length) return state;
  const idx = Math.floor((rng || Math.random)() * state.deck.length);
  const newDeck = [...state.deck];
  newDeck.splice(idx, 1);
  return { ...state, deck: newDeck };
}

function drawCards(state: any, count: number) {
  if (!state?.deck?.length) return state;
  const toDraw = Math.min(count, state.deck.length);
  const drawn = state.deck.slice(0, toDraw);
  return { ...state, deck: state.deck.slice(toDraw), hand: [...(state.hand || []), ...drawn] };
}

function addGameRule(state: any, ruleId: string, value: any = true) {
  if (!state) return state;
  return { ...state, rules: { ...state.rules, [ruleId]: value } };
}

function addHiddenModifier(state: any, modifierId: string, params: any = {}) {
  if (!state) return state;
  return { ...state, hiddenModifiers: [...(state.hiddenModifiers || []), { id: modifierId, ...params }] };
}

function unlockWander(state: any, wanderId: string) {
  if (!state?.run) return state;
  const existing = state.run.unlockedWanders || [];
  if (existing.includes(wanderId)) return state;
  return { ...state, run: { ...state.run, unlockedWanders: [...existing, wanderId] } };
}

function forceNextDanger(state: any, dangerId: string) {
  if (!state?.run) return state;
  return { ...state, run: { ...state.run, forcedCurse: curseId } };
}

// Additional missing helper functions
function modifyCoinPct(state: any, pctDelta: number) {
  if (!state?.resources) return state;
  const currentCoins = state.resources.coins || 0;
  const change = Math.floor(currentCoins * pctDelta);
  return { ...state, resources: { ...state.resources, coins: Math.max(0, currentCoins + change) } };
}

function modifyDiscardBonus(state: any, amount: number) {
  if (!state) return state;
  return { ...state, effectState: { ...state.effectState, discardBonus: (state.effectState?.discardBonus || 0) + amount } };
}

function modifyShuffleBonus(state: any, amount: number) {
  if (!state) return state;
  return { ...state, effectState: { ...state.effectState, shuffleBonus: (state.effectState?.shuffleBonus || 0) + amount } };
}

function addItem(state: any, itemId: string, _params?: any) {
  if (!state?.run?.inventory) return state;
  const existing = state.run.inventory.items || [];
  if (existing.includes(itemId)) return state;
  return { ...state, run: { ...state.run, inventory: { ...state.run.inventory, items: [...existing, itemId] } } };
}

function addQuest(state: any, questId: string) {
  if (!state?.run) return state;
  const existing = state.run.activeQuests || [];
  if (existing.includes(questId)) return state;
  return { ...state, run: { ...state.run, activeQuests: [...existing, questId] } };
}

function addStatus(state: any, statusId: string, duration: number = 1) {
  if (!state?.run) return state;
  const existing = state.run.statuses || [];
  return { ...state, run: { ...state.run, statuses: [...existing, { id: statusId, duration }] } };
}

function loseRandomCardHand(state: any, rng?: () => number) {
  if (!state?.hand?.length) return state;
  const idx = Math.floor((rng || Math.random)() * state.hand.length);
  const newHand = [...state.hand];
  newHand.splice(idx, 1);
  return { ...state, hand: newHand };
}

function removeDeckCardChoice(state: any, _rng?: () => number) {
  // This would normally trigger a UI choice - for now just remove a random card
  return loseRandomCard(state, _rng);
}

function removeRandomBlessing(state: any, rng?: () => number) {
  return removeBlessing(state, rng);
}

function removeRandomCurse(state: any, rng?: () => number) {
  return removeCurse(state, rng);
}

function removeRandomExploit(state: any, rng?: () => number) {
  return removeExploit(state, rng);
}

function removeRandomExploitByRarity(state: any, rarity: string, rng?: () => number) {
  if (!state?.run?.inventory?.exploits?.length) return state;
  const ownedExploits = state.run.inventory.exploits;
  const matchingExploits = ownedExploits.filter((id: string) => {
    const exploit = exploits.find((e: any) => e.id === id);
    return exploit?.rarity === rarity;
  });
  if (!matchingExploits.length) return state;
  const toRemove = matchingExploits[Math.floor((rng || Math.random)() * matchingExploits.length)];
  return { ...state, run: { ...state.run, inventory: { ...state.run.inventory, exploits: ownedExploits.filter((id: string) => id !== toRemove) } } };
}

function rerollInventory(state: any, inventoryKey: string, rng?: () => number) {
  if (!state?.run?.inventory?.[inventoryKey]?.length) return state;
  // Reroll replaces items with new random ones of same type
  const count = state.run.inventory[inventoryKey].length;
  let newState = { ...state, run: { ...state.run, inventory: { ...state.run.inventory, [inventoryKey]: [] } } };
  for (let i = 0; i < count; i++) {
    if (inventoryKey === 'exploits') newState = addRandomExploit(newState, undefined, rng);
    else if (inventoryKey === 'curses') newState = addRandomCurse(newState, rng);
    else if (inventoryKey === 'blessings') newState = addRandomBlessing(newState, rng);
  }
  return newState;
}

function tradeRandomExploitSameRarity(state: any, rng?: () => number) {
  if (!state?.run?.inventory?.exploits?.length) return state;
  const ownedExploits = state.run.inventory.exploits;
  const idx = Math.floor((rng || Math.random)() * ownedExploits.length);
  const toRemove = ownedExploits[idx];
  const exploit = exploits.find((e: any) => e.id === toRemove);
  const rarity = exploit?.rarity || 'common';
  // Remove the old exploit
  let newState = { ...state, run: { ...state.run, inventory: { ...state.run.inventory, exploits: ownedExploits.filter((_: string, i: number) => i !== idx) } } };
  // Add a new one of same rarity
  return addRandomExploit(newState, rarity, rng);
}

// ============================================================================
// WANDER DEFINITIONS
// ============================================================================

export const WANDER_REGISTRY: Wander[] = [
  {
    id: 'three_card_monte',
    category: 'The Crossroads',
    label: 'The Three-Card Monte',
    description: 'You come to a clearing where a roguish man with a missing tooth smiles at you from behind a rickety tree stump. He deftly shuffles three cards. "Ten coin is all it takes to win," he says, his one good eye gleaming.',
    type: 'wander',
    choices: [
      {
        label: 'Play the game',
        result: 'You toss him the coin. He flips the cards. His sleight of hand is masterful - either luck favors you, or it doesn\'t.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyCoin(state, -10);
          if (rng() < 0.5) {
            state = modifyCoin(state, 25);
          } else {
            state = addRandomCurse(state, rng);
          }
          return state;
        }
      },
      {
        label: 'Accuse him of cheating',
        result: '"I like your nerve," he sneers. His reaction could go either way - admiration or offense.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = addRandomExploit(state, 'uncommon', rng);
          } else {
            state = modifyCoin(state, -20);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'dying_thief',
    category: 'The Crossroads',
    label: 'The Dying Thief',
    description: 'A man is slumped against a milestone, a dark stain on his tunic rapidly spreading. He clutches a heavy sack. "Water... please," he coughs, his voice a dry rattle. "It\'s all yours... just... a drink...".',
    type: 'wander',
    choices: [
      {
        label: 'Help him',
        result: 'You spend what little you have on your waterskin and bandages. He gives a grateful sigh and goes still. An act of kindness resonates through fate itself.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      },
      {
        label: 'Take the sack',
        result: 'You pry the sack from his weakening grip. He curses you with his last breath. The coins within are tainted with his final words.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyCoin(state, 30);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'crossroads_demon',
    category: 'The Crossroads',
    label: 'The Crossroads Demon',
    description: 'You arrive at a dusty crossroads at twilight. A tall figure in an impeccably sharp, dark suit smiles. The air smells like sulfur and ozone. "A deal, traveler? A small price for a great boon," his voice is smooth as silk.',
    type: 'wander',
    // Appear later in runs and be more likely if certain ominous fears are present.
    conditions: { minEncounter: 5 },
    baseWeight: 1,
    weightModifiers: {
      // If the player has the 'bad-omens' fear active, this demon is more likely
      byFear: { 'bad-omens': 2 },
      // Certain dangers make dealing with demons less sensible (reduce chance)
      byDanger: { 'endless-hunger': 0.5 }
    },
    choices: [
      {
        label: 'Make the deal',
        result: 'You shake his hand. It\'s unnervingly warm. Gain a random Epic Exploit. Your maximum hand size is permanently reduced by 1.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = addRandomExploit(state, 'epic', rng);
          state = modifyHandSize(state, -1);
          return state;
        }
      },
      {
        label: 'Spit at his feet',
        result: 'He laughs, a dry, hissing sound. "Spirit! I like it. But such gestures have a cost." Your next score goal is reduced by 10%, but you lose 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          state = modifyCoin(state, -10);
          return state;
        }
      }
    ]
  },
  {
    id: 'mirror_pool',
    category: 'The Wilds',
    label: 'The Mirror Pool',
    description: 'In a silent glade, you find a perfectly still, circular pool of water. As you lean over, your reflection meets your gaze, holds it... and then slowly, deliberately, winks.',
    type: 'wander',
    // Reflections may be more tempting when 'bad-omens' is active; also prefer later encounters
    conditions: { minEncounter: 2 },
    baseWeight: 1,
    weightModifiers: { byFear: { 'bad-omens': 1.5 } },
    choices: [
      {
        label: 'Touch the water',
        result: 'Your reflection\'s hand rises to meet yours. It grips tightly - something flows between you, but whether blessing or burden remains to be seen.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = removeCurse(state, rng);
          } else if (state.deck?.length > 0) {
            // lose_random_card - remove a random card from deck
            const idx = Math.floor(rng() * state.deck.length);
            const newDeck = [...state.deck];
            newDeck.splice(idx, 1);
            state = { ...state, deck: newDeck };
          }
          return state;
        }
      },
      {
        label: 'Shatter the surface',
        result: 'You throw a rock into the pool. The image shatters angrily. You feel a chill run down your spine - perhaps some reflections are best left undisturbed.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.25) {
            state = addRandomCurse(state, rng);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'rats_nest',
    category: 'The Wilds',
    label: "The Rat's Nest",
    description: 'The ruins of an old wall are choked with a massive, tangled nest of bones, filth, and rags. The smell is overpowering. A faint glint of gold shines from deep within.',
    type: 'wander',
    // More/less likely depending on entangling fears like buried chains
    baseWeight: 1,
    weightModifiers: { byFear: { 'buried-chains': 0.6 } },
    choices: [
      {
        label: 'Reach inside',
        result: 'You hold your breath and plunge your hand in. Something sharp bites you, and you curse as you withdraw - but your fist closes around a heavy purse of coin.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyCoin(state, 50);
          if (rng() < 0.5) {
            state = addRandomCurse(state, rng);
          }
          return state;
        }
      },
      {
        label: 'Burn the nest',
        result: 'You spend 5 Coin on tinder and set the foul thing ablaze. Shrieks echo from within as it burns. A small act of cleansing. Your next score goal is reduced by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          state = modifyNextScoreGoalPct(state, -0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'unsent_letter',
    category: 'The Wilds',
    label: 'The Unsent Letter',
    description: 'A courier lies face-down on the path, an arrow in his back. A single, wax-sealed letter is still clutched in his hand, addressed to the Queen.',
    type: 'wander',
    choices: [
      {
        label: 'Read the letter',
        result: 'You break the royal seal. The letter details a secret path. Gain a random Rare Exploit, but you also gain the "Broken Vow" Curse.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = addRandomExploit(state, 'rare', rng);
          // add_specific_curse: broken_vow
          if (state?.run?.inventory) {
            state = {
              ...state,
              run: {
                ...state.run,
                inventory: {
                  ...state.run.inventory,
                  curses: [...(state.run.inventory.curses || []), 'broken_vow']
                }
              }
            };
          }
          return state;
        }
      },
      {
        label: 'Bury the courier',
        result: 'A moment of respect for the fallen. You give him a simple burial, checking his belongings respectfully as you lay him to rest.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          if (rng() < 0.1) {
            state = addRandomBlessing(state, rng);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'blind_oracle',
    category: 'The Sanctuary',
    label: 'The Blind Oracle',
    description: 'A blind woman with clouded, white eyes sits on the road. As you approach, her head snaps toward you. "I can see your path, traveler. The threads of your fate are tangled... but the vision costs," she rasps.',
    type: 'wander',
    choices: [
      {
        label: 'Pay for a vision',
        result: 'You hand over 15 Coin. "I see... a shortcut!". Her hand darts out and touches your deck. The top 3 cards of your deck are moved to your hand (can go over hand size).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -15);
          // draw_cards: move top 3 cards from deck to hand
          if (state.deck?.length > 0) {
            const cardsToDraw = Math.min(3, state.deck.length);
            const drawnCards = state.deck.slice(0, cardsToDraw);
            state = {
              ...state,
              deck: state.deck.slice(cardsToDraw),
              hand: [...(state.hand || []), ...drawnCards]
            };
          }
          return state;
        }
      },
      {
        label: 'Ask for a riddle',
        result: '"A fun choice!" Her riddle tests the depths of your wisdom. Your answer will determine your fate.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = addRandomBlessing(state, rng);
          } else {
            state = modifyNextScoreGoalPct(state, 0.1);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'goblins_toll',
    category: 'The Wilds',
    label: "The Goblin's Toll",
    description: 'A small, warty goblin blocks a narrow bridge, banging a crude spear on the stones. "Toll! Toll! Pay in shinies or pay in blood!".',
    type: 'wander',
    choices: [
      {
        label: "Pay the 'shiny'",
        result: 'You toss him 20 Coin. He snatches the coins greedily and waves you past, cackling.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          return state;
        }
      },
      {
        label: "Pay in 'blood'",
        result: 'You draw your weapon. The goblin\'s eyes widen with glee. The fight is short and clumsy, but decisive.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = modifyCoin(state, 30);
          } else {
            state = addRandomCurse(state, rng);
            state = modifyCoin(state, -10);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'haunted_armory',
    category: 'The Forge',
    label: 'The Haunted Armory',
    description: 'You find a stone building containing racks of spectral-looking weapons. A ghostly warrior, silent and hollow-eyed, stands guard. It motions for you to take one.',
    type: 'wander',
    choices: [
      {
        label: 'Take a weapon',
        result: 'You grasp a spectral blade. It feels real. Gain a random Epic Exploit. The ghost haunts you for your theft. Gain a random Curse.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = addRandomExploit(state, 'epic', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Salute the ghost',
        result: 'You show respect for a fallen soldier. The ghost nods once, solemnly, and fades. You feel a sense of peace. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'ring_of_thorns',
    category: 'The Wilds',
    label: 'The Ring of Thorns',
    description: 'A perfect circle of thorny, black briars as tall as a man bars the path. In the center, a single, beautiful red flower pulses with a soft, warm light.',
    type: 'wander',
    choices: [
      {
        label: 'Push through the thorns',
        result: 'You get cut and bleed. Your next score goal is increased by 10%. You retrieve the flower. It crumbles into glittering dust. Gain a random Blessing.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.1);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Go around',
        result: 'The thorns are thick, and it takes time to find a new path. You lose 5 Coin in the brambles, but you are unharmed.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          return state;
        }
      }
    ]
  },
  {
    id: 'skeletal_knight',
    category: 'The Crossroads',
    label: 'The Skeletal Knight',
    description: 'A skeleton in rusted armor, surprisingly intact, blocks the path. One gauntleted hand rests on its sword hilt. As you approach, its jaw clacks shut.',
    type: 'wander',
    choices: [
      {
        label: 'Offer it a toll',
        result: 'You toss 5 Coin at its feet. It seems to nod, its jaw clacking, and steps aside. Strange. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      },
      {
        label: 'Challenge it to a duel',
        result: 'It raises its blade. The ancient warrior moves with surprising grace, but rust has weakened its edge. Steel meets bone in a contest of will.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = addRandomExploit(state, 'uncommon', rng);
          } else {
            state = modifyCoin(state, -20);
            state = addRandomCurse(state, rng);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'weeping_statue',
    category: 'The Sanctuary',
    label: 'The Weeping Statue',
    description: 'You find a marble statue of a weeping angel, its face buried in its hands. Its stone tears feel strangely wet and warm to the touch.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'murmuring-guilt': 1.3, 'bitter-regret': 0.8 } },
    choices: [
      {
        label: 'Taste the tear',
        result: 'You dab a finger and taste it. Salty, and strangely warm. The statue\'s expression seems to shift slightly - whether in blessing or curse, only time will tell.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = removeCurse(state, rng);
          } else {
            state = addRandomCurse(state, rng);
          }
          return state;
        }
      },
      {
        label: 'Comfort the statue',
        result: 'You pat its stone shoulder. A moment of strange empathy. It seems to weep a little less. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'wandering_merchant',
    category: 'The Bazaar',
    label: 'The Wandering Merchant',
    description: 'A merchant with a backpack twice his size hails you. "Bargains! Riches! Wonders! I have just what you need, for the right price...".',
    type: 'wander',
    // Merchant frequency tweaks: more likely if the player previously encountered goblin toll
    baseWeight: 1,
    weightModifiers: { byWanderChoice: { 'goblins_toll': 1.5 } },
    choices: [
      {
        label: "Buy a 'Lost Item'",
        result: 'You pay 30 Coin. The merchant hands you a cloth-wrapped bundle. "Found it on the old road!" Gain a random Uncommon Exploit.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          state = modifyCoin(state, -30);
          state = addRandomExploit(state, 'uncommon', rng);
          return state;
        }
      },
      {
        label: 'Haggle with him',
        result: '"A sharp one!" The merchant\'s eyes gleam with either admiration or annoyance. Your bargaining skills will determine the outcome.',
        onChoose: (ctx) => {
          const rng = safeRng(ctx);
          let state = ctx.gameState;
          if (rng() < 0.5) {
            state = modifyCoin(state, -15);
            state = addRandomExploit(state, 'uncommon', rng);
          } else {
            state = modifyNextScoreGoalPct(state, 0.05);
          }
          return state;
        }
      }
    ]
  },
  {
    id: 'jesters_riddle',
    category: 'The Academy',
    label: "The Jester's Riddle",
    description: 'A jester in motley, juggling three small skulls, capers in the road. "A riddle! A riddle! What has roots as nobody sees, is taller than trees, up, up it goes, and yet never grows?".',
    type: 'wander',
    choices: [
      {
        label: 'Answer "A Mountain"',
        result: '"Correct! Correct!" he shrieks, tossing you a skull. It crumbles to dust, leaving a strange energy behind. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Tell him to get lost',
        result: '"Rude! A critic!" He throws a rotten skull at your head. It splatters. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'empty_gallows',
    category: 'The Crossroads',
    label: 'The Empty Gallows',
    description: 'A sturdy gallows stands on a windswept hill, three nooses swinging gently in the breeze. You feel a palpable sense of judgment.',
    type: 'wander',
    choices: [
      {
        label: 'Test the noose',
        result: 'You morbidly stick your head through. You feel a chill of death, a premonition. The experience leaves you shaken but somehow more focused.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [-0.1] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Cut the ropes',
        result: 'You sever the nooses. An act of defiance against this grim place. Your next score goal is reduced by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'glowing_sword',
    category: 'The Forge',
    label: 'The Glowing Sword',
    description: 'A magnificent sword is embedded to the hilt in a single, perfectly smooth black stone. It glows with a faint, blue light, humming with power.',
    type: 'wander',
    choices: [
      {
        label: 'Try to pull the sword',
        result: 'You grasp the hilt. The metal feels strangely warm. You strain with all your might - the sword will judge your worthiness.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_exploit', params: ['epic'] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      },
      {
        label: 'Leave it for another',
        result: 'You recognize a test you are not prepared for, or a trap. You wisely move on. Gain 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 10);
          return state;
        }
      }
    ]
  },
  {
    id: 'abandoned_child',
    category: 'The Crossroads',
    label: 'The Abandoned Child',
    description: 'A small child sits alone on the road, crying. "I\'m lost... I can\'t find my mommy. Can you help me?". Their eyes are a little too large, their face a little too pale.',
    type: 'wander',
    choices: [
      {
        label: 'Help the child',
        result: 'You waste time walking them to a nearby village. It\'s the right thing to do, though it costs you precious time and energy. You hope kindness will be remembered.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.15] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_blessing', params: [] }], []] }
        ]
      },
      {
        label: 'Ignore the child',
        result: 'You have no time for this. You push past. As you do, the child\'s crying stops, and you hear a soft chuckle. Gain a Curse ("Callous Heart").',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addSpecificCurse(state, 'callous_heart');
          return state;
        }
      }
    ]
  },
  {
    id: 'sudden_storm',
    category: 'The Wilds',
    label: 'The Sudden Storm',
    description: 'The sky darkens instantly, and a freezing rain begins to fall. The wind howls. You see a shallow cave nearby and a tall, solitary tree.',
    type: 'wander',
    choices: [
      {
        label: 'Hide in the cave',
        result: 'You are safe from the rain, but you are not alone. A small, furry beast nips your coin purse and flees. Lose 15 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -15);
          return state;
        }
      },
      {
        label: 'Hide under the tree',
        result: 'Lightning strikes the tree! The raw power of the storm courses through the ancient wood. You feel the electric charge flow through you - but in what form?',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_next_score_goal_pct', params: [0.15] }, { type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'fairy_ring',
    category: 'The Wilds',
    label: 'The Fairy Ring',
    description: 'You find a perfect circle of bright red mushrooms in a glade. Faint, tinkling music seems to come from within. It sounds... inviting.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'mood-swings': 0.6 }, byDanger: { 'synchronicity': 1.2 } },
    choices: [
      {
        label: 'Step into the ring',
        result: 'The music swells! You dance for what feels like minutes, but might be hours. The Fae watch from the shadows, their mood as changeable as the wind.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      },
      {
        label: 'Eat one of the mushrooms',
        result: 'You pluck one and take a bite. It tastes like static electricity and dreams. Your body tingles with unknown consequences.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_exploit', params: ['uncommon'] }], [{ type: 'modify_next_score_goal_pct', params: [0.1] }]] }
        ]
      }
    ]
  },
  {
    id: 'ghastly_procession',
    category: 'The Crossroads',
    label: 'The Ghastly Procession',
    description: 'A procession of silent, ghostly figures floats down the middle of the road, their faces blank and sorrowful. They pass right through the trees.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'bad-omens': 1.2 }, byDanger: { 'fifteen-signs': 1.4 } },
    choices: [
      {
        label: 'Block their path',
        result: 'You stand firm. The ghosts pass right through you, chilling you to the bone. The profound sorrow saps your will. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Join the procession',
        result: 'You fall in line. You march for what feels like an eternity. After a mile, they fade, leaving a small, strange artifact on the ground. Gain a random Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      }
    ]
  },
{
    id: 'poisoners_kit',
    category: 'The Bazaar',
    label: "The Poisoner's Kit",
    description: 'You find a small, intricately carved wooden box half-hidden under a log. Inside are several vials of dark, unlabeled liquids.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byDanger: { 'the-war-within': 0.7 }, byFear: { 'murmuring-guilt': 0.9 } },
    choices: [
      {
        label: 'Test a small drop',
        result: 'You dab a single drop on your tongue. It\'s bitter, with an aftertaste that lingers strangely. Your body will tell you soon enough whether it was wisdom or folly.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_next_score_goal_pct', params: [0.1] }]] }
        ]
      },
      {
        label: 'Destroy the kit',
        result: 'You smash the vials on a rock. The world is a slightly safer place. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'trapped_animal',
    category: 'The Wilds',
    label: 'The Trapped Animal',
    description: 'You hear a pained cry. A beautiful fox is caught in a cruel iron trap, its leg badly wounded. It snarls at you, terrified and in pain.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'murmuring-guilt': 1.5 } },
    choices: [
      {
        label: 'Free the fox',
        result: 'You risk a bite to spring the trap. The fox limps away, but looks back once. You feel a strange connection. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Put it out of its misery',
        result: 'A sad, necessary act. You end its suffering quickly. You salvage the trap for parts. Gain 15 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 15);
          return state;
        }
      }
    ]
  },
  {
    id: 'forgotten_idol',
    category: 'The Sanctuary',
    label: 'The Forgotten Idol',
    description: 'A small, jade idol of a forgotten, multi-limbed god sits on a mossy rock. It seems to pulse with a faint, greedy energy.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byDanger: { 'doppelganger': 0.7 }, byFear: { 'bad-omens': 1.1 } },
    choices: [
      {
        label: 'Pray to the idol',
        result: 'You kneel. The idol\'s many eyes glow. It demands a sacrifice, but offers a reward. Gain a random Rare Exploit, but also gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Topple the idol',
        result: 'You kick the statue, smashing it. You feel a surge of defiance against forgotten, greedy gods. Your next score goal is reduced by 12%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.12);
          return state;
        }
      }
    ]
  },
  {
    id: 'sleeping_giant',
    category: 'The Wilds',
    label: 'The Sleeping Giant',
    description: 'A massive giant is asleep, completely blocking the only mountain pass. His snores sound like distant thunder, shaking the pebbles on the ground.',
  type: 'wander',
  conditions: { minEncounter: 3 },
  baseWeight: 1,
  weightModifiers: { byFear: { 'insomnia': 0.6 } },
    choices: [
      {
        label: 'Try to sneak past',
        result: 'You hold your breath and tiptoe over his massive boot. Each step could be your last - one creak, one shifted pebble, and those thunderous snores could turn to rage.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyNextScoreGoalPct(state, 0.15);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Leave an offering',
        result: 'You gently place 25 Coin on his chest. Perhaps generosity will earn his favor, or perhaps giants simply sleep through all earthly concerns.',
        effects: [
          { type: 'modify_coin', params: [-25] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_blessing', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'gamblers_bones',
    category: 'The Crossroads',
    label: "The Gambler's Bones",
    description: 'A skeleton sits against a tree, a pair of pristine, ivory dice clutched in its bony hand. A small, worn sign at its feet reads: "One last game?"',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'bitter-regret': 0.7 }, byDanger: { 'fancy-8-ball': 1.25 } },
    choices: [
      {
        label: 'Take the dice',
        result: 'You pry them from its grip. They feel strangely lucky. This is no game, this is a new path. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Roll the dice',
        result: 'You roll them "for the skeleton." The bone dice clatter across the stone. Fate will decide what the dead gambler\'s final game brings you.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [30] }], [{ type: 'modify_coin', params: [-10] }]] }
        ]
      }
    ]
  },
  {
    id: 'fishermans_dilemma',
    category: 'The Wilds',
    label: "The Fisherman's Dilemma",
    description: 'A fisherman on a riverbank offers you a choice from his net. "One is a magical fish. The other... is just dinner. Both look the same to me." He holds up two gleaming fish.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'trembling-hands': 0.8 } },
    choices: [
      {
        label: 'Take the Silver Fish',
        result: 'You choose the silver-scaled fish. Its scales shimmer with an otherworldly light as you lift it from the net. Is it magic, or merely beautiful?',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_next_score_goal_pct', params: [-0.05] }]] }
        ]
      },
      {
        label: 'Take the Golden Fish',
        result: 'You choose the golden-scaled fish. It feels heavier than it should, and you wonder if that weight comes from treasure or simply from the fisherman\'s stories.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [30] }], [{ type: 'modify_next_score_goal_pct', params: [-0.05] }]] }
        ]
      }
    ]
  },
  {
    id: 'executioners_block',
    category: 'The Crossroads',
    label: "The Executioner's Block",
    description: 'You find a clearing with a single, massive, blood-stained executioner\'s block. A heavy, black-iron axe is embedded deep in the wood.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'creeping-blight': 0.8 }, byDanger: { 'the-war-within': 1.2 } },
    choices: [
      {
        label: 'Pull the axe free',
        result: 'It takes all your strength, but it comes free. Gain a random Rare Exploit. The block\'s dark aura clings to you. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Sharpen the axe',
        result: 'You pay respects to the grim tool, using your whetstone. You feel a cold resolve, and find a hidden coin. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'chest_of_masks',
    category: 'The Bazaar',
    label: 'The Chest of Masks',
    description: 'You find an unlocked, ornate chest full of strange, wooden masks. Two call to you: one depicts a wildly laughing god, the other a weeping demon.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'mood-swings': 1.2 } },
    choices: [
      {
        label: 'Wear the Laughing Mask',
        result: 'You put it on. You feel a rush of uncontrollable, joyous euphoria! Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Wear the Crying Mask',
        result: 'You put it on. You are overcome with a profound, crushing sorrow. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'forked_tongue',
    category: 'The Crossroads',
    label: 'The Forked Tongue',
    description: 'A well-dressed, foppish noble asks you for directions. You know of two paths: one is the main, safe road, the other is a "shortcut" through a notoriously haunted wood.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'prick-of-conscience': 1.5 } },
    choices: [
      {
        label: 'Tell the truth (Safe Path)',
        result: 'You give him directions for the safe path. He thanks you distractedly and tosses you 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 10);
          return state;
        }
      },
      {
        label: 'Lie (Haunted Path)',
        result: 'You send him to the haunted wood. You feel a dark glee. Gain a random Common Exploit, but also gain a random Curse for your deceit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'common', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'toll_bridge',
    category: 'The Crossroads',
    label: 'The Toll Bridge',
    description: 'A sturdy stone bridge is guarded by a surly, armored guard. "Bridge toll is 20 coin, by order of the Queen. No exceptions." He taps his spear on the ground.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byDanger: { 'crown-of-the-martyr': 0.6 }, byFear: { 'shadow-tax': 0.85 } },
    choices: [
      {
        label: 'Pay the toll',
        result: 'You hand over 20 Coin. The guard nods curtly and lets you pass. A simple, costly transaction.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          return state;
        }
      },
      {
        label: 'Find another way',
        result: 'You spend an hour wading the cold, fast-moving river upstream. It is difficult and exhausting. Your next score goal is increased by 10%, but you save your coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'forsaken_well',
    category: 'The Wilds',
    label: 'The Forsaken Well',
    description: 'You discover an old, forgotten well, its stone rim covered in moss. A faint, otherworldly glow emanates from its depths, pulsing with a cold light.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byDanger: { 'doppelganger': 1.2 } },
    choices: [
      {
        label: 'Descend into the well',
        result: 'You climb down. It\'s full of strange artifacts. Gain a random Rare Exploit, but you feel a dark presence attach to you. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You wisely avoid the strange, glowing hole in the ground. Your prudence saves you time and energy. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'peddler_of_cures',
    category: 'The Bazaar',
    label: 'The Peddler of Cures',
    description: 'A cloaked figure in a damp alleyway beckons you over. "A cure for what ails you," he whispers, holding a vial of *black, bubbling* liquid.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'bitter-regret': 1.4 }, byDanger: { 'endless-hunger': 0.8 } },
    choices: [
      {
        label: 'Drink the concoction',
        result: 'You drink it. It burns. The world twists... and one of your curses is gone! But such cures often come with hidden costs. You sense your purse feels lighter.',
        effects: [
          { type: 'remove_curse', params: [] },
          { type: 'random_outcome', params: [0.5, [{ type: 'set_coin', params: [0] }], []] }
        ]
      },
      {
        label: 'Refuse the offer',
        result: 'You wave him off. He scoffs and melts into the shadows. You feel a small pang of regret, a missed opportunity. Your next score goal is increased by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'lost_coin',
    category: 'The Bazaar',
    label: 'The Lost Coin',
    description: 'You notice a small, tarnished coin lying in the dirt, half-buried near the roots of a gnarled, weeping tree. It seems to pulse with a faint, sorrowful light.',
    type: 'wander',
    choices: [
      {
        label: 'Pick up the coin',
        result: 'You pocket the strange coin. It feels cold against your fingers, and you sense that some objects carry more than just monetary weight.',
        effects: [
          { type: 'modify_coin', params: [10] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Leave it be',
        result: 'You leave the sad coin to its weeping. Your respect for this strange, quiet place is its own reward. The spirits of this place grant you favor.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'whispering_tree',
    category: 'The Wilds',
    label: 'The Whispering Tree',
    description: 'A gnarled, ancient tree with bark that twists into a hundred solemn, crying faces stands before you. "Secrets... secrets..." it whispers on the wind.',
    type: 'wander',
    choices: [
      {
        label: 'Listen to its secrets',
        result: 'You offer 20 Coin to its roots. The whispers become clear, telling you a small truth. Gain one Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -20);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Turn away',
        result: 'You cover your ears and hurry past. The tree\'s whispers turn to curses, and phantom hands rifle through your pockets. You lose 50 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -50);
          return state;
        }
      }
    ]
  },
  {
    id: 'broken_altar',
    category: 'The Sanctuary',
    label: 'The Broken Altar',
    description: 'You come across a small, stone altar cracked down the middle. A small crevice, dark and deep, seems to be waiting for an offering.',
    type: 'wander',
    choices: [
       {
        label: 'Sacrifice a card from your hand',
        result: 'You slip a card into the darkness. Lose 1 random card. If it was a high card (Q/K/J), gain 50 Coin. If not, gain 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          // Remove random card from hand and check if face card
          const hand = state.hand || [];
          if (hand.length > 0) {
            const idx = Math.floor(rng() * hand.length);
            const card = hand[idx];
            state = { ...state, hand: hand.filter((_, i) => i !== idx) };
            // Face cards (J=11, Q=12, K=13) give 50, others give 10
            const isFaceCard = card.value >= 11 && card.value <= 13;
            state = modifyCoin(state, isFaceCard ? 50 : 10);
          }
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You leave the broken altar untouched. As you turn, you spot a glint in the cracks you missed. Gain 20 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 20);
          return state;
        }
      }
    ]
  },
  {
    id: 'lost_pilgrim',
    category: 'The Sanctuary',
    label: 'The Lost Pilgrim',
    description: 'You find a weary pilgrim on the side of the road, their face gaunt and their clothes tattered. "Blessings on you, traveler. My journey is over, but perhaps yours is not."',
    type: 'wander',
    choices: [
      {
        label: 'Offer your hand',
        result: 'You offer what aid you can, including 5 Coin for their journey. The pilgrim thanks you, and teaches you a trick for clearing your mind. Gain +1 discard for the rest of the run.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          state = modifyDiscardBonus(state, 1);
          return state;
        }
      },
      {
        label: 'Walk away',
        result: 'You walk away, leaving the pilgrim to their fate. You feel a small weight on your conscience. Your next score goal is increased by 8%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.08);
          return state;
        }
      }
    ]
  },
  {
    id: 'shrouded_figure',
    category: 'The Crossroads',
    label: 'The Shrouded Figure',
    description: 'A robed figure stands motionless on a bridge, holding out three face-down cards. "Choose," they whisper, their voice like dry leaves.',
    type: 'wander',
    choices: [
      {
        label: 'Take a card',
        result: 'You take a card. It dissolves in your hand, granting you new insight. Gain a random Uncommon Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'uncommon', rng);
          return state;
        }
      },
      {
        label: 'Refuse the offer',
        result: 'You refuse. The figure slowly withdraws their hand and fades away. You feel you may have missed an opportunity. Your next score goal is increased by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'crumbling_shrine',
    category: 'The Sanctuary',
    label: 'The Crumbling Shrine',
    description: 'You find a small, forgotten shrine in the woods, its statue covered in vines. A faint light seems to emanate from two gemstone eyes.',
    type: 'wander',
    choices: [
      {
        label: 'Light a candle',
        result: 'You spend a moment in quiet contemplation. The light glows brighter. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: "Take the statue's eyes",
        result: 'You pry the gems loose. The shrine crumbles to dust. Gain a random Rare Exploit, but the desecration costs you. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'ruined_chest',
    category: 'The Wilds',
    label: 'The Ruined Chest',
  description: 'You find a small, wooden chest, half-buried in the dirt. It is locked, but the wood is rotting and soft.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'prick-of-conscience': 0.9 }, byDanger: { 'doppelganger': 0.9 } },
    choices: [
      {
        label: 'Break the chest open',
        result: 'You kick it open. Inside is a single, perfect feather. Gain a random Blessing. Unfortunately, the chest was a beggar\'s coin-box. Lose all Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          state = setCoin(state, 0);
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You leave the rotting chest. You have no time for petty thievery. Your focus nets you a small find nearby. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'serpents_offer',
    category: 'The Crossroads',
    label: "The Serpent's Offer",
    description: 'A strange, emerald-green serpent with glistening scales slithers out from under a rock. It drops a single, shining playing card in front of you.',
    type: 'wander',
    choices: [
      {
        label: 'Take the card',
        result: 'You take the card. It\'s a blessing in disguise. Add a random Blessing to your hand.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You refuse the serpent\'s "gift." It hisses, but a small, bright-colored bird, no longer scared, lands nearby and drops a glittering seed. Your next score goal is reduced by 15%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      }
    ]
  },
{
    id: 'abandoned_caravan',
    category: 'The Bazaar',
    label: 'The Abandoned Caravan',
    description: 'You stumble upon a ransacked caravan. Wheels are broken, chests are splintered. Amidst the wreckage, a single, battered lockbox remains.',
    type: 'wander',
    choices: [
      {
        label: 'Pry open the lockbox',
        result: 'It\'s tough, but you get it open. The hinges creak loudly in the desolate silence. Inside you find riches, but you can\'t shake the feeling that something heard you.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, 50);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You leave the wreckage undisturbed, paying silent respect to the fallen. A faint shimmer rises from the wreckage, and you feel blessed by the spirits of the departed.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'cursed_relic',
    category: 'The Sanctuary',
    label: 'The Cursed Relic',
  description: 'A small, dark altar stands in a shadowy grove. Upon it rests a twisted metal relic that hums with a sickening, dark energy.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'bad-omens': 1.2 } },
    choices: [
      {
        label: 'Take the relic',
        result: 'You take it. Power flows into you. Gain a random Epic Exploit. You also feel a deep, abiding wrongness. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'epic', rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Desecrate the altar',
        result: 'You topple the altar. The relic shatters. A dark spirit flies out... and a bound one is set free! The spirits\' gratitude battles with their hunger for retribution.',
        effects: [
          { type: 'remove_curse', params: [] },
          { type: 'random_outcome', params: [0.5, [{ type: 'set_coin', params: [0] }], []] }
        ]
      }
    ]
  },
  {
    id: 'grimoire_of_lies',
    category: 'The Academy',
    label: 'The Grimoire of Lies',
  description: 'You find a heavy, leather-bound book lying open on a pedestal. The pages seem to shift and change as you try to read them, whispering conflicting promises.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byDanger: { 'synchronicity': 1.2 }, byFear: { 'murmuring-guilt': 0.9 } },
    choices: [
      {
        label: 'Read the book',
        result: 'You focus and read a passage. You learn a powerful, forbidden secret. Gain a random Rare Exploit. The lies get in your head, clouding your options. Discards & Shuffles -1 for the rest of the run.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          state = modifyDiscardBonus(state, -1);
          state = modifyShuffleBonus(state, -1);
          return state;
        }
      },
      {
        label: 'Burn the book',
        result: 'You set fire to the evil thing. As it burns, a last, spiteful page flies out and turns into coins. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'beggars_blessing',
    category: 'The Sanctuary',
    label: "The Beggar's Blessing",
    description: 'A lonely beggar sits on a stone, holding out a weathered hand. "Alms... alms...". A glimmer of something powerful and ancient seems to reside in their weary eyes.',
    type: 'wander',
    choices: [
      {
        label: 'Give Coin to the beggar',
        result: 'You give 10 Coin generously. The beggar looks up, their eyes clear and sharp. "Thank you." You are filled with a strange warmth. Gain random Blessing & your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -10);
          state = addRandomBlessing(state, rng);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      },
      {
        label: 'Steal from the beggar',
        result: 'You stoop and take the few coins from their bowl. The beggar says nothing, just watches you with sad, knowing eyes. Gain 10 Coin + random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, 10);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'whispering_fountain',
    category: 'The Sanctuary',
    label: 'The Whispering Fountain',
  description: 'You come across a small, mossy fountain in a hidden glade. Its water flows in a strange, shimmering stream, whispering secrets to those who drink.',
  type: 'wander',
  baseWeight: 1,
  weightModifiers: { byFear: { 'murmuring-guilt': 1.1 } },
    choices: [
      {
        label: 'Drink the water',
        result: 'You drink deeply. The whispers fill your mind with ancient knowledge. Some secrets enlighten, while others burden the soul with their weight.',
        effects: [
          { type: 'add_random_exploit', params: ['uncommon'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Drop a Coin in the water',
        result: 'You drop 1 Coin and make a wish. The fountain bubbles happily. Gain random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -1);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'grave_robber',
    category: 'The Crossroads',
    label: 'The Grave Robber',
    description: 'You find a freshly dug grave. A small wooden sign reads, "Here lies the foolish traveler who sought to escape fate. He had nice boots." This looks... promising.',
    type: 'wander',
    choices: [
      {
        label: 'Disturb the grave',
        result: 'You dig. The earth yields both coin and consequences. Whether the traveler\'s fate was his own making or something darker, you\'ve now inherited a piece of it.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 50);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      },
      {
        label: 'Leave it be',
        result: 'You heed the sign. Your wisdom is its own reward, and you spot a satchel nearby, dropped by the grave digger. Gain 75 Coin and your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 75);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'old_hermit',
    category: 'The Wilds',
    label: 'The Old Hermit',
    description: 'An old hermit with a wild, long beard sits outside a small hut, staring into a fire. "Only a few brave enough come this way," he says without looking up.',
    type: 'wander',
    choices: [
      {
        label: 'Ask for guidance',
        result: 'He tosses a rune-stone into the fire. "Your path is... complicated." The flames dance with otherworldly patterns. Such wisdom comes with risks - the spirits do not always approve of mortals seeking their secrets.',
        effects: [
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Walk away',
        result: 'You leave the hermit to his fire. You have your own path to walk, and you find a stash he missed. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'field_of_cursed_flowers',
    category: 'The Wilds',
    label: 'The Field of Cursed Flowers',
    description: 'You come across a field of beautiful, crystalline flowers. Their petals shimmer with an ethereal glow. A strange, sickly sweet scent hangs in the air, making you dizzy.',
    type: 'wander',
    choices: [
      {
        label: 'Touch the flowers',
        result: 'You reach out. A flower dissolves into light in your hand, its essence flowing into you. Beauty and danger often walk hand in hand in places such as this.',
        effects: [
          { type: 'add_random_blessing', params: [] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Burn the flowers',
        result: 'This place is unnatural. You set a fire. The flowers screech as they burn. The air is clean again. Your next score goal is reduced by 20%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.2);
          return state;
        }
      }
    ]
  },
  {
    id: 'ancient_gate',
    category: 'The Academy',
    label: 'The Ancient Gate',
    description: 'You find a massive, stone gate, half-buried in the ground. Its surface is covered in strange, glowing symbols. It seems to lead *down*.',
    type: 'wander',
    choices: [
      {
        label: 'Push the gate open',
        result: 'You push. It grinds open, revealing a dark treasure room below. Ancient riches await, but you sense that not all sleeping things should be disturbed.',
        effects: [
          { type: 'add_random_exploit', params: ['epic'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Leave it be',
        result: 'You don\'t mess with things you don\'t understand. Your caution is rewarded as you find a loose coin nearby. Gain 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 10);
          return state;
        }
      }
    ]
  },
  {
    id: 'lost_locket',
    category: 'The Crossroads',
    label: 'The Lost Locket',
    description: 'You find a small, tarnished silver locket lying on the ground. When you open it, a faint image of a familiar, smiling face looks back at you... before fading.',
    type: 'wander',
    choices: [
      {
        label: 'Keep the locket',
        result: 'You keep it. It feels... important. The weight of someone else\'s memories settles into your pocket, bringing both value and burden.',
        effects: [
          { type: 'modify_coin', params: [50] },
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_shuffle_bonus', params: [-1] }], []] }
        ]
      },
      {
        label: 'Leave it be',
        result: 'You leave the locket where it lies, closing it gently. Someone\'s memory is not your prize. Your empathy bolsters your spirit. Gain 50 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 50);
          return state;
        }
      }
    ]
  },
  {
    id: 'ponderous_turtle',
    category: 'The Wilds',
    label: 'The Ponderous Turtle',
    description: 'A truly ancient turtle with a mossy, gemstone-encrusted shell sits on the path. It looks at you with ancient, unblinking eyes and slowly opens its mouth.',
    type: 'wander',
    choices: [
      {
        label: 'Wait for it to speak',
        result: 'You wait. And wait. After a full minute, it rasps, "To... go... forward... one must... move." You ponder this deep wisdom. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      },
      {
        label: 'Tap its shell',
        result: 'You gently tap its gem-studded shell. It withdraws with a soft hiss. You feel slightly bad about it. Your next score goal is increased by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'architects_ghost',
    category: 'The Academy',
    label: "The Architect's Ghost",
    description: 'A spectral, fussy-looking being glares at your tableau. "It\'s all wrong! The flow! The structure! It\'s a disaster! You\'re putting *that* card *there*? Madness!"',
    type: 'wander',
    choices: [
      {
        label: '"Fix it, then."',
        result: '"Hmph. Fine." The ghost points at your 4th tableau column. "This one. Only... *blue*." (Gamechanging Effect: For the rest of this run, your 4th tableau column can only have cards of a single suit stacked on it) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addGameRule(state, 'tableau_4_suit_lock', true);
          return state;
        }
      },
      {
        label: '"What do you know?"',
        result: '"Insolence! You will build with crooked tools!" The ghost curses your hand. (Gain a Curse: "Crooked Tools": All 2s, 5s, and 8s are unplayable from your hand) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addSpecificCurse(state, 'crooked_tools');
          return state;
        }
      }
    ]
  },
  {
    id: 'alchemists_mistake',
    category: 'The Academy',
    label: 'The Alchemist\'s "Mistake"',
    description: 'You find a small, bubbling cauldron. A note: "FAILED. Too volatile. Do not drink. AT ALL." The potion inside is swirling with all the colors of the rainbow.',
    type: 'wander',
    choices: [
      {
        label: 'Drink it',
        result: 'You drink the volatile concoction. Your insides... rearrange. (Insane Effect: All items in your inventory are "rerolled," replaced with an equal number of new, random items of the same rarity) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = rerollInventory(state, 'exploits', rng);
          return state;
        }
      },
      {
        label: 'Knock it over',
        result: 'You kick the cauldron. The potion spills, burning a hole in the ground. You see a glint inside the hole. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'man_who_sells_holes',
    category: 'The Bazaar',
    label: 'The Man Who Sells Holes',
    description: 'A shady man in a trench coat opens it. "Got some fine... holes... today. Freshly cut." He is holding several perfect, black, circular holes, like patches of night.',
    type: 'wander',
    choices: [
      {
        label: '"I\'ll take one."',
        result: 'You pay 10 Coin. He hands you a hole. You put it on the ground... and it becomes a hole. You look in. It\'s just dirt. You just bought a hole.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 0);
          return state;
        }
      },
      {
        label: '"What do they do?"',
        result: 'He whispers, "They *remove*." You pay him 30 Coin for a hole. You must remove one card from your deck for the run.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -30);
          state = removeDeckCardChoice(state);
          return state;
        }
      }
    ]
  },
  {
    id: 'final_wager',
    category: 'The Crossroads',
    label: 'The Final Wager (Super Rare)',
    description: 'You enter a silent, golden chamber. A disembodied voice booms, "You have come far. I offer one final wager. Double, or Nothing. Choose your stakes."',
    type: 'wander',
    choices: [
      {
        label: '"I wager my status."',
        result: '"BOLD." A coin flips in the air. The fate of your next encounter hangs in the balance - triumph or tribulation.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_next_score_pct', params: [1] }], [{ type: 'modify_next_score_goal_pct', params: [1] }]] }
        ]
      },
      {
        label: '"I wager my posetions."',
        result: '"SAFE." A coin flips. Your earthly wealth dances on the edge of fortune\'s blade.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin_pct', params: [1] }], [{ type: 'set_coin', params: [0] }]] }
        ]
      },
      {
        label: '"I refuse."',
        result: '"Then your story is already written. Leave." You are dismissed, but you find 25 Coin on the way out.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      }
    ]
  },
  {
    id: 'box_of_jitters',
    category: 'The Bazaar',
    label: 'The Box of Jitters',
    description: 'You find a small, wooden box that is vibrating violently. A note on it says, "Do not open. Contains... jitters." It hums and buzzes in your hands.',
    type: 'wander',
    choices: [
      {
        label: 'Open the box',
        result: 'A cloud of buzzing light flies out and zips into your deck. (Gamechanging Effect: For the rest of the run, playing a card to a Foundation automatically plays the top card of the Waste Pile to a valid Tableau spot, if one exists) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addGameRule(state, 'jitters_auto_play', true);
          return state;
        }
      },
      {
        label: 'Sit on the box',
        result: 'You use it as a stool for a rest. The vibrations are... surprisingly nice? You feel energized and blessed.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'blank_faced_god',
    category: 'The Sanctuary',
    label: 'The Blank-Faced God',
    description: 'A statue of a god with no face, just a smooth, marble oval, holds out two hands. The left hand looks cold and empty, the right hand looks warm and open.',
    type: 'wander',
    choices: [
      {
        label: 'Place a Curse in its left hand',
        result: 'You offer one of your Curses. The hand closes, and the Curse is gone. (Lose 1 random Curse). The statue does nothing. You feel lighter.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Place a Blessing in its right hand',
        result: 'You offer one of your Blessings. The hand closes, and the Blessing is gone. (Lose 1 random Blessing). The statue does nothing. You feel hollow.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'countdown_obelisk',
    category: 'The Academy',
    label: 'The Countdown Obelisk',
    description: 'A massive, black obelisk hums with a low, deep thrum. Glowing runes are counting down on its surface... 3... 2... 1....',
    type: 'wander',
    choices: [
      {
        label: 'Wait for it to hit 0',
        result: 'You watch. The runes hit 0. A loud... *CLICK*... is heard. A small stone pigeon pops out, cuckoos, and goes back in. (Nothing happens).',
        onChoose: (ctx) => ctx.gameState
      },
      {
        label: 'Push a rune (interrupt)',
        result: 'You push a glowing rune. The countdown stops. The obelisk\'s hum turns angry. (Gain a Curse: "Runic Dissonance": You can no longer buy "Curse Removal" from the shop) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addSpecificCurse(state, 'runic_dissonance');
          return state;
        }
      }
    ]
  },
  {
    id: 'avaricious_apparition',
    category: 'The Crossroads',
    label: 'The Avaricious Apparition',
    description: 'A ghost in a green eyeshade and sleeve-garters counts spectral coins. "Ah, a customer! I can make you a deal on the back end... for a small fee, of course."',
    type: 'wander',
    choices: [
      {
        label: '"I\'m interested."',
        result: '"A smart one!" You hand over 100 Coin. For the rest of this run, all your "Sell" prices in the shop are now 75% of the Buy Price, up from 50%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -100);
          state = addGameRule(state, 'better_sell_prices', true);
          return state;
        }
      },
      {
        label: '"This seems corrupt."',
        result: '"It\'s just good business!" he sneers. He vanishes in a huff. (Effect: Your next "Reroll" in the shop will cost you triple) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addGameRule(state, 'triple_reroll_cost', true);
          return state;
        }
      }
    ]
  },
  {
    id: 'legendary_sword',
    category: 'The Forge',
    label: 'The "Legendary" Sword (Super Rare)',
    description: 'You find a magnificent, glowing sword... stuck deep in a pile of dried mud. A plaque reads, "Who pulleth this blade from the stone shall be KING".',
    type: 'wander',
    choices: [
      {
        label: 'Try to pull it',
        result: 'You pull. It doesn\'t budge. You strain, pulling with all your might. It\'s really stuck. You strain a muscle. Your next score goal is increased by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.1);
          return state;
        }
      },
      {
        label: 'Kick the "stone"',
        result: 'You kick the dried mud. It\'s... just dried mud. The sword crumbles to the ground. It\'s a cheap, tin replica with a light inside. (Gain 5 Coin from the battery compartment) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 5);
          return state;
        }
      }
    ]
  },
{
    id: 'abandoned_campfire',
    category: 'The Wilds',
    label: 'The Abandoned Campfire',
    description: 'You find a small, hastily abandoned campfire, its embers still glowing. A tattered backpack sits nearby, looking mostly empty.',
    type: 'wander',
    choices: [
      {
        label: 'Rest by the fire',
        result: 'The warmth is comforting. You rest for a moment, and sleep takes you unexpectedly. When you wake, the fire has burned lower, and you remember dreams - though whether they were of hope or shadow, you cannot say.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [-0.1] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      },
      {
        label: 'Rummage through the pack',
        result: 'You find a stash of coin left behind by the previous traveler. Gain 60 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 60);
          return state;
        }
      }
    ]
  },
  {
    id: 'accidental_shove',
    category: 'The Bazaar',
    label: 'The "Accidental" Shove',
    description: 'In a crowded passage, a cloaked figure shoves past you hard. "Watch it," he mutters. You check your pockets... something is missing. (You lose 25 Coin OR 1 random Common Exploit at random!)',
    type: 'wander',
    choices: [
      {
        label: 'Chase them down',
        result: 'You plunge into the crowd. Your legs pump as you weave between bodies, following the flash of their cloak. Whether you catch them depends on your speed, their luck, and the whims of the crowd.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'regain_lost_item', params: [] }, { type: 'modify_coin', params: [40] }], [{ type: 'modify_next_score_goal_pct', params: [0.1] }]] }
        ]
      },
      {
        label: 'Let it go',
        result: 'You curse under your breath and move on. The loss is permanent. You waste a moment being angry. Your next score goal is increased by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'tipsy_bard',
    category: 'The Bazaar',
    label: 'The Tipsy Bard',
    description: 'A bard with a lopsided grin slurs a song at you. "Buy a true artist a drink, traveler? Or perhaps... you have a... *request*?".',
    type: 'wander',
    choices: [
      {
        label: 'Buy him a drink',
        result: 'You spend 5 Coin on a drink. He launches into a bawdy song about a lucky maiden. You feel strangely optimistic. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -5);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Request "The Ballad of Kings"',
        result: 'You tip him 20 Coin for a special request. He plays a stirring epic about a forgotten hero. You feel inspired. Gain a random Common Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -20);
          state = addRandomExploit(state, 'common', rng);
          return state;
        }
      },
      {
        label: 'Heckle his playing',
        result: 'You call out, "You\'re flat!" The performer pauses, and all eyes turn to you. The crowd\'s reaction will determine whether your honesty is appreciated or reviled.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_next_score_goal_pct', params: [-0.05] }], [{ type: 'add_specific_curse', params: ['sticky'] }]] }
        ]
      }
    ]
  },
  {
    id: 'altar_of_sacrifice',
    category: 'The Sanctuary',
    label: 'The Altar of Sacrifice',
    description: 'You find a dark, stone altar with two runed bowls. The left bowl holds a cold, black flame. The right bowl is carved like an open, grasping hand.',
    type: 'wander',
    choices: [
      {
        label: 'Sacrifice to the Flame',
        result: 'You must offer potential. Lose 1 random Exploit from your inventory. The flame roars, sensing your loss. Your next score goal is reduced by 20%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomExploit(state, rng);
          state = modifyNextScoreGoalPct(state, -0.2);
          return state;
        }
      },
      {
        label: 'Sacrifice to the Hand',
        result: 'You must offer luck. Lose 1 random Blessing from your inventory. The hand closes, and when it opens, it\'s full. Gain 75 Coin.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'modify_coin', params: [75] }
        ]
      },
      {
        label: 'Desecrate the altar',
        result: 'You kick the altar over. A wave of dark energy hits you. Gain 2 random Curses, but your next score goal is reduced by 10% for your defiance.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          state = addRandomCurse(state, rng);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'strange_fruit',
    category: 'The Wilds',
    label: 'The Strange Fruit',
    description: 'A single, pulsing, magenta-colored fruit hangs from a dead, black tree. It smells like ozone and honey. It looks... delicious. And terrible.',
    type: 'wander',
    choices: [
      {
        label: 'Eat the fruit',
        result: 'You take a bite. It explodes with flavor - electric, sweet, and strangely alive. Your body will tell you soon enough what manner of fruit this was.',
        effects: [
          { type: 'random_outcome', params: [0.33, [{ type: 'add_random_blessing', params: [] }], [{ type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }]] }
        ]
      },
      {
        label: 'Smash the fruit',
        result: 'You stomp it. It explodes in harmless, sweet-smelling sparks. You find a single, solid pit that looks valuable. Gain 20 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 20);
          return state;
        }
      }
    ]
  },
  {
    id: 'cursed_hoard',
    category: 'The Crossroads',
    label: 'The Cursed Hoard',
    description: 'A massive pile of gold coins sits in the open. It glitters with a faint, sickly green light. It\'s *definitely* trapped.',
    type: 'wander',
    choices: [
      {
        label: 'Take a handful',
        result: 'You quickly grab what you can. The coins feel unnaturally cold against your skin. As you pocket them, you sense that some wealth comes with hidden costs.',
        effects: [
          { type: 'modify_coin', params: [40] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Take it ALL',
        result: 'Greed wins. You scoop armfuls into your pack, ignoring the growing chill in the air. Such avarice rarely goes unpunished.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, 150);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Leave it',
        result: 'You know better. Your willpower is its own reward. You feel focused and clear-headed. Your next score goal is reduced by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'broken_automaton',
    category: 'The Forge',
    label: 'The Broken Automaton',
    description: 'A brass automaton lies sparking on the path, its clockwork heart slowing. It clutches a small, velvet-wrapped object, trying to hand it to you.',
    type: 'wander',
    choices: [
      {
        label: 'Try to repair it',
        result: 'You spend 15 Coin on spare parts and get to work. It whirs, hands you the package, and goes still. Inside is a rare artifact.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -15);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      },
      {
        label: 'Pry the object from its hand',
  result: 'You wrench the item free. The construct\'s fingers tighten reflexively as you pull - whether from lingering magic or simple mechanics, you cannot tell.',
        effects: [
          { type: 'add_random_exploit', params: ['common'] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'mapmakers_table',
    category: 'The Academy',
    label: "The Mapmaker's Table",
    description: 'You find a cluttered table abandoned in a hurry. Maps and scrolls are scattered everywhere. A small, automated coin-slot says "MAPS - 20c".',
    type: 'wander',
    choices: [
      {
        label: 'Buy a "Shortcut Map"',
        result: 'You drop 20 Coin in the slot. A map lights up, showing you a faster way. Gain 80 Coin worth of shortcuts and your next score goal is reduced by 15%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 60);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      },
      {
        label: 'Steal a Scroll',
        result: 'You quickly pocket a promising-looking scroll. Its parchment feels ancient and thrums with power - but whether that power serves light or darkness remains to be discovered.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['rare'] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'time_worn_sundial',
    category: 'The Academy',
    label: 'The Time-Worn Sundial',
    description: 'You find a stone sundial, but the shadow on its face is frozen between two runes, pulsing faintly. It seems... stuck.',
    type: 'wander',
    choices: [
      {
        label: 'Push the shadow forward',
        result: 'You force the gnomon. You feel a lurch as time "skips." Your next score goal is increased by 10%, but you gain a blessing from the time spirits.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyNextScoreGoalPct(state, 0.1);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Push the shadow backward',
        result: 'You force it the other way. You feel a draining sensation, like rewinding a moment. Lose 25 Coin, but your next score goal is reduced by 15%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -25);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      }
    ]
  },
  {
    id: 'echoing_cave',
    category: 'The Wilds',
    label: 'The Echoing Cave',
    description: 'You pass the mouth of a deep, dark cave. When you cough, the echo comes back... as a dry, sibilant whisper. *...cough...*...*foolish...*',
    type: 'wander',
    choices: [
      {
        label: 'Shout a curse',
        result: 'You yell an insult into the dark. The cave roars back at you, shaking the walls. Your words have consequences, and the cave\'s displeasure rattles more than just stone.',
        effects: [
          { type: 'add_random_curse', params: [] },
          { type: 'random_outcome', params: [0.25, [{ type: 'modify_coin', params: [20] }], []] }
        ]
      },
      {
        label: 'Listen',
        result: 'You stand silently. You hear the faint whispers of a dozen other travelers, sharing their mistakes. You learn. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'whispering_well',
    category: 'The Wilds',
    label: 'The Whispering Well',
    description: 'You find a deep, stone well overgrown with silver moss. A cold draft rises, and voices whisper from the dark. "A trade... something of yours for something of ours...".',
    type: 'wander',
    choices: [
      {
        label: 'Toss in a Coin',
        result: 'You toss 1 Coin into the darkness. "A trifle!" the voices giggle. The well accepts your offering, and the spirits below decide whether your gesture deserves reward or indifference.',
        effects: [
          { type: 'modify_coin', params: [-1] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], []] }
        ]
      },
      {
        label: 'Toss in an Exploit',
        result: '"A real trade!" You lose 1 random Common Exploit. A new, more powerful item floats to the surface. Gain 1 random Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomExploitByRarity(state, 'common', rng);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'sleeping_golem',
    category: 'The Forge',
    label: 'The Sleeping Golem',
    description: 'A massive, ancient golem of stone and vine sits dormant, blocking the path. A single, glowing rune is carved into its forehead, pulsing slowly.',
    type: 'wander',
    choices: [
      {
        label: 'Try to sneak past',
        result: 'You hold your breath and tiptoe by. Every step must be perfect - one loose stone, one misplaced breath, and those ancient eyes might open to judge your trespass.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -30);
          state = modifyNextScoreGoalPct(state, 0.15);
          return state;
        }
      },
      {
        label: 'Touch the rune',
        result: 'You place your hand on the glowing symbol. It flashes, draining 40 Coin from your purse. The golem crumbles to dust, revealing a path and a hidden blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -40);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'wayside_shrine',
    category: 'The Sanctuary',
    label: 'The Wayside Shrine',
    description: 'A small, moss-covered shrine to an unknown god of luck stands by the road. A small, empty offering bowl sits at its base, polished by hopeful hands.',
    type: 'wander',
    choices: [
      {
        label: 'Make a small offering',
        result: 'You place 10 Coin in the bowl. You feel a warm, comforting presence. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -10);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Make a significant offering',
        result: 'You place 40 Coin in the bowl. The coins dematerialize. The god is pleased. Gain a random Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -40);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      },
      {
        label: 'Steal from the shrine',
        result: 'You scrape the few tarnished coins left by others. Gain 5 Coin. The air grows cold. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, 5);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'caged_pixie',
    category: 'The Wilds',
    label: 'The Caged Pixie',
    description: 'You find a tiny, rusted iron cage hanging from a branch. Inside, a furious, glittering pixie rattles the bars. "Let me out, you oaf! Let me out, and I\'ll make it worth your while!".',
    type: 'wander',
    choices: [
      {
        label: 'Free the pixie',
        result: 'You break the simple lock. It zips around your head, laughing, and sprinkles glittering dust on you. Gain a random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Sell the pixie',
        result: 'You take the cage. At the next stop, you find a shady buyer. Gain 60 Coin. The pixie glares at you with pure hatred. Gain the "Pixie\'s Ire" Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 60);
          state = addSpecificCurse(state, 'pixies-ire');
          return state;
        }
      }
    ]
  },
  {
    id: 'tree_of_cards',
    category: 'The Wilds',
    label: 'The Tree of Cards',
    description: 'You come across a bizarre, white-barked tree. Instead of leaves, it grows hundreds of playing cards, which flutter in the wind.',
    type: 'wander',
    choices: [
      {
        label: 'Pluck a red card (Heart/Diamond)',
        result: 'You pull a King of Hearts. It turns to dust. "A boon of vitality!" Your next score goal is reduced by 12%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.12);
          return state;
        }
      },
      {
        label: 'Pluck a black card (Spade/Club)',
        result: 'You pull an Ace of Spades. It turns to dust. "A boon of opportunity!" Immediately gain 30 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 30);
          return state;
        }
      },
      {
        label: 'Pluck a card from the roots',
        result: 'You dig at the base and find a mud-caked, rotting Joker. It crumbles to foul-smelling dust. Gain a random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'ghostly_gambler',
    category: 'The Crossroads',
    label: 'The Ghostly Gambler',
    description: 'A translucent, ghostly figure sits at a spectral table, playing solitaire. "This game is dreadfully dull. Care to make a wager on *your* game instead?".',
    type: 'wander',
    choices: [
      {
        label: 'Accept his wager',
        result: '"Excellent." He points to your tableau. "I wager you can\'t build a 4-card stack in the next 3 moves." If you succeed, gain 50 Coin. If you fail, gain the "Gambler\'s Debt" Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          // Quest: build 4-card stack in 3 moves for 50 coin, or get gambler's debt curse
          state = addQuest(state, 'stack_challenge');
          return state;
        }
      },
      {
        label: 'Refuse his wager',
        result: '"Boring." The ghost scoffs and fades away. You feel a chill. 25% chance you gain a Curse from his displeasure.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'resourceful_merchant',
    category: 'The Bazaar',
    label: 'The "Resourceful" Merchant',
    description: 'A merchant waves you down. "I don\'t deal in small coin, friend. I deal in *potential*. Big risk, big reward!"',
    type: 'wander',
    choices: [
      {
        label: 'Gamble 100 Coin',
        result: '"High stakes!" 50% chance to double your investment. 50% chance to lose it all.',
        effects: [
          { type: 'modify_coin', params: [-100] },
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [200] }], []] }
        ]
      },
      {
        label: 'Buy a Mystery Box',
        result: 'You pay 50 Coin. "Could be treasure, could be trash!" You receive either a rare exploit or a curse.',
        effects: [
          { type: 'modify_coin', params: [-50] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['rare'] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'locked_chest',
    category: 'The Bazaar',
    label: 'The Locked Chest',
    description: 'You find a heavy, iron-bound chest half-buried in the mud. The lock is intricate and rusted shut. It looks valuable.',
    type: 'wander',
    choices: [
      {
        label: 'Try to pick the lock',
        result: 'You spend time fumbling with the mechanism. 50% chance it springs open (Gain 75 Coin). 50% chance a poison trap springs (Gain a Curse and your next score goal is increased by 10%).',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [75] }], [{ type: 'add_random_curse', params: [] }, { type: 'modify_next_score_goal_pct', params: [0.1] }]] }
        ]
      },
      {
        label: 'Smash it open',
        result: 'You waste energy forcing the chest, and damage some contents in the process. Gain 40 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 40);
          return state;
        }
      }
    ]
  },
  {
    id: 'rival_adventurer',
    category: 'The Crossroads',
    label: 'The Rival Adventurer',
    description: 'A weary, cynical-looking traveler is resting by a fire. "Tough road. I\'ve got a spare Exploit I\'d sell... or we could trade. One for one. Your call."',
    type: 'wander',
    choices: [
      {
        label: 'Buy their Exploit',
        result: 'You hand over 30 Coin. "Smart move." Gain a random Common Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -30);
          state = addRandomExploit(state, 'common', rng);
          return state;
        }
      },
      {
        label: 'Trade Exploits',
        result: '"Fair is fair." You lose 1 random Exploit from your inventory. You gain 1 random Exploit of the same rarity. (10% chance they "mess up" and give you one of a higher rarity) .',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = tradeRandomExploitSameRarity(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'bottomless_bag',
    category: 'The Bazaar',
    label: 'The Bottomless Bag',
    description: 'You find a small, worn leather bag on the ground. You put your hand inside, and... it keeps going. It feels like it\'s full of *something*.',
    type: 'wander',
    choices: [
      {
        label: 'Pull something out',
        result: 'You reach in and hope for the best. 50% chance you pull out 25 Coin. 25% chance you pull out a random Blessing. 25% chance you pull out a small, angry viper (Gain a Curse).',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [25] }], [{ type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] }]] }
        ]
      },
      {
        label: 'Put something in',
        result: 'You sacrifice some of your progress to the bag. Your next score goal is increased by 15%. The bag rumbles happily and spits out a pile of gold. Gain 100 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.15);
          state = modifyCoin(state, 100);
          return state;
        }
      }
    ]
  },
{
    id: 'philanthropists_test',
    category: 'The Bazaar',
    label: 'The Philanthropist\'s Test',
    description: 'A noble in fine silks eyes your bulging coin purse. "I see you have been... fortunate. True fortune, however, comes from sharing. Prove your quality."',
    type: 'wander',
    choices: [
      {
        label: 'Donate generously',
        result: 'You hand over 50 Coin. The noble smiles. \'A truly worthy soul.\' Gain a random Rare Exploit.',
        effects: [
          { type: 'check_coin', params: [100, 
            [{ type: 'modify_coin', params: [-50] }, { type: 'add_random_exploit', params: ['rare'] }], 
            [] // This choice is hidden if < 100 coin
          ]}
        ]
      },
      {
        label: 'Refuse.',
        result: 'You clutch your purse. The noble\'s face darkens. \'So, just another greedy wretch.\' You are marked by your avarice. Gain the "Avarice" Curse (All shop prices are +25%).',
        effects: [
          { type: 'check_coin', params: [100, 
            [{ type: 'add_specific_curse', params: ['avarice'] }], 
            [] // This choice is hidden if < 100 coin
          ]}
        ]
      },
      {
        label: '"I have little to give."',
        result: '\'Pah! A pauper.\' The noble sneers and walks away. You feel insulted. Your next score goal is increased by 10%.',
        effects: [
          { type: 'check_coin', params: [null, 99, 
            [{ type: 'modify_next_score_goal_pct', params: [0.1] }], 
            [] // This choice is hidden if >= 100 coin
          ]}
        ]
      }
    ]
  },
  {
    id: 'cultists_welcome',
    category: 'The Sanctuary',
    label: 'The Cultist\'s Welcome',
    description: 'A cloaked figure in a dark alcove notices the dark energy clinging to you. Their eyes light up with recognition. "You... you\'ve been *touched* by the shadows. You are one of us. Let us deepen your connection."',
    type: 'wander',
    choices: [
      {
        label: 'Embrace the gift.',
        result: 'You accept their ritual. The power is immense, but costly. Gain 1 Legendary Exploit, but you also gain 1 permanent Curse (cannot be removed).',
        effects: [
          { type: 'check_curses', params: [3, 
            [{ type: 'add_random_exploit', params: ['legendary'] }, { type: 'add_specific_curse', params: ['permanent_curse_1', 'permanent'] }], 
            []
          ]}
        ]
      },
      {
        label: 'Rebuke them.',
        result: 'You deny their offer. The cultist scoffs, \'So be it, pretender.\' You feel a small spark of defiance. Remove 1 random Curse.',
        effects: [
          { type: 'check_curses', params: [3, 
            [{ type: 'remove_curse', params: [] }], 
            []
          ]}
        ]
      },
      {
        label: '"What are you talking about?"',
        result: 'The cultist inspects you... \'Ah. A tourist. Move along.\' You are dismissed. Gain 50 Coin.',
        effects: [
          { type: 'check_curses', params: [null, 2, 
            [{ type: 'modify_coin', params: [50] }], 
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'tinkerers_gamble',
    category: 'The Forge',
    label: 'The Tinkerer\'s Gamble',
    description: 'An old woman with magnifying goggles eyes your pack. "Ooh, that\'s a *Common* trinket you have. So simple! So boring! I can make it *better*. Or... I could break it. Let\'s find out, shall we?"',
    type: 'wander',
    choices: [
      {
        label: '\'Upgrade it.\'',
        result: 'You hand over 20 Coin and a random Common Exploit. She gets to work. 50% chance it becomes a Rare Exploit. 50% chance it shatters, and you lose the Exploit and the Coin.',
        effects: [
          { type: 'check_exploit_rarity', params: ['common', 1, 
            [
              { type: 'modify_coin', params: [-20] },
              { type: 'lose_random_exploit_rarity', params: ['common', 1] },
              { type: 'random_outcome', params: [0.5, 
                [{ type: 'add_random_exploit', params: ['rare'] }], 
                [] // Exploit and coin are already lost
              ]}
            ], 
            []
          ]}
        ]
      },
      {
        label: '\'Don\'t touch my things.\'',
        result: '\'Suit yourself. No fun.\' She snaps her toolkit shut. The next shop\'s reroll will be more expensive. Your next Reroll cost is doubled.',
        effects: [
          { type: 'check_exploit_rarity', params: ['common', 1, 
            [{ type: 'add_game_rule', params: ['double_next_reroll_cost'] }], 
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'beggars_plea',
    category: 'The Bazaar',
    label: 'The Beggar\'s Plea',
    description: 'A beggar with startlingly clear eyes blocks your path. "I don\'t want a trifle. I need 50 coin to buy my freedom. Can you spare it? The Wheel turns, traveler."',
    type: 'wander',
    choices: [
      {
        label: 'Pay his debt',
        result: 'You give him 50 Coin. He bows. \'The Wheel turns indeed. I will not forget this.\' You feel a profound sense of good will. Gain 1 Legendary Exploit.',
        effects: [
          { type: 'check_coin', params: [50, 
            [{ type: 'modify_coin', params: [-50] }, { type: 'add_random_exploit', params: ['legendary'] }], 
            []
          ]}
        ]
      },
      {
        label: '"I don\'t have it."',
        result: 'He nods sadly. \'Then we are both prisoners.\' You feel the weight of his words. Gain 1 Curse.',
        effects: [
          { type: 'check_coin', params: [null, 49, 
            [{ type: 'add_random_curse', params: [] }], 
            []
          ]}
        ]
      },
      {
        label: '"I cannot help you."',
        result: 'He nods sadly. \'Then we are both prisoners.\' You feel the weight of his words. Gain 1 Curse.',
        effects: [
          { type: 'check_coin', params: [50, 
            [{ type: 'add_random_curse', params: [] }], 
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'shadows_embrace',
    category: 'The Crossroads',
    label: 'The Shadow\'s Embrace',
    description: 'You feel the curses on you coalescing, forming a tangible, whispering shadow. It seems to writhe on your back, hungry for... *more*.',
    type: 'wander',
    choices: [
      {
        label: 'Feed the shadow (Accept another Curse)',
        result: 'You accept another random Curse. The shadow seems pleased with its new strength and reveals a secret. Gain 1 random Rare Exploit.',
        effects: [
          { type: 'check_curses', params: [3, 
            [{ type: 'add_random_curse', params: [] }, { type: 'add_random_exploit', params: ['rare'] }], 
            []
          ]}
        ]
      },
      {
        label: 'Fight it off',
        result: 'You spend all your will fighting the shadow back. It shrieks and dissipates. You are exhausted. Lose half of your Coin.',
        effects: [
          { type: 'check_curses', params: [3, 
            [{ type: 'modify_coin_pct', params: [-0.5] }], 
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'grumbling_goblin',
    category: 'The Wilds',
    label: 'The Grumbling Goblin',
    description: 'You kick a small, sleeping goblin out of your path. It wakes with a start, yelps, and scrambles into the bushes. "You\'ll pay for that! Grumblespike never forgets!"',
    type: 'wander',
    choices: [
      {
        label: '"Whatever."',
        result: 'The goblin is gone, but you feel like you just made an enemy. You gain the "Grumblespike\'s Grudge" hidden status for the rest of the run.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addStatus(state, 'grumblespikes_grudge', 1);
          return state;
        }
      }
    ]
  },
  {
    id: 'goblins_stash',
    category: 'The Wilds',
    label: 'The Goblin\'s Stash',
    description: 'You spot a poorly-hidden goblin den. A crude trap of string and bells is strung by the entrance.',
    type: 'wander',
    choices: [
      {
        label: 'Sneak in.',
        result: 'You cut the string. Inside is a small stash. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          // Check for Grumblespike's Grudge status (could be string[] or {id}[])
          const statuses = state.run?.statuses || [];
          const hasGrudge = statuses.some((s: any) => 
            typeof s === 'string' ? s === 'grumblespikes_grudge' : s?.id === 'grumblespikes_grudge'
          );
          if (hasGrudge) {
            // Grumblespike ambush! 50% coin, 50% curse
            if (rng() < 0.5) {
              state = modifyCoin(state, 75);
            } else {
              state = addRandomCurse(state, rng);
            }
          } else {
            state = modifyCoin(state, 25);
          }
          return state;
        }
      },
      {
        label: 'Leave it. Not worth the smell.',
        result: 'You bypass the den. Your next score goal is reduced by 5% for your prudence.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'goblin_ambush',
    category: 'The Wilds',
    label: 'The Goblin Ambush',
    description: 'A group of three, giggling goblins leap out from the bushes, waving pointy sticks. "Giv\'us shiiiinies!"',
    type: 'wander',
    choices: [
      {
        label: 'Intimidate them.',
        result: 'You shout and wave your arms. They scatter, terrified. You find some coin they dropped.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 30);
          return state;
        }
      },
      {
        label: 'Toss them a \'shiny\'',
        result: 'You throw 15 Coin at them. They cheer and fight over the coin, letting you pass.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -15);
          return state;
        }
      }
    ]
  },
  {
    id: 'goblin_kings_court',
    category: 'The Wilds',
    label: 'The Goblin King\'s Court',
    description: 'You stumble into a rowdy, torch-lit cavern. A fat, lazy goblin on a throne of junk eyes you.',
    type: 'wander',
    choices: [
      {
        label: 'Offer tribute',
        result: 'You offer 20 Coin. He cackles and takes it. \'Pass!\' You are shoved out.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          return state;
        }
      },
      {
        label: 'Try to sneak past',
        result: 'You slip by in the shadows.',
        onChoose: (ctx) => ctx.gameState
      }
    ]
  },
  {
    id: 'unnerving_totem',
    category: 'The Wilds',
    label: 'The Unnerving Totem',
    description: 'You find a small, wooden totem of a leering, many-eyed beast. It feels cold to the touch and seems to... watch you.',
    type: 'wander',
    choices: [
      {
        label: 'Keep the totem',
        result: 'You gain the "Unnerving Totem" item. The description says: \'It seems to be watching... waiting for a sacrifice.\'',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addItem(state, 'unnerving_totem');
          return state;
        }
      },
      {
        label: 'Leave it',
        result: 'You leave the creepy thing behind. You feel much better. The spirits of the forest appreciate your wisdom.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'altar_of_penance',
    category: 'The Sanctuary',
    label: 'The Altar of Penance',
    description: 'A tall, smooth stone altar stands in a quiet clearing. It has a single, cup-shaped depression in the center, stained dark. It feels like it wants an offering.',
    type: 'wander',
    choices: [
      {
        label: 'Offer Coin',
        result: 'You place 30 Coin in the bowl. They dissolve. You feel a weight lifted. Remove 1 random Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -30);
          state = removeCurse(state, rng);
          return state;
        }
      },
      {
        label: 'Offer a Blessing',
        result: 'You sacrifice a random Blessing. The altar hums with satisfaction, trading you power for potential. Gain 1 random Rare Exploit.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      },
      {
        label: 'Sacrifice the Totem',
        result: 'You place the totem in the bowl. The stone *cracks* and the totem *screams*. A dark wave washes over you. Gain 1 Epic Exploit and 2 random Curses.',
        effects: [
          { type: 'check_item', params: ['unnerving_totem',
            [{ type: 'remove_item', params: ['unnerving_totem'] }, { type: 'add_random_exploit', params: ['epic'] }, { type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }],
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'whispering_idol',
    category: 'The Sanctuary',
    label: 'The Whispering Idol',
    description: 'You find another, smaller idol, this one with a large, open mouth. It whispers, "Feed me... feed me...".',
    type: 'wander',
    choices: [
      {
        label: 'Feed it the Totem',
        result: 'The mouth crunches down. The idol\'s eyes glow. \'A fine meal.\' Gain 2 random Blessings and 1 random Curse.',
        effects: [
          { type: 'check_item', params: ['unnerving_totem',
            [{ type: 'remove_item', params: ['unnerving_totem'] }, { type: 'add_random_blessing', params: [] }, { type: 'add_random_blessing', params: [] }, { type: 'add_random_curse', params: [] }],
            []
          ]}
        ]
      },
      {
        label: 'Offer coin',
        result: 'You drop 10 Coin into its mouth. It swallows the coin. \'A morsel.\' Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -10);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      },
      {
        label: 'Offer a card from your hand',
        result: 'You feed it a card. \'More!\' Lose 1 random card from your hand. The totem blesses you in return.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = loseRandomCardHand(state, rng);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'promissory_note',
    category: 'The Bazaar',
    label: 'The Promissory Note',
    description: 'A ghostly hand offers you a scroll. "An investment," it whispers. "Redeemable... *later*. If you last that long."',
    type: 'wander',
    choices: [
      {
        label: 'Accept the note',
        result: 'You pay 25 Coin to the ghost. You get a "Promissory Note" item. The text says: \'Redeemable at the shop in the 4th Trial.\'',
        effects: [
          { type: 'check_trial', params: [1,
            [{ type: 'modify_coin', params: [-25] }, { type: 'add_item', params: ['promissory_note'] }],
            []
          ]}
        ]
      },
      {
        label: 'Refuse the note',
        result: 'The ghost sighs and fades. You feel a pang of... *something*. Was that a mistake? The path ahead feels more daunting. Your next encounter\'s score goal is increased by 10%.',
        effects: [
          { type: 'check_trial', params: [1,
            [{ type: 'modify_next_score_goal_pct', params: [0.1] }],
            []
          ]}
        ]
      }
    ]
  },
  {
    id: 'mysterious_cocoon',
    category: 'The Wilds',
    label: 'The Mysterious Cocoon',
    description: 'You find a large, silk-wrapped cocoon pulsing with a faint, warm light. It\'s twitching slightly.',
    type: 'wander',
    choices: [
      {
        label: 'Take the cocoon',
        result: 'You add the "Pulsing Cocoon" to your inventory. It has a counter: \'Hatches in 2 encounters.\'',
        effects: [
          { type: 'add_item', params: ['pulsing_cocoon', 2] } // The '2' is the counter
        ]
      },
      {
        label: 'Destroy it',
        result: 'You stomp on the cocoon. It bursts with a sickening squelch, but a small gem is inside. Gain 30 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 30);
          return state;
        }
      }
    ]
  },
  {
    id: 'seed_of_time',
    category: 'The Wilds',
    label: 'The Seed of Time',
    description: 'You find a small, pulsating, metallic seed. A note says, "Will bloom when the time is right. Do not rush it."',
    type: 'wander',
    choices: [
      {
        label: 'Plant the seed',
        result: 'You gain a "Gestating Seed" item. It will **hatch in 3 encounters**. (Hatches into `+100 Coin` and `1 Rare Exploit`).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addItem(state, 'gestating_seed', '3');
          return state;
        }
      },
      {
        label: 'Crack it open now',
        result: 'You smash it. It\'s unripe. You find a single, bitter pip. Gain 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 10);
          return state;
        }
      }
    ]
  },
  {
    id: 'desperate_healer',
    category: 'The Sanctuary',
    label: 'The Desperate Healer',
    description: 'A field medic waves you down, his face pale with exhaustion. "Please! I\'m out of supplies. I\'ll trade you my last poultice for *anything*."',
    type: 'wander',
    choices: [
      {
        label: 'Offer Coin',
        result: 'He thanks you as you hand over a portion of your coin. \'This will save three.\' He hands you the poultice. Your next score goal is reduced by 15%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoinPct(state, -0.2);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      },
      {
        label: '"I have my own problems."',
        result: 'He glares. \'May you get what you deserve.\' Your conscience weighs on you. Your next score goal is increased by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'broken_compass',
    category: 'The Wilds',
    label: 'The Broken Compass',
    description: 'You find a compass, its needle spinning wildly, pointing to all directions at once.',
    type: 'wander',
    choices: [
      {
        label: '"Follow it anyway."',
        result: 'You follow its chaotic path. You get hopelessly lost and pay a traveler 30 Coin for directions, but you find a hidden Common Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -30);
          state = addRandomExploit(state, 'common', rng);
          return state;
        }
      },
      {
        label: '"Smash it."',
        result: 'You smash it. The needle stops... pointing at a loose stone. Gain 30 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 30);
          return state;
        }
      }
    ]
  },
  {
    id: 'tax_collector',
    category: 'The Bazaar',
    label: 'The Tax Collector',
    description: 'A stern man in the Queen\'s colors blocks the path. "Taxation. By order of Her Majesty. 10% of all liquid assets."',
    type: 'wander',
    choices: [
      {
        label: 'Pay the tax',
        result: 'He takes his cut of your coin. He nods, marks a ledger. \'A loyal citizen.\' You feel... poorer. But he hands you a "Tax Receipt" item. (This item may prevent another negative event later).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoinPct(state, -0.1);
          state = addItem(state, 'tax_receipt');
          return state;
        }
      },
      {
        label: '"This is robbery!"',
        result: 'He sighs. \'So it is.\' He draws a sword. 50% chance to lose 50% of your Coin. 50% chance he\'s impressed and lets you pass, but you gain the "Traitor" Curse.',
        effects: [
          { type: 'random_outcome', params: [0.5, 
            [{ type: 'modify_coin_pct', params: [-0.5] }], 
            [{ type: 'add_specific_curse', params: ['traitor'] }]
          ]}
        ]
      }
    ]
  },
  {
    id: 'royal_gambit',
    category: 'The Academy',
    label: 'The Royal Gambit',
    description: 'A royal herald stands by a banner. "The Queen is unimpressed with the pace of progress. She offers a great boon... for a show of true commitment."',
    type: 'wander',
    choices: [
      {
        label: '"I pledge my loyalty."',
        result: 'You kneel. Your next score goal is DOUBLED. If you succeed, gain 1 Legendary Exploit. If you fail, gain 2 Curses.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 1);
          state = addQuest(state, "legendary");
          return state;
        }
      },
      {
        label: '"The Queen can wait."',
        result: 'The herald scoffs. \'A dangerous sentiment.\' Your next score goal is increased by 20%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.2);
          return state;
        }
      }
    ]
  },
  {
    id: 'cartographers_mistake',
    category: 'The Academy',
    label: 'The Cartographer\'s Mistake',
    description: 'A flustered cartographer is tearing his hair out by a small desk. "It\'s all wrong! This path doesn\'t exist on my map! But... you just came from it?"',
    type: 'wander',
    choices: [
      {
        label: 'Help him re-draw',
        result: 'You spend 10 Coin on supplies and help him chart the new path. He thanks you, giving you a copy. Gain a random Blessing and your next score goal is reduced by 15%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -10);
          state = addRandomBlessing(state, rng);
          state = modifyNextScoreGoalPct(state, -0.15);
          return state;
        }
      },
      {
        label: '"Explore the \'mistake\' again."',
        result: 'You follow the non-existent path... and find a hidden grove you missed the first time. Gain 1 random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      }
    ]
  },
{
    id: 'blacksmiths_challenge',
    category: 'The Forge',
    label: 'The Blacksmith\'s Challenge',
    description: 'A massive blacksmith with spectral, burning hands eyes your deck. "Your cards! Flimsy! Let me temper them. It will make them *pure*... and remove the chaff."',
    type: 'wander',
    choices: [
      {
        label: '"Temper the deck."',
        result: 'You sacrifice 1 random Common Exploit. He plunges your deck into a spectral fire. You gain 2 Blacksmith Blessings (Permanent deck removal cards).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomExploitByRarity(state, 'common', rng);
          state = addSpecificBlessing(state, 'blacksmith_blessing');
          state = addSpecificBlessing(state, 'blacksmith_blessing');
          return state;
        }
      },
      {
        label: '"They\'re fine as they are."',
        result: 'He shrugs. \'Your loss.\' You spot a pile of his \'failures\' nearby. Gain 15 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 15);
          return state;
        }
      }
    ]
  },
  {
    id: 'phantom_joker',
    category: 'The Crossroads',
    label: 'The Phantom Joker',
    description: 'A jester\'s skull sits on a pike. As you pass, it whispers, "Take my card! It\'s a secret! It can be *anything*... but it doesn\'t like to be used."',
    type: 'wander',
    choices: [
      {
        label: '"Take the card."',
        result: 'Two \'Joker\' cards appear in your hand. You gain 2 Jester Blessings (Blessings that act as wild cards). When played, they are removed from the run and you gain 1 Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addSpecificBlessing(state, 'jester_blessing');
          state = addSpecificBlessing(state, 'jester_blessing');
          return state;
        }
      },
      {
        label: '"Refuse the card."',
        result: 'The skull cackles. \'More fun for me!\' You feel... relieved. Your next score goal is reduced by 5%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.05);
          return state;
        }
      }
    ]
  },
  {
    id: 'pawnbroker',
    category: 'The Bazaar',
    label: 'The Pawnbroker',
    description: 'A shady man in a dark alley gestures. "Sell me something. Anything. I\'ll make it worth your while. I have... eccentric clients."',
    type: 'wander',
    choices: [
      {
        label: 'Sell a random Exploit',
        result: 'You sell 1 random Exploit. He pays you double its worth. Gain 80 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomExploit(state, rng);
          state = modifyCoin(state, 80);
          return state;
        }
      },
      {
        label: 'Sell a random Blessing',
        result: 'You sell 1 random Blessing. \'A trifle, but... acceptable.\' Gain 30 Coin.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'modify_coin', params: [30] }
        ]
      }
    ]
  },
  {
    id: 'barter_fair',
    category: 'The Bazaar',
    label: 'The Barter Fair',
    description: 'A small, impromptu fair is on the road. People are trading goods, not coin.',
    type: 'wander',
    choices: [
      {
        label: '"Trade 75 Coin for an Exploit."',
        result: 'You find a willing partner. You pay 75 Coin and gain 1 Common Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -75);
          state = addRandomExploit(state, 'common', rng);
          return state;
        }
      },
      {
        label: '"Trade a Blessing for an Epic Exploit."',
  result: 'A mysterious figure is interested in your blessings. You trade 1 random Blessing for 1 Epic exploit.',
        effects: [
          { type: 'check_blessings', params: [1, 
            [{ type: 'lose_random_blessing', params: [1] }, { type: 'add_random_exploit', params: ['epic'] }], 
            []
          ]}
        ]
      },
      {
        label: '"Just browse."',
        result: 'You find nothing of value, but enjoy the rest. Gain 40 Coin from a dropped purse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 40);
          return state;
        }
      }
    ]
  },
  {
    id: 'time_keepers_error',
    category: 'The Academy',
    label: 'The Time Keeper\'s Error',
    description: 'A robed being, flickering in and out of focus, wails, "I\'ve dropped a moment! The future is... unraveling! Have you seen it?"',
    type: 'wander',
    choices: [
      {
        label: '"Help find it."',
        result: 'You search and find a "Shard of a Moment." You gain a "Reset" item (Allows one-time reset of a failed encounter).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addItem(state, 'encounter_reset');
          return state;
        }
      },
      {
        label: '"Not my problem."',
        result: 'The being glares. \'Then you\'ll share in it!\' You feel a lurch. Time skips and you lose 75 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -75);
          return state;
        }
      }
    ]
  },
  {
    id: 'queens_pardon',
    category: 'The Sanctuary',
    label: 'The Queen\'s Pardon',
    description: 'A royal cleric stands by a shrine. "Her Majesty, in her infinite mercy, has offered a pardon for the afflicted... for a small show of faith."',
    type: 'wander',
    choices: [
      {
        label: 'Pay for a pardon',
        result: 'He accepts your 40 Coin \'donation.\' \'May you be cleansed.\' Remove 1 random Curse.',
        effects: [
          { type: 'check_curses', params: [1, 
            [{ type: 'modify_coin', params: [-40] }, { type: 'remove_curse', params: [] }], 
            []
          ]}
        ]
      },
      {
        label: '"I need no pardon."',
        result: 'He sniffs. \'Pride. A sin all its own.\' 50% chance to gain 1 Curse. 50% chance to gain 1 Blessing.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], [{ type: 'add_random_blessing', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'worn_out_boots',
    category: 'The Wilds',
    label: 'The Worn-Out Boots',
    description: 'You find a pair of sturdy-looking boots on the road. They look... magical, and strangely comfortable.',
    type: 'wander',
    choices: [
      {
        label: '"Put them on."',
        result: 'They fit perfectly! You feel faster and more prepared. Gain 1 free Shuffle for the next 3 encounters.',
        effects: [
          { type: 'add_status', params: ['fleet_of_foot', 3] } // Adds status for 3 encounters
        ]
      },
      {
        label: '"Leave them."',
        result: 'They\'re probably full of holes. You walk on, but find a coin they missed. Gain 10 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 10);
          return state;
        }
      }
    ]
  },
  {
    id: 'gamblers_fallacy',
    category: 'The Crossroads',
    label: 'The Gambler\'s Fallacy',
    description: 'A man at a dice table. "I\'ve lost 5 times in a row! The next one *must* be a winner. Lend me 20 coin. I\'ll split it!"',
    type: 'wander',
    choices: [
      {
        label: 'Lend him the coin',
        result: 'You hand over 20 Coin. He rolls... and loses again. \'Cursed!\' He storms off. You lose your coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          return state;
        }
      },
      {
        label: '"Don\'t be a fool."',
        result: 'You walk away. His shout of \'I won! I finally won!\' echoes behind you. You missed out. Lose 25% of your current Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoinPct(state, -0.25);
          return state;
        }
      }
    ]
  },
  {
    id: 'smugglers_cache',
    category: 'The Bazaar',
    label: 'The Smuggler\'s Cache',
    description: 'You find a loose stone in a crumbling wall. Behind it is a small, locked box.',
    type: 'wander',
    choices: [
      {
        label: 'Pick the lock',
        result: 'You get it open. It\'s full of contraband... powerful stuff. Gain 1 Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      },
      {
        label: 'Report it to the Queen\'s guard',
        result: 'You find a nearby guard. He thanks you and gives you a small reward. Gain 25 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 25);
          return state;
        }
      },
      {
        label: 'Leave it',
        result: 'Not your business. You move on. Your focus is rewarded. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'oracles_warning',
    category: 'The Sanctuary',
    label: 'The Oracle\'s Warning',
    description: 'An oracle with frantic eyes grabs your arm. "The *next* choice you make will be disastrous! Avoid it! Take this instead!"',
    type: 'wander',
    choices: [
      {
        label: 'Heed her warning',
        result: 'You take her small charm. The next Wander event you encounter is automatically skipped. You gain 1 Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addStatus(state, 'skip_next_wander', 1);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: '"I make my own fate."',
        result: 'You brush her off. She was telling the truth. The *next* Wander event you encounter, both outcomes are 50% worse (e.g., Curses are doubled, rewards are halved).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addStatus(state, 'wander_debuff', 1);
          return state;
        }
      }
    ]
  },
  {
    id: 'rusted_horn',
    category: 'The Wilds',
    label: 'The Rusted Horn',
    description: 'You find an old, rusted war horn half-buried in the mud. It looks ancient.',
    type: 'wander',
    choices: [
      {
        label: 'Blow the horn',
        result: 'You blow. A terrible, loud sound echoes. It summons... something. You are beset by spirits. Gain 1 Curse, but they drop a relic. Gain 1 Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      },
      {
        label: 'Polish it',
        result: 'You spend 5 Coin on a polishing cloth. It\'s just a horn, but it looks nice. You sell it at the next stop. Gain 15 Coin.',
        effects: [
          { type: 'modify_coin', params: [-5] },
          { type: 'modify_coin', params: [15] } // Net +10
        ]
      }
    ]
  },
  {
    id: 'scholars_test',
    category: 'The Academy',
    label: 'The Scholar\'s Test',
    description: 'A scholar with a pointed cap blocks your path. "A riddle! What has a neck, but no head, and a body, but no legs?"',
    type: 'wander',
    choices: [
      {
        label: '"A bottle."',
        result: 'Correct. Simple. Here is a simple reward. Gain 40 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 40);
          return state;
        }
      },
      {
        label: '"A curse."',
        result: 'A... creative answer. But wrong. You\'ve wasted my time. The scholar curses you under his breath.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: '"Your mother."',
        result: 'How rude! You are fined for your insolence! Lose 20 Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          return state;
        }
      }
    ]
  },
  {
    id: 'dryads_gift',
    category: 'The Wilds',
    label: 'The Dryad\'s Gift',
    description: 'A woman made of bark and leaves steps from a tree. "The forest is dying. A little of your... *luck*... would heal it. A Blessing for a life?"',
    type: 'wander',
    choices: [
      {
        label: 'Offer a Blessing',
        result: 'You sacrifice 1 random Blessing. The forest blooms. The Dryad thanks you. \'A gift for a gift.\' Gain 150 Coin and your next score goal is reduced by 20%.',
        effects: [
          { type: 'check_blessings', params: [1, 
            [{ type: 'lose_random_blessing', params: [1] }, { type: 'modify_coin', params: [150] }, { type: 'modify_next_score_goal_pct', params: [-0.2] }], 
            []
          ]}
        ]
      },
      {
        label: '"I have no luck to spare."',
        result: 'She sighs. The trees around you seem to wilt. \'Then the path ahead will be barren.\' Gain 1 Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'the_feast',
    category: 'The Wilds',
    label: 'The Feast',
    description: 'You stumble upon a massive, abandoned feast. The food is still warm, the wine still sparkling. It seems... perfect.',
    type: 'wander',
    choices: [
      {
        label: 'Eat greedily',
        result: 'You eat. You feel strong! ...and very, very sick. It was a Fae trap. Gain 1 Blessing, but also Gain 1 Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: '"Just take a snack."',
        result: 'You leave 5 Coin for a small, safe meal. Your prudence pays off. Your next score goal is reduced by 10%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -5);
          state = modifyNextScoreGoalPct(state, -0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'empty_throne',
    category: 'The Academy',
    label: 'The Empty Throne',
    description: 'You find a small, mossy throne in a clearing. A faded plaque reads, "The Queen."',
    type: 'wander',
    choices: [
      {
        label: 'Sit on the throne',
        result: 'You sit. You feel a rush of power and responsibility. This is yours. Gain 1 Rare Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomExploit(state, 'rare', rng);
          return state;
        }
      },
      {
        label: 'Kneel before it',
        result: 'You show respect. A small, spectral hand offers you a flower. Gain 1 Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: 'Spit on it',
        result: 'An act of pure defiance. You feel a chill wind. Gain 1 Curse.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          return state;
        }
      }
    ]
  },
  {
    id: 'ghostly_toll',
    category: 'The Crossroads',
    label: 'The Ghostly Toll',
    description: 'A spectral hand blocks the path. It doesn\'t want coin... it wants *your success*. A shiver runs down your spine as it waits.',
    type: 'wander',
    choices: [
      {
        label: '"Pay the toll."',
        result: 'You agree. The hand vanishes. A heavy weight settles on you. Your next score goal is increased by 20%.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.2);
          return state;
        }
      },
      {
        label: '"Find another way."',
        result: 'You refuse. You must backtrack and pay a ferryman 40 Coin to cross elsewhere.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -40);
          return state;
        }
      }
    ]
  },
  {
    id: 'runic_forge',
    category: 'The Forge',
    label: 'The Runic Forge',
    description: 'You find an ancient, glowing forge. It seems to want to empower your cards, but it requires a sacrifice.',
    type: 'wander',
    choices: [
      {
        label: 'Empower a Rank',
        result: 'You pay 20 Coin and choose a rank (e.g., \'7s\'). For the rest of the run, all 7s are now "Runed" and are worth +5 bonus points when played to a Foundation.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, -20);
          state = addGameRule(state, 'empower_rank_choice', true);
          return state;
        }
      },
      {
        label: 'Temper the Deck',
        result: 'You sacrifice 1 random Common Exploit. The forge\'s magic washes over your deck. You gain 2 Blacksmith Blessings (Permanent deck removal cards).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = removeRandomExploitByRarity(state, 'common', rng);
          state = addSpecificBlessing(state, 'blacksmith_blessing');
          state = addSpecificBlessing(state, 'blacksmith_blessing');
          return state;
        }
      }
    ]
  },
  {
    id: 'merchants_tip',
    category: 'The Bazaar',
    label: 'The Merchant\'s Tip',
    description: 'You share a drink with a traveling merchant. "You\'re heading to the next stop? I know the fellow who runs the shop. I\'ll send word."',
    type: 'wander',
    choices: [
      {
        label: '"Ask for a \'discount.\'"',
        result: 'He\'s greedy, but he owes me. Your *first purchase* at the next shop is *free*.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addStatus(state, 'free_first_purchase', 1);
          return state;
        }
      },
      {
        label: '"Ask for \'special stock.\'"',
        result: 'His usual stock is junk. I\'ll tell him to bring out the good stuff. The next shop is *guaranteed to sell a Legendary Exploit* (for a high price).',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = addGameRule(state, 'force_legendary_in_shop', true);
          return state;
        }
      }
    ]
  },
  {
    id: 'goading_spirit',
    category: 'The Crossroads',
    label: 'The Goading Spirit',
    description: 'A sneering ghost appears. "You\'re too slow! Too safe! I bet you can\'t even beat the next trial, you pathetic mortal."',
    type: 'wander',
    choices: [
      {
        label: '"I\'ll take that bet."',
        result: 'You feel a surge of defiant energy. You gain a **Blessing** for the next encounter. However, if you **fail to meet the score goal**, the spirit\'s mockery will stick with you. You will **gain 2 Curses**.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          state = addRandomCurse(state, rng);
          state = addRandomCurse(state, rng);
          return state;
        }
      },
      {
        label: '"Ignore the ghost."',
        result: 'The ghost boos you. \'Coward!\' Your next score goal is increased by 10% from the distraction.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyNextScoreGoalPct(state, 0.1);
          return state;
        }
      }
    ]
  },
  {
    id: 'rat_kings_bargain',
    category: 'The Wilds',
    label: 'The Rat King\'s Bargain',
    description: 'You find a massive rat, wearing a tiny crown. It speaks. "Give me cheese... or coin. I give... *secrets*."',
    type: 'wander',
    choices: [
      {
        label: '"Offer coin."',
        result: 'You give him 15 Coin. It sniffs the coin. \'Acceptable.\' It whispers a secret. Gain 1 random Common Exploit.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -15);
          state = addRandomExploit(state, 'common', rng);
          return state;
        }
      },
      {
        label: '"Offer food."',
        result: 'You buy some cheese for 25 Coin. \'Better!\' It chitters happily. Gain 1 random Blessing.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = modifyCoin(state, -25);
          state = addRandomBlessing(state, rng);
          return state;
        }
      },
      {
        label: '"Try to kill it."',
        result: 'It hisses, and a swarm of rats attacks you. You fight them off, but they steal everything from your pockets. Lose all Coin.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = setCoin(state, 0);
          return state;
        }
      }
    ]
  },
  {
    id: 'demon_return',
    category: 'The Crossroads',
    label: 'The Demon Returns',
    description: 'The crossroads demon returns.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Undo penalty',
        result: 'Hand size restored, permanent curse added.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyHandSize(state, 1);
          return state;
        }
      },
      {
        label: 'Refuse',
        result: 'He vanishes.',
        onChoose: (ctx) => ctx.gameState
      }
    ]
  },
  {
    id: 'fox_ally',
    category: 'The Wilds',
    label: 'The Fox Repays',
    description: 'The fox returns.',
    type: 'wander',
    isHidden: true,
    choices: [{
      label: 'Accept gift',
      result: 'Scaling blessing.',
      effects: [
        { type: 'add_random_blessing', params: [], scaling: 'curses_held' }
      ]
    }]
  },
  {
    id: 'jesters_legacy',
    category: 'The Academy',
    label: "The Jester's Legacy",
    description: 'The final joke.',
    type: 'wander',
    isHidden: true,
    choices: [{
      label: 'Claim reward',
      result: 'Legendary blessing.',
      onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomBlessing(state, rng);
          return state;
        }
    }]
  },
  {
    id: 'rat_king_return',
    category: 'The Wilds',
    label: 'The Rat King\'s Revenge',
    description: 'A swarm of vermin.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Face the swarm',
        result: 'Brutal battle.',
        effects: [
          { type: 'random_outcome', params: [0.6, [{ type: 'modify_coin', params: [120] }, { type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'giant_rage',
    category: 'The Wilds',
    label: 'The Giant Awakens',
    description: 'The giant is furious.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Face the storm',
        result: 'Terrible wrath.',
        effects: [
          { type: 'random_outcome', params: [0.4, [{ type: 'add_random_exploit', params: ['legendary'] }], [{ type: 'modify_next_score_goal_pct', params: [0.4] }, { type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'royal_wrath',
    category: 'The Wilds',
    label: 'The Queen\'s Wrath',
    description: 'Royal guards appear.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Pay or fight',
        result: 'Blood or gold.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [100] }], [{ type: 'add_random_exploit', params: ['epic'] }, { type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'ghostbound_return',
    category: 'The Forge',
    label: 'The Ghost\'s Claim',
    description: 'The spectral warrior returns.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Return or duel',
        result: 'Honor or defiance.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'remove_curse', params: [] }], [{ type: 'add_random_exploit', params: ['epic'] }]] }
        ]
      }
    ]
  },
  {
    id: 'fae_debt',
    category: 'The Wilds',
    label: 'The Fae Collects',
    description: 'The circle reappears.',
    type: 'wander',
    isHidden: true,
    choices: [
      {
        label: 'Pay or dance',
        result: 'Time or freedom.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_next_score_goal_pct', params: [-0.3] }], [{ type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'divine_conclave',
    category: 'Divine Intervention',
    label: 'The Divine Conclave',
    description: 'You stumble upon a hidden grove where the air shimmers with ethereal light. Statues of forgotten deities stand in a circle, their eyes seeming to follow your every move. A whisper in your mind offers you a choice of their favor.',
    type: 'wander',
    choices: [
      {
        label: 'Accept their favor',
        result: 'The statues seem to nod in unison. Three distinct paths of power reveal themselves to you.',
        effects: [
          { type: 'trigger_blessing_acquisition', params: [] }
        ]
      },
      {
        label: 'Leave the grove',
        result: 'You back away slowly, deciding that the attention of gods is not something you wish to court today.',
        onChoose: (ctx) => ctx.gameState
      }
    ]
  },
  {
    id: 'cleansing_spring',
    category: 'Sanctuary',
    label: 'The Cleansing Spring',
    description: 'A crystal-clear spring bubbles up from the earth, its waters glowing with a soft, purifying light. You feel a weight lifting from your shoulders just by standing near it.',
    type: 'wander',
    choices: [
      {
        label: 'Bathe in the waters',
        result: 'The cold water washes over you, dissolving the dark threads of fate that have clung to your soul.',
        effects: [
          { type: 'trigger_curse_removal', params: [] }
        ]
      },
      {
        label: 'Fill your waterskin',
        result: 'You take some of the water for later. It is refreshing, but the magic fades quickly away from the source.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          state = modifyCoin(state, 100);
          return state;
        }
      }
    ]
  },
  {
    id: 'merchants_caravan',
    category: 'Marketplace',
    label: 'The Merchant\'s Caravan',
    description: 'A colorful caravan of wagons has stopped by the roadside. Exotic scents and the sound of haggling fill the air. "Best prices in the realm!" a merchant calls out to you.',
    type: 'wander',
    choices: [
      {
        label: 'Browse their wares',
        result: 'You step closer to inspect the goods. The merchant spreads out a selection of rare items.',
        effects: [
          { type: 'trigger_trade', params: [] }
        ]
      },
      {
        label: 'Rob the merchant',
        result: 'You try to snatch a purse while they are distracted. It... does not go well. The guards are surprisingly competent.',
        onChoose: (ctx) => {
          let state = ctx.gameState;
          const rng = safeRng(ctx);
          state = addRandomCurse(state, rng);
          state = modifyCoin(state, 50);
          return state;
        }
      }
    ]
  }
]
export default WANDER_REGISTRY;
