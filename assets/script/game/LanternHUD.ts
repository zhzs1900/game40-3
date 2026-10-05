// 手机触摸操控面板与古镇夜巡符案UI系统
// 大虚拟摇杆、大驱邪出牌键、闪避闪避、巡夜灯阵徽章、符箓栏栏与三选一符案升级

import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, tween, Tween, UITransform, Vec2, Vec3 } from 'cc';
import { BuffOption, CardItem, ComboType, HandCombo, LanternSound } from './NightTownData';
import { TalismanRenderer } from './TalismanRenderer';

const { ccclass } = _decorator;

@ccclass('LanternHUD')
export class LanternHUD extends Component {
  // 操纵杆相关
  private stickBaseNode!: Node;
  private stickThumbNode!: Node;
  private stickCenter: Vec2 = new Vec2(-200, -420);
  private moveDir: Vec3 = new Vec3(0, 0, 0);

  // 符箓栏展示栏
  private handRowNode!: Node;
  private handCards: { node: Node; card: CardItem }[] = [];

  // 右侧核心操作大按钮
  private fireBtnNode!: Node;
  private fireLabel!: Label;
  private rollBtnNode!: Node;
  private rollMaskNode!: Node;
  private kataBtnNode!: Node;
  private kataEnergyG!: Graphics;

  // 顶部状态栏
  private hpBarG!: Graphics;
  private shieldBarG!: Graphics;
  private coinLabel!: Label;
  private stageLabel!: Label;
  private adSupplyBtn!: Node;

  // 符案三选一升级弹窗
  private upgradeModalNode!: Node;

  // 回调事件
  public onMove?: (dir: Vec3) => void;
  public onFireCombo?: () => void;
  public onRoll?: () => void;
  public onTriggerKata?: () => void;
  public onCardClick?: (card: CardItem) => void;
  public onAdSupplyClick?: () => void;
  public onPauseClick?: () => void;
  public onSelectBuff?: (buff: BuffOption) => void;

  onLoad() {
    this.createTopBar();
    this.createJoystick();
    this.createHandRow();
    this.createActionButtons();
    this.createUpgradeModal();
  }

