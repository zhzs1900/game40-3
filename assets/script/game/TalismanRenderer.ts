// 符箓与复古UI矢量渲染工具
// 使用 Graphics 精细刻画符箓面、花色纹样、黄铜边框与飞行动效

import { Color, Graphics, Node, tween, UITransform, Vec3 } from 'cc';
import { CardItem, SuitType } from './NightTownData';

export class TalismanRenderer {

  // 绘制单张精致符箓
  static drawCard(node: Node, card: CardItem, width: number = 80, height: number = 115, isBack: boolean = false) {
    const g=node.getComponent(Graphics)||node.addComponent(Graphics);g.clear();
    const hw=width/2, hh=height/2;
    // handmade talisman paper with clipped corners
    g.fillColor=isBack?new Color(45,54,79):new Color(238,221,177);
    g.moveTo(-hw+7,-hh);g.lineTo(hw-5,-hh+2);g.lineTo(hw,hh-8);g.lineTo(hw-6,hh);g.lineTo(-hw+5,hh-2);g.lineTo(-hw,hh-7);g.close();g.fill();
    g.strokeColor=isBack?new Color(183,143,79):new Color(166,48,43);g.lineWidth=2;
    g.moveTo(-hw+6,-hh+5);g.lineTo(hw-6,-hh+7);g.lineTo(hw-5,hh-8);g.lineTo(-hw+7,hh-6);g.close();g.stroke();
    if(isBack){
      g.strokeColor=new Color(213,173,88);g.lineWidth=1.5;
      g.moveTo(-15,25);g.bezierCurveTo(8,18,-12,3,15,-2);g.moveTo(-14,-12);g.bezierCurveTo(0,-22,9,-12,14,-28);g.stroke();
      return;
    }
    const col=card.suit==='spade'?new Color(67,104,169):card.suit==='heart'?new Color(188,54,46):card.suit==='club'?new Color(54,130,105):new Color(164,126,51);
    // top category stamp
    g.fillColor=col;g.roundRect(-hw+8,hh-24,24,14,3);g.fill();
    this.drawSuitSymbol(g,card.suit,-hw+20,hh-17,5,new Color(247,231,190));
    // flowing cinnabar rune
    g.strokeColor=new Color(177,50,45);g.lineWidth=2.2;
    g.moveTo(-12,hh-30);g.bezierCurveTo(11,hh-23,-14,8,12,4);
    g.bezierCurveTo(-5,-4,13,-15,-10,-24);g.moveTo(-15,-31);g.lineTo(14,-34);g.stroke();
    // value remains explicit for combination logic readability
    this.drawCardValue(g,card.val,hw-15,-hh+18,12,col);
    if(card.isJoker){
      g.strokeColor=new Color(219,171,75);g.lineWidth=2;g.circle(0,4,18);g.stroke();
      g.fillColor=new Color(188,53,47);g.circle(0,4,5);g.fill();
    }
  }

  // 牌背绘制
  private static drawCardBack(g: Graphics, halfW: number, halfH: number, w: number, h: number) {
    // 沉稳暗红底
    g.fillColor = new Color(125, 28, 28);
    g.roundRect(-halfW, -halfH, w, h, 8);
    g.fill();

    // 黄铜边框
    g.strokeColor = new Color(215, 175, 95);
    g.lineWidth = 2;
    g.roundRect(-halfW + 4, -halfH + 4, w - 8, h - 8, 5);
    g.stroke();

    // 内部菱形交错网格暗纹
    g.strokeColor = new Color(160, 45, 45, 180);
    g.lineWidth = 1;
    for (let x = -halfW + 8; x <= halfW - 8; x += 12) {
      g.moveTo(x, -halfH + 8);
      g.lineTo(x + 12, halfH - 8);
      g.stroke();
      g.moveTo(x + 12, -halfH + 8);
      g.lineTo(x, halfH - 8);
      g.stroke();
    }

    // 中心黄铜治安官小星徽
    this.drawStarBadge(g, 0, 0, 14, new Color(235, 195, 100));
  }

