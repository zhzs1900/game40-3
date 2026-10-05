import { _decorator, Color, Component, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { ComboType, SoundMgr, SuitType } from './GameData';

const { ccclass } = _decorator;

// 子弹数据接口
export interface BulletData {
  pos: Vec3;
  dir: Vec3;
  spd: number;
  dmg: number;
  suit: SuitType;
  combo: ComboType;
  isHero: boolean;        // 玩家发射还是敌人发射
  pierce: number;        // 剩余穿透次数（黑桃）
  bounce: number;        // 剩余跳弹次数（梅花）
  blastR: number;        // 爆炸半径（方块）
  vampire: number;       // 吸血量（红桃）
  lifeTime: number;      // 最大存活时间
}

// 粒子碎屑数据
interface ParticleItem {
  node: Node;
  vx: number;
  vy: number;
  rotSpd: number;
  life: number;
  maxLife: number;
  color: Color;
  size: number;
}

@ccclass('BulletPool')
export class BulletPool extends Component {
  private bulletRoot!: Node;
  private fxRoot!: Node;

  private bullets: { node: Node; data: BulletData; hitTargets: Set<Node> }[] = [];
  private particles: ParticleItem[] = [];

  // 命中回调：当子弹命中目标或造成吸血时触发
  public onHitTarget?: (b: BulletData, hitPos: Vec3) => void;
  public onVampireHeal?: (healVal: number) => void;
  public onShakeScreen?: (intensity: number) => void;

  onLoad() {
    if (!this.bullets) this.bullets = [];
    if (!this.particles) this.particles = [];
    this.bulletRoot = new Node('Bullets');
    this.fxRoot = new Node('Effects');
    this.node.addChild(this.bulletRoot);
    this.node.addChild(this.fxRoot);
  }

  // 发射一颗子弹
  spawnBullet(data: BulletData): Node {
    const bNode = new Node('Bullet');
    bNode.setPosition(data.pos);
    this.bulletRoot.addChild(bNode);

    // 旋转朝向移动方向
    const rad = Math.atan2(data.dir.y, data.dir.x);
    bNode.angle = (rad * 180) / Math.PI;

    // 绘制子弹弹头与流光
    this.drawBulletShape(bNode, data.suit, data.isHero, data.combo, data.blastR);

    this.bullets.push({ node: bNode, data, hitTargets: new Set() });
    return bNode;
  }

  // 绘制各花色的专属发光弹头与写实小导弹
  private drawBulletShape(node: Node, suit: SuitType, isHero: boolean, combo: ComboType, blastR: number = 0) {
    const g = node.addComponent(Graphics);
    g.clear();

    if (!isHero) {
      // 敌方子弹：深红暗哑子弹带赤红外焰
      g.fillColor = new Color(245, 60, 40);
      g.ellipse(0, 0, 8, 4);
      g.fill();
      g.fillColor = new Color(255, 220, 110);
      g.circle(3, 0, 2);
      g.fill();
      return;
    }

    // 重炮或方块爆炸弹/葫芦：呈现精密小导弹造型（尾翼、弹体、弹尖铜锥、发光符文）
    if (blastR > 0 || combo === 'fullhouse') {
      // 铸铁深黑弹体
      g.fillColor = new Color(45, 48, 55);
      g.roundRect(-10, -3.5, 18, 7, 1.5);
      g.fill();

      // 黄铜尖头战斗部
      g.fillColor = new Color(235, 165, 45);
      g.moveTo(8, -3.5);
      g.lineTo(16, 0);
      g.lineTo(8, 3.5);
      g.close();
      g.fill();

      // 尾部三片稳定尾翼
      g.fillColor = new Color(75, 80, 90);
      g.moveTo(-10, 3.5);
      g.lineTo(-14, 7);
      g.lineTo(-6, 3.5);
      g.close();
      g.fill();
      g.moveTo(-10, -3.5);
      g.lineTo(-14, -7);
      g.lineTo(-6, -3.5);
      g.close();
      g.fill();

      // 弹身爆破危险金纹
      g.fillColor = new Color(255, 210, 50);
      g.rect(-2, -3.5, 4, 7);
      g.fill();
      return;
    }

    // 顺子高速连发弹：极速细长穿云金梭
    if (combo === 'straight') {
      g.fillColor = new Color(255, 215, 60, 90);
      g.roundRect(-22, -3, 36, 6, 3);
      g.fill();
      g.fillColor = new Color(255, 255, 240);
      g.ellipse(2, 0, 12, 2.2);
      g.fill();
      return;
    }

    // 根据不同牌型放大弹头尺寸
    const sz = combo === 'flush' ? 1.4 : combo === 'trips' ? 1.2 : 1.0;

    // 花色光晕
    let glowCol = new Color(255, 220, 100);
    switch (suit) {
      case 'spade': glowCol = new Color(145, 90, 255); break;  // 黑桃幽蓝紫光
      case 'heart': glowCol = new Color(255, 60, 95); break;   // 红桃灼热绯红
      case 'club': glowCol = new Color(40, 230, 140); break;   // 梅花翡翠青芒
      case 'diamond': glowCol = new Color(255, 160, 35); break; // 方块耀金爆裂
    }

    // 拖尾光晕
    g.fillColor = new Color(glowCol.r, glowCol.g, glowCol.b, 90);
    g.roundRect(-16 * sz, -5 * sz, 26 * sz, 10 * sz, 4 * sz);
    g.fill();

    // 弹芯黄铜流光
    g.fillColor = new Color(255, 245, 205);
    g.ellipse(2 * sz, 0, 9 * sz, 4 * sz);
    g.fill();

    // 弹尖白炽亮斑
    g.fillColor = new Color(255, 255, 255);
    g.circle(6 * sz, 0, 2.5 * sz);
    g.fill();
  }

  // 枪口火焰、火药黑白烟雾与弹壳飞射
  playMuzzleFlash(pos: Vec3, dir: Vec3) {
    const fNode = new Node('MuzzleFx');
    fNode.setPosition(pos);
    const rad = Math.atan2(dir.y, dir.x);
    fNode.angle = (rad * 180) / Math.PI;
    this.fxRoot.addChild(fNode);

    const g = fNode.addComponent(Graphics);

    // 喇叭形金色火焰
    g.fillColor = new Color(255, 210, 60);
    g.moveTo(0, 0);
    g.lineTo(24, 12);
    g.lineTo(36, 0);
    g.lineTo(24, -12);
    g.close();
    g.fill();

    // 中心白热火核
    g.fillColor = new Color(255, 255, 240);
    g.moveTo(0, 0);
    g.lineTo(14, 6);
    g.lineTo(20, 0);
    g.lineTo(14, -6);
    g.close();
    g.fill();

    // 极快闪现后销毁
    this.scheduleOnce(() => {
      fNode.destroy();
    }, 0.06);

    // 产生火药烟气团
    for (let i = 0; i < 3; i++) {
      this.spawnSmokePuff(new Vec3(pos.x + dir.x * 20, pos.y + dir.y * 20, 0));
    }

    // 向斜后方抛出旋转金黄弹壳
    this.spawnCasing(pos, new Vec3(-dir.x + (Math.random() - 0.5), -dir.y + (Math.random() + 0.5), 0));
  }

  // 抛出黄铜弹壳
  private spawnCasing(pos: Vec3, ejectDir: Vec3) {
    const cNode = new Node('Casing');
    cNode.setPosition(pos);
    this.fxRoot.addChild(cNode);

    const g = cNode.addComponent(Graphics);
    g.fillColor = new Color(220, 175, 60);
    g.roundRect(-4, -1.5, 8, 3, 1);
    g.fill();

    const speed = 120 + Math.random() * 80;
    this.particles.push({
      node: cNode,
      vx: ejectDir.x * speed,
      vy: ejectDir.y * speed,
      rotSpd: (Math.random() - 0.5) * 720,
      life: 0,
      maxLife: 0.45,
      color: new Color(220, 175, 60),
      size: 4
    });
  }

  // 腾起的淡灰火药烟雾
  private spawnSmokePuff(pos: Vec3) {
    const sNode = new Node('Smoke');
    sNode.setPosition(pos);
    this.fxRoot.addChild(sNode);

    const g = sNode.addComponent(Graphics);
    const alpha = 140;
    g.fillColor = new Color(180, 170, 160, alpha);
    g.circle(0, 0, 7);
    g.fill();

    this.particles.push({
      node: sNode,
      vx: (Math.random() - 0.5) * 30,
      vy: 20 + Math.random() * 30,
      rotSpd: (Math.random() - 0.5) * 60,
      life: 0,
      maxLife: 0.5,
      color: new Color(180, 170, 160),
      size: 7
    });
  }

  // 产生跳弹火花（梅花或硬物反弹）
  playBounceSparks(pos: Vec3) {
    SoundMgr.inst.playBounce();
    for (let i = 0; i < 6; i++) {
      const spNode = new Node('Spark');
      spNode.setPosition(pos);
      this.fxRoot.addChild(spNode);

      const g = spNode.addComponent(Graphics);
      g.fillColor = new Color(255, 230, 120);
      g.circle(0, 0, 2);
      g.fill();

      const ang = Math.random() * Math.PI * 2;
      const spd = 100 + Math.random() * 120;
      this.particles.push({
        node: spNode,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rotSpd: 0,
        life: 0,
        maxLife: 0.22,
        color: new Color(255, 230, 120),
        size: 2
      });
    }
  }

  // 产生木屑飞溅（击中箱子掩体）
  playWoodSplinters(pos: Vec3) {
    for (let i = 0; i < 8; i++) {
      const wNode = new Node('Wood');
      wNode.setPosition(pos);
      this.fxRoot.addChild(wNode);

      const g = wNode.addComponent(Graphics);
      g.fillColor = new Color(150, 95, 45);
      g.rect(-2, -1, 4, 2);
      g.fill();

      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 100;
      this.particles.push({
        node: wNode,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rotSpd: (Math.random() - 0.5) * 500,
        life: 0,
        maxLife: 0.35,
        color: new Color(150, 95, 45),
        size: 3
      });
    }
  }

  // 导弹发射尾焰与白烟拖尾计时
  private trailTimer: number = 0;

  // 命中金属火星飞溅
  playHitSparks(pos: Vec3, dir: Vec3, sparkCol: Color = new Color(255, 220, 80)) {
    const oppRad = Math.atan2(-dir.y, -dir.x);
    for (let i = 0; i < 5; i++) {
      const spNode = new Node('HitSpark');
      spNode.setPosition(pos);
      this.fxRoot.addChild(spNode);

      const g = spNode.addComponent(Graphics);
      g.fillColor = sparkCol;
      g.circle(0, 0, 2);
      g.fill();

      const spread = (Math.random() - 0.5) * 1.2;
      const ang = oppRad + spread;
      const spd = 120 + Math.random() * 140;

      this.particles.push({
        node: spNode,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rotSpd: 0,
        life: 0,
        maxLife: 0.18,
        color: sparkCol,
        size: 2
      });
    }
  }

  // 黑桃穿透紫暗裂缝斩光
  playSpadeSlash(pos: Vec3) {
    const sNode = new Node('SpadeSlash');
    sNode.setPosition(pos);
    this.fxRoot.addChild(sNode);

    const g = sNode.addComponent(Graphics);
    g.strokeColor = new Color(160, 90, 255, 230);
    g.lineWidth = 3;
    g.moveTo(-18, -12);
    g.lineTo(18, 12);
    g.stroke();
    g.strokeColor = new Color(255, 255, 255);
    g.lineWidth = 1.2;
    g.moveTo(-12, -8);
    g.lineTo(12, 8);
    g.stroke();

    tween(sNode)
      .to(0.12, { scale: new Vec3(1.4, 0.2, 1) })
      .call(() => sNode.destroy())
      .start();
  }

  // 红桃吸血血色灵光（小红心从受击处飞向主角，并融入体内）
  playVampireFly(startPos: Vec3, targetNode: Node, onReach?: () => void) {
    const heartNode = new Node('VampireSpirit');
    heartNode.setPosition(startPos);
    this.fxRoot.addChild(heartNode);

    const g = heartNode.addComponent(Graphics);
    // 娇艳发光小红心
    g.fillColor = new Color(255, 50, 80);
    g.moveTo(0, -5);
    g.bezierCurveTo(-6, 2, -5, 7, 0, 3);
    g.bezierCurveTo(5, 7, 6, 2, 0, -5);
    g.close();
    g.fill();

    const tPos = targetNode.position;
    const midPos = new Vec3(
      (startPos.x + tPos.x) / 2 + (Math.random() - 0.5) * 60,
      (startPos.y + tPos.y) / 2 + 50,
      0
    );

    tween(heartNode)
      .to(0.2, { position: midPos, scale: new Vec3(1.3, 1.3, 1) }, { easing: 'quadOut' })
      .to(0.22, { position: tPos, scale: new Vec3(0.3, 0.3, 1) }, { easing: 'quadIn' })
      .call(() => {
        heartNode.destroy();
        if (onReach) onReach();
      })
      .start();
  }

  // 击杀敌人爆出金色赏金钱币飞散
  playCoinDrop(pos: Vec3, count: number = 3) {
    for (let i = 0; i < count; i++) {
      const cNode = new Node('CoinDrop');
      cNode.setPosition(pos);
      this.fxRoot.addChild(cNode);

      const g = cNode.addComponent(Graphics);
      g.fillColor = new Color(255, 215, 60);
      g.circle(0, 0, 5);
      g.fill();
      g.strokeColor = new Color(180, 120, 20);
      g.lineWidth = 1.2;
      g.circle(0, 0, 5);
      g.stroke();

      const ang = (Math.PI / 4) + (i * Math.PI) / count + (Math.random() - 0.5) * 0.4;
      const spd = 90 + Math.random() * 80;

      this.particles.push({
        node: cNode,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rotSpd: (Math.random() - 0.5) * 400,
        life: 0,
        maxLife: 0.55,
        color: new Color(255, 215, 60),
        size: 5
      });
    }
  }

  // 敌人或主角掉血时头顶跳出数字
  playDamageNumber(pos: Vec3, dmg: number, isHurt: boolean = false) {
    const numNode = new Node('DmgNum');
    // 稍微左右错开一点，防止叠在一起看不清
    numNode.setPosition(pos.x + (Math.random() - 0.5) * 20, pos.y + 15, 0);
    this.fxRoot.addChild(numNode);

    // 绘制一个半透明的小胶囊底框，让数字在复杂背景上看得清楚
    const g = numNode.addComponent(Graphics);
    g.fillColor = isHurt ? new Color(180, 25, 25, 200) : new Color(30, 20, 15, 190);
    g.roundRect(-20, -10, 40, 20, 5);
    g.fill();
    g.strokeColor = isHurt ? new Color(255, 120, 120, 240) : new Color(255, 215, 70, 240);
    g.lineWidth = 1.2;
    g.roundRect(-20, -10, 40, 20, 5);
    g.stroke();

    // 伤害数字文字挂载在子节点上，防止同一个节点挂载两个Renderable2D
    const lblNode = new Node('NumLbl');
    numNode.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.string = isHurt ? `-${Math.round(dmg)}` : `${Math.round(dmg)}`;
    lbl.fontSize = 13;
    lbl.lineHeight = 15;
    lbl.color = isHurt ? new Color(255, 210, 210) : new Color(255, 235, 130);

    // 向上弹一下然后缩水消失
    tween(numNode)
      .to(0.08, { scale: new Vec3(1.25, 1.25, 1) })
      .by(0.32, { position: new Vec3(0, 28, 0) })
      .to(0.12, { scale: new Vec3(0, 0, 1) })
      .call(() => numNode.destroy())
      .start();
  }

  // 方块或葫芦重型爆炸（真实西部火药爆轰：火球白核、黑烟破片与泥石飞溅，告别突兀单线圆圈）
  playExplosion(pos: Vec3, radius: number = 80) {
    const expNode = new Node('Explosion');
    expNode.setPosition(pos);
    this.fxRoot.addChild(expNode);

    const g = expNode.addComponent(Graphics);

    // 绘制多瓣爆轰烈焰团（外层深橙赤红，内层耀金，核心白炽）
    const petCount = 7;
    // 1. 外层爆轰赤焰多边形
    g.fillColor = new Color(235, 65, 20, 210);
    for (let i = 0; i < petCount; i++) {
      const a = (i * Math.PI * 2) / petCount;
      const r = radius * (0.65 + Math.random() * 0.25);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.close();
    g.fill();

    // 2. 中层浓郁炽金火球
    g.fillColor = new Color(255, 175, 35, 230);
    for (let i = 0; i < petCount; i++) {
      const a = (i * Math.PI * 2) / petCount + 0.3;
      const r = radius * 0.45;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.close();
    g.fill();

    // 3. 核心白炽爆轰火核
    g.fillColor = new Color(255, 255, 230, 255);
    g.circle(0, 0, radius * 0.22);
    g.fill();

    // 屏幕轻微震颤
    if (this.onShakeScreen) {
      this.onShakeScreen(6);
    }

    // 通过标准 tween 快速膨胀后消散，确保时间一到 100% 干净销毁，绝不在地面残留任何线条或圆圈
    expNode.setScale(0.3, 0.3, 1);
    tween(expNode)
      .to(0.08, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'quadOut' })
      .to(0.14, { scale: new Vec3(1.35, 1.35, 1) }, { easing: 'quadIn' })
      .call(() => {
        if (expNode.isValid) expNode.destroy();
      })
      .start();

    // 炸出碎土飞石与黑灰火药烟雾
    for (let i = 0; i < 8; i++) {
      this.spawnSmokePuff(new Vec3(pos.x + (Math.random() - 0.5) * 35, pos.y + (Math.random() - 0.5) * 35, 0));
    }

    // 飞溅炽热爆破弹片火星
    for (let i = 0; i < 8; i++) {
      const spNode = new Node('ExpSpark');
      spNode.setPosition(pos);
      this.fxRoot.addChild(spNode);
      const spg = spNode.addComponent(Graphics);
      spg.fillColor = new Color(255, 200, 50);
      spg.circle(0, 0, 2.5);
      spg.fill();

      const ang = (i * Math.PI * 2) / 8 + (Math.random() - 0.5) * 0.4;
      const spd = 140 + Math.random() * 120;
      this.particles.push({
        node: spNode,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rotSpd: 0,
        life: 0,
        maxLife: 0.28,
        color: new Color(255, 200, 50),
        size: 2.5
      });
    }
  }

  // 物理帧更新：驱动所有子弹移动、生存期判定与粒子衰减
  updateBullets(dt: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
    this.trailTimer += dt;
    const needTrail = this.trailTimer >= 0.04;
    if (needTrail) this.trailTimer = 0;

    // 1. 更新子弹
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b || !b.node || !b.node.isValid) {
        this.bullets.splice(i, 1);
        continue;
      }
      b.data.lifeTime -= dt;

      // 移动
      const pos = b.node.position;
      if (!pos) {
        if (b.node && b.node.isValid) b.node.destroy();
        this.bullets.splice(i, 1);
        continue;
      }
      const nextX = pos.x + b.data.dir.x * b.data.spd * dt;
      const nextY = pos.y + b.data.dir.y * b.data.spd * dt;
      b.node.setPosition(nextX, nextY, 0);

      // 导弹喷射金红尾焰与火药浓烟拖尾（重炮、方块爆炸、顺子高速弹、葫芦重弹）
      if (needTrail && b.data.isHero && (b.data.blastR > 0 || b.data.combo === 'fullhouse' || b.data.combo === 'straight')) {
        this.spawnBulletTrailPuff(new Vec3(nextX - b.data.dir.x * 12, nextY - b.data.dir.y * 12, 0), b.data.suit, b.data.dir);
      }

      // 边界碰撞与梅花跳弹检查
      let hitBorder = false;
      if (nextX < bounds.minX || nextX > bounds.maxX) {
        if (b.data.bounce > 0) {
          b.data.dir.x = -b.data.dir.x;
          b.data.bounce--;
          this.playBounceSparks(b.node.position);
          b.node.angle = (Math.atan2(b.data.dir.y, b.data.dir.x) * 180) / Math.PI;
        } else {
          hitBorder = true;
        }
      }
      if (nextY < bounds.minY || nextY > bounds.maxY) {
        if (b.data.bounce > 0) {
          b.data.dir.y = -b.data.dir.y;
          b.data.bounce--;
          this.playBounceSparks(b.node.position);
          b.node.angle = (Math.atan2(b.data.dir.y, b.data.dir.x) * 180) / Math.PI;
        } else {
          hitBorder = true;
        }
      }

      // 超时或撞墙销毁
      if (b.data.lifeTime <= 0 || hitBorder) {
        if (b.node && b.node.isValid) b.node.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // 2. 更新粒子碎屑
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p || !p.node || !p.node.isValid) {
        this.particles.splice(i, 1);
        continue;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.node.isValid) {
          p.node.destroy();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // 重力与位移
      p.vy -= 220 * dt;
      const curPos = p.node.position;
      if (!curPos) {
        if (p.node.isValid) p.node.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.node.setPosition(curPos.x + p.vx * dt, curPos.y + p.vy * dt, 0);
      p.node.angle += p.rotSpd * dt;

      // 逐渐变淡缩小
      const factor = 1 - p.life / p.maxLife;
      p.node.setScale(factor, factor, 1);
    }
  }

  // 生成导弹飞行的炽热喷射尾焰、浓烟扩散与火星
  private spawnBulletTrailPuff(pos: Vec3, suit: SuitType, dir: Vec3) {
    // 1. 炽热锥形喷射尾焰（内芯白热、外焰橙红）
    const flameNode = new Node('TrailFlame');
    flameNode.setPosition(pos);
    this.fxRoot.addChild(flameNode);

    const fg = flameNode.addComponent(Graphics);
    const oppRad = Math.atan2(-dir.y, -dir.x);
    flameNode.angle = (oppRad * 180) / Math.PI;

    // 外焰
    fg.fillColor = suit === 'diamond' ? new Color(255, 100, 20, 230) : new Color(255, 180, 40, 220);
    fg.moveTo(0, 0);
    fg.lineTo(16, 5);
    fg.lineTo(24, 0);
    fg.lineTo(16, -5);
    fg.close();
    fg.fill();

    // 内芯白热
    fg.fillColor = new Color(255, 255, 220);
    fg.moveTo(0, 0);
    fg.lineTo(8, 2.5);
    fg.lineTo(12, 0);
    fg.lineTo(8, -2.5);
    fg.close();
    fg.fill();

    // 0.08秒极速消散
    tween(flameNode)
      .to(0.08, { scale: new Vec3(0.3, 0.3, 1) })
      .call(() => {
        if (flameNode.isValid) flameNode.destroy();
      })
      .start();

    // 2. 膨胀消散的灰白火药浓烟气团（通过 tween 自身缩放并销毁，不混入 particles）
    const smokeNode = new Node('TrailSmoke');
    smokeNode.setPosition(pos.x - dir.x * 6 + (Math.random() - 0.5) * 6, pos.y - dir.y * 6 + (Math.random() - 0.5) * 6, 0);
    this.fxRoot.addChild(smokeNode);

    const sg = smokeNode.addComponent(Graphics);
    sg.fillColor = new Color(210, 205, 200, 140);
    sg.circle(0, 0, 4);
    sg.fill();

    tween(smokeNode)
      .to(0.28, { scale: new Vec3(2.5, 2.5, 1) })
      .call(() => {
        if (smokeNode.isValid) smokeNode.destroy();
      })
      .start();

    // 3. 散落微星火花（新建一个独立火花节点交给 particles 管理）
    const spkNode = new Node('TrailSpark');
    spkNode.setPosition(pos);
    this.fxRoot.addChild(spkNode);
    const spg = spkNode.addComponent(Graphics);
    spg.fillColor = new Color(255, 180, 40);
    spg.circle(0, 0, 2);
    spg.fill();

    this.particles.push({
      node: spkNode,
      vx: -dir.x * 40 + (Math.random() - 0.5) * 30,
      vy: -dir.y * 40 + (Math.random() - 0.5) * 30,
      rotSpd: 0,
      life: 0,
      maxLife: 0.22,
      color: new Color(255, 180, 40),
      size: 2
    });
  }

  // 获得当前活跃子弹列表以供碰撞检测
  getActiveBullets() {
    return this.bullets;
  }

  // 销毁单颗子弹
  removeBullet(index: number) {
    if (index >= 0 && index < this.bullets.length) {
      const b = this.bullets[index];
      b.node.destroy();
      this.bullets.splice(index, 1);
    }
  }

  // 清理全场所有敌人子弹（复活或开大时解除弹幕威胁）
  clearEnemyBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.data.isHero) {
        if (b.node && b.node.isValid) {
          b.node.destroy();
        }
        this.bullets.splice(i, 1);
      }
    }
  }

  // 清空所有子弹和特效
  clearAll() {
    if (this.bullets && Array.isArray(this.bullets)) {
      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        if (b && b.node && b.node.isValid) {
          b.node.destroy();
        }
      }
    }
    this.bullets = [];

    if (this.particles && Array.isArray(this.particles)) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p && p.node && p.node.isValid) {
          p.node.destroy();
        }
      }
    }
    this.particles = [];
  }
}
