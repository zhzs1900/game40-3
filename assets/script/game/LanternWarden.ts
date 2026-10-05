// 巡夜师主角实体类
// 纯 Graphics 矢量分层骨骼节点绘制与待机、奔跑、拔枪、放符后坐力、闪避闪避动画

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';
import { GunType } from './NightTownData';

const { ccclass } = _decorator;

export type HeroAction = 'idle' | 'run' | 'roll' | 'hit' | 'dead';

@ccclass('LanternWarden')
export class LanternWarden extends Component {
  // 骨骼层级节点
  private bodyRoot!: Node;
  private headNode!: Node;
  private capeNode!: Node;
  private holsterNode!: Node;
  private armNode!: Node;
  private gunNode!: Node;
  private leftLegNode!: Node;
  private rightLegNode!: Node;
  private dustRoot!: Node;
  private shadowNode!: Node;

  // 基础属性
  public hp: number = 85;
  public maxHp: number = 85;
  public shield: number = 10; // 开局穿戴牛皮防弹背心
  public moveSpd: number = 220;
  public isInvincible: boolean = false; // 闪避或受击保护期间无敌

  // 动作与姿态
  public curAction: HeroAction = 'idle';
  private runTime: number = 0;
  private rollTimer: number = 0;
  private aimDir: Vec3 = new Vec3(1, 0, 0);
  private curGun: GunType = 'revolver';
  private dustTimer: number = 0;
  private smokeTimer: number = 0;

  // 身体受击红闪计时
  private hitFlashTimer: number = 0;
  // 复活金身无敌保护倒计时
  private reviveProtectTimer: number = 0;

  onLoad() {
    this.buildSkeleton();
  }

  // 构建分层骨骼节点树
  private buildSkeleton() {
    // 地面柔和阴影
    this.shadowNode = new Node('Shadow');
    this.shadowNode.setPosition(0, -22, 0);
    this.node.addChild(this.shadowNode);
    const sg = this.shadowNode.addComponent(Graphics);
    sg.fillColor = new Color(15, 10, 8, 80);
    sg.ellipse(0, 0, 22, 9);
    sg.fill();

    // 扬尘根节点
    this.dustRoot = new Node('DustRoot');
    this.node.addChild(this.dustRoot);

    // 腿部节点
    const legsRoot = new Node('LegsRoot');
    this.node.addChild(legsRoot);

    this.leftLegNode = new Node('LeftLeg');
    this.leftLegNode.setPosition(-8, -12, 0);
    legsRoot.addChild(this.leftLegNode);
    this.drawLeg(this.leftLegNode, true);

    this.rightLegNode = new Node('RightLeg');
    this.rightLegNode.setPosition(8, -12, 0);
    legsRoot.addChild(this.rightLegNode);
    this.drawLeg(this.rightLegNode, false);

    // 躯干根节点
    this.bodyRoot = new Node('BodyRoot');
    this.bodyRoot.setPosition(0, 0, 0);
    this.node.addChild(this.bodyRoot);

    // 飘动风衣后摆（层次位于身体之后）
    this.capeNode = new Node('Cape');
    this.capeNode.setPosition(0, 6, 0);
    this.bodyRoot.addChild(this.capeNode);
    this.drawCape(this.capeNode);

    // 身体躯干（马甲、衬衫、弹带、领巾）
    const torsoNode = new Node('Torso');
    this.bodyRoot.addChild(torsoNode);
    this.drawTorso(torsoNode);

    // 腰间枪套
    this.holsterNode = new Node('Holster');
    this.holsterNode.setPosition(12, 0, 0);
    this.bodyRoot.addChild(this.holsterNode);
    this.drawHolster(this.holsterNode);

    // 头部（脸型、短须、雪茄、帅气巡夜师宽檐帽）
    this.headNode = new Node('Head');
    this.headNode.setPosition(0, 24, 0);
    this.bodyRoot.addChild(this.headNode);
    this.drawHead(this.headNode);

    // 持枪手臂与符灯
    this.armNode = new Node('GunArm');
    this.armNode.setPosition(6, 12, 0);
    this.bodyRoot.addChild(this.armNode);
    this.drawArm(this.armNode);

    this.gunNode = new Node('GunModel');
    this.gunNode.setPosition(18, 0, 0);
    this.armNode.addChild(this.gunNode);
    this.drawGun(this.gunNode, this.curGun);
  }

