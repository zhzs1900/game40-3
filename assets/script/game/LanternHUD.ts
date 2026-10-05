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
  private handRailNode!: Node;
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
  private hudPulse: number = 0;
  private fireAuraNode!: Node;
  private kataHaloNode!: Node;

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

    const stageSign = new Node('StageSign');
    stageSign.setPosition(-190, 575, 0);
    topRoot.addChild(stageSign);
    const signG = stageSign.addComponent(Graphics);
    signG.fillColor = new Color(13, 24, 48, 238);
    signG.moveTo(-132,-17); signG.lineTo(-120,-28); signG.lineTo(96,-28); signG.lineTo(128,-8);
    signG.lineTo(118,18); signG.lineTo(-105,18); signG.lineTo(-132,7); signG.close(); signG.fill();
    signG.strokeColor = new Color(218, 179, 91); signG.lineWidth = 2.2;
    signG.moveTo(-126,-13); signG.bezierCurveTo(-70,-31,55,-30,122,-7);
    signG.bezierCurveTo(93,16,-44,22,-126,5); signG.close(); signG.stroke();
    signG.strokeColor = new Color(167, 49, 46); signG.lineWidth = 1.5;
    signG.moveTo(-110,10); signG.bezierCurveTo(-66,2,-34,11,0,4);
    signG.bezierCurveTo(30,-2,61,9,105,2); signG.stroke();

    const stageLblNode = new Node('StageText');
    stageSign.addChild(stageLblNode);
    const signUi = stageLblNode.addComponent(UITransform);
    signUi.setContentSize(230, 30);
    this.stageLabel = stageLblNode.addComponent(Label);
    this.stageLabel.string = '青石巷口';
    this.stageLabel.fontSize = 16;
    this.stageLabel.lineHeight = 18;
    this.stageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.stageLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.stageLabel.overflow = Label.Overflow.SHRINK;
    this.stageLabel.color = new Color(255, 236, 186);

    const hpBox = new Node('HpBox');
    hpBox.setPosition(111, 520, 0);
    topRoot.addChild(hpBox);
    const boxG = hpBox.addComponent(Graphics);
    boxG.fillColor = new Color(17, 29, 56, 232);
    boxG.moveTo(-79,-17); boxG.lineTo(-68,-25); boxG.lineTo(70,-22); boxG.lineTo(82,-9);
    boxG.lineTo(74,17); boxG.lineTo(-65,20); boxG.close(); boxG.fill();
    boxG.strokeColor = new Color(207, 168, 86); boxG.lineWidth = 2;
    boxG.moveTo(-72,-14); boxG.lineTo(-62,-20); boxG.lineTo(65,-18); boxG.lineTo(75,-7);
    boxG.lineTo(67,12); boxG.lineTo(-61,15); boxG.close(); boxG.stroke();
    boxG.strokeColor = new Color(92, 112, 150, 180); boxG.lineWidth = 1.1;
    boxG.moveTo(-57,3); boxG.bezierCurveTo(-18,12,24,-8,62,2); boxG.stroke();

    const hpBarNode = new Node('HpFill');
    hpBarNode.setPosition(-60, 2, 0); hpBox.addChild(hpBarNode);
    this.hpBarG = hpBarNode.addComponent(Graphics);
    const shieldNode = new Node('ShieldFill');
    shieldNode.setPosition(-60, -9, 0); hpBox.addChild(shieldNode);
    this.shieldBarG = shieldNode.addComponent(Graphics);

    const coinNode = new Node('CoinBox');
    coinNode.setPosition(-285, 518, 0);
    topRoot.addChild(coinNode);
    const cg = coinNode.addComponent(Graphics);
    cg.fillColor = new Color(35, 27, 55, 230);
    cg.moveTo(-45,-16); cg.lineTo(-34,-23); cg.lineTo(35,-20); cg.lineTo(47,-7); cg.lineTo(40,15); cg.lineTo(-33,20); cg.close(); cg.fill();
    cg.strokeColor = new Color(208, 159, 78); cg.lineWidth = 1.8;
    cg.moveTo(-41,-12); cg.lineTo(-31,-18); cg.lineTo(31,-16); cg.lineTo(41,-5); cg.lineTo(35,11); cg.lineTo(-29,15); cg.close(); cg.stroke();
    cg.fillColor = new Color(241, 189, 86, 220);
    cg.moveTo(-27,8); cg.bezierCurveTo(-34,2,-31,-7,-24,-11); cg.bezierCurveTo(-17,-6,-17,3,-27,8); cg.fill();

    const coinLblNode = new Node('CoinText');
    coinLblNode.setPosition(10, 0, 0); coinNode.addChild(coinLblNode);
    const coinUi = coinLblNode.addComponent(UITransform); coinUi.setContentSize(50, 24);
    this.coinLabel = coinLblNode.addComponent(Label);
    this.coinLabel.string='0'; this.coinLabel.fontSize=15; this.coinLabel.lineHeight=17;
    this.coinLabel.horizontalAlign=Label.HorizontalAlign.CENTER; this.coinLabel.verticalAlign=Label.VerticalAlign.CENTER;
    this.coinLabel.overflow=Label.Overflow.SHRINK; this.coinLabel.color=new Color(255,225,125);

    // 广告按钮业务和外观保持原逻辑，不改回调与奖励链
    this.adSupplyBtn = new Node('AdSupplyBtn');
    this.adSupplyBtn.addComponent(UITransform).setContentSize(110, 40);
    this.adSupplyBtn.setPosition(250, 510, 0); topRoot.addChild(this.adSupplyBtn);
    const ag = this.adSupplyBtn.addComponent(Graphics);
    ag.fillColor = new Color(60, 30, 15, 235); ag.roundRect(-55,-20,110,40,6); ag.fill();
    ag.strokeColor = new Color(225,185,75); ag.lineWidth=2; ag.roundRect(-55,-20,110,40,6); ag.stroke();
    const adLblNode=new Node('AdLbl');this.adSupplyBtn.addChild(adLblNode);
    const al=adLblNode.addComponent(Label);al.string='王牌补给';al.fontSize=17;al.color=new Color(255,235,175);
    const badgeNode=new Node('AdBadge');badgeNode.setPosition(42,14,0);this.adSupplyBtn.addChild(badgeNode);
    const bg=badgeNode.addComponent(Graphics);bg.fillColor=new Color(185,35,35);bg.roundRect(-14,-8,28,16,3);bg.fill();
    bg.strokeColor=new Color(255,220,90);bg.lineWidth=1;bg.roundRect(-14,-8,28,16,3);bg.stroke();
    const adTxt=new Node('Txt');badgeNode.addChild(adTxt);const adL=adTxt.addComponent(Label);
    adL.string='AD';adL.fontSize=11;adL.lineHeight=12;adL.color=new Color(255,255,220);
    this.adSupplyBtn.on(Node.EventType.TOUCH_END,()=>{if(this.onAdSupplyClick)this.onAdSupplyClick();});
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
    this.handRowNode.setPosition(0, -515, 0);
    this.node.addChild(this.handRowNode);
    this.handRailNode = new Node('TalismanRail'); this.handRowNode.addChild(this.handRailNode);
    const g = this.handRailNode.addComponent(Graphics);
    g.fillColor = new Color(8, 18, 39, 190);
    g.moveTo(-225,-55); g.lineTo(-204,-70); g.lineTo(202,-70); g.lineTo(226,-50);
    g.lineTo(214,54); g.lineTo(189,68); g.lineTo(-196,68); g.lineTo(-224,49); g.close(); g.fill();
    g.strokeColor = new Color(198, 151, 77, 205); g.lineWidth = 2.3;
    g.moveTo(-215,-49); g.bezierCurveTo(-140,-71,141,-71,214,-45);
    g.lineTo(205,44); g.bezierCurveTo(112,65,-126,66,-211,45); g.close(); g.stroke();
    g.strokeColor = new Color(108, 132, 167, 150); g.lineWidth = 1.2;
    g.moveTo(-184,-39); g.bezierCurveTo(-90,-54,91,-54,184,-37); g.stroke();
    g.strokeColor = new Color(171, 50, 46, 170);
    for(let x=-165;x<=165;x+=66){ g.moveTo(x,-50); g.bezierCurveTo(x-8,-30,x+8,-12,x,8); g.bezierCurveTo(x-7,22,x+8,38,x,50); }
    g.stroke();
  }

  // 记录选中的卡牌编号
  public selectedIds: Set<number> = new Set();
  public onSelectionChange?: (selectedIds: number[]) => void;

  // 刷新展示的符箓栏
  updateHandDisplay(cards: CardItem[]) {
    for (const child of [...this.handRowNode.children]) {
      if (child.name.startsWith('Card_')) child.destroy();
    }
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
    const actionRoot = new Node('SealActions'); this.node.addChild(actionRoot);

    this.fireAuraNode = new Node('DriveEvilAura'); this.fireAuraNode.setPosition(245,-410,0); actionRoot.addChild(this.fireAuraNode);
    const aura = this.fireAuraNode.addComponent(Graphics);
    aura.strokeColor = new Color(235, 186, 86, 125); aura.lineWidth=3;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const r1=64,r2=i%2===0?76:70;aura.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);aura.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);} aura.stroke();

    this.fireBtnNode = new Node('DriveEvilBtn'); this.fireBtnNode.addComponent(UITransform).setContentSize(136,122);
    this.fireBtnNode.setPosition(245,-410,0); actionRoot.addChild(this.fireBtnNode);
    const fg=this.fireBtnNode.addComponent(Graphics);
    fg.fillColor=new Color(20,22,48,240);
    fg.moveTo(-62,-38);fg.bezierCurveTo(-72,-4,-58,38,-30,55);fg.lineTo(0,66);fg.lineTo(31,54);
    fg.bezierCurveTo(62,37,72,-4,60,-40);fg.lineTo(30,-57);fg.lineTo(-31,-56);fg.close();fg.fill();
    fg.strokeColor=new Color(228,184,87);fg.lineWidth=3;
    fg.moveTo(-56,-34);fg.bezierCurveTo(-64,-1,-52,32,-27,48);fg.lineTo(0,58);fg.lineTo(27,48);
    fg.bezierCurveTo(52,31,63,-2,55,-34);fg.lineTo(27,-49);fg.lineTo(-27,-49);fg.close();fg.stroke();
    fg.strokeColor=new Color(183,51,47);fg.lineWidth=2;
    fg.moveTo(-31,26);fg.bezierCurveTo(-13,39,6,15,29,28);fg.moveTo(-30,7);fg.bezierCurveTo(-8,-10,8,15,31,1);
    fg.moveTo(-23,-21);fg.bezierCurveTo(-3,-27,7,-12,25,-23);fg.stroke();

    const lblNode=new Node('DriveEvilLabel');this.fireBtnNode.addChild(lblNode);lblNode.setPosition(0,-2,0);
    lblNode.addComponent(UITransform).setContentSize(92,52);
    this.fireLabel=lblNode.addComponent(Label);this.fireLabel.string='驱邪';this.fireLabel.fontSize=19;this.fireLabel.lineHeight=22;
    this.fireLabel.horizontalAlign=Label.HorizontalAlign.CENTER;this.fireLabel.verticalAlign=Label.VerticalAlign.CENTER;
    this.fireLabel.overflow=Label.Overflow.SHRINK;this.fireLabel.color=new Color(255,233,182);

    this.rollBtnNode=new Node('DodgeSealBtn');this.rollBtnNode.addComponent(UITransform).setContentSize(88,88);
    this.rollBtnNode.setPosition(163,-313,0);actionRoot.addChild(this.rollBtnNode);
    const rg=this.rollBtnNode.addComponent(Graphics);
    rg.fillColor=new Color(15,41,58,236);rg.moveTo(0,43);rg.bezierCurveTo(29,35,43,15,40,-8);
    rg.bezierCurveTo(35,-33,14,-43,-9,-39);rg.bezierCurveTo(-34,-34,-45,-11,-39,11);rg.bezierCurveTo(-31,33,-14,40,0,43);rg.fill();
    rg.strokeColor=new Color(117,192,177);rg.lineWidth=2.4;rg.moveTo(0,39);rg.bezierCurveTo(28,31,38,13,35,-7);
    rg.bezierCurveTo(30,-27,12,-36,-8,-34);rg.bezierCurveTo(-28,-30,-38,-10,-33,9);rg.bezierCurveTo(-27,27,-12,36,0,39);rg.stroke();
    rg.strokeColor=new Color(231,190,105);rg.lineWidth=2;rg.moveTo(-17,10);rg.bezierCurveTo(-2,28,14,22,20,1);rg.moveTo(-18,-8);rg.bezierCurveTo(-1,5,9,-3,17,-20);rg.stroke();
    const rollLbl=new Node('DodgeTxt');this.rollBtnNode.addChild(rollLbl);const rl=rollLbl.addComponent(Label);
    rl.string='闪避';rl.fontSize=15;rl.lineHeight=17;rl.color=new Color(228,242,225);
    this.rollMaskNode=new Node('RollMask');this.rollBtnNode.addChild(this.rollMaskNode);this.rollMaskNode.active=false;

    this.kataHaloNode=new Node('LanternHalo');this.kataHaloNode.setPosition(270,-268,0);actionRoot.addChild(this.kataHaloNode);
    const kh=this.kataHaloNode.addComponent(Graphics);kh.strokeColor=new Color(213,170,83,120);kh.lineWidth=2;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;kh.moveTo(Math.cos(a)*43,Math.sin(a)*43);kh.lineTo(Math.cos(a)*51,Math.sin(a)*51);}kh.stroke();

    this.kataBtnNode=new Node('LanternArrayBtn');this.kataBtnNode.addComponent(UITransform).setContentSize(86,86);
    this.kataBtnNode.setPosition(270,-268,0);actionRoot.addChild(this.kataBtnNode);this.kataEnergyG=this.kataBtnNode.addComponent(Graphics);
    this.redrawKataBadge(0,100);

    this.fireBtnNode.on(Node.EventType.TOUCH_START,()=>this.fireBtnNode.setScale(.93,.93,1));
    this.fireBtnNode.on(Node.EventType.TOUCH_END,()=>{tween(this.fireBtnNode).to(.08,{scale:new Vec3(1,1,1)}).start();if(this.onFireCombo)this.onFireCombo();});
    this.fireBtnNode.on(Node.EventType.TOUCH_CANCEL,()=>this.fireBtnNode.setScale(1,1,1));
    this.rollBtnNode.on(Node.EventType.TOUCH_START,()=>this.rollBtnNode.setScale(.92,.92,1));
    this.rollBtnNode.on(Node.EventType.TOUCH_END,()=>{tween(this.rollBtnNode).to(.1,{scale:new Vec3(1,1,1)}).start();if(this.onRoll)this.onRoll();});
    this.rollBtnNode.on(Node.EventType.TOUCH_CANCEL,()=>this.rollBtnNode.setScale(1,1,1));
    this.kataBtnNode.on(Node.EventType.TOUCH_END,()=>{if(this.onTriggerKata)this.onTriggerKata();});
  }

  // 绘制灯阵徽章与能量外环
  redrawKataBadge(cur: number, max: number) {
    const g=this.kataEnergyG;g.clear();const ratio=Math.min(1,cur/max);
    g.fillColor=new Color(14,26,53,238);
    g.moveTo(0,40);g.lineTo(29,28);g.lineTo(40,0);g.lineTo(28,-30);g.lineTo(0,-40);g.lineTo(-30,-28);g.lineTo(-40,0);g.lineTo(-28,29);g.close();g.fill();
    g.strokeColor=ratio>=1?new Color(250,209,116):new Color(118,103,81);g.lineWidth=2.8;
    g.moveTo(0,38);g.lineTo(27,26);g.lineTo(38,0);g.lineTo(26,-27);g.lineTo(0,-38);g.lineTo(-27,-26);g.lineTo(-38,0);g.lineTo(-26,27);g.close();g.stroke();
    g.fillColor=ratio>=1?new Color(255,188,84,235):new Color(115,83,55,210);
    g.moveTo(-13,18);g.lineTo(13,18);g.lineTo(17,-16);g.lineTo(10,-23);g.lineTo(-10,-23);g.lineTo(-17,-16);g.close();g.fill();
    g.strokeColor=new Color(226,185,95);g.lineWidth=1.5;g.moveTo(-8,12);g.lineTo(8,12);g.moveTo(-10,-17);g.lineTo(10,-17);g.stroke();
    g.fillColor=new Color(255,236,173,ratio>=1?245:120);
    g.moveTo(0,14);g.bezierCurveTo(10,5,8,-8,0,-14);g.bezierCurveTo(-8,-7,-9,5,0,14);g.fill();
    g.strokeColor=new Color(183,55,48);g.lineWidth=1.8;g.moveTo(-7,3);g.lineTo(7,-4);g.moveTo(-6,-7);g.lineTo(6,7);g.stroke();
    Tween.stopAllByTarget(this.kataBtnNode);
    if(ratio>=1)tween(this.kataBtnNode).to(.24,{scale:new Vec3(1.1,1.1,1)}).to(.24,{scale:new Vec3(1,1,1)}).union().repeatForever().start();
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
    const totalW=121;
    this.hpBarG.clear();const hpRatio=Math.max(0,curHp/maxHp);
    this.hpBarG.fillColor=new Color(62,23,34,220);this.hpBarG.moveTo(0,-1);this.hpBarG.lineTo(totalW,-1);this.hpBarG.lineTo(totalW-5,7);this.hpBarG.lineTo(5,8);this.hpBarG.close();this.hpBarG.fill();
    if(hpRatio>0){
      const w=totalW*hpRatio;this.hpBarG.fillColor=new Color(207,55,61,245);
      this.hpBarG.moveTo(1,0);this.hpBarG.lineTo(Math.max(4,w),0);this.hpBarG.lineTo(Math.max(1,w-4),6);this.hpBarG.lineTo(5,7);this.hpBarG.close();this.hpBarG.fill();
      this.hpBarG.strokeColor=new Color(246,144,126,150);this.hpBarG.lineWidth=1;this.hpBarG.moveTo(6,5);this.hpBarG.lineTo(Math.max(7,w-5),4);this.hpBarG.stroke();
    }
    this.shieldBarG.clear();
    if(curShield>0){const sw=totalW*Math.min(1,curShield/40);this.shieldBarG.strokeColor=new Color(102,201,218,230);this.shieldBarG.lineWidth=4;
      this.shieldBarG.moveTo(1,0);this.shieldBarG.bezierCurveTo(sw*.35,3,sw*.65,-3,sw,0);this.shieldBarG.stroke();
      this.shieldBarG.strokeColor=new Color(210,247,242,160);this.shieldBarG.lineWidth=1;this.shieldBarG.moveTo(3,2);this.shieldBarG.lineTo(Math.max(4,sw-3),2);this.shieldBarG.stroke();}
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
    this.upgradeModalNode=new Node('UpgradeModal');this.node.addChild(this.upgradeModalNode);this.upgradeModalNode.active=false;
    const bgNode=new Node('Bg');this.upgradeModalNode.addChild(bgNode);
    const bg=bgNode.addComponent(Graphics);bg.fillColor=new Color(7,10,22,225);bg.rect(-360,-640,720,1280);bg.fill();
    bg.strokeColor=new Color(106,72,129,35);bg.lineWidth=7;
    for(let i=0;i<7;i++){const y=-420+i*135;bg.moveTo(-340,y);bg.bezierCurveTo(-150,y+35,120,y-45,340,y+15);}bg.stroke();

    const tableNode=new Node('Table');tableNode.setPosition(0,30,0);this.upgradeModalNode.addChild(tableNode);
    const tg=tableNode.addComponent(Graphics);
    tg.fillColor=new Color(17,29,55,248);tg.moveTo(-282,-190);tg.lineTo(-258,-226);tg.lineTo(244,-226);tg.lineTo(280,-188);
    tg.lineTo(270,182);tg.lineTo(240,218);tg.lineTo(-244,218);tg.lineTo(-278,184);tg.close();tg.fill();
    tg.strokeColor=new Color(218,176,87);tg.lineWidth=3.5;tg.moveTo(-267,-181);tg.lineTo(-246,-212);tg.lineTo(233,-212);tg.lineTo(265,-181);
    tg.lineTo(255,174);tg.lineTo(232,204);tg.lineTo(-233,204);tg.lineTo(-263,174);tg.close();tg.stroke();
    tg.strokeColor=new Color(172,50,46,190);tg.lineWidth=1.6;
    tg.moveTo(-220,184);tg.bezierCurveTo(-132,159,-46,194,0,170);tg.bezierCurveTo(56,145,141,189,219,167);tg.stroke();
    tg.strokeColor=new Color(105,132,167,100);tg.moveTo(-235,-175);tg.bezierCurveTo(-122,-195,114,-192,236,-168);tg.stroke();

    const titleNode=new Node('Title');titleNode.setPosition(0,166,0);tableNode.addChild(titleNode);
    titleNode.addComponent(UITransform).setContentSize(380,44);
    const tl=titleNode.addComponent(Label);tl.string='夜巡符契';tl.fontSize=25;tl.lineHeight=30;tl.horizontalAlign=Label.HorizontalAlign.CENTER;tl.verticalAlign=Label.VerticalAlign.CENTER;tl.overflow=Label.Overflow.SHRINK;tl.color=new Color(255,230,150);

    const titleSeal=new Node('TitleSeal');titleSeal.setPosition(0,130,0);tableNode.addChild(titleSeal);
    const sg=titleSeal.addComponent(Graphics);sg.strokeColor=new Color(180,51,46,170);sg.lineWidth=1.8;
    sg.moveTo(-78,0);sg.bezierCurveTo(-38,13,-12,-11,0,0);sg.bezierCurveTo(19,13,48,-11,80,0);sg.stroke();
  }

  // 弹出三选一升级符案牌局
  showUpgradeChoices(options: BuffOption[]) {
    this.upgradeModalNode.active=true;
    const table=this.upgradeModalNode.getChildByName('Table')!;
    for(const oc of table.children.filter(c=>c.name.startsWith('ChoiceCard_')))oc.destroy();
    const spacing=166;
    for(let i=0;i<options.length;i++){
      const opt=options[i],cardNode=new Node(`ChoiceCard_${i}`),offset=(i-1)*spacing;
      cardNode.setPosition(offset,-24,0);table.addChild(cardNode);
      const cardTrans=cardNode.addComponent(UITransform);cardTrans.setContentSize(146,238);cardTrans.setAnchorPoint(.5,.5);
      const cg=cardNode.addComponent(Graphics);
      cg.fillColor=new Color(237,220,176);cg.moveTo(-67,-102);cg.lineTo(-58,-116);cg.lineTo(56,-113);cg.lineTo(67,-99);cg.lineTo(63,98);cg.lineTo(52,112);cg.lineTo(-55,114);cg.lineTo(-66,100);cg.close();cg.fill();
      cg.strokeColor=new Color(160,49,45);cg.lineWidth=2.5;cg.moveTo(-61,-97);cg.lineTo(-52,-108);cg.lineTo(51,-106);cg.lineTo(60,-95);cg.lineTo(57,93);cg.lineTo(48,104);cg.lineTo(-50,106);cg.lineTo(-59,95);cg.close();cg.stroke();
      cg.strokeColor=new Color(205,160,80,185);cg.lineWidth=1.2;cg.moveTo(-48,78);cg.bezierCurveTo(-20,90,19,69,48,82);cg.moveTo(-48,-78);cg.bezierCurveTo(-13,-89,18,-69,48,-82);cg.stroke();
      cg.strokeColor=new Color(170,50,46,140);cg.lineWidth=1;
      cg.moveTo(-42,55);cg.bezierCurveTo(-17,43,11,62,41,47);cg.moveTo(-38,-46);cg.bezierCurveTo(-7,-61,18,-38,38,-55);cg.stroke();

      const iconNode=new Node('Icon');iconNode.setPosition(0,60,0);cardNode.addChild(iconNode);iconNode.addComponent(UITransform).setContentSize(90,52);
      const il=iconNode.addComponent(Label);il.string=opt.icon;il.fontSize=38;il.lineHeight=42;il.horizontalAlign=Label.HorizontalAlign.CENTER;il.verticalAlign=Label.VerticalAlign.CENTER;il.overflow=Label.Overflow.SHRINK;il.color=new Color(181,48,45);

      const nameNode=new Node('Name');nameNode.setPosition(0,12,0);cardNode.addChild(nameNode);nameNode.addComponent(UITransform).setContentSize(112,42);
      const nl=nameNode.addComponent(Label);nl.string=opt.name;nl.fontSize=19;nl.lineHeight=22;nl.horizontalAlign=Label.HorizontalAlign.CENTER;nl.verticalAlign=Label.VerticalAlign.CENTER;nl.overflow=Label.Overflow.SHRINK;nl.color=new Color(36,31,35);

      const descNode=new Node('Desc');descNode.setPosition(0,-54,0);cardNode.addChild(descNode);const descUi=descNode.addComponent(UITransform);descUi.setContentSize(108,72);
      const dl=descNode.addComponent(Label);dl.string=opt.desc;dl.fontSize=12;dl.lineHeight=16;dl.overflow=Label.Overflow.RESIZE_HEIGHT;dl.horizontalAlign=Label.HorizontalAlign.CENTER;dl.verticalAlign=Label.VerticalAlign.TOP;dl.color=new Color(83,69,62);

      const foot=new Node('FootRune');foot.setPosition(0,-91,0);cardNode.addChild(foot);const fg=foot.addComponent(Graphics);fg.strokeColor=new Color(181,51,46,150);fg.lineWidth=1.4;
      fg.moveTo(-23,0);fg.bezierCurveTo(-9,8,5,-7,22,1);fg.moveTo(-10,-5);fg.lineTo(10,5);fg.stroke();

      cardNode.setScale(.1,1,1);tween(cardNode).delay(i*.1).to(.2,{scale:new Vec3(1,1,1)}).start();
      const selectThis=()=>{if(!cardNode.isValid||!this.upgradeModalNode.active)return;cardNode.setScale(1,1,1);LanternSound.inst.playClick();this.upgradeModalNode.active=false;if(this.onSelectBuff)this.onSelectBuff(opt);};
      (cardNode as any).onSelect=selectThis;
      cardNode.on(Node.EventType.TOUCH_START,()=>cardNode.setScale(.96,.96,1));
      cardNode.on(Node.EventType.TOUCH_CANCEL,()=>cardNode.setScale(1,1,1));
      cardNode.on(Node.EventType.TOUCH_END,selectThis);cardNode.on('click',selectThis);
      iconNode.on(Node.EventType.TOUCH_END,selectThis);nameNode.on(Node.EventType.TOUCH_END,selectThis);descNode.on(Node.EventType.TOUCH_END,selectThis);
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
  update(dt: number) {
    this.hudPulse += dt;
    if (this.fireAuraNode?.isValid) {
      const p = 1 + Math.sin(this.hudPulse * 3.2) * 0.035;
      this.fireAuraNode.setScale(p,p,1);
      this.fireAuraNode.angle = Math.sin(this.hudPulse * 1.3) * 3;
    }
    if (this.kataHaloNode?.isValid) this.kataHaloNode.angle += dt * 18;
    if (this.stickBaseNode?.isValid && !this.isJoyDragging) {
      this.stickThumbNode.angle = Math.sin(this.hudPulse * 1.8) * 4;
    }
  }

}
