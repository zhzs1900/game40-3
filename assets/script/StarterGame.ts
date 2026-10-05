import { _decorator, Node, view } from 'cc';
import { BaseGameState } from './common/BaseGameController';
import { BasePageGameController } from './common/BasePageGameController';
import { CoverPage } from './common/CoverPage';
import { GameDialogs } from './common/GameDialogs';
import { GameDebug } from './common/GameDebug';
import { LanternNightScene } from './game/LanternNightScene';
import { GameAudio } from './framework/common/GameAudio';
import { GameProgress } from './common/services/GameProgress';
import type { GameResult } from './common/services/GameProgress';
import { GameUI } from './framework/ui/GameUI';

const { ccclass } = _decorator;
export type { GameResult } from './common/services/GameProgress';

@ccclass('StarterGame')
export class StarterGame extends BasePageGameController {
  private progress!: GameProgress;
  private audio!: GameAudio;
  private ui!: GameUI;
  private debug!: GameDebug;
  private gameScene: LanternNightScene | null = null;
  private stage!: Node;
  private cover!: CoverPage;
  private dialogs!: GameDialogs;

  get currentLevel() { return this.progress.level; }

  protected bootstrap() {
    this.progress = new GameProgress(this.storage);
    this.audio = new GameAudio(this.node, this.storage);
    this.ui = new GameUI(() => this.audio.click());
    this.dialogs = new GameDialogs(this.ui, this.audio, () => this.getState(), state => this.setState(state));
    this.cover = new CoverPage(this.ui, this.progress, this.dialogs,
      () => this.showPlay(this.progress.level), () => this.showCover(), () => this.debug.showPassword());
    this.debug = new GameDebug(this.ui, this.progress,
      (title, height) => this.dialogs.open(title, height),
      level => this.showPlay(level), result => this.finishGame(result));
    view.on('canvas-resize', this.onResize, this);
    this.showCover();
  }

  onDestroy() {
    view.off('canvas-resize', this.onResize, this);
    super.onDestroy();
  }

  private onResize() {
    if (!this.stage?.isValid) { return; }
    const size = view.getVisibleSize();
    const scale = Math.min(size.width / 720, size.height / 1280);
    this.stage.setScale(scale, scale, 1);
  }

  private createStage(name: string) {
    this.dialogs.close();
    this.gameScene = null;
    const root = this.createPage(name);
    this.stage = this.ui.stage(root, view.getVisibleSize());
    this.dialogs.attach(this.stage);
    return this.stage;
  }

  protected showCover() {
    this.progress.returnToCover();
    const stage = this.createStage('CoverPage');
    this.setState(BaseGameState.Cover);
    this.cover.render(stage);
    this.debug.render(stage);
  }

  protected showPlay(level = this.progress.level) {
    if (!this.progress.select(level, true)) { return; }
    const stage = this.createStage('PlayPage');
    this.setState(BaseGameState.Playing);
    this.gameScene = stage.addComponent(LanternNightScene);
    this.gameScene.initialize(this.ui, level, result => this.finishGame(result),
      () => this.dialogs.showGameMenu(() => this.showCover()));
    this.debug.render(stage);
  }

  protected onEnterState(_previous: BaseGameState, next: BaseGameState) {
    if (this.gameScene?.isValid) { this.gameScene.enabled = next === BaseGameState.Playing; }
  }

  /** 玩法完成时调用；调试菜单复用相同结算流程。 */
  public finishGame(result: GameResult) {
    if (!this.gameScene) { this.showPlay(); }
    this.dialogs.close();
    const victory = result === 'victory';
    if (victory) { this.progress.win(); }
    this.setState(victory ? BaseGameState.Victory : BaseGameState.GameOver);
    this.dialogs.showResult(result, this.progress.level, this.progress.totalLevels,
      () => this.showPlay(this.progress.level + (victory ? 1 : 0)), () => this.showCover());
  }
}
