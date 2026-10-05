import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, UITransform, UIOpacity, Vec3 } from 'cc';
import { BuffOption, CardItem, HandCombo, LanternSound, SuitType } from './NightTownData';
import { TalismanRenderer as Art, TALISMAN_INK as Ink, TALISMAN_LAYOUT as Layout } from './TalismanRenderer';

const { ccclass } = _decorator;
type PlayOwner = Component & { isPaused?: boolean };
type HandView = { node: Node; visual: Node; glow: UIOpacity; card: CardItem; pressed: boolean; cancel: () => void };
type ActionView = { node: Node; visual: Node; glow: UIOpacity; pressed: boolean; cancel: () => void };

/** Gameplay-only UI. Cover, pause, ads and persistence remain owned by the existing framework. */
@ccclass('LanternHUD')
export class LanternHUD extends Component {
  public onMove?: (dir: Vec3) => void;
  public onFireCombo?: () => void;
  public onRoll?: () => void;
  public onTriggerKata?: () => void;
  public onCardClick?: (card: CardItem) => void;
  public onAdSupplyClick?: () => void;
  public onPauseClick?: () => void;
  public onSelectBuff?: (buff: BuffOption) => void;
  public onSelectionChange?: (ids: number[]) => void;
  public selectedIds: Set<number> = new Set();

  private owner: PlayOwner | null = null;
  private stickBaseNode!: Node;
  private stickThumbNode!: Node;
  private joyTouch: number | null = null;
  private moveDir = new Vec3();
  private handRowNode!: Node;
  private handCards: HandView[] = [];
  private actions: ActionView[] = [];
  private comboLabel!: Label;
  private coinLabel!: Label;
  private stageLabel!: Label;
  private waveLabel!: Label;
  private healthLabel!: Label;
  private shieldLabel!: Label;
  private hpBarG!: Graphics;
  private shieldBarG!: Graphics;
  private adSupplyBtn!: Node;
  private kataEnergyG!: Graphics;
  private kataLabel!: Label;
  private energyRatio = 0;
  private upgradeModalNode!: Node;
  private currentUpgradeOptions: BuffOption[] = [];
  private choosing = false;
  private clock = 0;

  onLoad() {
    for (let n: Node | null = this.node; n; n = n.parent) {
      const c = n.getComponent('LanternNightScene');
      if (c) { this.owner = c as PlayOwner; break; }
    }
    this.createTopBar();
    this.createHandRow();
    this.createJoystick();
    this.createActionButtons();
    this.createUpgradeModal();
  }

  private canPlay(): boolean {
    return (!this.owner || (this.owner.enabled && !this.owner.isPaused)) && !this.upgradeModalNode?.active;
  }