  // 1. 创建顶部黄铜皮革状态栏与王牌补给
  private createTopBar() {
    const topRoot = new Node('TopStatus');
    this.node.addChild(topRoot);

    // 生命与护盾底框（左侧，微调位置给中间木牌留足空间）
    const hpBox = new Node('HpBox');
    hpBox.setPosition(120, 520, 0);
    topRoot.addChild(hpBox);

    const boxG = hpBox.addComponent(Graphics);
    // 皮革底纹
    boxG.fillColor = new Color(20, 31, 58, 225);
    boxG.roundRect(-68, -16, 136, 32, 6);
    boxG.fill();
    // 黄铜边框
    boxG.strokeColor = new Color(222, 183, 96);
    boxG.lineWidth = 1.8;
    boxG.roundRect(-68, -16, 136, 32, 6);
    boxG.stroke();

    // 红色血条
    const hpBarNode = new Node('HpFill');
    hpBarNode.setPosition(-62, -2, 0);
    hpBox.addChild(hpBarNode);
    this.hpBarG = hpBarNode.addComponent(Graphics);

    // 蓝色护盾条
    const shieldNode = new Node('ShieldFill');
    shieldNode.setPosition(-62, -10, 0);
    hpBox.addChild(shieldNode);
    this.shieldBarG = shieldNode.addComponent(Graphics);

    // 关卡名称展示木牌（加宽到310px，保证完全框住关卡与事件长文本）
    const stageSign = new Node('StageSign');
    stageSign.setPosition(-205, 580, 0);
    topRoot.addChild(stageSign);
    const signG = stageSign.addComponent(Graphics);
    signG.fillColor = new Color(21, 34, 66, 235);
    signG.roundRect(-120, -18, 240, 36, 8);
    signG.fill();
    signG.strokeColor = new Color(213, 174, 92);
    signG.lineWidth = 1.8;
    signG.roundRect(-120, -18, 240, 36, 8);
    signG.stroke();

    const stageLblNode = new Node('StageText');
    stageSign.addChild(stageLblNode);
    // 给文字节点加上尺寸限制与自动缩小模式，彻底避免文字超出木牌外框
    const signUi = stageLblNode.addComponent(UITransform);
    signUi.setContentSize(224, 30);
    this.stageLabel = stageLblNode.addComponent(Label);
    this.stageLabel.string = '青石巷口';
    this.stageLabel.fontSize = 14;
    this.stageLabel.lineHeight = 16;
    this.stageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.stageLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.stageLabel.overflow = Label.Overflow.SHRINK;
    this.stageLabel.color = new Color(255, 240, 200);

    // 灵火显示（右侧，对称对齐）
    const coinNode = new Node('CoinBox');
    coinNode.setPosition(-285, 520, 0);
    topRoot.addChild(coinNode);
    const cg = coinNode.addComponent(Graphics);
    cg.fillColor = new Color(37, 30, 58, 225);
    cg.roundRect(-42, -16, 84, 32, 5);
    cg.fill();
    cg.strokeColor = new Color(207, 155, 82);
    cg.lineWidth = 1.5;
    cg.roundRect(-42, -16, 84, 32, 5);
    cg.stroke();
    TalismanRenderer.drawStarBadge(cg, -24, 0, 8, new Color(245, 195, 50));

    const coinLblNode = new Node('CoinText');
    coinLblNode.setPosition(8, 0, 0);
    coinNode.addChild(coinLblNode);
    const coinUi = coinLblNode.addComponent(UITransform);
    coinUi.setContentSize(48, 24);
    this.coinLabel = coinLblNode.addComponent(Label);
    this.coinLabel.string = '0';
    this.coinLabel.fontSize = 15;
    this.coinLabel.overflow = Label.Overflow.SHRINK;
    this.coinLabel.color = new Color(255, 225, 120);

    // 常驻【王牌补给】激励广告按钮（右上角带黄铜框AD标）
    this.adSupplyBtn = new Node('AdSupplyBtn');
    this.adSupplyBtn.addComponent(UITransform).setContentSize(110, 40);
    this.adSupplyBtn.setPosition(250, 510, 0);
    topRoot.addChild(this.adSupplyBtn);

    const ag = this.adSupplyBtn.addComponent(Graphics);
    // 复古长牌底座
    ag.fillColor = new Color(60, 30, 15, 235);
    ag.roundRect(-55, -20, 110, 40, 6);
    ag.fill();
    ag.strokeColor = new Color(225, 185, 75);
    ag.lineWidth = 2;
    ag.roundRect(-55, -20, 110, 40, 6);
    ag.stroke();

    const adLblNode = new Node('AdLbl');
    this.adSupplyBtn.addChild(adLblNode);
    const al = adLblNode.addComponent(Label);
    al.string = '王牌补给';
    al.fontSize = 17;
    al.color = new Color(255, 235, 175);

    // 右上角鲜明 AD 标识黄铜铭牌
    const badgeNode = new Node('AdBadge');
    badgeNode.setPosition(42, 14, 0);
    this.adSupplyBtn.addChild(badgeNode);
    const bg = badgeNode.addComponent(Graphics);
    bg.fillColor = new Color(185, 35, 35);
    bg.roundRect(-14, -8, 28, 16, 3);
    bg.fill();
    bg.strokeColor = new Color(255, 220, 90);
    bg.lineWidth = 1;
    bg.roundRect(-14, -8, 28, 16, 3);
    bg.stroke();

    const adTxt = new Node('Txt');
    badgeNode.addChild(adTxt);
    const adL = adTxt.addComponent(Label);
    adL.string = 'AD';
    adL.fontSize = 11;
    adL.lineHeight = 12;
    adL.color = new Color(255, 255, 220);

    this.adSupplyBtn.on(Node.EventType.TOUCH_END, () => {
      if (this.onAdSupplyClick) this.onAdSupplyClick();
    });
  }

