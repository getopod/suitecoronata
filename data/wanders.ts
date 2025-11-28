
import { Wander } from '../types';

// --- PART 1: Events 1-25 ---
const part1: Wander[] = [
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
          { type: 'modify_coin', params: [-10] },
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [25] }], [{ type: 'add_random_curse', params: [] }]] },
          { type: 'add_hidden_modifier', params: ['monte_streak', 2] }
        ]
      },
      {
        label: 'Accuse him of cheating',
        result: '"I like your nerve," he sneers.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['uncommon'] }], [{ type: 'modify_coin', params: [-20] }]] }
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
          { type: 'modify_coin', params: [-5] },
          { type: 'modify_score', params: [100] },
          { type: 'add_hidden_modifier', params: ['kind_soul', 'run'] }
        ]
      },
      {
        label: 'Take the sack',
        result: 'You pry it from his grip. He curses you.',
        effects: [
          { type: 'modify_coin', params: [30] },
          { type: 'add_random_curse', params: [] }
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
          { type: 'add_random_exploit', params: ['epic'] },
          { type: 'modify_hand_size', params: [-1] },
          { type: 'unlock_wander', params: ['demon_return'] }
        ]
      },
      {
        label: 'Spit at his feet',
        result: '"Spirit! I like it." He laughs.',
        effects: [
          { type: 'modify_score', params: [50] },
          { type: 'modify_coin', params: [-10] }
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
          { type: 'random_outcome', params: [0.5, [{ type: 'remove_curse', params: [] }], [{ type: 'lose_random_card', params: [] }]] },
          { type: 'add_hidden_modifier', params: ['mirror_karma', 'run'] }
        ]
      },
      {
        label: 'Shatter the surface',
        result: 'You throw a rock. The image shatters angrily.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
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
          { type: 'modify_coin', params: [50] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] },
          { type: 'conditional_unlock', params: ['rat_king_return', { curses: 2 }] }
        ]
      },
      {
        label: 'Burn the nest (-5 Coin)',
        result: 'You set it ablaze. Shrieks echo.',
        effects: [
          { type: 'modify_coin', params: [-5] },
          { type: 'modify_score', params: [25] }
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
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'add_specific_curse', params: ['broken_vow'] },
          { type: 'unlock_secret_danger', params: ['royal_wrath'] }
        ]
      },
      {
        label: 'Bury the courier',
        result: 'You give him a simple burial.',
        effects: [
          { type: 'modify_score', params: [50] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_fortune', params: [] }], []] }
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
          { type: 'modify_coin', params: [-15] },
          { type: 'draw_cards', params: [3, 'manual'] },
          { type: 'top_deck_card', params: ['blessing'] }
        ]
      },
      {
        label: 'Ask for a riddle',
        result: '"A fun choice!"',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_score', params: [-25] }]] }
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
          { type: 'modify_coin', params: [-20] }
        ]
      },
      {
        label: "Pay in 'blood'",
        result: 'You draw your weapon.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [30] }], [{ type: 'add_random_curse', params: [] }, { type: 'modify_coin', params: [-10] }]] },
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
          { type: 'add_random_exploit', params: ['epic'] },
          { type: 'add_random_curse', params: [] },
          { type: 'add_status', params: ['ghostbound'] }
        ]
      },
      {
        label: 'Salute the ghost',
        result: 'You show respect. The ghost nods.',
        effects: [
          { type: 'modify_score', params: [50] }
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
          { type: 'modify_score', params: [-25] },
          { type: 'add_random_blessing', params: [] },
          { type: 'add_hidden_modifier', params: ['blood_roses', 'run'] }
        ]
      },
      {
        label: 'Go around',
        result: 'It takes time. You lose coin in the brambles.',
        effects: [
          { type: 'modify_coin', params: [-5] }
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
          { type: 'modify_coin', params: [-5] },
          { type: 'modify_score', params: [50] }
        ]
      },
      {
        label: 'Duel',
        result: 'Steel meets bone.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['uncommon'] }], [{ type: 'modify_coin', params: [-20] }, { type: 'add_random_curse', params: [] }]] }
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
          { type: 'random_outcome', params: [0.5, [{ type: 'remove_curse', params: [] }], [{ type: 'add_random_curse', params: [] }]] },
          { type: 'add_hidden_modifier', params: ['angel_tears', 3] }
        ]
      },
      {
        label: 'Comfort the statue',
        result: 'You pat its shoulder.',
        effects: [
          { type: 'modify_score', params: [50] }
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
          { type: 'modify_coin', params: [-30] },
          { type: 'add_random_exploit', params: ['uncommon'] },
          { type: 'add_status', params: ['merchant_favor'] }
        ]
      },
      {
        label: 'Haggle',
        result: '"A sharp one!"',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [-15] }, { type: 'add_random_exploit', params: ['uncommon'] }], [{ type: 'modify_score', params: [-10] }]] }
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
          { type: 'add_random_blessing', params: [] },
          { type: 'increment_counter', params: ['riddles_solved', 1] }
        ]
      },
      {
        label: 'Tell him to get lost',
        result: 'He throws a skull at you.',
        effects: [
          { type: 'add_random_curse', params: [] }
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
          { type: 'modify_score', params: [50] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_curse', params: [] }], []] },
          { type: 'add_consumable', params: ['noose_luck'] }
        ]
      },
      {
        label: 'Cut the ropes',
        result: 'An act of defiance.',
        effects: [
          { type: 'modify_score', params: [25] }
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
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_exploit', params: ['epic'] }], [{ type: 'add_random_curse', params: [] }]] },
          { type: 'scale_item', params: ['sword_blessing', 'encounters'] }
        ]
      },
      {
        label: 'Leave it',
        result: 'You move on.',
        effects: [
          { type: 'modify_coin', params: [10] }
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
          { type: 'modify_score', params: [-50] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_blessing', params: [] }], []] }
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
          { type: 'modify_coin', params: [-15] }
        ]
      },
      {
        label: 'Hide under tree',
        result: 'Lightning strikes!',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_score', params: [-50] }, { type: 'add_random_curse', params: [] }]] },
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
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] },
          { type: 'add_consumable', params: ['fae_token'] }
        ]
      },
      {
        label: 'Eat mushroom',
        result: 'Tastes like static.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_exploit', params: ['uncommon'] }], [{ type: 'modify_score', params: [-25] }]] }
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
          { type: 'add_random_curse', params: [] }
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
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_score', params: [-25] }]] },
          { type: 'add_status', params: ['poison_tongue'] }
        ]
      },
      {
        label: 'Destroy kit',
        result: 'You smash the vials.',
        effects: [
          { type: 'modify_score', params: [50] }
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
          { type: 'add_random_blessing', params: [] },
          { type: 'add_consumable', params: ['fox_token'] }
        ]
      },
      {
        label: 'Kill it',
        result: 'A sad act.',
        effects: [
          { type: 'modify_coin', params: [15] }
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
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'add_random_curse', params: [] },
          { type: 'fear_to_blessing', params: ['bad-omens'] }
        ]
      },
      {
        label: 'Topple it',
        result: 'You kick it over.',
        effects: [
          { type: 'modify_score', params: [75] }
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
          { type: 'random_outcome', params: [0.5, [], [{ type: 'modify_score', params: [-50] }, { type: 'add_random_curse', params: [] }]] },
          { type: 'add_hidden_modifier', params: ['giant_awake', 'run'] }
        ]
      },
      {
        label: 'Leave offering (-25 Coin)',
        result: 'You leave coin.',
        effects: [
          { type: 'modify_coin', params: [-25] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_blessing', params: [] }], []] }
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
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [30] }], [{ type: 'modify_coin', params: [-10] }]] },
          { type: 'add_hidden_modifier', params: ['dead_mans_luck', 3] }
        ]
      }
    ]
  }
];

