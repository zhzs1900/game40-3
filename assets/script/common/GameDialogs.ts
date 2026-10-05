import { Color, Node } from 'cc';
import { GameAudio } from '../framework/common/GameAudio';
import { GameUI } from '../framework/ui/GameUI';
import { BaseGameState } from './BaseGameController';
import type { GameResult } from './services/GameProgress';

/** 公共弹窗生命周期、音频选项、游戏菜单及结算界面。 */
export class GameDialogs {
  private stage!: Node;
  private modal: { overlay: Node; body: Node; close: () => void } | null = null;
  private resumeState: BaseGameState | null = null;

  constructor(private readonly ui: GameUI, private readonly audio: GameAudio,
    private readonly getState: () => BaseGameState,
    private readonly setState: (state: BaseGameState) => void) {}

  attach(stage: Node) { this.stage = stage; }

  open(title: string, height = 760) {
    this.close();
    this.resumeState = this.getState();
    if (this.resumeState === BaseGameState.Playing) { this.setState(BaseGameState.Paused); }
    this.modal = this.ui.modal(this.stage, title, height);
    this.ui.button(this.modal.body, '', 280, height / 2 - 15, 56, 56, () => this.close(), 'icons/icon-3');
    return this.modal.body;
  }

  close() {
    this.modal?.close();
    this.modal = null;
    if (this.resumeState !== null && this.getState() === BaseGameState.Paused) { this.setState(this.resumeState); }
    this.resumeState = null;
  }

  renderAudio(body: Node, refresh: () => void) {
    const music = this.ui.button(body, '音乐', -140, 160, 250, 200, () => {
      this.audio.setMusic(!this.audio.musicEnabled);
      refresh();
    }, 'panels/card_common', undefined, true, -20);
    this.ui.image(body, this.audio.musicEnabled ? 'icons/icon-7' : 'icons/icon-8', 80, 80, -140, 210);
    const musicBadge = this.ui.image(music, 'panels/badge_common', 160, 38, 0, -68);
    this.ui.text(musicBadge, this.audio.musicEnabled ? '已开启' : '已关闭', 0, 0, 20, 150,
      this.audio.musicEnabled ? new Color(253, 230, 138) : new Color(148, 163, 184));
    const effects = this.ui.button(body, '音效', 140, 160, 250, 200, () => {
      this.audio.setEffects(!this.audio.effectsEnabled);
      refresh();
    }, 'panels/card_common', undefined, true, -20);
    this.ui.image(body, this.audio.effectsEnabled ? 'icons/icon-9' : 'icons/icon-10', 80, 80, 140, 210);
    const effectsBadge = this.ui.image(effects, 'panels/badge_common', 160, 38, 0, -68);
    this.ui.text(effectsBadge, this.audio.effectsEnabled ? '已开启' : '已关闭', 0, 0, 20, 150,
      this.audio.effectsEnabled ? new Color(253, 230, 138) : new Color(148, 163, 184));
  }

  showGameMenu(onCover: () => void) {
    const body = this.open('游戏菜单', 860);
    this.dismissOnBackground();
    this.renderAudio(body, () => this.showGameMenu(onCover));
    this.ui.button(body, '继续游戏', 0, -50, 500, 90, () => this.close(), 'buttons/btn_gold', 'icons/icon-4');
    this.ui.button(body, '返回封面', 0, -170, 500, 90, onCover, 'buttons/btn_dark', 'icons/icon-5');
  }

  dismissOnBackground() {
    this.modal!.overlay.on(Node.EventType.TOUCH_END, () => this.close());
  }

  notice(source: Node, message: string) {
    if (!source.isValid || !source.activeInHierarchy) { return; }
    const body = this.open('温馨提示', 420);
    this.ui.text(body, message, 0, 20, 22, 530);
    this.ui.button(body, '知道了', 0, -110, 240, 70, () => this.close());
  }

  showResult(result: GameResult, level: number, totalLevels: number,
    onContinue: () => void, onCover: () => void) {
    const victory = result === 'victory';
    const body = this.open(victory ? '游戏胜利' : '游戏失败', 780);
    // 结算只能通过下一关、重试或返回封面离开。
    body.children.find(child => child.name === 'icons/icon-3')!.active = false;
    this.ui.image(body, 'panels/medallion_common', 180, 180, 0, 165);
    this.ui.image(body, victory ? 'icons/icon_trophy' : 'icons/icon-3', 120, 120, 0, 165);
    const lastLevel = level === totalLevels;
    this.ui.text(body, victory && lastLevel ? '恭喜你，全部关卡已通关！' : `第${level}关挑战${victory ? '成功' : '失败'}`, 0, 20, 28, 540);
    if (!victory || !lastLevel) {
      this.ui.button(body, victory ? '进入下一关' : '重新挑战', 0, -115, 500, 90,
        onContinue, 'buttons/btn_gold', victory ? 'icons/icon-13' : 'icons/icon-6');
    }
    this.ui.button(body, '返回封面', 0, -235, 500, 90, onCover, 'buttons/btn_dark', 'icons/icon-5');
  }
}