  // 绘制腿部与皮马靴、银色马刺
  private drawLeg(node: Node, isLeft: boolean) {
    const g=node.addComponent(Graphics); g.clear();
    const side=isLeft?-1:1;
    g.fillColor=new Color(37,48,75); g.moveTo(-5,2);g.lineTo(5,2);g.lineTo(4,-15);g.lineTo(-4,-15);g.close();g.fill();
    g.strokeColor=new Color(96,111,143);g.lineWidth=1.2;g.moveTo(side*1,0);g.lineTo(side*2,-13);g.stroke();
    g.fillColor=new Color(27,28,39);g.roundRect(-5,-20,10,7,2);g.fill();
    g.strokeColor=new Color(183,142,80);g.lineWidth=1;g.moveTo(-4,-17);g.lineTo(4,-17);g.stroke();
    g.fillColor=new Color(161,49,44);g.rect(side>0?2:-4,-9,2,6);g.fill();
  }

  // 绘制长风衣下摆（双层披肩、撕裂毛边与风衣暗褶）
  private drawCape(node: Node) {
    const g=node.addComponent(Graphics); g.clear();
    g.fillColor=new Color(29,42,70);g.moveTo(-14,4);g.bezierCurveTo(-20,-5,-17,-24,-10,-31);g.lineTo(-2,-25);g.lineTo(2,-32);g.lineTo(11,-25);g.bezierCurveTo(18,-13,19,-2,13,4);g.close();g.fill();
    g.fillColor=new Color(48,61,91);g.moveTo(-12,3);g.lineTo(12,3);g.lineTo(9,-8);g.bezierCurveTo(2,-4,-3,-4,-10,-9);g.close();g.fill();
    g.strokeColor=new Color(119,135,169);g.lineWidth=1.2;g.moveTo(-9,-5);g.bezierCurveTo(-3,-10,2,-4,8,-9);g.moveTo(-8,-17);g.bezierCurveTo(-1,-21,3,-15,9,-20);g.stroke();
    g.fillColor=new Color(179,51,46);g.moveTo(7,-19);g.lineTo(13,-25);g.lineTo(9,-11);g.close();g.fill();
  }

  // 绘制躯干（亚麻开领衬衫、做旧皮背心、立体飞符带）
  private drawTorso(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(228,219,192);g.roundRect(-10,-5,20,26,4);g.fill();
    g.fillColor=new Color(42,57,88);g.moveTo(-11,20);g.lineTo(-2,20);g.lineTo(0,4);g.lineTo(-10,-4);g.close();g.fill();
    g.moveTo(11,20);g.lineTo(2,20);g.lineTo(0,4);g.lineTo(10,-4);g.close();g.fill();
    g.strokeColor=new Color(170,50,45);g.lineWidth=2;g.moveTo(-1,18);g.bezierCurveTo(-6,12,5,9,-2,3);g.bezierCurveTo(4,0,-4,-3,3,-6);g.stroke();
    g.fillColor=new Color(173,53,47);g.rect(-11,-5,22,4);g.fill();
    g.strokeColor=new Color(218,176,93);g.lineWidth=1.4;g.moveTo(-9,-2);g.lineTo(9,-2);g.stroke();
    g.fillColor=new Color(220,197,139);g.roundRect(-14,-4,7,12,2);g.fill();
    g.strokeColor=new Color(173,53,47);g.lineWidth=1;g.moveTo(-12,5);g.lineTo(-8,-1);g.stroke();
  }

  // 绘制腰间皮枪套（大腿系腿皮绳与雕花铜带扣）
  private drawHolster(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(96,66,48);g.roundRect(-7,-2,14,5,2);g.fill();
    g.fillColor=new Color(224,204,151);g.moveTo(-2,-2);g.lineTo(6,-2);g.lineTo(5,-16);g.lineTo(-4,-14);g.close();g.fill();
    g.strokeColor=new Color(177,51,45);g.lineWidth=1.5;g.moveTo(-1,-5);g.lineTo(4,-12);g.moveTo(4,-5);g.lineTo(-1,-12);g.stroke();
    g.fillColor=new Color(219,174,82);g.circle(-5,0,1.7);g.fill();
  }

