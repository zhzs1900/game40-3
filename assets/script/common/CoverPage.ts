import { Color, LabelOutline, Node, tween, Vec3 } from 'cc';
import { baseGameConfig } from '../config/baseGameConfig';
import { GameUI } from '../framework/ui/GameUI';
import { GameDialogs } from './GameDialogs';
import { sidebarService } from '../framework/ad/SidebarService';
import { openAbilityService } from '../framework/ad/OpenAbilityService';
import { GameProgress } from './services/GameProgress';

/** 公共封面；游戏名称和健康忠告通过配置调整。 */
export class CoverPage {
  constructor(private readonly ui: GameUI, private readonly progress: GameProgress,
    private readonly dialogs: GameDialogs, private readonly onStart: () => void,
    private readonly onRefresh: () => void, private readonly onCheat: () => void) {}

  render(stage: Node) {
    const { ui, progress } = this;
    ui.image(stage, 'coverpage', 720, 1280);
    this.renderTitle(stage);
    ui.button(stage, '', -265, -265, 80, 80, () => this.changeLevel(-1), 'icons/icon-12', undefined, progress.level > 1);
    ui.button(stage, `第${progress.level}关`, 0, -265, 400, 100, this.onStart, 'buttons/btn_gold', 'icons/icon-4');
    ui.button(stage, '', 265, -265, 80, 80, () => this.changeLevel(1), 'icons/icon-13', undefined, progress.level < progress.unlockedLevel);
    if (baseGameConfig.showAdvice) {
      ui.text(stage, '游戏健康忠告', 0, -470, 24);
      ui.text(stage, '抵制不良游戏，拒绝盗版游戏。\n注意自我保护，谨防上当受骗。\n适度游戏益脑，沉迷游戏伤身。\n合理安排时间，享受健康生活。', 0, -558, 21);
    }
    ui.button(stage, '', 300, 580, 64, 64, () => this.showSettings(), 'icons/icon-2');
  }

  private renderTitle(stage: Node) {
    const title = this.ui.node(stage, 'CoverTitle', 660, 100, 0, 384);
    const layers = [
      { x: 7, y: -13, fill: new Color(12, 8, 24, 90), edge: new Color(12, 8, 24, 90), width: 11 },
      { x: 5, y: -10, fill: new Color(20, 10, 32, 220), edge: new Color(20, 10, 32, 220), width: 6 },
      { x: 0, y: -5, fill: new Color(164, 76, 16), edge: new Color(74, 32, 18), width: 6 },
      { x: 0, y: 2, fill: new Color(255, 250, 216), edge: new Color(255, 237, 169), width: 2 },
      { x: 0, y: 0, fill: new Color(255, 211, 76), edge: new Color(132, 65, 17), width: 2 },
    ];
    const characters = Array.from(baseGameConfig.gameTitle);
    const fontSize = Math.min(68, 560 / Math.max(1, characters.length));
    const spacing = fontSize * 1.12;
    characters.forEach((character, index) => {
      const x = (index - (characters.length - 1) / 2) * spacing;
      const y = index % 2 === 0 ? 5 : -5;
      const letter = this.ui.node(title, `TitleChar${index}`, fontSize * 1.5, 110, x, y);
      letter.angle = index % 2 === 0 ? -7 : 6;
      layers.forEach(layer => {
        const text = this.ui.text(letter, character, layer.x, layer.y, fontSize, fontSize * 1.5, layer.fill);
        const outline = text.addComponent(LabelOutline);
        outline.color = layer.edge;
        outline.width = layer.width;
      });
      tween(letter)
        .delay(index * 0.12)
        .then(tween(letter)
          .to(0.65, { position: new Vec3(x, y + 8, 0) }, { easing: 'sineInOut' })
          .to(0.65, { position: new Vec3(x, y, 0) }, { easing: 'sineInOut' })
          .union()
          .repeatForever())
        .start();
    });
  }

  private changeLevel(delta: number) {
    if (this.progress.select(this.progress.level + delta)) { this.onRefresh(); }
  }

  private showSettings() {
    const body = this.dialogs.open('游戏设置', 860);
    this.dialogs.dismissOnBackground();
    this.dialogs.renderAudio(body, () => this.showSettings());
    this.ui.button(body, '添加桌面', 0, -40, 500, 80, () => {
      void openAbilityService.addShortcut().then(result => this.dialogs.notice(body, result.message));
    });
    this.ui.button(body, '添加侧边栏', 0, -150, 500, 80, () => this.showSidebar());
    if (baseGameConfig.adConfig.subscribeMessageEnabled) {
      this.ui.button(body, '订阅消息', 0, -260, 500, 80, () => {
        void openAbilityService.requestSubscribeMessage().then(result => this.dialogs.notice(body, result.message));
      });
    }
    this.ui.button(body, '秘籍', 230, -365, 100, 40, this.onCheat, 'buttons/btn_dark');
  }

  private showSidebar() {
    const added = sidebarService.isLaunchedFromSidebar();
    const body = this.dialogs.open(added ? '已在侧边栏' : '添加到侧边栏', 600);
    this.ui.image(body, 'icon', 120, 120, 0, 110);
    this.ui.text(body, added ? '可以从抖音首页侧边栏随时启动游戏' : '前往抖音首页侧边栏，点击本游戏卡片加入', 0, 0, 20, 550);
    this.ui.button(body, added ? '已添加成功' : '前往首页侧边栏', 0, -120, 440, 80, () => {
      if (added) { this.dialogs.close(); return; }
      void sidebarService.navigate().then(ok => {
        if (ok) { if (body.isValid && body.activeInHierarchy) { this.dialogs.close(); } }
        else { this.dialogs.notice(body, '当前环境不支持跳转，请在抖音小游戏中使用'); }
      });
    });
  }

}