  private createTopBar() {
    const topRoot = Art.node(this.node, 'TopStatus');
    const stage = Art.node(topRoot, 'StageSign', -181, 570, 292, 78);
    Art.panel(stage.addComponent(Graphics), 292, 78);
    this.stageLabel = Art.label(stage, 'StageText', '\u9752\u77f3\u5df7\u53e3', 0, 15, 252, 30, 22);
    this.waveLabel = Art.label(stage, 'WaveText', '\u591c\u5de1\u5f00\u59cb', 0, -16, 252, 25, 18, Ink.muted);
    const coins = Art.node(topRoot, 'CoinBox', -243, 484, 168, 48);
    Art.panel(coins.addComponent(Graphics), 168, 48);
    const icon = Art.node(coins, 'SpiritFire', -59, 0).addComponent(Graphics);
    Art.drawSuitSymbol(icon, 'heart', 0, 0, 12, Ink.gold);
    this.coinLabel = Art.label(coins, 'CoinText', '0', 11, 0, 116, 30, 20);

    // Keep a separate gap below the fixed ad button (y=490..532).
    const hp = Art.node(topRoot, 'HpBox', 206, 447, 240, 64);
    Art.panel(hp.addComponent(Graphics), 240, 64);
    this.healthLabel = Art.label(hp, 'HealthText', '\u751f\u547d 85/85', -34, 17, 150, 24, 17);
    this.shieldLabel = Art.label(hp, 'ShieldText', '\u62a4\u8eab 10', 58, 17, 80, 24, 16, new Color(143, 218, 212));
    this.hpBarG = Art.node(hp, 'HpFill', -99, -4).addComponent(Graphics);
    this.shieldBarG = Art.node(hp, 'ShieldFill', -99, -18).addComponent(Graphics);

    // Original fixed rewarded-ad control. Same node names, geometry, labels and callback.
    this.adSupplyBtn = new Node('AdSupplyBtn');
    this.adSupplyBtn.addComponent(UITransform).setContentSize(110, 40);
    this.adSupplyBtn.setPosition(250, 510, 0); topRoot.addChild(this.adSupplyBtn);
    const ag = this.adSupplyBtn.addComponent(Graphics);
    ag.fillColor = new Color(60, 30, 15, 235); ag.roundRect(-55,-20,110,40,6); ag.fill();
    ag.strokeColor = new Color(225,185,75); ag.lineWidth=2; ag.roundRect(-55,-20,110,40,6); ag.stroke();
    const adLblNode=new Node('AdLbl');this.adSupplyBtn.addChild(adLblNode);
    const al=adLblNode.addComponent(Label);al.string='\u738b\u724c\u8865\u7ed9';al.fontSize=17;al.color=new Color(255,235,175);
    const badgeNode=new Node('AdBadge');badgeNode.setPosition(42,14,0);this.adSupplyBtn.addChild(badgeNode);
    const bg=badgeNode.addComponent(Graphics);bg.fillColor=new Color(185,35,35);bg.roundRect(-14,-8,28,16,3);bg.fill();
    bg.strokeColor=new Color(255,220,90);bg.lineWidth=1;bg.roundRect(-14,-8,28,16,3);bg.stroke();
    const adTxt=new Node('Txt');badgeNode.addChild(adTxt);const adL=adTxt.addComponent(Label);
    adL.string='AD';adL.fontSize=11;adL.lineHeight=12;adL.color=new Color(255,255,220);
    this.adSupplyBtn.on(Node.EventType.TOUCH_END,()=>{if(this.onAdSupplyClick)this.onAdSupplyClick();});
  }

  private createHandRow() {
    this.handRowNode = Art.node(this.node, 'TalismanRow', Layout.handX, Layout.handY);
    // A narrow silk cord replaces the solid panel that covered both thumb zones.
    const cord = Art.node(this.handRowNode, 'TalismanRail').addComponent(Graphics);
    cord.strokeColor = new Color(175, 115, 68, 180); cord.lineWidth = 2;
    cord.moveTo(-226, -59); cord.bezierCurveTo(-115, -64, 116, -64, 226, -59); cord.stroke();
    cord.strokeColor = new Color(238, 207, 151, 120); cord.lineWidth = .7;
    cord.moveTo(-214, -57); cord.bezierCurveTo(-100, -61, 100, -61, 214, -57); cord.stroke();
    for (const x of [-226, 226]) {
      cord.strokeColor = Ink.gold; cord.lineWidth = 1.2;
      cord.moveTo(x - 4, -59); cord.bezierCurveTo(x - 9, -51, x + 6, -50, x + 4, -59);
      cord.bezierCurveTo(x - 4, -65, x - 4, -55, x + 4, -59); cord.stroke();
    }
    this.comboLabel = Art.label(this.node, 'ComboHint', '\u70b9\u9009\u7b26\u7b93\u7ec4\u5408', Layout.handX, -182, 340, 28, 19, Ink.light);
  }