  // 绘制头部、巡夜师宽檐帽、斜插羽毛、微斑胡茬与雪茄
  private drawHead(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(228,181,145);g.roundRect(-7,-4,14,15,4);g.fill();
    g.strokeColor=new Color(48,36,33);g.lineWidth=1.4;g.moveTo(-5,6);g.lineTo(-1,7);g.moveTo(1,7);g.lineTo(5,6);g.stroke();
    g.fillColor=new Color(28,27,31);g.circle(-2.6,4.2,1);g.circle(2.6,4.2,1);g.fill();
    g.strokeColor=new Color(131,70,52);g.lineWidth=1;g.moveTo(-2,-1);g.bezierCurveTo(0,-2,2,-2,4,-1);g.stroke();
    g.fillColor=new Color(27,31,43);g.moveTo(-8,10);g.bezierCurveTo(-6,20,-2,23,0,25);g.bezierCurveTo(4,22,8,18,8,10);g.close();g.fill();
    g.fillColor=new Color(35,39,54);g.ellipse(0,11,15,3);g.fill();
    g.strokeColor=new Color(177,52,46);g.lineWidth=2;g.moveTo(-7,13);g.lineTo(7,13);g.stroke();
    g.strokeColor=new Color(216,174,91);g.lineWidth=1.2;g.moveTo(7,17);g.bezierCurveTo(13,22,13,27,10,30);g.stroke();
  }

  // 绘制手臂与皮手套
  private drawArm(node: Node) {
    const g=node.addComponent(Graphics);g.clear();
    g.fillColor=new Color(44,58,88);g.roundRect(0,-4,15,8,3);g.fill();
    g.strokeColor=new Color(113,132,164);g.lineWidth=1;g.moveTo(3,2);g.lineTo(10,-2);g.stroke();
    g.fillColor=new Color(219,178,142);g.circle(16,0,4);g.fill();
    g.fillColor=new Color(178,52,46);g.rect(10,-4,3,8);g.fill();
  }

  // 绘制符灯模型（全面提升5种武器的细节结构）
  private drawGun(node: Node, gun: GunType) {
    let g=node.getComponent(Graphics);if(!g)g=node.addComponent(Graphics);g.clear();
    if(gun==='revolver'){
      g.strokeColor=new Color(184,138,75);g.lineWidth=3;g.moveTo(-2,0);g.lineTo(10,0);g.stroke();
      g.fillColor=new Color(198,151,78);g.circle(11,0,5);g.fill();
      g.fillColor=new Color(255,213,112,210);g.ellipse(11,0,3,4);g.fill();
      g.strokeColor=new Color(177,51,45);g.lineWidth=1.5;g.moveTo(9,3);g.lineTo(13,-3);g.stroke();
    } else if(gun==='lever'){
      g.fillColor=new Color(224,207,158);g.roundRect(-3,-5,25,10,2);g.fill();
      g.strokeColor=new Color(165,48,43);g.lineWidth=2;g.moveTo(1,2);g.bezierCurveTo(7,7,12,-5,19,2);g.stroke();
      g.fillColor=new Color(218,176,86);g.rect(20,-3,6,6);g.fill();
    } else if(gun==='shotgun'){
      g.fillColor=new Color(224,207,158);g.moveTo(-2,-7);g.lineTo(24,-4);g.lineTo(24,4);g.lineTo(-2,7);g.close();g.fill();
      g.strokeColor=new Color(181,51,46);g.lineWidth=2;g.moveTo(2,-3);g.lineTo(20,0);g.moveTo(2,3);g.lineTo(20,0);g.stroke();
      g.fillColor=new Color(245,158,67,210);g.circle(24,0,4);g.fill();
    } else if(gun==='bounce'){
      g.fillColor=new Color(212,199,151);g.roundRect(-2,-5,20,10,3);g.fill();
      g.strokeColor=new Color(76,129,123);g.lineWidth=2;g.moveTo(1,2);g.bezierCurveTo(6,7,12,-6,17,1);g.stroke();
      g.fillColor=new Color(118,177,163);g.circle(19,0,4);g.fill();
    } else {
      g.fillColor=new Color(58,48,69);g.roundRect(-4,-7,28,14,4);g.fill();
      g.strokeColor=new Color(219,177,87);g.lineWidth=2;g.roundRect(1,-5,18,10,3);g.stroke();
      g.fillColor=new Color(178,52,47);g.moveTo(6,4);g.lineTo(12,-4);g.lineTo(18,4);g.close();g.fill();
    }
  }

