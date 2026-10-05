import { Color, Graphics, Label, Node, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import type { CardItem, SuitType } from './NightTownData';

/** Logical 720 x 1280 stage coordinates. Input roots never animate or overlap. */
export const TALISMAN_LAYOUT = {
  handX: -14, handY: -270, cardW: 64, cardH: 106, cardPitch: 74,
  cardHitW: 68, cardHitH: 134, selectedLift: 10,
  joystick: { x: -228, y: -482, w: 176, h: 176 },
  attack: { x: 238, y: -497, w: 140, h: 140 },
  dodge: { x: 112, y: -406, w: 90, h: 90 },
  ultimate: { x: 284, y: -354, w: 90, h: 90 },
} as const;

export const TALISMAN_INK = {
  night: new Color(16, 27, 47), lacquer: new Color(30, 45, 66),
  gold: new Color(212, 177, 112), light: new Color(255, 237, 198),
  muted: new Color(180, 193, 201), red: new Color(169, 56, 47),
  paper: new Color(244, 226, 185), dark: new Color(54, 41, 42),
};

export class TalismanRenderer {
  static node(parent: Node, name: string, x = 0, y = 0, w = 0, h = 0): Node {
    const n = new Node(name);
    n.layer = parent.layer;
    parent.addChild(n);
    n.setPosition(x, y, 0);
    if (w > 0 && h > 0) n.addComponent(UITransform).setContentSize(w, h);
    return n;
  }

  /** Conservative wrapping, not automatic font shrinking. Explicit bounds are a final guard. */
  static wrap(text: string, width: number, fontSize: number, maxLines: number): string {
    const limit = Math.max(1, (width - 8) / fontSize);
    const lines: string[] = [];
    let line = '', used = 0;
    for (const ch of Array.from(String(text))) {
      const advance = /[\u0000-\u007f]/.test(ch) ? 0.64 : 1.05;
      if (ch === '\n' || (used + advance > limit && line.length > 0)) {
        lines.push(line); line = ''; used = 0;
        if (ch === '\n') continue;
      }
      line += ch; used += advance;
    }
    lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '\u2026';
    }
    return lines.join('\n');
  }

  static label(parent: Node, name: string, text: string, x: number, y: number,
    w: number, h: number, size: number, color = TALISMAN_INK.light, maxLines = 1): Label {
    const n = this.node(parent, name, x, y, w, h);
    const label = n.addComponent(Label);
    label.fontSize = size;
    label.lineHeight = Math.ceil(size * 1.25);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableWrapText = false;
    label.overflow = Label.Overflow.CLAMP;
    label.color = color;
    label.string = this.wrap(text, w, size, maxLines);
    return label;
  }

  static suitColor(suit: SuitType): Color {
    return suit === 'spade' ? new Color(62, 104, 153) :
      suit === 'heart' ? new Color(180, 65, 46) :
      suit === 'club' ? new Color(42, 118, 98) : new Color(147, 106, 48);
  }

  /** Thin lacquer surround. All ornament is outside the central text-safe inset. */
  static panel(g: Graphics, w: number, h: number, accent = TALISMAN_INK.gold) {
    const x = -w / 2, y = -h / 2, r = Math.min(14, h / 4);
    g.fillColor = new Color(0, 0, 0, 90);
    g.roundRect(x + 2, y - 3, w - 4, h, r); g.fill();
    g.fillColor = TALISMAN_INK.night;
    g.roundRect(x, y, w, h, r); g.fill();
    g.strokeColor = new Color(91, 111, 133); g.lineWidth = 1;
    g.roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(3, r - 3)); g.stroke();
    g.strokeColor = accent; g.lineWidth = 1.7;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = sx * (w / 2 - 7), cy = sy * (h / 2 - 7);
      g.moveTo(cx - sx * 23, cy);
      g.bezierCurveTo(cx - sx * 10, cy, cx, cy - sy * 1, cx, cy - sy * 14);
      g.moveTo(cx - sx * 14, cy - sy * 4);
      g.bezierCurveTo(cx - sx * 4, cy - sy * 1, cx - sx * 2, cy - sy * 8, cx - sx * 9, cy - sy * 12);
    }
    g.stroke();
    g.strokeColor = new Color(250, 224, 165, 80); g.lineWidth = 1;
    g.moveTo(x + 34, -y - 3); g.lineTo(-x - 34, -y - 3); g.stroke();
  }

  private static paperPath(g: Graphics) {
    g.moveTo(-28, 51);
    g.bezierCurveTo(-12, 54, 3, 49, 20, 52);
    g.lineTo(29, 43);
    g.bezierCurveTo(28, 26, 33, 9, 29, -10);
    g.bezierCurveTo(27, -25, 31, -40, 27, -51);
    g.lineTo(19, -49); g.lineTo(13, -52); g.lineTo(7, -49);
    g.bezierCurveTo(-3, -53, -12, -49, -27, -51);
    g.bezierCurveTo(-32, -32, -28, -20, -30, -3);
    g.bezierCurveTo(-28, 13, -32, 32, -28, 51); g.close();
  }

  /** Every card is uniformly fitted, including the 22x32 boss cards. */
  static drawCard(node: Node, card: CardItem, width = 80, height = 115, isBack = false) {
    const old = node.getChildByName('TalismanFace');
    if (old) { old.removeFromParent(); old.destroy(); }
    const face = this.node(node, 'TalismanFace', 0, 0, 64, 106);
    const k = Math.min(width / 64, height / 106);
    face.setScale(k, k, 1);
    const g = face.addComponent(Graphics);
    const ink = this.suitColor(card.suit);
    g.fillColor = new Color(60, 36, 25, 170);
    this.paperPath(g); g.fill();
    g.fillColor = isBack ? new Color(60, 58, 68) : TALISMAN_INK.paper;
    this.paperPath(g); g.fill();
    g.strokeColor = new Color(130, 89, 46, 190); g.lineWidth = 1.2;
    this.paperPath(g); g.stroke();
    // Frayed edge fibres, engraved border, side shading: no decoration behind the rank.
    g.strokeColor = new Color(173, 126, 72, 90); g.lineWidth = 0.7;
    for (let i = 0; i < 30; i++) {
      const y = -44 + i * 3.05;
      const side = i % 2 ? -1 : 1;
      g.moveTo(side * 26, y);
      g.bezierCurveTo(side * 22, y + 2, side * 27, y + 2, side * 29, y + 4);
    }
    g.stroke();
    g.strokeColor = isBack ? TALISMAN_INK.gold : new Color(167, 71, 48, 170);
    g.lineWidth = 1.1;
    g.moveTo(-23, 45); g.lineTo(-23, -44); g.lineTo(-17, -44);
    g.moveTo(23, 36); g.lineTo(23, -44); g.lineTo(17, -44); g.stroke();
    // Folded corner with its own paper shadow.
    g.fillColor = new Color(187, 149, 94);
    g.moveTo(20, 52); g.lineTo(20, 41); g.lineTo(29, 43); g.close(); g.fill();
    g.fillColor = new Color(255, 241, 206);
    g.moveTo(20, 52); g.bezierCurveTo(18, 45, 22, 45, 29, 43); g.close(); g.fill();
    // Woven header and red tie, positioned away from the type label.
    g.strokeColor = new Color(188, 89, 56, 130); g.lineWidth = 0.8;
    g.moveTo(-19, 43); g.bezierCurveTo(-9, 39, 5, 46, 14, 42); g.stroke();
    if (isBack) {
      this.drawSuitSymbol(g, 'diamond', 0, 0, 21, TALISMAN_INK.gold);
      return;
    }
    const category = card.isJoker ? '\u4e07\u7b26' :
      ({ spade: '\u96f7\u5370', heart: '\u706b\u5370', club: '\u98ce\u5370', diamond: '\u7075\u5370' }[card.suit]);
    this.label(face, 'SealType', category, 0, 30, 42, 22, 16, ink);
    this.drawSuitSymbol(g, card.isJoker ? 'diamond' : card.suit, 0, 1, 18, ink);
    // Small brush-written details on the flanks, not underneath text.
    g.strokeColor = new Color(174, 64, 45, 170); g.lineWidth = 1;
    for (const side of [-1, 1]) {
      const x = side * 20;
      g.moveTo(x, 12); g.bezierCurveTo(x - side * 3, 6, x + side * 1, 0, x - side * 2, -7);
      g.moveTo(x - side * 2, 3); g.lineTo(x + side * 1, 3);
    }
    g.stroke();
    const value = card.isJoker ? '\u4e07' :
      ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[card.val] || String(card.val);
    const rank = this.label(face, 'Rank', value, 0, -31, 44, 33, 26, TALISMAN_INK.dark);
    rank.isBold = true;
    g.strokeColor = new Color(177, 132, 77, 140); g.lineWidth = 1;
    g.moveTo(-14, -18); g.bezierCurveTo(-5, -16, 5, -16, 14, -18); g.stroke();
  }

  /** Cloud-thunder, curling fire, wind-leaf, and lotus: four readable silhouettes. */
  static drawSuitSymbol(g: Graphics, suit: SuitType, x: number, y: number, r: number, color: Color, shadow?: Color) {
    const p = (a: number, b: number): [number, number] => [x + a * r, y + b * r];
    const m = (a: number, b: number) => g.moveTo(...p(a, b));
    const l = (a: number, b: number) => g.lineTo(...p(a, b));
    const c = (a: number, b: number, d: number, e: number, f: number, h: number) => g.bezierCurveTo(...p(a, b), ...p(d, e), ...p(f, h));
    g.fillColor = color; g.strokeColor = color; g.lineWidth = Math.max(0.8, r * 0.08);
    if (suit === 'spade') {
      m(-.86, .18); c(-1, .53, -.52, .57, -.39, .48);
      c(-.4, .94, .28, 1, .45, .52); c(.9, .67, 1.02, .19, .72, .09); g.stroke();
      m(.06, .66); l(-.39, -.08); l(-.03, -.1); l(-.2, -.92); l(.56, .03); l(.18, .03); g.close(); g.fill();
      m(-.8, -.42); l(-.58, -.24); m(.56, -.62); l(.82, -.44); g.stroke();
    } else if (suit === 'heart') {
      m(0, .96); c(.23, .56, -.28, .28, .15, .09);
      c(.31, .25, .48, .36, .42, .63); c(1.05, .09, .88, -.66, .16, -.87);
      c(-.68, -1, -1, -.3, -.55, .26); c(-.46, -.04, -.17, -.17, -.2, .1);
      c(-.42, .55, -.1, .7, 0, .96); g.close(); g.fill();
      g.strokeColor = new Color(252, 210, 140); g.lineWidth = Math.max(.8, r * .075);
      m(.05, -.61); c(-.32, -.37, -.22, -.17, -.08, -.02); c(-.02, -.3, .3, -.3, .26, -.51); g.stroke();
    } else if (suit === 'club') {
      m(-.9, -.49); c(-.1, -.87, .95, -.1, .66, .71);
      c(.02, .88, -.77, .33, -.61, -.22); c(-.4, -.64, .01, -.35, .12, -.03); g.stroke();
      m(-.76, -.42); c(-.28, -.1, .11, .25, .65, .71); g.stroke();
      m(-.99, .52); c(-.6, .64, -.28, .38, -.1, .57);
      m(.38, -.63); c(.79, -.68, 1, -.46, .9, -.27); g.stroke();
    } else {
      m(0, .91); c(-.63, .5, -.43, -.13, 0, -.58); c(.43, -.12, .65, .52, 0, .91); g.close(); g.stroke();
      m(0, -.57); c(-.66, -.56, -.97, -.03, -.82, .39); c(-.4, .25, -.14, -.1, 0, -.57);
      c(.65, -.56, .98, -.03, .82, .39); c(.4, .25, .14, -.1, 0, -.57); g.stroke();
      m(-.81, -.58); c(-.37, -.97, .37, -.97, .81, -.58); g.stroke();
      g.fillColor = color; m(0, .27); c(-.15, .03, -.13, -.17, 0, -.25); c(.13, -.17, .15, .03, 0, .27); g.fill();
    }
  }

  static lantern(g: Graphics, x: number, y: number, r: number, lit = true) {
    g.strokeColor = TALISMAN_INK.gold; g.lineWidth = 1.3;
    g.moveTo(x - r * .32, y + r * .64);
    g.bezierCurveTo(x - r * .5, y + r * 1.15, x + r * .5, y + r * 1.15, x + r * .32, y + r * .64); g.stroke();
    g.fillColor = new Color(119, 58, 43);
    g.moveTo(x - r * .48, y + r * .6);
    g.bezierCurveTo(x - r, y + r * .1, x - r * .78, y - r * .67, x - r * .35, y - r * .76);
    g.lineTo(x + r * .35, y - r * .76);
    g.bezierCurveTo(x + r * .78, y - r * .67, x + r, y + r * .1, x + r * .48, y + r * .6); g.close(); g.fill();
    g.strokeColor = TALISMAN_INK.gold; g.lineWidth = 1.3;
    for (const f of [-.4, 0, .4]) {
      g.moveTo(x + f * r, y + r * .56);
      g.bezierCurveTo(x + f * r * 1.5, y + r * .1, x + f * r * 1.5, y - r * .5, x + f * r * .7, y - r * .69);
    }
    g.moveTo(x - r * .48, y + r * .6); g.lineTo(x + r * .48, y + r * .6);
    g.moveTo(x - r * .4, y - r * .75); g.lineTo(x + r * .4, y - r * .75); g.stroke();
    if (lit) this.drawSuitSymbol(g, 'heart', x, y - r * .02, r * .4, new Color(255, 202, 99));
    g.strokeColor = new Color(193, 101, 61); g.lineWidth = 1;
    g.moveTo(x, y - r * .8); g.bezierCurveTo(x - r * .2, y - r * 1.1, x + r * .2, y - r * .94, x, y - r * 1.22); g.stroke();
  }

  static drawStarBadge(g: Graphics, cx: number, cy: number, r: number, color: Color) {
    this.drawSuitSymbol(g, 'diamond', cx, cy, r, color);
  }

  static playFlyAnim(parent: Node, card: CardItem, startPos: Vec3, heroPos: Vec3, onComplete: () => void) {
    if (!parent?.isValid) return;
    // Derive the emitter from the actual hand root instead of the old hard-coded bottom anchor.
    const row = parent.getChildByName('UIRoot')?.getChildByName('TalismanRow');
    const slot = row?.getChildByName(`Card_${card.id}`);
    const source = slot?.getChildByName('CardVisual') || slot;
    const space = parent.getComponent(UITransform);
    const origin = source && space ? space.convertToNodeSpaceAR(source.worldPosition) : startPos.clone();
    const n = this.node(parent, 'FlyingTalisman');
    n.setPosition(origin);
    this.drawCard(n, card, 48, 80);
    const opacity = n.addComponent(UIOpacity);
    const mid = new Vec3((origin.x + heroPos.x) / 2, Math.max(origin.y, heroPos.y) + 42, 0);
    tween(n).to(.17, { position: mid, angle: -17, scale: new Vec3(.85, .85, 1) })
      .to(.15, { position: heroPos.clone(), angle: 24, scale: new Vec3(.16, .16, 1) })
      .call(() => {
        if (n.isValid) n.destroy();
        if (parent.isValid) onComplete();
      }).start();
    tween(opacity).delay(.14).to(.18, { opacity: 0 }).start();
  }

  static playGlassShards(parent: Node, pos: Vec3) {
    if (!parent?.isValid) return;
    for (let i = 0; i < 8; i++) {
      const n = this.node(parent, 'SealAsh'); n.setPosition(pos);
      const g = n.addComponent(Graphics);
      g.fillColor = new Color(235, 210, 165, 220);
      g.moveTo(-3, -5); g.bezierCurveTo(1, -3, 4, -4, 4, 2); g.lineTo(1, 6); g.lineTo(-4, 3); g.close(); g.fill();
      g.strokeColor = TALISMAN_INK.red; g.lineWidth = .8;
      g.moveTo(-2, 2); g.bezierCurveTo(2, 4, -1, -1, 2, -2); g.stroke();
      const a = i * Math.PI / 4, d = 25 + Math.random() * 35;
      const opacity = n.addComponent(UIOpacity);
      tween(n).by(.4, { position: new Vec3(Math.cos(a) * d, Math.sin(a) * d, 0), angle: i * 37 }).call(() => { if (n.isValid) n.destroy(); }).start();
      tween(opacity).to(.4, { opacity: 0 }).start();
    }
  }
}
