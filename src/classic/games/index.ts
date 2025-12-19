import { ClassicGameRules } from '../types';
import { KlondikeDraw1, KlondikeDraw3 } from './klondike';
import { FreeCell } from './freecell';

export const CLASSIC_GAMES: Record<string, ClassicGameRules> = {
  klondike: KlondikeDraw1,
  klondike3: KlondikeDraw3,
  freecell: FreeCell,
};