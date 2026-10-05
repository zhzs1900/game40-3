// 关底 Boss 与“黑牌赌王”系统
// 具备专属悬浮牌面、阶段变身、攻击预摇、破牌打断与虚弱硬直机制

import { _decorator, Color, Component, Graphics, Node, tween, Tween, Vec3 } from 'cc';
import { ComboType, SuitType } from './NightTownData';
import { TalismanRenderer } from './TalismanRenderer';

const { ccclass } = _decorator;

@ccclass('NightTownGateSpirit')
export class NightTownGateSpirit extends Component {
  public bossName: string = '黑牌赌王·卡特赖特';
  public hp: number = 2000;
  public maxHp: number = 2000;
  public phase: number = 1;       // 1: 普通 2: 牌型阶段 3: 狂暴末路
  public isStunned: boolean = false;
  public isDead: boolean = false;

  // 内部节点
  private shadowNode!: Node;
  private legLeftNode!: Node;
  private legRightNode!: Node;
  private bodyRoot!: Node;
  private headNode!: Node;
  private armNode!: Node;
  private gunNode!: Node;
  private cardOrbitRoot!: Node;
  private bossHpBarNode!: Node;

  // 破牌机制数据
  public isCharging: boolean = false;
  public chargeTimer: number = 0;
  public maxChargeTime: number = 3.0;
  public breakCount: number = 0;      // 破牌所需受击次数
  public maxBreakCount: number = 4;
  public curBossCombo: ComboType = 'pair';
  public curBossSuit: SuitType = 'spade';

  // 状态与定时
  private actionTimer: number = 0;
  private animTimer: number = 0;
  private stunTimer: number = 0;

  // 回调通知
  public onBossFire?: (fromPos: Vec3, toPos: Vec3, type: ComboType, suit: SuitType) => void;
  public onSummonMinions?: (pos: Vec3) => void;
  public onHandBroken?: () => void;

  onLoad() {
    this.buildSkeleton();
  }

  public curLevel: number = 1;

  // 初始化 Boss 属性与难度
  initBoss(name: string, hp: number, level: number) {
    this.bossName = name;
    this.maxHp = hp;
    this.hp = hp;
    this.curLevel = level;
    this.phase = 1;
    this.isDead = false;
    this.isStunned = false;
    this.isCharging = false;
    this.redrawBossByTheme(level);
    this.updateHpBar();
  }

  // 根据关卡主题换装Boss服饰与配饰
  private redrawBossByTheme(level: number) {
    // 重新绘制躯干与头部
    this.drawBossTorso(this.bodyRoot, level);
    this.drawBossHead(this.headNode, level);
  }

  // 构建骨骼层级
  private buildSkeleton() {
    // 巨大暗影
    this.shadowNode = new Node('Shadow');
    this.shadowNode.setPosition(0, -32, 0);
    this.node.addChild(this.shadowNode);
    const sg = this.shadowNode.addComponent(Graphics);
    sg.fillColor = new Color(10, 8, 8, 110);
    sg.ellipse(0, 0, 38, 14);
    sg.fill();

    // 独立左右西装长腿（漫步时交替摆动）
    this.legLeftNode = new Node('LegL');
    this.legLeftNode.setPosition(-8, -10, 0);
    this.node.addChild(this.legLeftNode);
    this.drawBossLeg(this.legLeftNode, true);

    this.legRightNode = new Node('LegR');
    this.legRightNode.setPosition(8, -10, 0);
    this.node.addChild(this.legRightNode);
    this.drawBossLeg(this.legRightNode, false);

    // 身体根节点
    this.bodyRoot = new Node('BodyRoot');
    this.node.addChild(this.bodyRoot);

    // 绘制大氅与怀表金链
    this.drawBossTorso(this.bodyRoot, 1);

    // 头部（高顶丝绸黑礼帽、黑眼罩、金边胡子）
    this.headNode = new Node('Head');
    this.headNode.setPosition(0, 36, 0);
    this.bodyRoot.addChild(this.headNode);
    this.drawBossHead(this.headNode, 1);

    // 手臂与锁链灯笼
    this.armNode = new Node('Arm');
    this.armNode.setPosition(10, 16, 0);
    this.bodyRoot.addChild(this.armNode);
    this.drawBossArm(this.armNode);

    this.gunNode = new Node('Gun');
    this.gunNode.setPosition(24, 0, 0);
    this.armNode.addChild(this.gunNode);
    this.drawGoldRevolver(this.gunNode);

    // 头顶悬浮黑牌阵列节点
    this.cardOrbitRoot = new Node('CardOrbit');
    this.cardOrbitRoot.setPosition(0, 75, 0);
    this.node.addChild(this.cardOrbitRoot);

    // 大Boss血条节点
    this.bossHpBarNode = new Node('BossHpBar');
    this.bossHpBarNode.setPosition(0, 105, 0);
    this.node.addChild(this.bossHpBarNode);
  }

