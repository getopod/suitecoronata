import { Wander, Effect, EffectType } from '../types';
import { EFFECTS_REGISTRY } from './effects';

// Helper to get effects by category
const getEffectsByCategory = (category: 'curse' | 'exploit' | 'blessing') => {
  return Object.values(EFFECTS_REGISTRY).filter(e => e.category === category);
};

const curses = getEffectsByCategory('curse');
const exploits = getEffectsByCategory('exploit');
const blessings = getEffectsByCategory('blessing');

// Helper functions for common effects
const safeRng = (chance: number, success: Effect[], failure: Effect[] = []): Effect => ({
  type: 'random_outcome',
  params: [chance, success, failure]
});

const modifyCoin = (amount: number): Effect => ({
  type: 'modify_coin',
  params: [amount]
});

const addRandomCurse = (): Effect => ({
  type: 'add_random_curse',
  params: []
});

const addRandomBlessing = (): Effect => ({
  type: 'add_random_blessing',
  params: []
});

const addRandomExploit = (rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'): Effect => ({
  type: 'add_random_exploit',
  params: [rarity]
});

const modifyScore = (amount: number): Effect => ({
  type: 'modify_score',
  params: [amount]
});

export const WANDER_REGISTRY: Wander[] = [
  {
    id: 'three_card_monte',
    label: 'The Three-Card Monte',
    description: 'A roguish man shuffles cards on a stump. "Ten coin to win," he smiles.',
    type: 'wander',
    choices: [
      {
        label: 'Play the game (-10 Coin)',
        result: 'He flips the cards...',
        effects: [
          modifyCoin(-10),
          safeRng(0.5, [modifyCoin(25)], [addRandomCurse()]),
          { type: 'add_hidden_modifier', params: ['monte_streak', 2] }
        ]
      },
      {
        label: 'Accuse him of cheating',
        result: '"I like your nerve," he sneers.',
        effects: [
          safeRng(0.5, [addRandomExploit('uncommon')], [modifyCoin(-20)])
        ]
      }
    ]
  },
  {
    id: 'dying_thief',
    label: 'The Dying Thief',
    description: 'A wounded man clutches a sack. "Water... please..."',
    type: 'wander',
    choices: [
      {
        label: 'Help him (-5 Coin)',
        result: 'You give water. He sighs gratefully. An act of kindness.',
        effects: [
          modifyCoin(-5),
          modifyScore(100),
          { type: 'add_hidden_modifier', params: ['kind_soul', 'run'] }
        ]
      },
      {
        label: 'Take the sack',
        result: 'You pry it from his grip. He curses you.',
        effects: [
          modifyCoin(30),
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'crossroads_demon',
    label: 'The Crossroads Demon',
    description: 'A sharp-dressed figure at the crossroads smiles. "A deal, traveler?"',
    type: 'wander',
    conditions: { minEncounter: 5 },
    choices: [
      {
        label: 'Make the deal',
        result: 'You shake his warm hand. Power comes at a price.',
        effects: [
          addRandomExploit('epic'),
          { type: 'modify_hand_size', params: [-1] },
          { type: 'unlock_wander', params: ['demon_return'] }
        ]
      },
      {
        label: 'Spit at his feet',
        result: '"Spirit! I like it." He laughs.',
        effects: [
          modifyScore(50),
          modifyCoin(-10)
        ]
      }
    ]
  },
  {
    id: 'mirror_pool',
    label: 'The Mirror Pool',
    description: 'A still pool reflects your gaze... then winks.',
    type: 'wander',
    conditions: { minEncounter: 2 },
    choices: [
      {
        label: 'Touch the water',
        result: 'Your reflection grips your hand.',
        effects: [
          safeRng(0.5, [{ type: 'remove_curse', params: [] }], [{ type: 'lose_random_card', params: [] }]),
          { type: 'add_hidden_modifier', params: ['mirror_karma', 'run'] }
        ]
      },
      {
        label: 'Shatter the surface',
        result: 'You throw a rock. The image shatters angrily.',
        effects: [
          safeRng(0.25, [addRandomCurse()], [])
        ]
      }
    ]
  },
  {
    id: 'rats_nest',
    label: "The Rat's Nest",
    description: 'A massive nest of bones and filth. Gold glitters inside.',
    type: 'wander',
    choices: [
      {
        label: 'Reach inside',
        result: 'You plunge your hand in. Something bites.',
        effects: [
          modifyCoin(50),
          safeRng(0.5, [addRandomCurse()], []),
          { type: 'conditional_unlock', params: ['rat_king_return', { curses: 2 }] }
        ]
      },
      {
        label: 'Burn the nest (-5 Coin)',
        result: 'You set it ablaze. Shrieks echo.',
        effects: [
          modifyCoin(-5),
          modifyScore(25)
        ]
      }
    ]
  },
  {
    id: 'unsent_letter',
    label: 'The Unsent Letter',
    description: 'A dead courier clutches a letter to the Queen.',
    type: 'wander',
    choices: [
      {
        label: 'Read the letter',
        result: 'You break the seal. Secrets revealed, vows broken.',
        effects: [
          addRandomExploit('rare'),
          { type: 'add_specific_curse', params: ['broken_vow'] },
          { type: 'unlock_secret_danger', params: ['royal_wrath'] }
        ]
      },
      {
        label: 'Bury the courier',
        result: 'You give him a simple burial.',
        effects: [
          modifyScore(50),
          safeRng(0.1, [{ type: 'add_random_fortune', params: [] }], [])
        ]
      }
    ]
  },
  {
    id: 'blind_oracle',
    label: 'The Blind Oracle',
    description: 'A blind woman speaks. "I see your path... for a price."',
    type: 'wander',
    choices: [
      {
        label: 'Pay for a vision (-15 Coin)',
        result: '"I see a shortcut!" She touches your deck.',
        effects: [
          modifyCoin(-15),
          { type: 'draw_cards', params: [3, 'manual'] },
          { type: 'top_deck_card', params: ['blessing'] }
        ]
      },
      {
        label: 'Ask for a riddle',
        result: '"A fun choice!"',
        effects: [
          safeRng(0.5, [addRandomBlessing()], [modifyScore(-25)])
        ]
      }
    ]
  },
  {
    id: 'goblins_toll',
    label: "The Goblin's Toll",
    description: 'A goblin blocks the bridge. "Pay in shinies or blood!"',
    type: 'wander',
    choices: [
      {
        label: "Pay the 'shiny' (-20 Coin)",
        result: 'He snatches the coin and lets you pass.',
        effects: [
          modifyCoin(-20)
        ]
      },
      {
        label: "Pay in 'blood'",
        result: 'You draw your weapon.',
        effects: [
          safeRng(0.5, [modifyCoin(30)], [addRandomCurse(), modifyCoin(-10)]),
          { type: 'increment_counter', params: ['goblin_insult', 1] }
        ]
      }
    ]
  },
  {
    id: 'haunted_armory',
    label: 'The Haunted Armory',
    description: 'Spectral weapons float in racks. A ghost stands guard.',
    type: 'wander',
    choices: [
      {
        label: 'Take a weapon',
        result: 'You grasp a spectral blade. It feels real.',
        effects: [
          addRandomExploit('epic'),
          addRandomCurse(),
          { type: 'add_status', params: ['ghostbound'] }
        ]
      },
      {
        label: 'Salute the ghost',
        result: 'You show respect. The ghost nods.',
        effects: [
          modifyScore(50)
        ]
      }
    ]
  },
  {
    id: 'ring_of_thorns',
    label: 'The Ring of Thorns',
    description: 'Black briars surround a pulsing red flower.',
    type: 'wander',
    choices: [
      {
        label: 'Push through',
        result: 'You bleed, but get the flower.',
        effects: [
          modifyScore(-25),
          addRandomBlessing(),
          { type: 'add_hidden_modifier', params: ['blood_roses', 'run'] }
        ]
      },
      {
        label: 'Go around',
        result: 'It takes time. You lose coin in the brambles.',
        effects: [
          modifyCoin(-5)
        ]
      }
    ]
  },
  {
    id: 'skeletal_knight',
    label: 'The Skeletal Knight',
    description: 'A skeleton in rusted armor blocks the path.',
    type: 'wander',
    choices: [
      {
        label: 'Offer a toll (-5 Coin)',
        result: 'It steps aside.',
        effects: [
          modifyCoin(-5),
          modifyScore(50)
        ]
      },
      {
        label: 'Duel',
        result: 'Steel meets bone.',
        effects: [
          safeRng(0.5, [addRandomExploit('uncommon')], [modifyCoin(-20), addRandomCurse()])
        ]
      }
    ]
  },
  {
    id: 'weeping_statue',
    label: 'The Weeping Statue',
    description: 'A marble angel weeps warm tears.',
    type: 'wander',
    choices: [
      {
        label: 'Taste the tear',
        result: 'Salty and warm.',
        effects: [
          safeRng(0.5, [{ type: 'remove_curse', params: [] }], [addRandomCurse()]),
          { type: 'add_hidden_modifier', params: ['angel_tears', 3] }
        ]
      },
      {
        label: 'Comfort the statue',
        result: 'You pat its shoulder.',
        effects: [
          modifyScore(50)
        ]
      }
    ]
  },
  {
    id: 'wandering_merchant',
    label: 'The Wandering Merchant',
    description: 'A merchant with a huge pack hails you.',
    type: 'wander',
    choices: [
      {
        label: "Buy 'Lost Item' (-30 Coin)",
        result: 'He hands you a bundle.',
        effects: [
          modifyCoin(-30),
          addRandomExploit('uncommon'),
          { type: 'add_status', params: ['merchant_favor'] }
        ]
      },
      {
        label: 'Haggle',
        result: '"A sharp one!"',
        effects: [
          safeRng(0.5, [modifyCoin(-15), addRandomExploit('uncommon')], [modifyScore(-10)])
        ]
      }
    ]
  },
  {
    id: 'jesters_riddle',
    label: "The Jester's Riddle",
    description: 'A jester juggles skulls. "A riddle!"',
    type: 'wander',
    choices: [
      {
        label: 'Answer "A Mountain"',
        result: '"Correct!"',
        effects: [
          addRandomBlessing(),
          { type: 'increment_counter', params: ['riddles_solved', 1] }
        ]
      },
      {
        label: 'Tell him to get lost',
        result: 'He throws a skull at you.',
        effects: [
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'empty_gallows',
    label: 'The Empty Gallows',
    description: 'Three nooses swing in the breeze.',
    type: 'wander',
    choices: [
      {
        label: 'Test the noose',
        result: 'You feel a chill of death.',
        effects: [
          modifyScore(50),
          safeRng(0.1, [addRandomCurse()], []),
          { type: 'add_consumable', params: ['noose_luck'] }
        ]
      },
      {
        label: 'Cut the ropes',
        result: 'An act of defiance.',
        effects: [
          modifyScore(25)
        ]
      }
    ]
  },
  {
    id: 'glowing_sword',
    label: 'The Glowing Sword',
    description: 'A sword in stone glows blue.',
    type: 'wander',
    choices: [
      {
        label: 'Pull the sword',
        result: 'You strain...',
        effects: [
          safeRng(0.25, [addRandomExploit('epic')], [addRandomCurse()]),
          { type: 'scale_item', params: ['sword_blessing', 'encounters'] }
        ]
      },
      {
        label: 'Leave it',
        result: 'You move on.',
        effects: [
          modifyCoin(10)
        ]
      }
    ]
  },
  {
    id: 'abandoned_child',
    label: 'The Abandoned Child',
    description: 'A child cries on the road.',
    type: 'wander',
    choices: [
      {
        label: 'Help the child',
        result: 'You waste time, but it is right.',
        effects: [
          modifyScore(-50),
          safeRng(0.1, [addRandomBlessing()], [])
        ]
      },
      {
        label: 'Ignore the child',
        result: 'You hear a soft chuckle behind you.',
        effects: [
          { type: 'add_specific_curse', params: ['callous_heart'] },
          { type: 'add_hidden_modifier', params: ['callous', 'run'] }
        ]
      }
    ]
  },
  {
    id: 'sudden_storm',
    label: 'The Sudden Storm',
    description: 'Freezing rain falls.',
    type: 'wander',
    choices: [
      {
        label: 'Hide in cave',
        result: 'A beast nips your purse.',
        effects: [
          modifyCoin(-15)
        ]
      },
      {
        label: 'Hide under tree',
        result: 'Lightning strikes!',
        effects: [
          safeRng(0.5, [addRandomBlessing()], [modifyScore(-50), addRandomCurse()]),
          { type: 'add_hidden_modifier', params: ['storm_touched', 'run'] }
        ]
      }
    ]
  },
  {
    id: 'fairy_ring',
    label: 'The Fairy Ring',
    description: 'Red mushrooms and music.',
    type: 'wander',
    choices: [
      {
        label: 'Step in',
        result: 'You dance.',
        effects: [
          safeRng(0.5, [addRandomBlessing()], [addRandomCurse()]),
          { type: 'add_consumable', params: ['fae_token'] }
        ]
      },
      {
        label: 'Eat mushroom',
        result: 'Tastes like static.',
        effects: [
          safeRng(0.25, [addRandomExploit('uncommon')], [modifyScore(-25)])
        ]
      }
    ]
  },
  {
    id: 'ghastly_procession',
    label: 'The Ghastly Procession',
    description: 'Ghosts float down the road.',
    type: 'wander',
    choices: [
      {
        label: 'Block path',
        result: 'They pass through you.',
        effects: [
          addRandomCurse()
        ]
      },
      {
        label: 'Join them',
        result: 'You march for eternity.',
        effects: [
          { type: 'add_random_fortune', params: [] },
          { type: 'force_next_danger', params: ['the-war-within'] }
        ]
      }
    ]
  },
  {
    id: 'poisoners_kit',
    label: "The Poisoner's Kit",
    description: 'A box of vials.',
    type: 'wander',
    choices: [
      {
        label: 'Test a drop',
        result: 'Bitter.',
        effects: [
          safeRng(0.5, [addRandomBlessing()], [modifyScore(-25)]),
          { type: 'add_status', params: ['poison_tongue'] }
        ]
      },
      {
        label: 'Destroy kit',
        result: 'You smash the vials.',
        effects: [
          modifyScore(50)
        ]
      }
    ]
  },
  {
    id: 'trapped_animal',
    label: 'The Trapped Animal',
    description: 'A fox in a trap.',
    type: 'wander',
    choices: [
      {
        label: 'Free the fox',
        result: 'It limps away.',
        effects: [
          addRandomBlessing(),
          { type: 'add_consumable', params: ['fox_token'] }
        ]
      },
      {
        label: 'Kill it',
        result: 'A sad act.',
        effects: [
          modifyCoin(15)
        ]
      }
    ]
  },
  {
    id: 'forgotten_idol',
    label: 'The Forgotten Idol',
    description: 'A jade idol pulses.',
    type: 'wander',
    choices: [
      {
        label: 'Pray',
        result: 'It demands sacrifice.',
        effects: [
          addRandomExploit('rare'),
          addRandomCurse(),
          { type: 'fear_to_blessing', params: ['bad-omens'] }
        ]
      },
      {
        label: 'Topple it',
        result: 'You kick it over.',
        effects: [
          modifyScore(75)
        ]
      }
    ]
  },
  {
    id: 'sleeping_giant',
    label: 'The Sleeping Giant',
    description: 'A giant blocks the pass.',
    type: 'wander',
    choices: [
      {
        label: 'Sneak past',
        result: 'You tiptoe.',
        effects: [
          safeRng(0.5, [], [modifyScore(-50), addRandomCurse()]),
          { type: 'add_hidden_modifier', params: ['giant_awake', 'run'] }
        ]
      },
      {
        label: 'Leave offering (-25 Coin)',
        result: 'You leave coin.',
        effects: [
          modifyCoin(-25),
          safeRng(0.25, [addRandomBlessing()], [])
        ]
      }
    ]
  },
  {
    id: 'gamblers_bones',
    label: "The Gambler's Bones",
    description: 'A skeleton holds dice.',
    type: 'wander',
    choices: [
      {
        label: 'Take dice',
        result: 'You pry them loose.',
        effects: [
          { type: 'add_random_fortune', params: [] }
        ]
      },
      {
        label: 'Roll dice',
        result: 'You roll for the dead.',
        effects: [
          safeRng(0.5, [modifyCoin(30)], [modifyCoin(-10)]),
          { type: 'add_hidden_modifier', params: ['dead_mans_luck', 3] }
        ]
      }
    ]
  },
  {
    id: 'fishermans_dilemma',
    label: "The Fisherman's Dilemma",
    description: 'Silver or Golden fish?',
    type: 'wander',
    choices: [
      {
        label: 'Silver Fish',
        result: 'It shimmers.',
        effects: [
          safeRng(0.5, [addRandomBlessing()], [modifyScore(25)])
        ]
      },
      {
        label: 'Golden Fish',
        result: 'It is heavy.',
        effects: [
          safeRng(0.5, [modifyCoin(30)], [modifyScore(25)])
        ]
      }
    ]
  },
  {
    id: 'executioners_block',
    label: "The Executioner's Block",
    description: 'A block and axe.',
    type: 'wander',
    choices: [
      {
        label: 'Pull axe',
        result: 'It comes free.',
        effects: [
          addRandomExploit('rare'),
          addRandomCurse()
        ]
      },
      {
        label: 'Sharpen axe',
        result: 'You pay respects.',
        effects: [
          modifyCoin(25)
        ]
      }
    ]
  },
  {
    id: 'chest_of_masks',
    label: 'The Chest of Masks',
    description: 'Laughing or Crying masks.',
    type: 'wander',
    choices: [
      {
        label: 'Laughing Mask',
        result: 'Euphoria.',
        effects: [
          addRandomBlessing(),
          { type: 'add_hidden_modifier', params: ['mad_laughter', 'run'] }
        ]
      },
      {
        label: 'Crying Mask',
        result: 'Sorrow.',
        effects: [
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'forked_tongue',
    label: 'The Forked Tongue',
    description: 'A noble asks for directions.',
    type: 'wander',
    choices: [
      {
        label: 'Truth',
        result: 'Safe path.',
        effects: [
          modifyCoin(10)
        ]
      },
      {
        label: 'Lie',
        result: 'Haunted path.',
        effects: [
          addRandomExploit('common'),
          addRandomCurse(),
          { type: 'add_status', params: ['liar_tongue'] }
        ]
      }
    ]
  },
  {
    id: 'toll_bridge',
    label: 'The Toll Bridge',
    description: 'A guard demands toll.',
    type: 'wander',
    choices: [
      {
        label: 'Pay (-20 Coin)',
        result: 'You pass.',
        effects: [
          modifyCoin(-20)
        ]
      },
      {
        label: 'Find another way',
        result: 'Wading the river is hard.',
        effects: [
          modifyScore(-25)
        ]
      }
    ]
  },
  {
    id: 'forsaken_well',
    label: 'The Forsaken Well',
    description: 'A glowing well.',
    type: 'wander',
    choices: [
      {
        label: 'Descend',
        result: 'Artifacts and darkness.',
        effects: [
          addRandomExploit('rare'),
          addRandomCurse()
        ]
      },
      {
        label: 'Leave it',
        result: 'Prudence.',
        effects: [
          { type: 'modify_discard_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'peddler_of_cures',
    label: 'The Peddler of Cures',
    description: 'A cloaked figure offers a cure.',
    type: 'wander',
    choices: [
      {
        label: 'Drink',
        result: 'It burns.',
        effects: [
          { type: 'remove_curse', params: [] },
          safeRng(0.5, [{ type: 'set_coin', params: [0] }], []),
          { type: 'add_hidden_modifier', params: ['black_blood', 'run'] }
        ]
      },
      {
        label: 'Refuse',
        result: 'He scoffs.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.05] }
        ]
      }
    ]
  },
  {
    id: 'lost_coin',
    label: 'The Lost Coin',
    description: 'A sad, pulsing coin.',
    type: 'wander',
    choices: [
      {
        label: 'Pick up',
        result: 'Cold to the touch.',
        effects: [
          modifyCoin(10),
          safeRng(0.1, [addRandomCurse()], [])
        ]
      },
      {
        label: 'Leave it',
        result: 'Respect.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'whispering_tree',
    label: 'The Whispering Tree',
    description: 'A tree with faces.',
    type: 'wander',
    choices: [
      {
        label: 'Listen (-20 Coin)',
        result: 'Secrets revealed.',
        effects: [
          modifyCoin(-20),
          addRandomBlessing()
        ]
      },
      {
        label: 'Turn away',
        result: 'Quiet.',
        effects: [
          { type: 'modify_shuffle_count', params: [-1] }
        ]
      }
    ]
  },
  {
    id: 'broken_altar',
    label: 'The Broken Altar',
    description: 'A cracked altar.',
    type: 'wander',
    choices: [
      {
        label: 'Sacrifice card',
        result: 'You slip it in.',
        effects: [
          { type: 'sacrifice_hand_card_check', params: [[13, 12, 11], [modifyCoin(50)], [modifyCoin(10)]] }
        ]
      },
      {
        label: 'Leave it',
        result: 'You find a loose coin.',
        effects: [
          modifyCoin(20)
        ]
      }
    ]
  },
  {
    id: 'lost_pilgrim',
    label: 'The Lost Pilgrim',
    description: 'A weary pilgrim.',
    type: 'wander',
    choices: [
      {
        label: 'Offer hand (-5 Coin)',
        result: 'He teaches you a trick.',
        effects: [
          modifyCoin(-5),
          { type: 'modify_discard_bonus', params: [1] }
        ]
      },
      {
        label: 'Walk away',
        result: 'Conscience weighs on you.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.05] }
        ]
      }
    ]
  },
  {
    id: 'shrouded_figure',
    label: 'The Shrouded Figure',
    description: 'A figure offers cards.',
    type: 'wander',
    choices: [
      {
        label: 'Take card',
        result: 'It dissolves.',
        effects: [
          addRandomExploit('uncommon')
        ]
      },
      {
        label: 'Refuse',
        result: 'He fades.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.05] }
        ]
      }
    ]
  },
  {
    id: 'crumbling_shrine',
    label: 'The Crumbling Shrine',
    description: 'A vine-covered shrine.',
    type: 'wander',
    choices: [
      {
        label: 'Light candle',
        result: 'Contemplation.',
        effects: [
          addRandomBlessing()
        ]
      },
      {
        label: 'Take eyes',
        result: 'You pry gems loose.',
        effects: [
          addRandomExploit('rare'),
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'ruined_chest',
    label: 'The Ruined Chest',
    description: 'A rotting chest.',
    type: 'wander',
    choices: [
      {
        label: 'Break open',
        result: 'A feather and a lost coinbox.',
        effects: [
          addRandomBlessing(),
          { type: 'set_coin', params: [0] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Prudence.',
        effects: [
          modifyCoin(25)
        ]
      }
    ]
  },
  {
    id: 'serpents_offer',
    label: "The Serpent's Offer",
    description: 'A green snake offers a card.',
    type: 'wander',
    choices: [
      {
        label: 'Take card',
        result: 'Blessing in disguise.',
        effects: [
          addRandomBlessing()
        ]
      },
      {
        label: 'Leave it',
        result: 'A bird drops a seed.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'abandoned_caravan',
    label: 'The Abandoned Caravan',
    description: 'A ransacked caravan.',
    type: 'wander',
    choices: [
      {
        label: 'Pry lockbox',
        result: 'Riches and noise.',
        effects: [
          modifyCoin(50),
          addRandomBlessing(),
          safeRng(0.25, [{ type: 'remove_deck_card_value', params: [[1, 5, 10]] }], [])
        ]
      },
      {
        label: 'Leave it',
        result: 'Respect.',
        effects: [
          { type: 'modify_discard_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'cursed_relic',
    label: 'The Cursed Relic',
    description: 'A twisted metal relic.',
    type: 'wander',
    choices: [
      {
        label: 'Take it',
        result: 'Power and sickness.',
        effects: [
          addRandomExploit('epic'),
          addRandomCurse()
        ]
      },
      {
        label: 'Desecrate altar',
        result: 'Spirits released.',
        effects: [
          { type: 'remove_curse', params: [] },
          safeRng(0.5, [{ type: 'set_coin', params: [0] }], [])
        ]
      }
    ]
  },
  {
    id: 'grimoire_of_lies',
    label: 'The Grimoire of Lies',
    description: 'A shifting book.',
    type: 'wander',
    choices: [
      {
        label: 'Read it',
        result: 'Your mind twists.',
        effects: [
          addRandomExploit('rare'),
          addRandomCurse(),
          { type: 'add_status', params: ['confused_mind'] }
        ]
      },
      {
        label: 'Burn it',
        result: 'It screams.',
        effects: [
          modifyScore(50)
        ]
      }
    ]
  },
  {
    id: 'singing_stones',
    label: 'The Singing Stones',
    description: 'Stones hum a tune.',
    type: 'wander',
    choices: [
      {
        label: 'Sing along',
        result: 'Harmony.',
        effects: [
          addRandomBlessing(),
          { type: 'modify_hand_size', params: [1] }
        ]
      },
      {
        label: 'Kick stone',
        result: 'Discord.',
        effects: [
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'beggar_king',
    label: 'The Beggar King',
    description: 'A beggar in rags wears a crown.',
    type: 'wander',
    choices: [
      {
        label: 'Bow (-10 Coin)',
        result: 'He blesses you.',
        effects: [
          modifyCoin(-10),
          addRandomBlessing()
        ]
      },
      {
        label: 'Mock him',
        result: 'He curses you.',
        effects: [
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'fountain_of_youth',
    label: 'The Fountain of Youth',
    description: 'Clear water bubbles.',
    type: 'wander',
    choices: [
      {
        label: 'Drink',
        result: 'You feel younger... too young.',
        effects: [
          { type: 'remove_curse', params: [] },
          { type: 'modify_hand_size', params: [-1] }
        ]
      },
      {
        label: 'Fill flask',
        result: 'For later.',
        effects: [
          { type: 'add_consumable', params: ['youth_flask'] }
        ]
      }
    ]
  },
  {
    id: 'hermits_hut',
    label: "The Hermit's Hut",
    description: 'A hermit offers tea.',
    type: 'wander',
    choices: [
      {
        label: 'Drink tea',
        result: 'Relaxing.',
        effects: [
          { type: 'modify_discard_count', params: [2] }
        ]
      },
      {
        label: 'Steal spoon',
        result: 'It is silver.',
        effects: [
          modifyCoin(10),
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'moonlit_dance',
    label: 'The Moonlit Dance',
    description: 'Fairies dance in the moonlight.',
    type: 'wander',
    choices: [
      {
        label: 'Join in',
        result: 'You lose track of time.',
        effects: [
          addRandomBlessing(),
          modifyScore(-25)
        ]
      },
      {
        label: 'Watch',
        result: 'Beautiful.',
        effects: [
          modifyScore(25)
        ]
      }
    ]
  },
  {
    id: 'broken_mirror',
    label: 'The Broken Mirror',
    description: 'Seven years bad luck?',
    type: 'wander',
    choices: [
      {
        label: 'Fix it',
        result: 'You cut your hand.',
        effects: [
          addRandomCurse(),
          addRandomBlessing()
        ]
      },
      {
        label: 'Smash it more',
        result: 'Chaos.',
        effects: [
          addRandomExploit('common')
        ]
      }
    ]
  },
  {
    id: 'starving_artist',
    label: 'The Starving Artist',
    description: 'He paints a masterpiece.',
    type: 'wander',
    choices: [
      {
        label: 'Buy art (-50 Coin)',
        result: 'It is beautiful.',
        effects: [
          modifyCoin(-50),
          { type: 'add_random_fortune', params: [] }
        ]
      },
      {
        label: 'Critique it',
        result: 'He cries.',
        effects: [
          addRandomCurse()
        ]
      }
    ]
  },
  {
    id: 'graverobbers',
    label: 'The Graverobbers',
    description: 'They dig up a grave.',
    type: 'wander',
    choices: [
      {
        label: 'Help them',
        result: 'You share the loot.',
        effects: [
          modifyCoin(40),
          addRandomCurse()
        ]
      },
      {
        label: 'Stop them',
        result: 'They flee.',
        effects: [
          modifyScore(50)
        ]
      }
    ]
  },
  {
    id: 'mysterious_portal',
    label: 'The Mysterious Portal',
    description: 'A swirling vortex.',
    type: 'wander',
    choices: [
      {
        label: 'Jump in',
        result: 'Where are you?',
        effects: [
          { type: 'random_outcome', params: [0.33, [addRandomBlessing()], [addRandomCurse()]] },
          { type: 'modify_shuffle_count', params: [1] }
        ]
      },
      {
        label: 'Throw rock',
        result: 'It disappears.',
        effects: [
          modifyScore(10)
        ]
      }
    ]
  }
];