  // 2. 左下大尺寸触摸虚拟摇杆
  private createJoystick() {
    const joyRoot = new Node('InkCompass');
    this.node.addChild(joyRoot);
    this.stickBaseNode = new Node('CompassBase');
    this.stickBaseNode.addComponent(UITransform).setContentSize(170, 170);
    this.stickBaseNode.setPosition(this.stickCenter.x, this.stickCenter.y, 0);
    joyRoot.addChild(this.stickBaseNode);

    const bg = this.stickBaseNode.addComponent(Graphics);
    bg.fillColor = new Color(10, 18, 38, 145);
    bg.circle(0, 0, 84); bg.fill();
    bg.strokeColor = new Color(201, 163, 88, 205); bg.lineWidth = 2.5; bg.circle(0, 0, 82); bg.stroke();
    bg.strokeColor = new Color(119, 139, 174, 150); bg.lineWidth = 1.2;
    bg.circle(0, 0, 62); bg.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      bg.moveTo(Math.cos(a) * 50, Math.sin(a) * 50);
      bg.lineTo(Math.cos(a) * 72, Math.sin(a) * 72);
    }
    bg.stroke();
    bg.strokeColor = new Color(184, 54, 48, 210); bg.lineWidth = 2;
    bg.moveTo(0, 56); bg.lineTo(7, 40); bg.lineTo(0, 44); bg.lineTo(-7, 40); bg.close(); bg.stroke();

    this.stickThumbNode = new Node('InkSealThumb');
    this.stickBaseNode.addChild(this.stickThumbNode);
    const tg = this.stickThumbNode.addComponent(Graphics);
    tg.fillColor = new Color(28, 43, 72, 235); tg.circle(0, 0, 34); tg.fill();
    tg.strokeColor = new Color(230, 190, 100); tg.lineWidth = 2.5; tg.circle(0, 0, 34); tg.stroke();
    tg.strokeColor = new Color(193, 55, 48); tg.lineWidth = 2;
    tg.moveTo(-10, 9); tg.bezierCurveTo(-2, 14, 5, 8, 9, 12);
    tg.moveTo(-9, 0); tg.bezierCurveTo(-3, -5, 3, 7, 10, 0);
    tg.moveTo(-8, -10); tg.lineTo(8, -10); tg.stroke();