  // 换枪刷新模型
  switchGun(newGun: GunType) {
    this.curGun = newGun;
    this.drawGun(this.gunNode, newGun);
  }

  // 设置瞄准方向（武器手臂平滑指向目标）
  setAim(dir: Vec3) {
    this.aimDir.set(dir).normalize();
    const rad = Math.atan2(this.aimDir.y, this.aimDir.x);
    let deg = (rad * 180) / Math.PI;

    // 水平翻转身体朝向
    if (this.aimDir.x < 0) {
      this.node.setScale(-1, 1, 1);
      deg = 180 - deg;
    } else {
      this.node.setScale(1, 1, 1);
    }
    this.armNode.angle = deg;
  }

  // 获得符灯发射点世界坐标
  getMuzzlePos(): Vec3 {
    const tip = new Vec3(22, 0, 0);
    const armPos = this.armNode.position;
    const bodyPos = this.bodyRoot.position;
    const nodePos = this.node.position;

    // 计算旋转偏移
    const rad = (this.armNode.angle * Math.PI) / 180;
    const facing = this.node.scale.x;
    const wx = nodePos.x + (bodyPos.x + armPos.x + tip.x * Math.cos(rad)) * facing;
    const wy = nodePos.y + bodyPos.y + armPos.y + tip.x * Math.sin(rad);
    return new Vec3(wx, wy, 0);
  }

  // 执行闪避闪避动作（360度旋转、扬尘、无敌判定）
  startRoll(dir: Vec3, onDone?: () => void) {
    if (this.curAction === 'roll' || this.curAction === 'dead') return;
    this.curAction = 'roll';
    this.isInvincible = true;
    this.rollTimer = 0.35;

    // 闪避时扬起剧烈的连环沙暴气团
    for (let i = 0; i < 6; i++) {
      this.scheduleOnce(() => {
        if (this.isValid) this.spawnDustPuff();
      }, i * 0.05);
    }

    // 自身旋转闪避一圈
    const spinDeg = dir.x >= 0 ? -360 : 360;
    tween(this.bodyRoot)
      .by(0.35, { angle: spinDeg, position: new Vec3(0, 8, 0) }, { easing: 'quadOut' })
      .to(0.05, { position: new Vec3(0, 0, 0), angle: 0 })
      .call(() => {
        if (this.curAction !== 'roll') return;
        this.isInvincible = this.reviveProtectTimer > 0;
        if (onDone) onDone();
      })
      .start();
  }

  // 放符后坐力动作动画与抛壳
  playShootRecoil() {
    if (this.curAction === 'roll' || this.curAction === 'dead') return;

    // 符灯猛烈后拉并微抬
    tween(this.gunNode)
      .to(0.04, { position: new Vec3(10, 4, 0), angle: 18 })
      .to(0.12, { position: new Vec3(18, 0, 0), angle: 0 }, { easing: 'bounceOut' })
      .start();

    // 身体微微后仰承受后坐力
    tween(this.bodyRoot)
      .to(0.04, { position: new Vec3(-3, 0, 0) })
      .to(0.1, { position: new Vec3(0, 0, 0) })
      .start();

    // 抛出跳动旋转的黄铜弹壳
    this.spawnShellCasing();
  }