// --- PART 2: Events 26-50 ---
const part2: Wander[] = [
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
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'modify_score', params: [25] }]] }
        ]
      },
      {
        label: 'Golden Fish',
        result: 'It is heavy.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [30] }], [{ type: 'modify_score', params: [25] }]] }
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
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'add_random_curse', params: [] }
        ]
      },
      {
        label: 'Sharpen axe',
        result: 'You pay respects.',
        effects: [
          { type: 'modify_coin', params: [25] }
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
          { type: 'add_random_blessing', params: [] },
          { type: 'add_hidden_modifier', params: ['mad_laughter', 'run'] }
        ]
      },
      {
        label: 'Crying Mask',
        result: 'Sorrow.',
        effects: [
          { type: 'add_random_curse', params: [] }
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
          { type: 'modify_coin', params: [10] }
        ]
      },
      {
        label: 'Lie',
        result: 'Haunted path.',
        effects: [
          { type: 'add_random_exploit', params: ['common'] },
          { type: 'add_random_curse', params: [] },
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
          { type: 'modify_coin', params: [-20] }
        ]
      },
      {
        label: 'Find another way',
        result: 'Wading the river is hard.',
        effects: [
          { type: 'modify_score', params: [-25] }
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
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'add_random_curse', params: [] }
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
          { type: 'random_outcome', params: [0.5, [{ type: 'set_coin', params: [0] }], []] },
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
          { type: 'modify_coin', params: [10] },
          { type: 'random_outcome', params: [0.1, [{ type: 'add_random_curse', params: [] }], []] }
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
          { type: 'modify_coin', params: [-20] },
          { type: 'add_random_blessing', params: [] }
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
          { type: 'sacrifice_hand_card_check', params: [[13, 12, 11], [{ type: 'modify_coin', params: [50] }], [{ type: 'modify_coin', params: [10] }]] }
        ]
      },
      {
        label: 'Leave it',
        result: 'You find a loose coin.',
        effects: [
          { type: 'modify_coin', params: [20] }
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
          { type: 'modify_coin', params: [-5] },
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
          { type: 'add_random_exploit', params: ['uncommon'] }
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
          { type: 'add_random_blessing', params: [] }
        ]
      },
      {
        label: 'Take eyes',
        result: 'You pry gems loose.',
        effects: [
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'add_random_curse', params: [] }
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
          { type: 'add_random_blessing', params: [] },
          { type: 'set_coin', params: [0] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Prudence.',
        effects: [
          { type: 'modify_coin', params: [25] }
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
          { type: 'add_random_blessing', params: [] }
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
          { type: 'modify_coin', params: [50] },
          { type: 'add_random_blessing', params: [] },
          { type: 'random_outcome', params: [0.25, [{ type: 'remove_deck_card_value', params: [[1, 5, 10]] }], []] }
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
          { type: 'add_random_exploit', params: ['epic'] },
          { type: 'add_random_curse', params: [] }
        ]
      },
      {
        label: 'Desecrate altar',
        result: 'Spirits released.',
        effects: [
          { type: 'remove_curse', params: [] },
          { type: 'random_outcome', params: [0.5, [{ type: 'set_coin', params: [0] }], []] }
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
        result: 'Forbidden secrets.',
        effects: [
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'modify_discard_bonus', params: [-1] },
          { type: 'modify_shuffle_bonus', params: [-1] },
          { type: 'add_status', params: ['forbidden_knowledge'] }
        ]
      },
      {
        label: 'Burn it',
        result: 'Coins fly out.',
        effects: [
          { type: 'modify_coin', params: [25] }
        ]
      }
    ]
  },
  {
    id: 'beggars_blessing',
    label: "The Beggar's Blessing",
    description: 'A beggar with clear eyes.',
    type: 'wander',
    choices: [
      {
        label: 'Give Coin (-10)',
        result: 'Warmth.',
        effects: [
          { type: 'modify_coin', params: [-10] },
          { type: 'add_random_blessing', params: [] },
          { type: 'modify_score', params: [50] },
          { type: 'add_hidden_modifier', params: ['saints_favor', 'run'] }
        ]
      },
      {
        label: 'Steal',
        result: 'He watches sadly.',
        effects: [
          { type: 'modify_coin', params: [10] },
          { type: 'add_random_curse', params: [] }
        ]
      }
    ]
  },
  {
    id: 'whispering_fountain',
    label: 'The Whispering Fountain',
    description: 'A fountain whispers secrets.',
    type: 'wander',
    choices: [
      {
        label: 'Drink',
        result: 'Secrets fill your mind.',
        effects: [
          { type: 'add_random_exploit', params: ['uncommon'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Drop Coin (-1)',
        result: 'A wish.',
        effects: [
          { type: 'modify_coin', params: [-1] },
          { type: 'add_random_blessing', params: [] }
        ]
      }
    ]
  },
  {
    id: 'grave_robber',
    label: 'The Grave Robber',
    description: 'A fresh grave with a sign.',
    type: 'wander',
    choices: [
      {
        label: 'Disturb it',
        result: 'Coin and consequences.',
        effects: [
          { type: 'modify_coin', params: [50] },
          { type: 'modify_score', params: [100] },
          { type: 'random_outcome', params: [0.5, [{ type: 'remove_deck_card_value', params: [[1, 5, 10]] }], []] }
        ]
      },
      {
        label: 'Leave it',
        result: 'You find a satchel.',
        effects: [
          { type: 'modify_discard_count', params: [1] },
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'old_hermit',
    label: 'The Old Hermit',
    description: 'A hermit at a fire.',
    type: 'wander',
    choices: [
      {
        label: 'Ask for guidance',
        result: 'Rune stones.',
        effects: [
          { type: 'add_random_exploit', params: ['rare'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Walk away',
        result: 'You find a stash.',
        effects: [
          { type: 'modify_coin', params: [25] }
        ]
      }
    ]
  },
  {
    id: 'field_of_cursed_flowers',
    label: 'The Field of Cursed Flowers',
    description: 'Crystalline flowers.',
    type: 'wander',
    choices: [
      {
        label: 'Touch flowers',
        result: 'Dissolves into light.',
        effects: [
          { type: 'add_random_blessing', params: [] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Burn them',
        result: 'They screech.',
        effects: [
          { type: 'modify_score', params: [200] }
        ]
      }
    ]
  },
  {
    id: 'ancient_gate',
    label: 'The Ancient Gate',
    description: 'A massive buried gate.',
    type: 'wander',
    choices: [
      {
        label: 'Push open',
        result: 'Treasure room.',
        effects: [
          { type: 'add_random_exploit', params: ['epic'] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Caution.',
        effects: [
          { type: 'modify_coin', params: [10] }
        ]
      }
    ]
  },
  {
    id: 'lost_locket',
    label: 'The Lost Locket',
    description: 'A tarnished locket.',
    type: 'wander',
    choices: [
      {
        label: 'Keep it',
        result: 'Heavy memories.',
        effects: [
          { type: 'modify_coin', params: [50] },
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_shuffle_bonus', params: [-1] }], []] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Empathy.',
        effects: [
          { type: 'modify_discard_count', params: [1] }
        ]
      }
    ]
  }
];

// --- PART 3: Events 51-75 ---
const part3: Wander[] = [
  {
    id: 'ponderous_turtle',
    label: 'The Ponderous Turtle',
    description: 'An ancient turtle.',
    type: 'wander',
    choices: [
      {
        label: 'Wait',
        result: 'It speaks wisdom.',
        effects: [
          { type: 'modify_discard_count', params: [1] }
        ]
      },
      {
        label: 'Tap shell',
        result: 'It withdraws.',
        effects: [
          { type: 'modify_score', params: [-10] }
        ]
      }
    ]
  },
  {
    id: 'architects_ghost',
    label: "The Architect's Ghost",
    description: 'A fussy ghost critiques your layout.',
    type: 'wander',
    choices: [
      {
        label: 'Fix it',
        result: 'He locks a column.',
        effects: [
          { type: 'add_game_rule', params: ['tableau_4_suit_lock'] }
        ]
      },
      {
        label: 'Rebuke him',
        result: 'He curses your hand.',
        effects: [
          { type: 'add_specific_curse', params: ['crooked_tools'] }
        ]
      }
    ]
  },
  {
    id: 'alchemists_mistake',
    label: 'The Alchemist\'s "Mistake"',
    description: 'A volatile cauldron.',
    type: 'wander',
    choices: [
      {
        label: 'Drink it',
        result: 'Inventory rerolled.',
        effects: [
          { type: 'reroll_inventory', params: [] }
        ]
      },
      {
        label: 'Knock it over',
        result: 'A glint in the hole.',
        effects: [
          { type: 'modify_coin', params: [25] }
        ]
      }
    ]
  },
  {
    id: 'man_who_sells_holes',
    label: 'The Man Who Sells Holes',
    description: 'A shady man selling holes.',
    type: 'wander',
    choices: [
      {
        label: 'Buy one (-10 Coin)',
        result: 'It is just a hole.',
        effects: [
          { type: 'modify_coin', params: [-10] }
        ]
      },
      {
        label: 'Ask function (-30 Coin)',
        result: 'They remove cards.',
        effects: [
          { type: 'modify_coin', params: [-30] },
          { type: 'remove_deck_card_choice', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'final_wager',
    label: 'The Final Wager',
    description: 'A golden chamber. Double or nothing.',
    type: 'wander',
    choices: [
      {
        label: 'Wager Score',
        result: 'A coin flips.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_score_pct', params: [1] }], [{ type: 'set_score', params: [0] }]] }
        ]
      },
      {
        label: 'Wager Coins',
        result: 'A coin flips.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin_pct', params: [1] }], [{ type: 'set_coin', params: [0] }]] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Dismissed.',
        effects: [
          { type: 'modify_coin', params: [25] }
        ]
      }
    ]
  },
  {
    id: 'box_of_jitters',
    label: 'The Box of Jitters',
    description: 'A vibrating box.',
    type: 'wander',
    choices: [
      {
        label: 'Open it',
        result: 'Jitters enter your deck.',
        effects: [
          { type: 'add_game_rule', params: ['jitters_auto_play'] }
        ]
      },
      {
        label: 'Sit on it',
        result: 'Good vibes.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'blank_faced_god',
    label: 'The Blank-Faced God',
    description: 'A statue with empty hands.',
    type: 'wander',
    choices: [
      {
        label: 'Give Curse',
        result: 'Lighter.',
        effects: [
          { type: 'remove_random_curse', params: [1] }
        ]
      },
      {
        label: 'Give Blessing',
        result: 'Hollow.',
        effects: [
          { type: 'remove_random_blessing', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'countdown_obelisk',
    label: 'The Countdown Obelisk',
    description: 'Runes count down.',
    type: 'wander',
    choices: [
      {
        label: 'Wait',
        result: 'A cuckoo bird.',
        effects: []
      },
      {
        label: 'Interrupt',
        result: 'Runic Dissonance.',
        effects: [
          { type: 'add_specific_curse', params: ['runic_dissonance'] }
        ]
      }
    ]
  },
  {
    id: 'avaricious_apparition',
    label: 'The Avaricious Apparition',
    description: 'A ghost accountant.',
    type: 'wander',
    choices: [
      {
        label: 'Pay fee (-100 Coin)',
        result: 'Better sell prices.',
        effects: [
          { type: 'modify_coin', params: [-100] },
          { type: 'add_game_rule', params: ['better_sell_prices'] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Rerolls cost more.',
        effects: [
          { type: 'add_game_rule', params: ['triple_reroll_cost'] }
        ]
      }
    ]
  },
  {
    id: 'legendary_sword',
    label: 'The "Legendary" Sword',
    description: 'Sword in dried mud.',
    type: 'wander',
    choices: [
      {
        label: 'Pull it',
        result: 'Strained muscle.',
        effects: [
          { type: 'modify_score', params: [-25] }
        ]
      },
      {
        label: 'Kick it',
        result: 'It is a toy.',
        effects: [
          { type: 'modify_coin', params: [5] }
        ]
      }
    ]
  },
  {
    id: 'abandoned_campfire',
    label: 'The Abandoned Campfire',
    description: 'Embers glow.',
    type: 'wander',
    choices: [
      {
        label: 'Rest',
        result: 'Dreams.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      },
      {
        label: 'Rummage',
        result: 'Leftovers.',
        effects: [
          { type: 'modify_discard_count', params: [1] },
          { type: 'modify_coin', params: [15] }
        ]
      }
    ]
  },
  {
    id: 'accidental_shove',
    label: 'The "Accidental" Shove',
    description: 'Someone bumps you. Money missing.',
    type: 'wander',
    choices: [
      {
        label: 'Chase',
        result: 'The crowd.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'regain_lost_item', params: [] }, { type: 'modify_coin', params: [40] }], [{ type: 'modify_score', params: [-25] }]] }
        ]
      },
      {
        label: 'Let it go',
        result: 'Anger.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.05] }
        ]
      }
    ]
  },
  {
    id: 'tipsy_bard',
    label: 'The Tipsy Bard',
    description: 'A bard offers a song.',
    type: 'wander',
    choices: [
      {
        label: 'Buy drink (-5 Coin)',
        result: 'Bawdy song.',
        effects: [
          { type: 'modify_coin', params: [-5] },
          { type: 'add_random_blessing', params: [] }
        ]
      },
      {
        label: 'Request Epic (-20 Coin)',
        result: 'Inspiring.',
        effects: [
          { type: 'modify_coin', params: [-20] },
          { type: 'add_random_exploit', params: ['common'] }
        ]
      },
      {
        label: 'Heckle',
        result: 'The crowd reacts.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_score', params: [25] }], [{ type: 'add_specific_curse', params: ['sticky'] }]] }
        ]
      }
    ]
  },
  {
    id: 'altar_of_sacrifice',
    label: 'The Altar of Sacrifice',
    description: 'Two bowls: Flame and Hand.',
    type: 'wander',
    choices: [
      {
        label: 'Sacrifice Exploit',
        result: 'Flame roars.',
        effects: [
          { type: 'lose_random_exploit', params: [1] },
          { type: 'modify_score', params: [150] }
        ]
      },
      {
        label: 'Sacrifice Blessing',
        result: 'Hand closes.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'modify_coin', params: [75] }
        ]
      },
      {
        label: 'Desecrate',
        result: 'Dark energy.',
        effects: [
          { type: 'add_random_curse', params: [] },
          { type: 'add_random_curse', params: [] },
          { type: 'modify_score', params: [50] }
        ]
      }
    ]
  },
  {
    id: 'strange_fruit',
    label: 'The Strange Fruit',
    description: 'A magenta fruit.',
    type: 'wander',
    choices: [
      {
        label: 'Eat it',
        result: 'Explosive flavor.',
        effects: [
          { type: 'random_outcome', params: [0.33, [{ type: 'add_random_blessing', params: [] }], [{ type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }]] }
        ]
      },
      {
        label: 'Smash it',
        result: 'Valuable pit.',
        effects: [
          { type: 'modify_coin', params: [20] }
        ]
      }
    ]
  },
  {
    id: 'cursed_hoard',
    label: 'The Cursed Hoard',
    description: 'Green-glowing gold.',
    type: 'wander',
    choices: [
      {
        label: 'Take handful',
        result: 'Cold coins.',
        effects: [
          { type: 'modify_coin', params: [40] },
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Take ALL',
        result: 'Greed.',
        effects: [
          { type: 'modify_coin', params: [150] },
          { type: 'add_random_curse', params: [] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Focus.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [-0.05] }
        ]
      }
    ]
  },
  {
    id: 'broken_automaton',
    label: 'The Broken Automaton',
    description: 'A sparking construct.',
    type: 'wander',
    choices: [
      {
        label: 'Repair (-15 Coin)',
        result: 'It hands you a package.',
        effects: [
          { type: 'modify_coin', params: [-15] },
          { type: 'add_random_fortune', params: [] }
        ]
      },
      {
        label: 'Pry object',
        result: 'It clamps down.',
        effects: [
          { type: 'add_random_exploit', params: ['common'] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'mapmakers_table',
    label: "The Mapmaker's Table",
    description: 'Abandoned maps.',
    type: 'wander',
    choices: [
      {
        label: 'Buy Map (-20 Coin)',
        result: 'A shortcut.',
        effects: [
          { type: 'modify_coin', params: [-20] },
          { type: 'modify_shuffle_count', params: [1] },
          { type: 'modify_discard_count', params: [1] }
        ]
      },
      {
        label: 'Steal Scroll',
        result: 'Secret or Trap.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['rare'] }], [{ type: 'add_random_curse', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'time_worn_sundial',
    label: 'The Time-Worn Sundial',
    description: 'Frozen shadow.',
    type: 'wander',
    choices: [
      {
        label: 'Push forward',
        result: 'Time skips.',
        effects: [
          { type: 'modify_score', params: [-25] },
          { type: 'modify_shuffle_count', params: [1] }
        ]
      },
      {
        label: 'Push backward',
        result: 'Rewind.',
        effects: [
          { type: 'modify_coin', params: [-25] },
          { type: 'modify_discard_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'echoing_cave',
    label: 'The Echoing Cave',
    description: 'Whispers back.',
    type: 'wander',
    choices: [
      {
        label: 'Shout curse',
        result: 'Roars back.',
        effects: [
          { type: 'add_random_curse', params: [] },
          { type: 'random_outcome', params: [0.25, [{ type: 'modify_coin', params: [20] }], []] }
        ]
      },
      {
        label: 'Listen',
        result: 'Learn from mistakes.',
        effects: [
          { type: 'modify_score', params: [50] }
        ]
      }
    ]
  },
  {
    id: 'whispering_well',
    label: 'The Whispering Well',
    description: 'A trade.',
    type: 'wander',
    choices: [
      {
        label: 'Toss Coin (-1)',
        result: 'A trifle.',
        effects: [
          { type: 'modify_coin', params: [-1] },
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], []] }
        ]
      },
      {
        label: 'Toss Exploit',
        result: 'Real trade.',
        effects: [
          { type: 'lose_random_exploit_rarity', params: ['common', 1] },
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      }
    ]
  },
  {
    id: 'sleeping_golem',
    label: 'The Sleeping Golem',
    description: 'Glowing rune on forehead.',
    type: 'wander',
    choices: [
      {
        label: 'Sneak past',
        result: 'Quietly.',
        effects: [
          { type: 'random_outcome', params: [0.5, [], [{ type: 'modify_coin', params: [-30] }, { type: 'modify_score', params: [-50] }]] }
        ]
      },
      {
        label: 'Touch rune',
        result: 'Energy drained.',
        effects: [
          { type: 'modify_shuffle_count', params: [-1] },
          { type: 'add_random_fortune', params: [] }
        ]
      }
    ]
  },
  {
    id: 'wayside_shrine',
    label: 'The Wayside Shrine',
    description: 'God of luck.',
    type: 'wander',
    choices: [
      {
        label: 'Small offering (-10 Coin)',
        result: 'Warmth.',
        effects: [
          { type: 'modify_coin', params: [-10] },
          { type: 'add_random_blessing', params: [] }
        ]
      },
      {
        label: 'Large offering (-40 Coin)',
        result: 'Pleased.',
        effects: [
          { type: 'modify_coin', params: [-40] },
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      },
      {
        label: 'Steal',
        result: 'Cold air.',
        effects: [
          { type: 'modify_coin', params: [5] },
          { type: 'add_random_curse', params: [] }
        ]
      }
    ]
  },
  {
    id: 'caged_pixie',
    label: 'The Caged Pixie',
    description: 'Rattling bars.',
    type: 'wander',
    choices: [
      {
        label: 'Free it',
        result: 'Dust.',
        effects: [
          { type: 'add_random_blessing', params: [] }
        ]
      },
      {
        label: 'Sell it',
        result: 'Hatred.',
        effects: [
          { type: 'modify_coin', params: [60] },
          { type: 'add_specific_curse', params: ['pixies_ire'] }
        ]
      }
    ]
  },
  {
    id: 'tree_of_cards',
    label: 'The Tree of Cards',
    description: 'Cards grow like leaves.',
    type: 'wander',
    choices: [
      {
        label: 'Pluck Red',
        result: 'Vitality.',
        effects: [
          { type: 'modify_score', params: [75] }
        ]
      },
      {
        label: 'Pluck Black',
        result: 'Opportunity.',
        effects: [
          { type: 'modify_coin', params: [30] }
        ]
      },
      {
        label: 'Dig roots',
        result: 'Rotting Joker.',
        effects: [
          { type: 'add_random_curse', params: [] }
        ]
      }
    ]
  }
];

// --- PART 4: Events 76-100 ---
const part4: Wander[] = [
  {
    id: 'ghostly_gambler',
    label: 'The Ghostly Gambler',
    description: 'A ghost plays solitaire.',
    type: 'wander',
    choices: [
      {
        label: 'Accept wager',
        result: 'Challenge accepted.',
        effects: [
          { type: 'add_quest', params: ['build_4_stack_3_moves', [{ type: 'modify_coin', params: [50] }], [{ type: 'add_specific_curse', params: ['gamblers_debt'] }]] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Boring.',
        effects: [
          { type: 'random_outcome', params: [0.25, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'resourceful_merchant',
    label: 'The "Resourceful" Merchant',
    description: 'Trading potential.',
    type: 'wander',
    choices: [
      {
        label: 'Trade Shuffles',
        result: 'Done.',
        effects: [
          { type: 'modify_shuffle_count', params: [-2] },
          { type: 'modify_discard_count', params: [3] }
        ]
      },
      {
        label: 'Trade Discards',
        result: 'Done.',
        effects: [
          { type: 'modify_discard_count', params: [-2] },
          { type: 'modify_shuffle_count', params: [3] }
        ]
      }
    ]
  },
  {
    id: 'locked_chest',
    label: 'The Locked Chest',
    description: 'Iron-bound.',
    type: 'wander',
    choices: [
      {
        label: 'Pick lock',
        result: 'Click or hiss.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [75] }], [{ type: 'add_random_curse', params: [] }, { type: 'modify_score', params: [-25] }]] }
        ]
      },
      {
        label: 'Smash (-1 Discard)',
        result: 'Force it.',
        effects: [
          { type: 'modify_discard_count', params: [-1] },
          { type: 'modify_coin', params: [40] }
        ]
      }
    ]
  },
  {
    id: 'rival_adventurer',
    label: 'The Rival Adventurer',
    description: 'A cynic by a fire.',
    type: 'wander',
    choices: [
      {
        label: 'Buy Exploit (-30 Coin)',
        result: 'Smart move.',
        effects: [
          { type: 'modify_coin', params: [-30] },
          { type: 'add_random_exploit', params: ['common'] }
        ]
      },
      {
        label: 'Trade Exploits',
        result: 'Fair is fair.',
        effects: [
          { type: 'trade_random_exploit_same_rarity', params: [] }
        ]
      }
    ]
  },
  {
    id: 'bottomless_bag',
    label: 'The Bottomless Bag',
    description: 'It keeps going.',
    type: 'wander',
    choices: [
      {
        label: 'Pull something out',
        result: 'Hope for best.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [25] }], [{ type: 'random_outcome', params: [0.5, [{ type: 'add_random_blessing', params: [] }], [{ type: 'add_random_curse', params: [] }]] }]] }
        ]
      },
      {
        label: 'Put something in (-100 Pts)',
        result: 'Sacrifice.',
        effects: [
          { type: 'modify_score', params: [-100] },
          { type: 'modify_shuffle_count', params: [2] },
          { type: 'modify_discard_count', params: [2] }
        ]
      }
    ]
  },
  {
    id: 'philanthropists_test',
    label: 'The Philanthropist\'s Test',
    description: 'A noble eyes your purse.',
    type: 'wander',
    choices: [
      {
        label: 'Donate (-50 Coin)',
        result: 'Worthy soul.',
        effects: [
          { type: 'check_coin', params: [100, [{ type: 'modify_coin', params: [-50] }, { type: 'add_random_exploit', params: ['rare'] }], []] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Greedy wretch.',
        effects: [
          { type: 'check_coin', params: [100, [{ type: 'add_specific_curse', params: ['avarice'] }], []] }
        ]
      },
      {
        label: '"I have little"',
        result: 'Pauper.',
        effects: [
          { type: 'check_coin', params: [null, 99, [{ type: 'modify_next_score_goal_pct', params: [0.1] }], []] }
        ]
      }
    ]
  },
  {
    id: 'cultists_welcome',
    label: 'The Cultist\'s Welcome',
    description: 'You are touched by shadows.',
    type: 'wander',
    choices: [
      {
        label: 'Embrace',
        result: 'Ritual.',
        effects: [
          { type: 'check_curses', params: [3, [{ type: 'add_random_exploit', params: ['legendary'] }, { type: 'add_specific_curse', params: ['permanent_curse_1', 'permanent'] }], []] }
        ]
      },
      {
        label: 'Rebuke',
        result: 'Defiance.',
        effects: [
          { type: 'check_curses', params: [3, [{ type: 'remove_curse', params: [] }], []] }
        ]
      },
      {
        label: 'What?',
        result: 'Tourist.',
        effects: [
          { type: 'check_curses', params: [null, 2, [{ type: 'modify_shuffle_count', params: [1] }], []] }
        ]
      }
    ]
  },
  {
    id: 'tinkerers_gamble',
    label: 'The Tinkerer\'s Gamble',
    description: 'She wants your trinket.',
    type: 'wander',
    choices: [
      {
        label: 'Upgrade',
        result: 'Work begins.',
        effects: [
          { type: 'check_exploit_rarity', params: ['common', 1, [{ type: 'modify_coin', params: [-20] }, { type: 'lose_random_exploit_rarity', params: ['common', 1] }, { type: 'random_outcome', params: [0.5, [{ type: 'add_random_exploit', params: ['rare'] }], []] }], []] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Suit yourself.',
        effects: [
          { type: 'check_exploit_rarity', params: ['common', 1, [{ type: 'add_game_rule', params: ['double_next_reroll_cost'] }], []] }
        ]
      }
    ]
  },
  {
    id: 'beggars_plea',
    label: 'The Beggar\'s Plea',
    description: 'Buying freedom.',
    type: 'wander',
    choices: [
      {
        label: 'Pay debt (-50 Coin)',
        result: 'Wheel turns.',
        effects: [
          { type: 'check_coin', params: [50, [{ type: 'modify_coin', params: [-50] }, { type: 'add_random_exploit', params: ['legendary'] }], []] }
        ]
      },
      {
        label: 'No money',
        result: 'Prisoners.',
        effects: [
          { type: 'check_coin', params: [null, 49, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'No help',
        result: 'Prisoners.',
        effects: [
          { type: 'check_coin', params: [50, [{ type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'shadows_embrace',
    label: 'The Shadow\'s Embrace',
    description: 'Curses coalesce.',
    type: 'wander',
    choices: [
      {
        label: 'Feed shadow',
        result: 'Acceptance.',
        effects: [
          { type: 'check_curses', params: [3, [{ type: 'add_random_curse', params: [] }, { type: 'add_random_exploit', params: ['rare'] }], []] }
        ]
      },
      {
        label: 'Fight it',
        result: 'Exhaustion.',
        effects: [
          { type: 'check_curses', params: [3, [{ type: 'set_shuffle_count', params: [0] }, { type: 'set_discard_count', params: [0] }], []] }
        ]
      }
    ]
  },
  {
    id: 'grumbling_goblin',
    label: 'The Grumbling Goblin',
    description: 'You kick a sleeping goblin.',
    type: 'wander',
    choices: [
      {
        label: 'Whatever',
        result: 'Grudge formed.',
        effects: [
          { type: 'add_status', params: ['grumblespikes_grudge'] }
        ]
      }
    ]
  },
  {
    id: 'goblins_stash',
    label: 'The Goblin\'s Stash',
    description: 'Poorly hidden den.',
    type: 'wander',
    choices: [
      {
        label: 'Sneak in',
        result: 'Trap or Grumblespike.',
        effects: [
          { type: 'conditional_outcome', params: [{ condition: 'has_status', params: ['grumblespikes_grudge'], success: [{ type: 'random_outcome', params: [0.5, [{ type: 'modify_coin', params: [75] }], [{ type: 'add_random_curse', params: [] }]] }], failure: [{ type: 'modify_coin', params: [25] }] }] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Prudence.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [-0.05] }
        ]
      }
    ]
  },
  {
    id: 'goblin_ambush',
    label: 'The Goblin Ambush',
    description: 'Three giggling goblins.',
    type: 'wander',
    choices: [
      {
        label: 'Intimidate',
        result: 'Scattered or Swarm.',
        effects: [
          { type: 'conditional_outcome', params: [{ condition: 'has_status', params: ['grumblespikes_grudge'], success: [{ type: 'modify_coin_pct', params: [-0.25] }], failure: [{ type: 'modify_discard_count', params: [1] }] }] }
        ]
      },
      {
        label: 'Toss shiny (-15 Coin)',
        result: 'They cheer.',
        effects: [
          { type: 'modify_coin', params: [-15] }
        ]
      }
    ]
  },
  {
    id: 'goblin_kings_court',
    label: 'The Goblin King\'s Court',
    description: 'Rowdy cavern.',
    type: 'wander',
    choices: [
      {
        label: 'Offer tribute (-20 Coin)',
        result: 'Pass or Grumblespike.',
        effects: [
          { type: 'conditional_outcome', params: [{ condition: 'has_status', params: ['grumblespikes_grudge'], success: [{ type: 'modify_coin_pct', params: [-0.5] }, { type: 'add_random_curse', params: [] }], failure: [{ type: 'modify_coin', params: [-20] }] }] }
        ]
      },
      {
        label: 'Sneak past',
        result: 'Shadows or Spotted.',
        effects: [
          { type: 'conditional_outcome', params: [{ condition: 'has_status', params: ['grumblespikes_grudge'], success: [{ type: 'modify_coin', params: [-30] }], failure: [] }] }
        ]
      }
    ]
  },
  {
    id: 'unnerving_totem',
    label: 'The Unnerving Totem',
    description: 'A leering wooden totem.',
    type: 'wander',
    choices: [
      {
        label: 'Keep it',
        result: 'It watches.',
        effects: [
          { type: 'add_item', params: ['unnerving_totem'] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Relief.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'altar_of_penance',
    label: 'The Altar of Penance',
    description: 'A cup-shaped depression.',
    type: 'wander',
    choices: [
      {
        label: 'Offer Coin',
        result: 'Cleansed.',
        effects: [
          { type: 'modify_coin', params: [-30] },
          { type: 'remove_curse', params: [] }
        ]
      },
      {
        label: 'Offer Blessing',
        result: 'Power.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      },
      {
        label: 'Sacrifice Totem',
        result: 'Screams.',
        effects: [
          { type: 'check_item', params: ['unnerving_totem', [{ type: 'remove_item', params: ['unnerving_totem'] }, { type: 'add_random_exploit', params: ['epic'] }, { type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }], []] }
        ]
      }
    ]
  },
  {
    id: 'whispering_idol',
    label: 'The Whispering Idol',
    description: 'Feed me.',
    type: 'wander',
    choices: [
      {
        label: 'Feed Totem',
        result: 'Fine meal.',
        effects: [
          { type: 'check_item', params: ['unnerving_totem', [{ type: 'remove_item', params: ['unnerving_totem'] }, { type: 'add_random_blessing', params: [] }, { type: 'add_random_blessing', params: [] }, { type: 'add_random_curse', params: [] }], []] }
        ]
      },
      {
        label: 'Offer Coin',
        result: 'Morsel.',
        effects: [
          { type: 'modify_coin', params: [-10] },
          { type: 'modify_shuffle_count', params: [1] }
        ]
      },
      {
        label: 'Offer Card',
        result: 'More!',
        effects: [
          { type: 'lose_random_card_hand', params: [1] },
          { type: 'modify_discard_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'promissory_note',
    label: 'The Promissory Note',
    description: 'Ghostly investment.',
    type: 'wander',
    choices: [
      {
        label: 'Accept (-25 Coin)',
        result: 'Redeem later.',
        effects: [
          { type: 'check_trial', params: [1, [{ type: 'modify_coin', params: [-25] }, { type: 'add_item', params: ['promissory_note'] }], []] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Missed out.',
        effects: [
          { type: 'check_trial', params: [1, [{ type: 'modify_next_score_goal_pct', params: [0.1] }], []] }
        ]
      }
    ]
  },
  {
    id: 'mysterious_cocoon',
    label: 'The Mysterious Cocoon',
    description: 'Pulsing silk.',
    type: 'wander',
    choices: [
      {
        label: 'Take it',
        result: 'Hatches soon.',
        effects: [
          { type: 'add_item', params: ['pulsing_cocoon', 2] }
        ]
      },
      {
        label: 'Destroy it',
        result: 'Gem inside.',
        effects: [
          { type: 'modify_coin', params: [30] }
        ]
      }
    ]
  },
  {
    id: 'seed_of_time',
    label: 'The Seed of Time',
    description: 'Metallic seed.',
    type: 'wander',
    choices: [
      {
        label: 'Plant it',
        result: 'Gestating.',
        effects: [
          { type: 'add_item', params: ['gestating_seed', 3] }
        ]
      },
      {
        label: 'Crack it',
        result: 'Unripe.',
        effects: [
          { type: 'modify_coin', params: [10] }
        ]
      }
    ]
  },
  {
    id: 'desperate_healer',
    label: 'The Desperate Healer',
    description: 'Needs supplies.',
    type: 'wander',
    choices: [
      {
        label: 'Offer Coin (-20%)',
        result: 'Saves three.',
        effects: [
          { type: 'modify_coin_pct', params: [-0.2] },
          { type: 'modify_next_score_goal_pct', params: [-0.15] }
        ]
      },
      {
        label: 'No help',
        result: 'Conscience.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.1] }
        ]
      }
    ]
  },
  {
    id: 'broken_compass',
    label: 'The Broken Compass',
    description: 'Spinning wildly.',
    type: 'wander',
    choices: [
      {
        label: 'Follow it',
        result: 'Lost but found.',
        effects: [
          { type: 'modify_shuffle_count', params: [-1] },
          { type: 'add_random_exploit', params: ['common'] }
        ]
      },
      {
        label: 'Smash it',
        result: 'Loose stone.',
        effects: [
          { type: 'modify_coin', params: [30] }
        ]
      }
    ]
  },
  {
    id: 'tax_collector',
    label: 'The Tax Collector',
    description: 'Royal colors.',
    type: 'wander',
    choices: [
      {
        label: 'Pay tax (-10%)',
        result: 'Receipt.',
        effects: [
          { type: 'modify_coin_pct', params: [-0.1] },
          { type: 'add_item', params: ['tax_receipt'] }
        ]
      },
      {
        label: 'Robbery!',
        result: 'Sword drawn.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'modify_coin_pct', params: [-0.5] }], [{ type: 'add_specific_curse', params: ['traitor'] }]] }
        ]
      }
    ]
  },
  {
    id: 'royal_gambit',
    label: 'The Royal Gambit',
    description: 'Queen\'s offer.',
    type: 'wander',
    choices: [
      {
        label: 'Pledge loyalty',
        result: 'Double goal.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [1] },
          { type: 'add_quest', params: ['win_next_encounter', [{ type: 'add_random_exploit', params: ['legendary'] }], [{ type: 'add_random_curse', params: [] }, { type: 'add_random_curse', params: [] }]] }
        ]
      },
      {
        label: 'Wait',
        result: 'Dangerous sentiment.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [0.2] }
        ]
      }
    ]
  },
  {
    id: 'cartographers_mistake',
    label: 'The Cartographer\'s Mistake',
    description: 'Wrong map.',
    type: 'wander',
    choices: [
      {
        label: 'Redraw (-10 Coin)',
        result: 'Copy.',
        effects: [
          { type: 'modify_coin', params: [-10] },
          { type: 'modify_shuffle_count', params: [2] }
        ]
      },
      {
        label: 'Explore mistake',
        result: 'Hidden grove.',
        effects: [
          { type: 'add_random_blessing', params: [] }
        ]
      }
    ]
  }
];

// --- PART 5: Events 101-128 ---
const part5: Wander[] = [
  {
    id: 'blacksmiths_challenge',
    label: 'The Blacksmith\'s Challenge',
    description: 'Temper the deck.',
    type: 'wander',
    choices: [
      {
        label: 'Temper (-1 Common Exploit)',
        result: 'Spectral fire.',
        effects: [
          { type: 'lose_random_exploit_rarity', params: ['common', 1] },
          { type: 'add_blessing_by_id', params: ['blacksmith_blessing'] },
          { type: 'add_blessing_by_id', params: ['blacksmith_blessing'] }
        ]
      },
      {
        label: 'Fine as is',
        result: 'Failures.',
        effects: [
          { type: 'modify_coin', params: [15] }
        ]
      }
    ]
  },
  {
    id: 'phantom_joker',
    label: 'The Phantom Joker',
    description: 'Jester skull.',
    type: 'wander',
    choices: [
      {
        label: 'Take card',
        result: 'Two Jokers.',
        effects: [
          { type: 'add_blessing_by_id', params: ['jester_blessing'] },
          { type: 'add_blessing_by_id', params: ['jester_blessing'] }
        ]
      },
      {
        label: 'Refuse',
        result: 'Relief.',
        effects: [
          { type: 'modify_next_score_goal_pct', params: [-0.05] }
        ]
      }
    ]
  },
  {
    id: 'pawnbroker',
    label: 'The Pawnbroker',
    description: 'Shady dealer.',
    type: 'wander',
    choices: [
      {
        label: 'Sell Exploit',
        result: 'Double worth.',
        effects: [
          { type: 'lose_random_exploit', params: [1] },
          { type: 'modify_coin', params: [80] }
        ]
      },
      {
        label: 'Sell Blessing',
        result: 'Acceptable.',
        effects: [
          { type: 'lose_random_blessing', params: [1] },
          { type: 'modify_coin', params: [30] }
        ]
      }
    ]
  },
  {
    id: 'barter_fair',
    label: 'The Barter Fair',
    description: 'Trading goods.',
    type: 'wander',
    choices: [
      {
        label: 'Trade Shuffles for Exploit',
        result: 'Partner found.',
        effects: [
          { type: 'modify_shuffle_count', params: [-3] },
          { type: 'add_random_exploit', params: ['common'] }
        ]
      },
      {
        label: 'Trade Discards for Exploit',
        result: 'Agreed.',
        effects: [
          { type: 'modify_discard_count', params: [-3] },
          { type: 'add_random_exploit', params: ['common'] }
        ]
      },
      {
        label: 'Browse',
        result: 'Rest.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'time_keepers_error',
    label: 'The Time Keeper\'s Error',
    description: 'Dropped moment.',
    type: 'wander',
    choices: [
      {
        label: 'Help find',
        result: 'Shard found.',
        effects: [
          { type: 'add_item', params: ['encounter_reset'] }
        ]
      },
      {
        label: 'Not my problem',
        result: 'Shared fate.',
        effects: [
          { type: 'modify_shuffle_count', params: [-1] },
          { type: 'modify_discard_count', params: [-1] }
        ]
      }
    ]
  },
  {
    id: 'queens_pardon',
    label: 'The Queen\'s Pardon',
    description: 'Cleric shrine.',
    type: 'wander',
    choices: [
      {
        label: 'Pay pardon (-40 Coin)',
        result: 'Cleansed.',
        effects: [
          { type: 'check_curses', params: [1, [{ type: 'modify_coin', params: [-40] }, { type: 'remove_curse', params: [] }], []] }
        ]
      },
      {
        label: 'No pardon',
        result: 'Pride.',
        effects: [
          { type: 'random_outcome', params: [0.5, [{ type: 'add_random_curse', params: [] }], [{ type: 'add_random_blessing', params: [] }]] }
        ]
      }
    ]
  },
  {
    id: 'worn_out_boots',
    label: 'The Worn-Out Boots',
    description: 'Sturdy boots.',
    type: 'wander',
    choices: [
      {
        label: 'Put them on',
        result: 'Fit perfectly.',
        effects: [
          { type: 'add_status', params: ['fleet_of_foot', 3] }
        ]
      },
      {
        label: 'Leave them',
        result: 'Missed coin.',
        effects: [
          { type: 'modify_coin', params: [10] }
        ]
      }
    ]
  },
  {
    id: 'gamblers_fallacy',
    label: 'The Gambler\'s Fallacy',
    description: 'Losing streak.',
    type: 'wander',
    choices: [
      {
        label: 'Lend coin (-20)',
        result: 'Loss.',
        effects: [
          { type: 'modify_coin', params: [-20] }
        ]
      },
      {
        label: 'Don\'t be a fool',
        result: 'He wins later.',
        effects: [
          { type: 'modify_coin_pct', params: [-0.25] }
        ]
      }
    ]
  },
  {
    id: 'smugglers_cache',
    label: 'The Smuggler\'s Cache',
    description: 'Loose stone.',
    type: 'wander',
    choices: [
      {
        label: 'Pick lock',
        result: 'Contraband.',
        effects: [
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      },
      {
        label: 'Report it',
        result: 'Reward.',
        effects: [
          { type: 'modify_coin', params: [25] }
        ]
      },
      {
        label: 'Leave it',
        result: 'Focus.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      }
    ]
  },
  {
    id: 'oracles_warning',
    label: 'The Oracle\'s Warning',
    description: 'Frantic oracle.',
    type: 'wander',
    choices: [
      {
        label: 'Heed warning',
        result: 'Skip danger.',
        effects: [
          { type: 'add_status', params: ['skip_next_wander'] },
          { type: 'add_random_blessing', params: [] }
        ]
      },
      {
        label: 'Make own fate',
        result: 'Disaster.',
        effects: [
          { type: 'add_status', params: ['wander_debuff'] }
        ]
      }
    ]
  },
  {
    id: 'rusted_horn',
    label: 'The Rusted Horn',
    description: 'Ancient horn.',
    type: 'wander',
    choices: [
      {
        label: 'Blow it',
        result: 'Summoned.',
        effects: [
          { type: 'add_random_curse', params: [] },
          { type: 'add_random_exploit', params: ['rare'] }
        ]
      },
      {
        label: 'Polish (-5 Coin)',
        result: 'Sold.',
        effects: [
          { type: 'modify_coin', params: [-5] },
          { type: 'modify_coin', params: [15] }
        ]
      }
    ]
  },
  {
    id: 'scholars_test',
    label: 'The Scholar\'s Test',
    description: 'A riddle.',
    type: 'wander',
    choices: [
      {
        label: '"A bottle"',
        result: 'Correct.',
        effects: [
          { type: 'modify_shuffle_count', params: [1] }
        ]
      },
      {
        label: 'Silence',
        result: 'Wrong.',
        effects: [
          { type: 'modify_score', params: [-10] }
        ]
      }
    ]
  }
];

export const WANDER_REGISTRY: Wander[] = [...part1, ...part2, ...part3, ...part4, ...part5];
