import { ClassicGameRules } from '../types';
import { KlondikeDraw1, KlondikeDraw3 } from './klondike';
import { Spider1Suit, Spider2Suit, Spider4Suit } from './spider';
import { FreeCell } from './freecell';
import { Yukon } from './yukon';
import { Golf } from './golf';
import { Scorpion } from './scorpion';
import { Wasp } from './wasp';
import { Pyramid } from './pyramid';
import { TriPeaks } from './tripeaks';
import { FortyThieves } from './fortythieves';
import { BakersDozen } from './bakers_dozen';
import { RussianSolitaire } from './russian';
import { Easthaven } from './easthaven';
import { Canfield } from './canfield';
import { BeleagueredCastle } from './castle';
import { BusDriver } from './bus';
import { ClockSolitaire } from './clock';
import { Calculation } from './calculation';
import { AcesUp } from './aces_up';
import { LaBelleLucie } from './labelle';
import { Cruel } from './cruel';
import { SeahavenTowers } from './seahaven';

export const CLASSIC_GAMES: Record<string, ClassicGameRules> = {
  klondike: KlondikeDraw1,
  klondike3: KlondikeDraw3,
  spider1: Spider1Suit,
  spider2: Spider2Suit,
  spider4: Spider4Suit,
  freecell: FreeCell,
  seahaven: SeahavenTowers,
  yukon: Yukon,
  russian: RussianSolitaire,
  scorpion: Scorpion,
  wasp: Wasp,
  golf: Golf,
  pyramid: Pyramid,
  tripeaks: TriPeaks,
  fortythieves: FortyThieves,
  bakers: BakersDozen,
  easthaven: Easthaven,
  canfield: Canfield,
  castle: BeleagueredCastle,
  bus: BusDriver,
  clock: ClockSolitaire,
  calculation: Calculation,
  aces_up: AcesUp,
  labelle: LaBelleLucie,
  cruel: Cruel
};

export const DEFAULT_GAME = 'klondike';