  // 抛出金黄弹壳
  private spawnShellCasing() {
    const parent = this.node.parent;
    if (!parent) return;

    const casing = new Node('ShellCasing');
    const muzzle = this.getMuzzlePos();
    casing.setPosition(muzzle.x - 12, muzzle.y + 2, 0);
    parent.addChild(casing);

    const g = casing.addComponent(Graphics);
    g.fillColor = new Color(255, 215, 65);
    g.roundRect(-2.5, -1, 5, 2, 0.5);
    g.fill();

    const facing = this.node.scale.x;
    tween(casing)
      .by(0.22, { position: new Vec3(-facing * (18 + Math.random() * 12), 16 + Math.random() * 8, 0), angle: 480 }, { easing: 'quadOut' })
      .by(0.18, { position: new Vec3(-facing * 8, -32, 0), angle: 240 }, { easing: 'quadIn' })
      .call(() => casing.destroy())
      .start();
  }

  // 受到伤害受击
  takeDmg(amount: number): boolean {
    if (this.isInvincible || this.curAction === 'dead') return false;

    // 优先扣护盾
    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        amount = 0;
      } else {
        amount -= this.shield;
        this.shield = 0;
      }
    }

    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.15;
    // 受击后提供 0.45 秒短暂无敌保护时间，防止同一帧或连续弹幕瞬间暴毙
    this.isInvincible = true;
    this.reviveProtectTimer = 0.45;

    // 身体受击震颤
    tween(this.bodyRoot)
      .to(0.05, { position: new Vec3(-4, 0, 0) })
      .to(0.05, { position: new Vec3(3, 0, 0) })
      .to(0.05, { position: new Vec3(0, 0, 0) })
      .start();

    if (this.hp <= 0) {
      this.playDeath();
      return true; // 死亡
    }
    return false;
  }

  // 恢复生命值
  heal(val: number) {
    if (this.curAction === 'dead') return;
    this.hp = Math.min(this.maxHp, this.hp + val);
  }

  // 增加护盾
  addShield(val: number) {
    this.shield = Math.min(40, this.shield + val);
  }

  // 绝处逢生：恢复70%生命、10点护盾与2秒无敌保护。
  revive() {
    this.hp = Math.ceil(this.maxHp * 0.7);
    this.shield = 10;
    this.curAction = 'idle';
    this.isInvincible = true;
    this.reviveProtectTimer = 2.0;

    // 身体骨骼瞬间立起归位
    this.bodyRoot.setPosition(0, 0, 0);
    this.bodyRoot.angle = 0;
    this.node.setScale(1, 1, 1);
  }

  // 悲壮倒地死亡动画（帽子飞出、武器脱手、身体倒地）
  private playDeath() {
    this.curAction = 'dead';

    // 身体向后瘫倒
    tween(this.bodyRoot)
      .to(0.35, { position: new Vec3(-10, -14, 0), angle: -85 }, { easing: 'quadIn' })
      .start();

    // 巡夜师帽子闪避脱落飞出
    const flyHat = new Node('FlyHat');
    this.node.parent?.addChild(flyHat);
    flyHat.setPosition(this.node.position.x, this.node.position.y + 24, 0);
    const g = flyHat.addComponent(Graphics);
    g.fillColor = new Color(68, 40, 22);
    g.ellipse(0, 0, 23, 6);
    g.fill();
    g.fillColor = new Color(82, 48, 26);
    g.roundRect(-10, 0, 20, 12, 3);
    g.fill();

    tween(flyHat)
      .by(0.45, { position: new Vec3(50, 40, 0), angle: 360 }, { easing: 'quadOut' })
      .by(0.3, { position: new Vec3(25, -60, 0), angle: 180 }, { easing: 'quadIn' })
      .start();
  }

  // 生成脚下飞扬的荒野蓬松沙尘群
  private spawnDustPuff() {
    const parentNode = this.dustRoot.parent || this.node.parent;
    if (!parentNode) return;

    for (let i = 0; i < 2; i++) {
      const dNode = new Node('Dust');
      const side = (Math.random() - 0.5) * 14;
      dNode.setPosition(this.node.position.x + side, this.node.position.y - 18, 0);
      parentNode.addChild(dNode);

      const g = dNode.addComponent(Graphics);
      // 土黄色做旧蓬松烟尘
      g.fillColor = new Color(210, 185, 145, 160);
      g.circle(0, 0, 4.5 + Math.random() * 4);
      g.fill();
      g.fillColor = new Color(230, 210, 175, 100);
      g.circle(1, 1, 2.5);
      g.fill();

      const driftX = -side * 1.5 + (Math.random() - 0.5) * 8;
      const driftY = 10 + Math.random() * 12;

      tween(dNode)
        .to(0.32, {
          position: new Vec3(dNode.position.x + driftX, dNode.position.y + driftY, 0),
          scale: new Vec3(2.0, 2.0, 1)
        })
        .call(() => dNode.destroy())
        .start();
    }
  }

  // 雪茄袅袅青烟
  private spawnCigarSmoke() {
    const parent = this.node.parent;
    if (!parent) return;

    const smoke = new Node('CigarSmoke');
    const facing = this.node.scale.x;
    smoke.setPosition(this.node.position.x + facing * 8, this.node.position.y + 26, 0);
    parent.addChild(smoke);

    const g = smoke.addComponent(Graphics);
    g.fillColor = new Color(230, 230, 235, 120);
    g.circle(0, 0, 2);
    g.fill();

    tween(smoke)
      .to(0.4, {
        position: new Vec3(smoke.position.x - facing * 6 + (Math.random() - 0.5) * 6, smoke.position.y + 16, 0),
        scale: new Vec3(2.5, 2.5, 1)
      })
      .call(() => smoke.destroy())
      .start();
  }

  // 帧循环驱动呼吸、跑动骨骼姿态、压扁弹起与沙尘
  updateActor(dt: number, isMoving: boolean) {
    if (this.curAction === 'dead') return;

    // 复活无敌金身倒计时
    if (this.reviveProtectTimer > 0) {
      this.reviveProtectTimer -= dt;
      if (this.reviveProtectTimer <= 0) {
        this.isInvincible = this.curAction === 'roll';
      }
    }

    if (this.curAction === 'roll') {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.curAction = 'idle';
        this.isInvincible = this.reviveProtectTimer > 0;
      }
      return;
    }

    // 雪茄袅袅青烟
    this.smokeTimer += dt;
    if (this.smokeTimer >= 0.4) {
      this.smokeTimer = 0;
      this.spawnCigarSmoke();
    }

    if (isMoving) {
      this.curAction = 'run';
      this.runTime += dt * 12;

      // 双腿交替大步迈动
      const legAngle = Math.sin(this.runTime) * 35;
      this.leftLegNode.angle = legAngle;
      this.rightLegNode.angle = -legAngle;

      // 躯干压扁拉伸与跑步颠簸（生动的弹簧质感）
      const squash = 1 + Math.sin(this.runTime * 2) * 0.07;
      this.bodyRoot.setScale(1 / squash, squash, 1);
      this.bodyRoot.setPosition(0, Math.abs(Math.sin(this.runTime)) * 3.5, 0);

      // 奔跑时身体与头部随节奏微晃
      this.bodyRoot.angle = Math.sin(this.runTime) * 4;
      this.headNode.setPosition(0, 30 + Math.sin(this.runTime * 2) * 1.5, 0);

      // 风衣后摆随风大幅剧烈波浪翻卷
      this.capeNode.angle = -22 - Math.abs(Math.sin(this.runTime)) * 30 + Math.sin(this.runTime * 3) * 6;

      // 枪套晃动
      this.holsterNode.angle = Math.sin(this.runTime * 0.8) * 16;

      // 脚步扬尘
      this.dustTimer += dt;
      if (this.dustTimer >= 0.12) {
        this.dustTimer = 0;
        this.spawnDustPuff();
      }
    } else {
      this.curAction = 'idle';
      this.runTime += dt * 2.5;

      // 待机轻缓呼吸起伏（微压扁拉伸）
      const breath = Math.sin(this.runTime) * 0.03;
      this.bodyRoot.setScale(1 - breath, 1 + breath, 1);
      this.bodyRoot.setPosition(0, Math.sin(this.runTime) * 1.5, 0);
      this.bodyRoot.angle = 0;
      this.headNode.setPosition(0, 30, 0);

      this.leftLegNode.angle = 0;
      this.rightLegNode.angle = 0;
      this.capeNode.angle = Math.sin(this.runTime) * 5;
      this.holsterNode.angle = 0;
    }
  }
}
