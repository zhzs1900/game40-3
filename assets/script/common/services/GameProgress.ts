import { baseGameConfig } from '../../config/baseGameConfig';
import { GameStorage } from '../../framework/core/GameStorage';

export type GameResult = 'victory' | 'failure';

/** 正常选关受解锁进度限制，调试选关只改变当前关卡。 */
export class GameProgress {
  level = 1;
  unlockedLevel: number;
  readonly totalLevels = baseGameConfig.totalLevels;

  constructor(private readonly storage: GameStorage) {
    const saved = storage.getNumber('unlockedLvl', 1);
    this.unlockedLevel = Number.isInteger(saved) && saved >= 1 && saved <= this.totalLevels ? saved : 1;
  }

  select(level: number, debug = false) {
    if (!Number.isInteger(level) || level < 1 || level > (debug ? this.totalLevels : this.unlockedLevel)) { return false; }
    this.level = level;
    return true;
  }

  win() {
    if (this.level === this.unlockedLevel && this.level < this.totalLevels) {
      this.unlockedLevel += 1;
      this.storage.setNumber('unlockedLvl', this.unlockedLevel);
    }
  }

  returnToCover() {
    this.level = Math.min(this.level, this.unlockedLevel);
  }
}
