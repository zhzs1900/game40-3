import { Color, Label, Mask, Node, resources, ScrollView, SpriteFrame, UITransform } from 'cc';
import { baseGameConfig } from '../config/baseGameConfig';
import { GameUI } from '../framework/ui/GameUI';
import { GameProgress } from './services/GameProgress';
import type { GameResult } from './services/GameProgress';

/** 调试入口、素材预览、选关和结算事件；不持有玩法页面。 */
export class GameDebug {
  constructor(private readonly ui: GameUI, private readonly progress: GameProgress,
    private readonly openModal: (title: string, height: number) => Node,
    private readonly showPlay: (level: number) => void,
    private readonly finishGame: (result: GameResult) => void) {}

  render(stage: Node) {
    if (baseGameConfig.debug) {
      this.ui.button(stage, 'DEBUG', 260, -605, 180, 44, () => this.showMenu(), 'buttons/btn_debug', 'icons/icon-14');
    }
  }

  showPassword() {
    const body = this.openModal('输入秘籍密码', 860);
    const input = this.ui.image(body, 'panels/card_common', 480, 80, 0, 255);
    const text = this.ui.text(input, '请输入密码', 0, 0, 28, 440).getComponent(Label)!;
    const tip = this.ui.text(body, '', 0, 190, 20, 480, new Color(248, 113, 113)).getComponent(Label)!;
    let password = '';
    const refresh = () => {
      text.string = password ? '●'.repeat(password.length) : '请输入密码';
      tip.string = '';
    };
    for (let digit = 1; digit <= 9; digit += 1) {
      const index = digit - 1;
      this.ui.button(body, String(digit), (index % 3 - 1) * 165, 110 - Math.floor(index / 3) * 100, 140, 80, () => {
        password += String(digit);
        refresh();
      }, 'buttons/btn_dark');
    }
    this.ui.button(body, '清空', -165, -190, 140, 80, () => {
      password = '';
      refresh();
    }, 'buttons/btn_dark');
    this.ui.button(body, '0', 0, -190, 140, 80, () => {
      password += '0';
      refresh();
    }, 'buttons/btn_dark');
    this.ui.button(body, '删除', 165, -190, 140, 80, () => {
      password = password.slice(0, -1);
      refresh();
    }, 'buttons/btn_dark');
    this.ui.button(body, '确认', 0, -315, 260, 70, () => {
      if (password.length > 0 && password === baseGameConfig.debugPassword) {
        this.showMenu();
      } else {
        tip.string = '密码不正确，请重新输入';
      }
    });
  }

  private showMenu() {
    const body = this.openModal('调试控制台 (DEBUG)', 640);
    this.ui.image(body, 'icons/indicator_debug', 10, 10, -240, 255);
    const gallery = this.ui.button(body, '1. UI 展示', 0, 130, 520, 90, () => this.showGallery(), 'buttons/btn_dark', 'icons/icon_gallery');
    const count = this.ui.image(gallery, 'panels/badge_common', 90, 36, 190, 0);
    this.ui.text(count, `${resources.getDirWithPath('ui', SpriteFrame).length} 张`, 0, 0, 18, 80);
    this.ui.button(body, '2. 关卡选择', 0, 10, 520, 90, () => this.showLevels(), 'buttons/btn_dark', 'icons/icon_levels');
    this.ui.button(body, '3. 触发事件', 0, -110, 520, 90, () => this.showEvents(), 'buttons/btn_dark', 'icons/icon_events');
  }

  private back(body: Node, y: number) {
    this.ui.button(body, '返回调试菜单', 0, y, 280, 60, () => this.showMenu(), 'buttons/btn_back');
  }

  private showEvents() {
    const body = this.openModal('触发事件', 560);
    this.ui.image(body, 'icons/indicator_debug', 10, 10, -240, 215);
    this.ui.button(body, '触发胜利', 0, 80, 500, 90, () => this.finishGame('victory'), 'buttons/btn_gold', 'icons/icon_trophy');
    this.ui.button(body, '触发失败', 0, -40, 500, 90, () => this.finishGame('failure'), 'buttons/btn_dark', 'icons/icon-3');
    this.back(body, -170);
  }

  private showLevels() {
    const body = this.openModal('选择关卡', 1120);
    const panelHeight = Math.ceil(this.progress.totalLevels / 2) * 165 + 20;
    const panelY = 430 - panelHeight / 2;
    const panel = this.ui.image(body, 'panels/panel_levels', 560, panelHeight, 0, panelY);
    for (let level = 1; level <= this.progress.totalLevels; level += 1) {
      const index = level - 1;
      this.ui.button(panel, `STAGE\n${level}`, index % 2 === 0 ? -140 : 140, 350 - Math.floor(index / 2) * 165 - panelY,
        250, 140, () => this.showPlay(level), level === this.progress.level ? 'buttons/card_stage_on' : 'buttons/card_stage');
    }
    const tip = this.ui.image(body, 'panels/panel_tip', 340, 44, 0, -430);
    this.ui.text(tip, '点击对应关卡即可进入', 0, 0, 20, 320);
    this.back(body, -500);
  }

  private showGallery() {
    const body = this.openModal('UI 组件展示', 1120);
    this.ui.image(body, 'icons/indicator_debug', 10, 10, -240, 495);
    const viewport = this.ui.node(body, 'GalleryViewport', 540, 840, 0, -10);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false;
    const paths = resources.getDirWithPath('ui', SpriteFrame)
      .map(info => info.path.replace(/^ui\//, '').replace(/\/spriteFrame$/, '')).sort();
    const height = Math.ceil(paths.length / 2) * 220;
    const content = this.ui.node(viewport, 'GalleryContent', 540, height);
    content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    content.setPosition(0, 420);
    scroll.content = content;
    paths.forEach((path, index) => {
      const x = index % 2 === 0 ? -135 : 135;
      const y = -110 - Math.floor(index / 2) * 220;
      const card = this.ui.image(content, 'panels/card_common', 250, 200, x, y);
      this.ui.text(card, path.split('/').pop()!, 0, 72, 18, 230);
      this.ui.image(card, path, 220, 130, 0, -20, true);
    });
    this.back(body, -490);
  }
}