  // 四角转角装饰点缀
  private static drawCornerDeco(g: Graphics, halfW: number, halfH: number) {
    g.fillColor = new Color(195, 155, 80);
    const offset = 8;
    const pts = [
      [-halfW + offset, halfH - offset],
      [halfW - offset, halfH - offset],
      [-halfW + offset, -halfH + offset],
      [halfW - offset, -halfH + offset]
    ];
    for (const [x, y] of pts) {
      g.circle(x, y, 1.8);
      g.fill();
    }
  }

  // 绘制Joker专属王牌面
  private static drawJokerFace(g: Graphics, halfW: number, halfH: number) {
    // 璀璨金色星徽和魔力光环
    this.drawStarBadge(g, 0, 8, 22, new Color(235, 180, 40));
    g.strokeColor = new Color(160, 40, 200);
    g.lineWidth = 2;
    g.circle(0, 8, 26);
    g.stroke();

    // 底部横幅标语
    g.fillColor = new Color(150, 20, 20);
    g.roundRect(-halfW + 10, -halfH + 12, halfW * 2 - 20, 16, 4);
    g.fill();

    // 顶端闪烁双角小丑帽（左右双铃铛）
    g.fillColor = new Color(255, 70, 70);
    g.moveTo(-16, 26);
    g.bezierCurveTo(-22, 42, -18, 48, -12, 42);
    g.lineTo(0, 32);
    g.close();
    g.fill();

    g.fillColor = new Color(70, 130, 255);
    g.moveTo(16, 26);
    g.bezierCurveTo(22, 42, 18, 48, 12, 42);
    g.lineTo(0, 32);
    g.close();
    g.fill();

    // 两个金铃铛
    g.fillColor = new Color(255, 220, 50);
    g.circle(-14, 44, 2.5);
    g.circle(14, 44, 2.5);
    g.fill();
  }

  // 绘制标准扑克花色图形
  static drawSuitSymbol(g: Graphics, suit: SuitType, x: number, y: number, r: number, color: Color, shadow?: Color) {
    g.strokeColor=color;g.fillColor=color;g.lineWidth=Math.max(1.3,r*.22);
    if(suit==='spade'){
      g.moveTo(x-r*.8,y-r*.7);g.lineTo(x,y+r);g.lineTo(x+r*.1,y+r*.15);g.lineTo(x+r*.75,y+r*.55);g.lineTo(x+r*.2,y-r*.8);g.stroke();
    } else if(suit==='heart'){
      g.moveTo(x-r,y);g.bezierCurveTo(x-r*.4,y+r,x+r*.4,y+r,x+r,y);g.bezierCurveTo(x+r*.35,y-r*.8,x-r*.2,y-r*.9,x-r,y);g.stroke();
    } else if(suit==='club'){
      g.moveTo(x-r,y-r*.3);g.bezierCurveTo(x-r*.1,y+r*.9,x+r*.2,y-r*.8,x+r,y+r*.2);g.stroke();
    } else {
      g.moveTo(x,y+r);g.lineTo(x+r,y);g.lineTo(x,y-r);g.lineTo(x-r,y);g.close();g.stroke();
    }
  }

