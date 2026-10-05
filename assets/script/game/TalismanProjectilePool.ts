import { _decorator, Color, Component, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { ComboType, LanternSound, SuitType } from './NightTownData';

const { ccclass } = _decorator;

// 飞符数据接口
export interface BulletData {
  pos: Vec3;
  dir: Vec3;
  spd: number;
  dmg: number;
  suit: SuitType;
  combo: ComboType;
  isHero: boolean;        // 玩家发射还是敌人发射
  pierce: number;        // 剩余穿透次数（雷印）
  bounce: number;        // 剩余跳弹次数（风印）
  blastR: number;        // 爆炸半径（灵印）
  vampire: number;       // 吸血量（火印）
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

@ccclass('TalismanProjectilePool')
export class TalismanProjectilePool extends Component {
  private bulletRoot!: Node;
  private fxRoot!: Node;

  private bullets: { node: Node; data: BulletData; hitTargets: Set<Node> }[] = [];
  private particles: ParticleItem[] = [];

  // 命中回调：当飞符命中目标或造成吸血时触发
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

  // 发射一颗飞符
  spawnBullet(data: BulletData): Node {
    const bNode = new Node('Bullet');
    bNode.setPosition(data.pos);
    this.bulletRoot.addChild(bNode);

    // 旋转朝向移动方向
    const rad = Math.atan2(data.dir.y, data.dir.x);
    bNode.angle = (rad * 180) / Math.PI;

    // 绘制飞符符印与流光
    this.drawBulletShape(bNode, data.suit, data.isHero, data.combo, data.blastR);

    this.bullets.push({ node: bNode, data, hitTargets: new Set() });
    return bNode;
  }

  // 绘制各花色的专属发光符印与写实小导弹
  private drawBulletShape(node: Node, suit: SuitType, isHero: boolean, combo: ComboType, blastR: number = 0) {
    const g=node.addComponent(Graphics); g.clear();
    if(!isHero){
      g.fillColor=new Color(54,27,63,210); g.ellipse(0,0,10,6); g.fill();
      g.fillColor=new Color(147,73,152,150); g.circle(3,0,4); g.fill();
      g.strokeColor=new Color(202,103,110,180); g.lineWidth=1.5;
      g.moveTo(-12,4);g.bezierCurveTo(-5,10,2,-8,11,3);g.stroke();
      return;
    }
    const col = suit==='spade' ? new Color(132,174,238) :
      suit==='heart' ? new Color(244,99,64) :
      suit==='club' ? new Color(116,205,174) : new Color(229,197,111);
    const long = combo==='straight' ? 30 : combo==='fullhouse' || blastR>0 ? 24 : 20;
    const tall = combo==='flush' || combo==='quads' ? 12 : 9;
    g.fillColor=new Color(244,226,178,245);
    g.moveTo(-long/2,-tall/2); g.lineTo(long/2-3,-tall/2+1); g.lineTo(long/2,tall/2-1); g.lineTo(-long/2,tall/2); g.close(); g.fill();
    g.strokeColor=new Color(166,48,43); g.lineWidth=1.6;
    g.moveTo(-long/2+3,tall/2-2); g.bezierCurveTo(-3, tall/2+3, 3, -tall/2-2, long/2-4, 1); g.stroke();
    g.strokeColor=col; g.lineWidth=2;
    if(suit==='spade'){ g.moveTo(-3,-3);g.lineTo(0,4);g.lineTo(3,-2);g.lineTo(7,4); }
    else if(suit==='heart'){ g.moveTo(-5,0);g.bezierCurveTo(-1,6,4,5,7,0);g.bezierCurveTo(2,-5,-1,-5,-5,0); }
    else if(suit==='club'){ g.moveTo(-5,3);g.bezierCurveTo(0,-5,4,6,8,-2); }
    else { g.moveTo(-4,0);g.lineTo(2,5);g.lineTo(8,0);g.lineTo(2,-5);g.close(); }
    g.stroke();
    g.fillColor=new Color(col.r,col.g,col.b,80);g.roundRect(-long/2-8,-tall/2-3,long+16,tall+6,5);g.fill();
  }

  // 符灯火焰、朱砂黑白烟雾与弹壳飞射
  playMuzzleFlash(pos: Vec3, dir: Vec3) {
    const fNode=new Node('BrushRuneRelease');fNode.setPosition(pos);
    fNode.angle=Math.atan2(dir.y,dir.x)*180/Math.PI;this.fxRoot.addChild(fNode);
    const g=fNode.addComponent(Graphics);
    g.strokeColor=new Color(244,211,127,240);g.lineWidth=3;
    g.moveTo(0,0);g.bezierCurveTo(9,13,18,-10,30,2);g.moveTo(4,-7);g.bezierCurveTo(13,1,20,8,31,-4);g.stroke();
    g.strokeColor=new Color(185,53,47,230);g.lineWidth=2;g.moveTo(8,5);g.lineTo(15,-5);g.lineTo(22,5);g.stroke();
    tween(fNode).to(0.12,{scale:new Vec3(1.45,1.45,1)}).call(()=>fNode.destroy()).start();
    for(let i=0;i<4;i++) this.spawnSmokePuff(new Vec3(pos.x+dir.x*(10+i*4),pos.y+dir.y*(10+i*4),0));
  }

  // 抛出黄铜弹壳
  private spawnCasing(pos: Vec3, ejectDir: Vec3) {
    const cNode=new Node('PaperAsh');cNode.setPosition(pos);this.fxRoot.addChild(cNode);
    const g=cNode.addComponent(Graphics);g.fillColor=new Color(201,185,151,180);
    g.moveTo(-3,-2);g.lineTo(4,-1);g.lineTo(2,3);g.lineTo(-4,2);g.close();g.fill();
    const speed=55+Math.random()*55;
    this.particles.push({node:cNode,vx:ejectDir.x*speed,vy:20+Math.abs(ejectDir.y)*speed,rotSpd:(Math.random()-.5)*300,life:0,maxLife:.6,color:new Color(201,185,151),size:4});
  }

  // 腾起的淡灰朱砂烟雾
  private spawnSmokePuff(pos: Vec3) {
    const sNode=new Node('SpiritEmber');sNode.setPosition(pos);this.fxRoot.addChild(sNode);
    const g=sNode.addComponent(Graphics);
    const warm=Math.random()>.5;g.fillColor=warm?new Color(246,177,75,135):new Color(115,167,185,110);
    g.moveTo(0,6);g.bezierCurveTo(7,1,4,-6,0,-8);g.bezierCurveTo(-4,-4,-5,2,0,6);g.fill();
    this.particles.push({node:sNode,vx:(Math.random()-.5)*24,vy:28+Math.random()*28,rotSpd:(Math.random()-.5)*80,life:0,maxLife:.55,color:new Color(220,176,103),size:6});
  }

  // 产生跳弹火花（风印或硬物反弹）
  playBounceSparks(pos: Vec3) {
    LanternSound.inst.playBounce();
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
  playHitSparks(pos: Vec3, dir: Vec3, sparkCol: Color = new Color(239, 197, 111)) {
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

  // 雷印穿透紫暗裂缝斩光
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

  // 火印吸血血色灵光（小红心从受击处飞向主角，并融入体内）
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

  // 击杀敌人爆出金色灵息钱币飞散
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

  // 灵印或葫芦重型爆炸（真实古镇夜巡朱砂爆轰：火球白核、黑烟破片与泥石飞溅，告别突兀单线圆圈）
  playExplosion(pos: Vec3, radius: number = 80) {
    const expNode = new Node('SealBurst');
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

    // 炸出碎土飞石与黑灰朱砂烟雾
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

  // 物理帧更新：驱动所有飞符移动、生存期判定与粒子衰减
  updateBullets(dt: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
    this.trailTimer += dt;
    const needTrail = this.trailTimer >= 0.04;
    if (needTrail) this.trailTimer = 0;

    // 1. 更新飞符
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

      // 导弹喷射金红尾焰与朱砂浓烟拖尾（重炮、灵印爆炸、顺子高速弹、葫芦重弹）
      if (needTrail && b.data.isHero && (b.data.blastR > 0 || b.data.combo === 'fullhouse' || b.data.combo === 'straight')) {
        this.spawnBulletTrailPuff(new Vec3(nextX - b.data.dir.x * 12, nextY - b.data.dir.y * 12, 0), b.data.suit, b.data.dir);
      }

      // 边界碰撞与风印跳弹检查
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
    const n=new Node('InkTrail');n.setPosition(pos);this.fxRoot.addChild(n);
    const g=n.addComponent(Graphics);
    const c=suit==='spade'?new Color(112,157,221,120):suit==='heart'?new Color(226,83,60,120):suit==='club'?new Color(91,184,151,120):new Color(224,190,102,120);
    g.strokeColor=c;g.lineWidth=2;g.moveTo(0,0);g.bezierCurveTo(-dir.x*8+2,-dir.y*8+3,-dir.x*14-2,-dir.y*14-2,-dir.x*20,-dir.y*20);g.stroke();
    tween(n).to(.2,{scale:new Vec3(.35,.35,1)}).call(()=>n.destroy()).start();
  }

  // 获得当前活跃飞符列表以供碰撞检测
  getActiveBullets() {
    return this.bullets;
  }

  // 销毁单颗飞符
  removeBullet(index: number) {
    if (index >= 0 && index < this.bullets.length) {
      const b = this.bullets[index];
      b.node.destroy();
      this.bullets.splice(index, 1);
    }
  }

  // 清理全场所有敌人飞符（复活或开大时解除弹幕威胁）
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

  // 清空所有飞符和特效
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