  // 绘制Boss躯干（根据关卡展现不同服饰颜色）
  private drawBossTorso(node: Node, level: number = 1) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(64,58,61);g.moveTo(-29,26);g.lineTo(29,26);g.lineTo(34,-27);g.lineTo(18,-38);g.lineTo(-20,-36);g.lineTo(-34,-24);g.close();g.fill();
    g.fillColor=new Color(85,73,67);g.moveTo(-22,19);g.lineTo(22,19);g.lineTo(25,-18);g.lineTo(-25,-18);g.close();g.fill();
    g.strokeColor=new Color(39,36,43);g.lineWidth=4;
    g.moveTo(-19,22);g.lineTo(-7,-29);g.moveTo(17,23);g.lineTo(5,-31);g.moveTo(-26,-6);g.lineTo(27,4);g.stroke();
    g.strokeColor=new Color(181,51,46);g.lineWidth=2.5;
    g.moveTo(-8,16);g.bezierCurveTo(9,7,-12,-2,9,-13);g.moveTo(-12,-19);g.lineTo(12,-19);g.stroke();
    g.fillColor=new Color(217,173,86);g.circle(-18,12,3);g.circle(18,12,3);g.circle(-19,-18,3);g.circle(19,-18,3);g.fill();
    // chained lantern at the sternum
    g.strokeColor=new Color(104,91,82);g.lineWidth=3;g.moveTo(-25,22);g.lineTo(-7,6);g.moveTo(25,22);g.lineTo(7,6);g.stroke();
    g.fillColor=new Color(120,43,43);g.roundRect(-9,-1,18,21,4);g.fill();
    g.fillColor=new Color(252,192,83,210);g.ellipse(0,8,5,8);g.fill();
    if(level>=5){g.strokeColor=new Color(114,55,121,170);g.lineWidth=2;g.moveTo(-31,-4);g.lineTo(-15,4);g.lineTo(-23,16);g.moveTo(31,-4);g.lineTo(15,4);g.lineTo(23,16);g.stroke();}
  }

  // 绘制Boss头部与不同特色礼帽
  private drawBossHead(node: Node, level: number = 1) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(96,82,72);g.moveTo(-22,18);g.lineTo(-15,31);g.lineTo(0,36);g.lineTo(16,30);g.lineTo(23,16);g.lineTo(18,-14);g.lineTo(0,-25);g.lineTo(-18,-13);g.close();g.fill();
    g.fillColor=new Color(207,193,159);g.moveTo(-15,13);g.lineTo(-9,25);g.lineTo(0,29);g.lineTo(10,24);g.lineTo(16,12);g.lineTo(11,-8);g.lineTo(0,-16);g.lineTo(-11,-8);g.close();g.fill();
    g.strokeColor=new Color(160,47,44);g.lineWidth=3;g.moveTo(-13,12);g.lineTo(-4,5);g.lineTo(-11,0);g.moveTo(13,12);g.lineTo(4,5);g.lineTo(11,0);g.stroke();
    g.fillColor=new Color(31,26,31);g.ellipse(-6,8,4,2);g.ellipse(6,8,4,2);g.fill();
    g.fillColor=new Color(235,177,74);g.circle(-6,8,1.5);g.circle(6,8,1.5);g.fill();
    g.strokeColor=new Color(59,51,50);g.lineWidth=3;g.moveTo(-9,-5);g.bezierCurveTo(-3,-12,4,-12,10,-4);g.stroke();
    // crown-like town gate carving
    g.fillColor=new Color(58,48,49);g.moveTo(-24,23);g.lineTo(-17,43);g.lineTo(-7,35);g.lineTo(0,47);g.lineTo(8,35);g.lineTo(18,43);g.lineTo(24,22);g.close();g.fill();
    if(level>=7){g.strokeColor=new Color(186,53,47);g.lineWidth=2;g.moveTo(0,29);g.lineTo(-3,12);g.lineTo(4,-5);g.stroke();}
  }

  // 绘制Boss手臂
  private drawBossArm(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(73,65,64);g.roundRect(-2,-8,28,16,6);g.fill();
    g.strokeColor=new Color(45,41,45);g.lineWidth=4;g.moveTo(2,-5);g.lineTo(24,5);g.stroke();
    g.strokeColor=new Color(189,145,76);g.lineWidth=2;g.moveTo(5,7);g.bezierCurveTo(12,13,17,-10,25,-4);g.stroke();
    g.fillColor=new Color(111,87,67);g.circle(28,0,7);g.fill();
  }

  // 绘制镇门灵锁链灯笼
  private drawGoldRevolver(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.strokeColor=new Color(105,88,76);g.lineWidth=4;g.moveTo(-3,0);g.lineTo(18,0);g.stroke();
    g.fillColor=new Color(128,45,45);g.roundRect(13,-13,20,25,5);g.fill();
    g.strokeColor=new Color(224,178,88);g.lineWidth=2;g.roundRect(13,-13,20,25,5);g.stroke();
    g.fillColor=new Color(255,196,78,210);g.ellipse(23,0,7,10);g.fill();
    g.strokeColor=new Color(169,48,45);g.lineWidth=1.5;g.moveTo(17,7);g.lineTo(29,-7);g.moveTo(17,-7);g.lineTo(29,7);g.stroke();
  }

  // 绘制Boss左右腿（条纹西裤与银扣亮黑皮鞋）
  private drawBossLeg(node: Node, isLeft: boolean) {
    const g=node.addComponent(Graphics);g.clear();
    const side=isLeft?-1:1;
    g.fillColor=new Color(61,57,61);g.moveTo(-7,3);g.lineTo(7,3);g.lineTo(9,-24);g.lineTo(-8,-27);g.close();g.fill();
    g.strokeColor=new Color(39,37,43);g.lineWidth=3;g.moveTo(side*2,0);g.lineTo(side*4,-23);g.stroke();
    g.fillColor=new Color(73,65,62);g.moveTo(-9,-23);g.lineTo(10,-23);g.lineTo(14,-31);g.lineTo(-12,-32);g.close();g.fill();
    g.strokeColor=new Color(180,137,73);g.lineWidth=1.5;g.moveTo(-8,-27);g.lineTo(9,-27);g.stroke();
  }

  // 更新 Boss 大血条
  private updateHpBar() {
    const g = this.bossHpBarNode.getComponent(Graphics) || this.bossHpBarNode.addComponent(Graphics);
    g.clear();

    const w = 90;
    const h = 8;

    // 暗底槽
    g.fillColor = new Color(15, 15, 18, 210);
    g.roundRect(-w / 2, -h / 2, w, h, 3);
    g.fill();

    // 烫金外框
    g.strokeColor = new Color(210, 165, 60);
    g.lineWidth = 1.2;
    g.roundRect(-w / 2, -h / 2, w, h, 3);
    g.stroke();

    // 阶段颜色：一阶段红，二阶段橙，三阶段紫黑狂暴
    let col = new Color(220, 45, 45);
    if (this.phase === 2) col = new Color(245, 140, 30);
    if (this.phase === 3) col = new Color(180, 40, 220);

    const ratio = Math.max(0, this.hp / this.maxHp);
    g.fillColor = col;
    g.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, (w - 3) * ratio, h - 3, 2);
    g.fill();
  }

  // 开启牌型蓄力大招（头顶展开悬浮卡牌，进入前摇）
  startComboCharge(type: ComboType, suit: SuitType) {
    if (this.isCharging || this.isStunned || this.isDead) return;

    this.isCharging = true;
    this.chargeTimer = 0;
    this.maxChargeTime = 3.1 - (this.curLevel - 1) * 0.07 - (this.phase === 3 ? 0.45 : 0);
    this.curBossCombo = type;
    this.curBossSuit = suit;
    this.breakCount = 0;
    this.maxBreakCount = 3 + Math.floor((this.curLevel - 1) / 3) + (this.phase === 3 ? 1 : 0);

    // 渲染头顶悬浮的暗黑符箓阵
    this.renderOrbitCards(type, suit);

    // 蓄力红光脉冲
    tween(this.bodyRoot)
      .to(0.2, { scale: new Vec3(1.1, 1.1, 1) })
      .to(0.2, { scale: new Vec3(1.0, 1.0, 1), angle: 0 })
      .union()
      .repeatForever()
      .start();
  }

  // 绘制头顶展开的 3-5 张悬浮暗黑魔牌
  private renderOrbitCards(type: ComboType, suit: SuitType) {
    for (const child of [...this.cardOrbitRoot.children]) child.destroy();
    this.cardOrbitRoot.removeAllChildren();

    const count = type === 'fullhouse' ? 5 : type === 'straight' ? 5 : 3;
    const spacing = 26;

    for (let i = 0; i < count; i++) {
      const cNode = new Node(`OrbitCard_${i}`);
      const offset = (i - (count - 1) / 2) * spacing;
      cNode.setPosition(offset, 0, 0);
      this.cardOrbitRoot.addChild(cNode);

      // 如果是最后一张，作为“破牌核心破绽”，闪耀光芒
      const isWeakPoint = (i === Math.floor(count / 2));
      TalismanRenderer.drawCard(cNode, { id: i, suit, val: 10 + i }, 22, 32);

      if (isWeakPoint) {
        // 核心破绽牌闪耀红光，提示玩家击打
        const g = cNode.addComponent(Graphics);
        g.strokeColor = new Color(255, 40, 40, 220);
        g.lineWidth = 2;
        g.roundRect(-12, -17, 24, 34, 4);
        g.stroke();
      }

      // 卡牌轻微浮动
      tween(cNode)
        .by(0.4 + i * 0.1, { position: new Vec3(0, 6, 0) })
        .by(0.4 + i * 0.1, { position: new Vec3(0, -6, 0) })
        .union()
        .repeatForever()
        .start();
    }
  }

  // 承受玩家攻击
  takeDmg(amount: number): boolean {
    if (this.isDead) return false;

    this.hp -= amount;
    this.updateHpBar();

    // 检查阶段切换
    const ratio = this.hp / this.maxHp;
    if (this.phase === 1 && ratio <= 0.7) {
      this.phase = 2;
      this.triggerPhaseShift();
    } else if (this.phase === 2 && ratio <= 0.3) {
      this.phase = 3;
      this.triggerPhaseShift();
    }

    // 若正处于蓄力大招，受击累计破牌计数
    if (this.isCharging) {
      this.breakCount++;
      if (this.breakCount >= this.maxBreakCount) {
        // 成功破坏 Boss 牌型！
        this.breakChargeHand();
      }
    }

    if (this.hp <= 0) {
      this.playDeath();
      return true;
    }
    return false;
  }

  // 阶段转换动画
  private triggerPhaseShift() {
    // 震退周围并召唤爪牙
    if (this.onSummonMinions) {
      this.onSummonMinions(this.node.position);
    }

    // 符封崩裂：木石外壳震开、面具开合
    tween(this.bodyRoot)
      .to(0.1, { scale: new Vec3(1.22, 1.08, 1), angle: 4 })
      .to(0.2, { scale: new Vec3(1.0, 1.0, 1), angle: 0 })
      .start();
  }

  // 破牌成功：大招被打断，Boss 陷入虚弱眩晕硬直
  private breakChargeHand() {
    this.isCharging = false;
    this.isStunned = true;
    for (const child of [...this.cardOrbitRoot.children]) child.destroy();
    this.cardOrbitRoot.removeAllChildren();
    Tween.stopAllByTarget(this.bodyRoot);
    this.bodyRoot.setScale(1, 1, 1);

    // 产生符箓爆碎纸屑效果
    const shatterNode = new Node('BrokenSeal');
    this.node.addChild(shatterNode);
    shatterNode.setPosition(0, 70, 0);
    const sg = shatterNode.addComponent(Graphics);
    sg.fillColor = new Color(255, 230, 150);
    for (let i = 0; i < 12; i++) {
      sg.rect((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 4, 3);
    }
    sg.fill();

    tween(shatterNode)
      .by(0.4, { scale: new Vec3(2, 2, 1), position: new Vec3(0, -30, 0) })
      .call(() => shatterNode.destroy())
      .start();

    // 头顶冒出金星眩晕
    const stunStar = new Node('OpenMaskSeal');
    this.node.addChild(stunStar);
    stunStar.setPosition(0, 60, 0);
    const starG = stunStar.addComponent(Graphics);
    TalismanRenderer.drawStarBadge(starG, 0, 0, 12, new Color(255, 220, 50));

    tween(stunStar)
      .by(1.8, { angle: 720 })
      .call(() => stunStar.destroy())
      .start();

    // 破牌提供1.6秒反击窗口。
    this.stunTimer = 1.6;

    if (this.onHandBroken) {
      this.onHandBroken();
    }
  }

  // 蓄力超时未被打断，释放恐怖牌型大招
  private unleashCombo(targetPos: Vec3) {
    this.isCharging = false;
    for (const child of [...this.cardOrbitRoot.children]) child.destroy();
    this.cardOrbitRoot.removeAllChildren();
    Tween.stopAllByTarget(this.bodyRoot);
    this.bodyRoot.setScale(1, 1, 1);

    if (this.onBossFire) {
      this.onBossFire(this.node.position, targetPos, this.curBossCombo, this.curBossSuit);
    }
  }

  // 壮烈死亡倒地
  private playDeath() {
    this.isDead = true;
    for (const child of [...this.cardOrbitRoot.children]) child.destroy();
    this.cardOrbitRoot.removeAllChildren();
    this.bossHpBarNode.active = false;
    this.legLeftNode.active = false;
    this.legRightNode.active = false;

    // 礼帽跌落
    tween(this.headNode)
      .by(0.4, { position: new Vec3(-30, 20, 0), angle: -120 })
      .by(0.3, { position: new Vec3(-20, -50, 0) })
      .start();

    // 躯干跪地
    tween(this.bodyRoot)
      .to(0.5, { position: new Vec3(0, -18, 0), angle: 90 })
      .start();
  }

  // 每帧驱动 Boss 行为
  updateBoss(dt: number, heroPos: Vec3) {
    if (this.isDead) return;
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) this.isStunned = false;
      return;
    }

    this.animTimer += dt * 5;
    const myPos = this.node.position;
    const dx = heroPos.x - myPos.x;
    const dy = heroPos.y - myPos.y;

    // 面向主角
    this.node.setScale(dx < 0 ? -1 : 1, 1, 1);

    // 瞄准主角
    const rad = Math.atan2(dy, Math.abs(dx));
    this.armNode.angle = (rad * 180) / Math.PI;

    // Boss 沉稳漫步与双腿迈动
    if (!this.isCharging) {
      const legAngle = Math.sin(this.animTimer * 0.8) * 15;
      this.legLeftNode.angle = legAngle;
      this.legRightNode.angle = -legAngle;
      this.bodyRoot.setPosition(0, Math.sin(this.animTimer * 1.6) * 2, 0);
    } else {
      this.legLeftNode.angle = 0;
      this.legRightNode.angle = 0;
    }

    // 蓄力状态中处理
    if (this.isCharging) {
      this.chargeTimer += dt;
      if (this.chargeTimer >= this.maxChargeTime) {
        // 前摇结束，大招轰击！
        this.unleashCombo(heroPos);
      }
      return;
    }

    // 常规行动计时器
    this.actionTimer += dt;
    const attackInterval = (this.phase === 3 ? 1.6 : this.phase === 2 ? 2.4 : 3.0) /
      (1 + (this.curLevel - 1) * 0.035);

    if (this.actionTimer >= attackInterval) {
      this.actionTimer = 0;

      // 决定本次攻击：普通速射 vs 蓄力牌型大招
      const roll = Math.random();
      if (this.phase >= 2 && roll < 0.65) {
        // 蓄力大招
        const comboPool: ComboType[] = this.phase === 3 ? ['fullhouse', 'straight', 'trips'] : ['trips', 'pair'];
        const suitPool: SuitType[] = ['spade', 'diamond', 'club', 'heart'];
        const pickCombo = comboPool[Math.floor(Math.random() * comboPool.length)];
        const pickSuit = suitPool[Math.floor(Math.random() * suitPool.length)];
        this.startComboCharge(pickCombo, pickSuit);
      } else {
        // 普通点射
        if (this.onBossFire) {
          this.onBossFire(this.node.position, heroPos, 'single', 'spade');
        }
      }
    }
  }
}