  updateHandDisplay(cards: CardItem[]) {
    // Retain stable input roots on selection; destroy only cards that actually left the hand.
    const present = new Set(cards.map(c => c.id));
    for (const id of Array.from(this.selectedIds)) if (!present.has(id)) this.selectedIds.delete(id);
    for (const v of this.handCards) if (!present.has(v.card.id)) {
      v.node.removeFromParent(); v.node.destroy();
    }
    const previous = new Map(this.handCards.filter(v => present.has(v.card.id)).map(v => [v.card.id, v]));
    this.handCards = cards.map((card, i) => {
      let v = previous.get(card.id);
      if (!v) {
        const node = Art.node(this.handRowNode, `Card_${card.id}`, 0, 0, Layout.cardHitW, Layout.cardHitH);
        const visual = Art.node(node, 'CardVisual');
        const halo = Art.node(visual, 'SelectedBorder');
        const glow = halo.addComponent(UIOpacity);
        const g = halo.addComponent(Graphics);
        // Halo stays inside a 68px-wide slot; it never expands the touch area.
        for (const side of [-1, 1]) {
          g.strokeColor = new Color(242, 197, 112, 145); g.lineWidth = 2;
          g.moveTo(side * 31, -46);
          g.bezierCurveTo(side * 33, -13, side * 31, 24, side * 30, 49); g.stroke();
        }
        const paper = Art.node(visual, 'Paper');
        Art.drawCard(paper, card, Layout.cardW, Layout.cardH);
        v = { node, visual, glow, card, pressed: false, cancel: () => {} };
        const item = v;
        let touch: number | null = null;
        item.cancel = () => { touch = null; item.pressed = false; };
        node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
          if (!this.canPlay() || touch !== null) return;
          touch = e.getID(); item.pressed = true;
        });
        node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
          if (touch === e.getID()) { touch = null; item.pressed = false; }
        });
        node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
          if (touch !== e.getID()) return;
          touch = null; item.pressed = false;
          if (!this.canPlay() || !this.contains(node, e)) return;
          LanternSound.inst.playCard();
          if (this.selectedIds.has(item.card.id)) this.selectedIds.delete(item.card.id);
          else this.selectedIds.add(item.card.id);
          this.refreshSelection();
          this.onSelectionChange?.(Array.from(this.selectedIds));
        });
      }
      if (v.card.val !== card.val || v.card.suit !== card.suit || v.card.isJoker !== card.isJoker) {
        Art.drawCard(v.visual.getChildByName('Paper')!, card, Layout.cardW, Layout.cardH);
      }
      v.card = { ...card };
      v.node.setPosition((i - (cards.length - 1) / 2) * Layout.cardPitch, 0, 0);
      return v;
    });
    this.refreshSelection();
  }

  private refreshSelection() {
    for (const v of this.handCards) {
      const selected = this.selectedIds.has(v.card.id);
      v.glow.opacity = selected ? 230 : 0;
      v.visual.setPosition(0, selected ? Layout.selectedLift : 0, 0);
    }
  }

  clearSelection() { this.selectedIds.clear(); this.refreshSelection(); }

  private createJoystick() {
    const p = Layout.joystick;
    this.stickBaseNode = Art.node(this.node, 'CompassBase', p.x, p.y, p.w, p.h);
    const g = this.stickBaseNode.addComponent(Graphics);
    g.fillColor = new Color(11, 23, 40, 185); g.circle(0, 0, 79); g.fill();
    g.strokeColor = new Color(157, 145, 115, 185); g.lineWidth = 1.4;
    g.circle(0, 0, 76); g.stroke();
    g.strokeColor = new Color(89, 123, 138, 155); g.lineWidth = 1;
    g.circle(0, 0, 65); g.stroke();
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16, inner = i % 4 ? 70 : 61;
      g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      g.lineTo(Math.cos(a) * 74, Math.sin(a) * 74);
    }
    g.stroke();
    // Engraved cloud scrolls outside the moving thumb, not a star-shaped placeholder.
    for (const side of [-1, 1]) {
      g.strokeColor = Ink.gold; g.lineWidth = 1;
      g.moveTo(side * 48, -24); g.bezierCurveTo(side * 65, -14, side * 49, 0, side * 57, 12);
      g.bezierCurveTo(side * 68, 22, side * 45, 32, side * 45, 17); g.stroke();
    }
    this.stickThumbNode = Art.node(this.stickBaseNode, 'InkSealThumb');
    const thumb = this.stickThumbNode.addComponent(Graphics);
    thumb.fillColor = new Color(47, 74, 87); thumb.circle(0, 0, 29); thumb.fill();
    thumb.strokeColor = Ink.gold; thumb.lineWidth = 1.5; thumb.circle(0, 0, 28); thumb.stroke();
    Art.drawSuitSymbol(thumb, 'diamond', 0, 0, 18, new Color(226, 205, 151));
    this.stickBaseNode.on(Node.EventType.TOUCH_START, this.onJoyStart, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_MOVE, this.onJoyMove, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_END, this.onJoyEnd, this);
    this.stickBaseNode.on(Node.EventType.TOUCH_CANCEL, this.onJoyEnd, this);
  }

  private contains(node: Node, event: EventTouch): boolean {
    const ui = node.getComponent(UITransform)!;
    const p = event.getUILocation();
    const local = ui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    return Math.abs(local.x) <= ui.width / 2 && Math.abs(local.y) <= ui.height / 2;
  }

  private onJoyStart(e: EventTouch) {
    if (!this.canPlay() || this.joyTouch !== null) return;
    this.joyTouch = e.getID(); this.onJoyMove(e);
  }

  private onJoyMove(e: EventTouch) {
    if (this.joyTouch !== e.getID()) return;
    if (!this.canPlay()) { this.stopJoystick(); return; }
    const p = e.getUILocation();
    const local = this.stickBaseNode.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    const length = Math.sqrt(local.x * local.x + local.y * local.y);
    const factor = length > 48 ? 48 / length : 1;
    this.stickThumbNode.setPosition(local.x * factor, local.y * factor, 0);
    this.moveDir.set(local.x * factor / 48, local.y * factor / 48, 0);
    this.onMove?.(this.moveDir);
  }

  private onJoyEnd(e: EventTouch) { if (this.joyTouch === e.getID()) this.stopJoystick(); }
  private stopJoystick() {
    const moving = this.joyTouch !== null;
    this.joyTouch = null;
    this.stickThumbNode?.setPosition(0, 0, 0);
    this.moveDir.set(0, 0, 0);
    if (moving) this.onMove?.(this.moveDir);
  }
  public isJoystickDragging(): boolean { return this.joyTouch !== null; }

  private makeAction(name: string, p: { x: number; y: number; w: number; h: number }, title: string,
    kind: 'attack' | 'dodge' | 'ultimate', onClick: () => void): ActionView {
    const node = Art.node(this.node, name, p.x, p.y, p.w, p.h);
    const visual = Art.node(node, 'Visual');
    const radius = p.w / 2 - 7;
    const g = visual.addComponent(Graphics);
    g.fillColor = new Color(14, 26, 44, 245); g.circle(0, 0, radius); g.fill();
    g.strokeColor = new Color(118, 102, 76); g.lineWidth = 3; g.circle(0, 0, radius - 1); g.stroke();
    g.strokeColor = Ink.gold; g.lineWidth = 1; g.circle(0, 0, radius - 4); g.stroke();
    for (let i = 0; i < 8; i++) {
      if (kind !== 'attack' && i >= 5) continue;
      const a = i * Math.PI / 4;
      const x = Math.cos(a) * (radius - 9), y = Math.sin(a) * (radius - 9);
      g.moveTo(x - 3, y); g.bezierCurveTo(x - 5, y + 5, x + 5, y + 5, x + 3, y); g.stroke();
    }
    if (kind === 'attack') Art.lantern(g, 0, 24, 22);
    else Art.drawSuitSymbol(g, kind === 'dodge' ? 'club' : 'diamond', 0, 11, 14, Ink.gold);
    Art.label(visual, 'Caption', title, 0, kind === 'attack' ? -22 : -16,
      kind === 'attack' ? 78 : 58, 32, kind === 'attack' ? 25 : 20, Ink.light);
    const halo = Art.node(visual, 'EdgeLight');
    const glow = halo.addComponent(UIOpacity);
    const hg = halo.addComponent(Graphics);
    hg.strokeColor = new Color(253, 212, 132); hg.lineWidth = 2;
    hg.arc(0, 0, radius - 2, .12, 1.5, false);
    hg.arc(0, 0, radius - 2, 3.3, 4.9, false); hg.stroke();
    glow.opacity = 95;
    const action: ActionView = { node, visual, glow, pressed: false, cancel: () => {} };
    let touch: number | null = null;
    action.cancel = () => { touch = null; action.pressed = false; };
    node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      if (!this.canPlay() || touch !== null) return;
      touch = e.getID(); action.pressed = true;
    });
    node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
      if (touch === e.getID()) { touch = null; action.pressed = false; }
    });
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      if (touch !== e.getID()) return;
      touch = null; action.pressed = false;
      if (this.canPlay() && this.contains(node, e)) onClick();
    });
    this.actions.push(action);
    return action;
  }

  private createActionButtons() {
    this.makeAction('DriveEvilBtn', Layout.attack, '\u9a71\u90aa', 'attack', () => this.onFireCombo?.());
    this.makeAction('DodgeSealBtn', Layout.dodge, '\u95ea\u907f', 'dodge', () => this.onRoll?.());
    const ult = this.makeAction('LanternArrayBtn', Layout.ultimate, '\u706f\u9635', 'ultimate', () => this.onTriggerKata?.());
    this.kataEnergyG = Art.node(ult.visual, 'EnergyEdge').addComponent(Graphics);
    this.kataLabel = Art.label(this.node, 'EnergyValue', '0%', Layout.ultimate.x, Layout.ultimate.y - 58, 74, 24, 17, Ink.gold);
    this.redrawKataBadge(0, 100);
  }

  redrawKataBadge(cur: number, max: number) {
    this.energyRatio = max > 0 && Number.isFinite(cur) ? Math.max(0, Math.min(1, cur / max)) : 0;
    const g = this.kataEnergyG;
    if (!g) return;
    g.clear();
    if (this.energyRatio > 0) {
      g.strokeColor = this.energyRatio >= 1 ? new Color(255, 215, 128) : new Color(140, 195, 182);
      g.lineWidth = 2.4;
      g.arc(0, 0, 41, Math.PI / 2, Math.PI / 2 + this.energyRatio * Math.PI * 2, false); g.stroke();
    }
    this.kataLabel.string = this.energyRatio >= 1 ? '\u5df2\u84c4\u6ee1' : `${Math.floor(this.energyRatio * 100)}%`;
  }

  setComboHint(combo: HandCombo) {
    const names = {
      single: '\u5355\u7b26 \u00b7 \u9a71\u90aa', pair: '\u53cc\u5370 \u00b7 \u5e76\u7b26',
      trips: '\u4e09\u5370 \u00b7 \u6563\u7b26', straight: '\u8fde\u4e66 \u00b7 \u75be\u7b26',
      flush: '\u540c\u5370 \u00b7 \u7b26\u9635', fullhouse: '\u5408\u5951 \u00b7 \u9547\u715e',
      quads: '\u56db\u5370 \u00b7 \u9547\u90aa',
    };
    this.comboLabel.string = names[combo.type] || Art.wrap(combo.name, 340, 19, 1);
  }

  updateHp(curHp: number, maxHp: number, curShield: number) {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, curHp / maxHp)) : 0;
    const bar = (g: Graphics, amount: number, h: number, color: Color) => {
      g.clear(); g.fillColor = new Color(5, 15, 28); g.roundRect(0, -h / 2, 198, h, h / 2); g.fill();
      if (amount <= 0) return;
      const w = 198 * Math.min(1, amount);
      g.fillColor = color; g.roundRect(0, -h / 2, w, h, Math.min(w / 2, h / 2)); g.fill();
      if (w > 8) { g.strokeColor = new Color(255, 243, 207, 100); g.lineWidth = .8; g.moveTo(4, h / 2 - 2); g.lineTo(w - 4, h / 2 - 2); g.stroke(); }
    };
    bar(this.hpBarG, ratio, 10, new Color(191, 68, 60));
    bar(this.shieldBarG, Math.max(0, curShield / 40), 5, new Color(89, 177, 178));
    const hp = Math.max(0, Math.ceil(curHp)), max = Math.max(0, Math.ceil(maxHp));
    this.healthLabel.string = Art.wrap(`\u751f\u547d ${hp}/${max}`, 150, 17, 1);
    this.shieldLabel.string = Art.wrap(`\u62a4\u8eab ${Math.max(0, Math.ceil(curShield))}`, 80, 16, 1);
  }

  updateCoins(coins: number) {
    const n = Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
    this.coinLabel.string = n >= 1e16 ? n.toExponential(1) : n >= 1e12 ? `${(n / 1e12).toFixed(n >= 1e15 ? 0 : 1)}\u4e07\u4ebf` : n >= 1e8 ? `${(n / 1e8).toFixed(1)}\u4ebf` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}\u4e07` : String(n);
    this.coinLabel.string = Art.wrap(this.coinLabel.string, 116, 20, 1);
  }

  updateStageName(name: string) {
    const parts = name.split(' - ');
    this.stageLabel.string = Art.wrap(parts[0], 252, 22, 1);
    const detail = parts.slice(1).join(' ').replace('\u7a81\u53d1\u4e8b\u4ef6\uff1a', '\u591c\u88ad\uff1a');
    this.waveLabel.string = Art.wrap(detail, 252, 18, 1);
  }

  private createUpgradeModal() {
    this.upgradeModalNode = Art.node(this.node, 'UpgradeModal');
    const veil = Art.node(this.upgradeModalNode, 'InputVeil', 0, 0, 720, 1280);
    const g = veil.addComponent(Graphics); g.fillColor = new Color(4, 11, 25, 225); g.rect(-360, -640, 720, 1280); g.fill();
    // Catch touches without changing or replacing the framework pause dialog.
    for (const event of [Node.EventType.TOUCH_START, Node.EventType.TOUCH_MOVE, Node.EventType.TOUCH_END, Node.EventType.TOUCH_CANCEL]) {
      veil.on(event, (e: EventTouch) => { e.propagationStopped = true; });
    }
    const table = Art.node(this.upgradeModalNode, 'Table', 0, 25, 592, 434);
    Art.panel(table.addComponent(Graphics), 592, 434);
    Art.label(table, 'Title', '\u591c\u5de1\u7b26\u5951', 0, 162, 380, 44, 28);
    Art.label(table, 'Subtitle', '\u9009\u62e9\u4e00\u9879\u5f3a\u5316', 0, 118, 360, 28, 18, Ink.muted);
    this.upgradeModalNode.active = false;
  }

  showUpgradeChoices(options: BuffOption[]) {
    this.stopJoystick(); this.choosing = false;
    this.currentUpgradeOptions = options.slice(0, 3);
    const table = this.upgradeModalNode.getChildByName('Table')!;
    for (const old of [...table.children]) if (old.name.startsWith('ChoiceCard_')) { old.removeFromParent(); old.destroy(); }
    this.upgradeModalNode.active = true;
    this.currentUpgradeOptions.forEach((option, i) => {
      const x = (i - (this.currentUpgradeOptions.length - 1) / 2) * 178;
      const card = Art.node(table, `ChoiceCard_${i}`, x, -42, 158, 258);
      const art = Art.node(card, 'ChoiceVisual');
      const g = art.addComponent(Graphics);
      Art.panel(g, 158, 258, new Color(179, 148, 92));
      const icon = Art.node(art, 'Icon', 0, 78).addComponent(Graphics);
      const suit: SuitType = option.icon === '\u706b' ? 'heart' : option.icon === '\u98ce' ? 'club' : option.icon === '\u96f7' ? 'spade' : 'diamond';
      Art.drawSuitSymbol(icon, suit, 0, 0, 24, Ink.gold);
      Art.label(art, 'Name', option.name, 0, 24, 132, 32, 21, Ink.light);
      // Four fixed lines at a readable size; no RESIZE_HEIGHT growth into footer ornaments.
      Art.label(art, 'Desc', option.desc, 0, -45, 130, 96, 18, new Color(200, 211, 212), 4);
      const foot = Art.node(art, 'Footer', 0, -109).addComponent(Graphics);
      foot.strokeColor = new Color(161, 133, 86, 130); foot.lineWidth = 1;
      foot.moveTo(-36, 0); foot.bezierCurveTo(-15, 4, 15, 4, 36, 0); foot.stroke();
      const select = () => this.selectUpgradeChoice(i);
      card.on(Node.EventType.TOUCH_START, () => { art.setScale(.98, .98, 1); });
      card.on(Node.EventType.TOUCH_CANCEL, () => { art.setScale(1, 1, 1); });
      card.on(Node.EventType.TOUCH_END, (e: EventTouch) => { art.setScale(1, 1, 1); if (this.contains(card, e)) select(); });
      card.on('click', select);
    });
  }

  selectUpgradeChoice(index: number) {
    if (!this.upgradeModalNode.active || this.choosing || this.owner?.enabled === false) return;
    const option = this.currentUpgradeOptions[index];
    if (!option) return;
    this.choosing = true;
    this.upgradeModalNode.active = false;
    LanternSound.inst.playClick();
    this.onSelectBuff?.(option);
  }

  closeUpgrade() { this.upgradeModalNode.active = false; }

  update(dt: number) {
    if (!this.canPlay()) {
      this.stopJoystick();
      for (const v of this.actions) { v.cancel(); v.visual.setScale(1, 1, 1); }
      for (const v of this.handCards) v.cancel();
      return;
    }
    this.clock += Math.min(dt, .05);
    for (let i = 0; i < this.handCards.length; i++) {
      const v = this.handCards[i], selected = this.selectedIds.has(v.card.id);
      const lift = selected ? Layout.selectedLift + Math.sin(this.clock * 2.6 + i) * 1.2 : 0;
      v.visual.setPosition(0, lift - (v.pressed ? 2 : 0), 0);
      const k = v.pressed ? .97 : 1;
      v.visual.setScale(k, k, 1);
      v.glow.opacity = selected ? Math.round(195 + Math.sin(this.clock * 3 + i) * 35) : 0;
    }
    this.actions.forEach((v, i) => {
      const k = v.pressed ? .95 : 1; v.visual.setScale(k, k, 1);
      v.glow.opacity = Math.round((i === 2 && this.energyRatio >= 1 ? 195 : 70) + Math.sin(this.clock * 2 + i) * 25);
    });
  }

  onDisable() { this.stopJoystick(); }
  onDestroy() { this.stopJoystick(); }
}