    this.stickBaseNode.on(Node.EventType.TOUCH_START, this.onTouchMove, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private isJoyDragging: boolean = false;

  // 查询当前触摸摇杆是否正在被手指按住拖拽
  public isJoystickDragging(): boolean {
    return this.isJoyDragging;
  }

  private onTouchMove(e: EventTouch) {
    this.isJoyDragging = true;
    const touch = e.getUILocation();
    const uiTransform = this.stickBaseNode.getComponent(UITransform) || this.stickBaseNode.addComponent(UITransform);
    const local = uiTransform.convertToNodeSpaceAR(new Vec3(touch.x, touch.y, 0));

    const len = Math.sqrt(local.x * local.x + local.y * local.y);
    const maxR = 65;
    if (len > maxR) {
      local.x = (local.x / len) * maxR;
      local.y = (local.y / len) * maxR;
    }
    this.stickThumbNode.setPosition(local.x, local.y, 0);

    this.moveDir.set(local.x / maxR, local.y / maxR, 0);
    if (this.onMove) {
      this.onMove(this.moveDir);
    }
  }

  private onTouchEnd() {
    this.isJoyDragging = false;
    this.stickThumbNode.setPosition(0, 0, 0);
    this.moveDir.set(0, 0, 0);
    if (this.onMove) {
      this.onMove(this.moveDir);
    }
  }

  // 3. 底部大符箓符箓栏栏
  private createHandRow() {
    this.handRowNode = new Node('TalismanRow');
    this.handRowNode.setPosition(0, -520, 0);
    this.node.addChild(this.handRowNode);
    const rail = new Node('TalismanRail');
    rail.setPosition(0, -3, 0);
    this.handRowNode.addChild(rail);
    const g = rail.addComponent(Graphics);
    g.fillColor = new Color(12, 22, 43, 165); g.roundRect(-218, -57, 436, 114, 16); g.fill();
    g.strokeColor = new Color(183, 142, 78, 150); g.lineWidth = 1.5; g.roundRect(-218, -57, 436, 114, 16); g.stroke();
  }

  // 记录选中的卡牌编号
  public selectedIds: Set<number> = new Set();
  public onSelectionChange?: (selectedIds: number[]) => void;

  // 刷新展示的符箓栏
  updateHandDisplay(cards: CardItem[]) {
    for (const child of [...this.handRowNode.children]) child.destroy();
    this.handRowNode.removeAllChildren();
    this.handCards = [];

    // 清理已不在手里的旧选中ID
    const curIds = new Set(cards.map(c => c.id));
    for (const id of Array.from(this.selectedIds)) {
      if (!curIds.has(id)) {
        this.selectedIds.delete(id);
      }
    }

    const total = cards.length;
    const cardW = 68;
    const cardH = 98;
    const spacing = 70;

    for (let i = 0; i < total; i++) {
      const card = cards[i];
      const cNode = new Node(`Card_${card.id}`);
      const offset = (i - (total - 1) / 2) * spacing;
      const isSel = this.selectedIds.has(card.id);
      const arcY = isSel ? 16 : 0;
      cNode.setPosition(offset, arcY, 0);
      cNode.angle = 0;
      this.handRowNode.addChild(cNode);

      // 符箓栏点击区域匹配
      const cardUi = cNode.addComponent(UITransform);
      cardUi.setContentSize(cardW + 8, cardH + 8);
      cardUi.setAnchorPoint(0.5, 0.5);

      TalismanRenderer.drawCard(cNode, card, cardW, cardH);

      // 若被选中，画高亮金黄光圈
      if (isSel) {
        const sg = cNode.addComponent(Graphics);
        sg.strokeColor = new Color(222, 67, 56, 240);
        sg.lineWidth = 3;
        sg.roundRect(-cardW / 2 - 2, -cardH / 2 - 2, cardW + 4, cardH + 4, 9);
        sg.stroke();
      }

      cNode.on(Node.EventType.TOUCH_END, () => {
        LanternSound.inst.playCard();
        // 切换选中状态
        if (this.selectedIds.has(card.id)) {
          this.selectedIds.delete(card.id);
        } else {
          this.selectedIds.add(card.id);
        }
        this.updateHandDisplay(cards);

        if (this.onSelectionChange) {
          this.onSelectionChange(Array.from(this.selectedIds));
        }
      });

      this.handCards.push({ node: cNode, card });
    }
  }

  // 清空选中项
  clearSelection() {
    this.selectedIds.clear();
  }

  // 4. 右侧超大【驱邪/出牌】与【闪避】、【灯阵】大按钮
  private createActionButtons() {
    const actionRoot = new Node('SealActions');
    this.node.addChild(actionRoot);

    this.fireBtnNode = new Node('DriveEvilBtn');
    this.fireBtnNode.addComponent(UITransform).setContentSize(132, 118);
    this.fireBtnNode.setPosition(245, -410, 0);
    actionRoot.addChild(this.fireBtnNode);
    const fg = this.fireBtnNode.addComponent(Graphics);
    fg.fillColor = new Color(26, 25, 48, 235); fg.roundRect(-62, -54, 124, 108, 18); fg.fill();
    fg.strokeColor = new Color(224, 180, 88); fg.lineWidth = 3; fg.roundRect(-62, -54, 124, 108, 18); fg.stroke();
    fg.strokeColor = new Color(186, 50, 47); fg.lineWidth = 2;
    fg.moveTo(-34, 26); fg.bezierCurveTo(-8, 42, 8, 10, 35, 30);
    fg.moveTo(-31, 6); fg.bezierCurveTo(-7, -10, 12, 18, 33, 0);
    fg.moveTo(-25, -22); fg.lineTo(26, -22); fg.stroke();

    const lblNode = new Node('DriveEvilLabel');
    this.fireBtnNode.addChild(lblNode);
    lblNode.setPosition(0, -2, 0);
    lblNode.addComponent(UITransform).setContentSize(96, 52);
    this.fireLabel = lblNode.addComponent(Label);
    this.fireLabel.string = '驱邪'; this.fireLabel.fontSize = 18; this.fireLabel.lineHeight = 22;
    this.fireLabel.horizontalAlign = Label.HorizontalAlign.CENTER; this.fireLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.fireLabel.overflow = Label.Overflow.SHRINK; this.fireLabel.color = new Color(255, 231, 175);

    this.fireBtnNode.on(Node.EventType.TOUCH_START, () => this.fireBtnNode.setScale(0.94, 0.94, 1));
    this.fireBtnNode.on(Node.EventType.TOUCH_END, () => {
      tween(this.fireBtnNode).to(0.08, { scale: new Vec3(1, 1, 1) }).start();
      if (this.onFireCombo) this.onFireCombo();
    });
    this.fireBtnNode.on(Node.EventType.TOUCH_CANCEL, () => this.fireBtnNode.setScale(1, 1, 1));

    this.rollBtnNode = new Node('DodgeSealBtn');
    this.rollBtnNode.addComponent(UITransform).setContentSize(82, 82);
    this.rollBtnNode.setPosition(165, -315, 0);
    actionRoot.addChild(this.rollBtnNode);
    const rg = this.rollBtnNode.addComponent(Graphics);
    rg.fillColor = new Color(19, 42, 58, 225); rg.roundRect(-38, -38, 76, 76, 16); rg.fill();
    rg.strokeColor = new Color(130, 184, 180); rg.lineWidth = 2.5; rg.roundRect(-38, -38, 76, 76, 16); rg.stroke();
    rg.strokeColor = new Color(230, 188, 102); rg.lineWidth = 2;
    rg.moveTo(-18, 10); rg.bezierCurveTo(-2, 28, 15, 22, 19, 2);
    rg.moveTo(-20, -10); rg.bezierCurveTo(-3, 5, 10, -2, 18, -18); rg.stroke();
    const rollLbl = new Node('DodgeTxt'); this.rollBtnNode.addChild(rollLbl);
    const rl = rollLbl.addComponent(Label); rl.string = '闪避'; rl.fontSize = 16; rl.color = new Color(228, 242, 225);
    this.rollMaskNode = new Node('RollMask'); this.rollBtnNode.addChild(this.rollMaskNode); this.rollMaskNode.active = false;
    this.rollBtnNode.on(Node.EventType.TOUCH_END, () => { if (this.onRoll) this.onRoll(); });

    this.kataBtnNode = new Node('LanternArrayBtn');
    this.kataBtnNode.addComponent(UITransform).setContentSize(82, 82);
    this.kataBtnNode.setPosition(270, -270, 0);
    actionRoot.addChild(this.kataBtnNode);
    this.kataEnergyG = this.kataBtnNode.addComponent(Graphics);
    this.redrawKataBadge(0, 100);
    this.kataBtnNode.on(Node.EventType.TOUCH_END, () => { if (this.onTriggerKata) this.onTriggerKata(); });
  }

  // 绘制灯阵徽章与能量外环
  redrawKataBadge(cur: number, max: number) {
    const g = this.kataEnergyG; g.clear();
    const ratio = Math.min(1, cur / max);
    g.fillColor = new Color(16, 27, 52, 230); g.roundRect(-37, -37, 74, 74, 14); g.fill();
    g.strokeColor = ratio >= 1 ? new Color(250, 209, 116) : new Color(118, 103, 81);
    g.lineWidth = 3; g.roundRect(-37, -37, 74, 74, 14); g.stroke();
    g.fillColor = ratio >= 1 ? new Color(255, 188, 84, 235) : new Color(115, 83, 55, 210);
    g.moveTo(-13, 19); g.lineTo(13, 19); g.lineTo(18, -17); g.lineTo(-18, -17); g.close(); g.fill();
    g.fillColor = new Color(255, 236, 173, ratio >= 1 ? 245 : 120); g.ellipse(0, 0, 12, 18); g.fill();
    g.strokeColor = new Color(183, 55, 48); g.lineWidth = 1.8; g.moveTo(-8, 3); g.lineTo(8, -4); g.moveTo(-7, -6); g.lineTo(7, 7); g.stroke();
    Tween.stopAllByTarget(this.kataBtnNode);
    if (ratio >= 1) tween(this.kataBtnNode).to(0.28,{scale:new Vec3(1.12,1.12,1)}).to(0.28,{scale:new Vec3(1,1,1)}).union().repeatForever().start();
    else this.kataBtnNode.setScale(1,1,1);
  }

  // 把发射按钮文字合理拆成两行，避免圆钮装不下挤出边界
  private fmtBtnTxt(txt: string): string {
    if (!txt) return '出牌\n放符';
    if (txt.includes('·')) {
      const arr = txt.split('·');
      return `${arr[0]}\n${arr[1]}`;
    }
    if (txt.length === 4) {
      return `${txt.slice(0, 2)}\n${txt.slice(2)}`;
    }
    return txt;
  }

  // 刷新当前牌型大招提示文本
  setComboHint(combo: HandCombo) {
    this.fireLabel.string = this.fmtBtnTxt(combo.name);
  }

  // 刷新血量与护盾条
  updateHp(curHp: number, maxHp: number, curShield: number) {
    const totalW = 124;

    // 血条
    this.hpBarG.clear();
    const hpRatio = Math.max(0, curHp / maxHp);
    this.hpBarG.fillColor = new Color(215, 45, 45);
    this.hpBarG.roundRect(0, 0, totalW * hpRatio, 8, 2);
    this.hpBarG.fill();

    // 护盾条
    this.shieldBarG.clear();
    if (curShield > 0) {
      const shieldRatio = Math.min(1.0, curShield / 40);
      this.shieldBarG.fillColor = new Color(50, 150, 240);
      this.shieldBarG.roundRect(0, 0, totalW * shieldRatio, 5, 1);
      this.shieldBarG.fill();
    }
  }

  // 刷新灵火
  updateCoins(coins: number) {
    this.coinLabel.string = `${coins}`;
  }

  // 刷新关卡名
  updateStageName(name: string) {
    this.stageLabel.string = name;
  }

  // 5. 符案三选一升级弹窗
  private createUpgradeModal() {
    this.upgradeModalNode = new Node('UpgradeModal');
    this.node.addChild(this.upgradeModalNode);
    this.upgradeModalNode.active = false;

    // 黑色半透明暗背景
    const bgNode = new Node('Bg');
    this.upgradeModalNode.addChild(bgNode);
    const bg = bgNode.addComponent(Graphics);
    bg.fillColor = new Color(10, 8, 12, 215);
    bg.rect(-360, -640, 720, 1280);
    bg.fill();

    // 符案墨绿台呢底板
    const tableNode = new Node('Table');
    tableNode.setPosition(0, 30, 0);
    this.upgradeModalNode.addChild(tableNode);
    const tg = tableNode.addComponent(Graphics);
    tg.fillColor = new Color(20, 31, 58);
    tg.roundRect(-270, -220, 540, 440, 12);
    tg.fill();
    tg.strokeColor = new Color(215, 175, 70);
    tg.lineWidth = 4;
    tg.roundRect(-270, -220, 540, 440, 12);
    tg.stroke();

    // 标题提示：灵息强化
    const titleNode = new Node('Title');
    titleNode.setPosition(0, 160, 0);
    tableNode.addChild(titleNode);
    const tl = titleNode.addComponent(Label);
    tl.string = '—— 夜巡符契 ——';
    tl.fontSize = 24;
    tl.color = new Color(255, 230, 150);
  }

  // 弹出三选一升级符案牌局
  showUpgradeChoices(options: BuffOption[]) {
    this.upgradeModalNode.active = true;
    const table = this.upgradeModalNode.getChildByName('Table')!;

    // 移除旧卡
    const oldCards = table.children.filter(c => c.name.startsWith('ChoiceCard_'));
    for (const oc of oldCards) oc.destroy();

    const spacing = 160;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cardNode = new Node(`ChoiceCard_${i}`);
      const offset = (i - 1) * spacing;
      cardNode.setPosition(offset, -20, 0);
      table.addChild(cardNode);

      // 设置卡牌精确的触控区域（宽度140，高度230），居中锚点(0.5, 0.5)
      // 完美覆盖 -70 到 +70、-115 到 +115 的整张卡牌视觉全范围，彻底杜绝下方点不到的问题
      const cardTrans = cardNode.addComponent(UITransform);
      cardTrans.setContentSize(140, 230);
      cardTrans.setAnchorPoint(0.5, 0.5);

      // 符箓造型大按钮
      const cg = cardNode.addComponent(Graphics);
      cg.fillColor = new Color(241, 224, 176);
      cg.roundRect(-65, -110, 130, 220, 8);
      cg.fill();
      cg.strokeColor = new Color(173, 52, 45);
      cg.lineWidth = 2.5;
      cg.roundRect(-65, -110, 130, 220, 8);
      cg.stroke();

      // 图标符记
      const iconNode = new Node('Icon');
      iconNode.setPosition(0, 55, 0);
      cardNode.addChild(iconNode);
      const il = iconNode.addComponent(Label);
      il.string = opt.icon;
      il.fontSize = 38;
      il.color = new Color(185, 35, 35);

      // 名称（短文本如“跳弹+1”）
      const nameNode = new Node('Name');
      nameNode.setPosition(0, 5, 0);
      cardNode.addChild(nameNode);
      const nl = nameNode.addComponent(Label);
      nl.string = opt.name;
      nl.fontSize = 21;
      nl.lineHeight = 24;
      nl.color = new Color(35, 30, 30);

      // 简短描述（自适应卡牌宽度折行）
      const descNode = new Node('Desc');
      descNode.setPosition(0, -55, 0);
      const descUi = descNode.addComponent(UITransform);
      descUi.setContentSize(110, 60);
      cardNode.addChild(descNode);
      const dl = descNode.addComponent(Label);
      dl.string = opt.desc;
      dl.fontSize = 12;
      dl.lineHeight = 15;
      dl.overflow = Label.Overflow.RESIZE_HEIGHT;
      dl.horizontalAlign = Label.HorizontalAlign.CENTER;
      dl.color = new Color(90, 75, 65);

      // 初始翻牌动画（从背面翻开）
      cardNode.setScale(0.1, 1, 1);
      tween(cardNode)
        .delay(i * 0.1)
        .to(0.2, { scale: new Vec3(1, 1, 1) })
        .start();

      const selectThis = () => {
        if (!cardNode.isValid || !this.upgradeModalNode.active) return;
        cardNode.setScale(1.0, 1.0, 1);
        LanternSound.inst.playClick();
        this.upgradeModalNode.active = false;
        if (this.onSelectBuff) {
          this.onSelectBuff(opt);
        }
      };
      (cardNode as any).onSelect = selectThis;

      // 绑定父节点触摸与点击反馈
      cardNode.on(Node.EventType.TOUCH_START, () => {
        cardNode.setScale(0.96, 0.96, 1);
      });
      cardNode.on(Node.EventType.TOUCH_CANCEL, () => {
        cardNode.setScale(1.0, 1.0, 1);
      });
      cardNode.on(Node.EventType.TOUCH_END, () => {
        selectThis();
      });
      cardNode.on('click', selectThis);

      // 子节点也全部绑定触摸委托，确保不论点击牌的下半部文字、图标还是空白处都能100%响应
      iconNode.on(Node.EventType.TOUCH_END, selectThis);
      nameNode.on(Node.EventType.TOUCH_END, selectThis);
      descNode.on(Node.EventType.TOUCH_END, selectThis);
    }
  }

  private currentUpgradeOptions: BuffOption[] = [];

  // 直接选中指定卡牌索引
  selectUpgradeChoice(index: number) {
    const table = this.upgradeModalNode.getChildByName('Table');
    if (table) {
      const card = table.getChildByName(`ChoiceCard_${index}`);
      if (card && (card as any).onSelect) {
        (card as any).onSelect();
      }
    }
  }

  // 关闭升级弹窗
  closeUpgrade() {
    this.upgradeModalNode.active = false;
  }
}