  // 各种花色的矢量线条精细描摹
  private static drawSuitShape(g: Graphics, suit: SuitType, cx: number, cy: number, r: number, color: Color) {
    g.fillColor = color;
    switch (suit) {
      case 'spade': {
        // 雷印♠：尖顶、双侧圆弧垂下、底部小支柱
        g.moveTo(cx, cy + r * 1.15);
        g.bezierCurveTo(cx + r * 0.8, cy + r * 0.5, cx + r * 1.05, cy - r * 0.25, cx, cy - r * 0.5);
        g.bezierCurveTo(cx - r * 1.05, cy - r * 0.25, cx - r * 0.8, cy + r * 0.5, cx, cy + r * 1.15);
        g.close();
        g.fill();
        // 底部小底座
        g.moveTo(cx - r * 0.2, cy - r * 0.4);
        g.lineTo(cx - r * 0.45, cy - r * 1.05);
        g.lineTo(cx + r * 0.45, cy - r * 1.05);
        g.lineTo(cx + r * 0.2, cy - r * 0.4);
        g.close();
        g.fill();
        break;
      }
      case 'heart': {
        // 火印♥：双心瓣饱满弯曲向内收尖
        g.moveTo(cx, cy - r * 0.9);
        g.bezierCurveTo(cx - r * 1.1, cy + r * 0.2, cx - r * 0.9, cy + r * 1.1, cx, cy + r * 0.4);
        g.bezierCurveTo(cx + r * 0.9, cy + r * 1.1, cx + r * 1.1, cy + r * 0.2, cx, cy - r * 0.9);
        g.close();
        g.fill();
        break;
      }
      case 'club': {
        // 风印♣：三颗饱满圆叶与底托
        const petalR = r * 0.46;
        g.circle(cx, cy + r * 0.42, petalR);
        g.fill();
        g.circle(cx - r * 0.46, cy - r * 0.15, petalR);
        g.fill();
        g.circle(cx + r * 0.46, cy - r * 0.15, petalR);
        g.fill();
        g.circle(cx, cy, petalR * 0.7);
        g.fill();
        // 底部支柱
        g.moveTo(cx - r * 0.18, cy - r * 0.1);
        g.lineTo(cx - r * 0.42, cy - r * 1.0);
        g.lineTo(cx + r * 0.42, cy - r * 1.0);
        g.lineTo(cx + r * 0.18, cy - r * 0.1);
        g.close();
        g.fill();
        break;
      }
      case 'diamond': {
        // 灵印♦：挺拔四角菱形，带向内微弯的腰线
        g.moveTo(cx, cy + r * 1.1);
        g.lineTo(cx + r * 0.78, cy);
        g.lineTo(cx, cy - r * 1.1);
        g.lineTo(cx - r * 0.78, cy);
        g.close();
        g.fill();
        break;
      }
    }
  }

  // 精细绘制数字点数（2-10, J, Q, K, A）
  private static drawCardValue(g: Graphics, val: number, x: number, y: number, sz: number, color: Color) {
    g.strokeColor = color;
    g.lineWidth = 1.8;

    switch (val) {
      case 14: // A
        g.moveTo(x - sz * 0.35, y - sz * 0.5);
        g.lineTo(x, y + sz * 0.5);
        g.lineTo(x + sz * 0.35, y - sz * 0.5);
        g.stroke();
        g.moveTo(x - sz * 0.22, y - sz * 0.1);
        g.lineTo(x + sz * 0.22, y - sz * 0.1);
        g.stroke();
        break;
      case 13: // K
        g.moveTo(x - sz * 0.3, y - sz * 0.5);
        g.lineTo(x - sz * 0.3, y + sz * 0.5);
        g.stroke();
        g.moveTo(x + sz * 0.3, y + sz * 0.5);
        g.lineTo(x - sz * 0.25, y);
        g.lineTo(x + sz * 0.32, y - sz * 0.5);
        g.stroke();
        break;
      case 12: // Q
        g.circle(x, y, sz * 0.42);
        g.stroke();
        g.moveTo(x + sz * 0.15, y - sz * 0.15);
        g.lineTo(x + sz * 0.38, y - sz * 0.48);
        g.stroke();
        break;
      case 11: // J
        g.moveTo(x - sz * 0.25, y + sz * 0.5);
        g.lineTo(x + sz * 0.15, y + sz * 0.5);
        g.lineTo(x + sz * 0.15, y - sz * 0.2);
        g.bezierCurveTo(x + sz * 0.15, y - sz * 0.52, x - sz * 0.3, y - sz * 0.52, x - sz * 0.3, y - sz * 0.25);
        g.stroke();
        break;
      case 10: // 10
        g.moveTo(x - sz * 0.35, y - sz * 0.5);
        g.lineTo(x - sz * 0.35, y + sz * 0.5);
        g.stroke();
        g.circle(x + sz * 0.2, y, sz * 0.38);
        g.stroke();
        break;
      default: {
        // 普通数字精巧点数阵列
        g.fillColor = color;
        g.circle(x, y + 2, 2.2);
        g.circle(x, y - 2, 2.2);
        g.fill();
        break;
      }
    }
  }

  // 绘制黄铜治安官五角星徽章
  static drawStarBadge(g: Graphics, cx: number, cy: number, r: number, color: Color) {
    g.fillColor = color;
    const pts = 5;
    const step = Math.PI / pts;
    g.moveTo(cx, cy + r);
    for (let i = 0; i < 2 * pts; i++) {
      const curR = (i % 2 === 0) ? r : r * 0.45;
      const angle = i * step + Math.PI / 2;
      g.lineTo(cx + curR * Math.cos(angle), cy + curR * Math.sin(angle));
    }
    g.close();
    g.fill();

    // 中心小圆孔铆钉
    g.strokeColor = new Color(130, 85, 30);
    g.lineWidth = 1.2;
    g.circle(cx, cy, r * 0.25);
    g.stroke();
  }

  // 符箓打出时的环绕飞行动画：从起点飞向目标，环绕旋转一圈后化作流光进入符灯
  static playFlyAnim(parent: Node, card: CardItem, startPos: Vec3, heroPos: Vec3, onComplete: () => void) {
    const flyNode = new Node('FlyCard');
    parent.addChild(flyNode);
    flyNode.setPosition(startPos);
    flyNode.setScale(0.8, 0.8, 1);

    this.drawCard(flyNode, card, 60, 85);

    // 向上飞跃并环绕角色
    const midPos = new Vec3(
      (startPos.x + heroPos.x) / 2 + (Math.random() - 0.5) * 80,
      heroPos.y + 60,
      0
    );

    // 飞行动画中产生淡金色符箓残影
    const spawnGhost = () => {
      if (!flyNode.isValid) return;
      const ghost = new Node('CardGhost');
      parent.addChild(ghost);
      ghost.setPosition(flyNode.position);
      ghost.setScale(flyNode.scale);
      ghost.angle = flyNode.angle;
      const gg = ghost.addComponent(Graphics);
      gg.fillColor = new Color(255, 230, 140, 90);
      gg.roundRect(-30, -42, 60, 85, 6);
      gg.fill();

      tween(ghost)
        .to(0.18, { scale: new Vec3(0.3, 0.3, 1) })
        .call(() => ghost.destroy())
        .start();
    };

    tween(flyNode)
      .call(spawnGhost)
      .to(0.18, { position: midPos, scale: new Vec3(1.1, 1.1, 1), angle: 360 }, { easing: 'quadOut' })
      .call(spawnGhost)
      .to(0.15, { position: heroPos, scale: new Vec3(0.2, 0.2, 1), angle: 720 }, { easing: 'quadIn' })
      .call(() => {
        flyNode.destroy();
        onComplete();
      })
      .start();
  }

  // 玻璃碎裂飞溅特效
  static playGlassShards(parent: Node, pos: Vec3) {
    for (let i = 0; i < 8; i++) {
      const sNode = new Node('GlassShard');
      sNode.setPosition(pos);
      parent.addChild(sNode);

      const g = sNode.addComponent(Graphics);
      g.fillColor = new Color(200, 240, 255, 210);
      g.moveTo(0, 0);
      g.lineTo((Math.random() - 0.5) * 8, 8);
      g.lineTo(4, 2);
      g.close();
      g.fill();

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      tween(sNode)
        .by(0.25, {
          position: new Vec3(Math.cos(ang) * dist, Math.sin(ang) * dist, 0),
          angle: (Math.random() - 0.5) * 360,
          scale: new Vec3(0.2, 0.2, 1)
        })
        .call(() => sNode.destroy())
        .start();
    }
  }
}
