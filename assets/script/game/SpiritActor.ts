// 敌人实体系统
// 涵盖近战兽祟、双枪游魂、重甲喷子、爆符傀儡、骑兽夜叉
// 具备完整肢体骨骼、真实迈腿奔跑动画、丰富的服饰纹理与击杀滑行动画

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

export type EnemyKind = 'brawler' | 'gunner' | 'shotgunner' | 'bomber' | 'rider';

@ccclass('SpiritActor')
export class SpiritActor extends Component {
  public kind: EnemyKind = 'gunner';
  public hp: number = 90;
  public maxHp: number = 90;
  public spd: number = 100;
  public atkDmg: number = 14;
  public atkRange: number = 260;
  public isElite: boolean = false;
  public isDead: boolean = false;

  // 内部节点骨骼（躯干、双腿、头部、手臂武器与坐骑）
  private shadowNode!: Node;
  private legLeftNode!: Node;
  private legRightNode!: Node;
  private bodyRoot!: Node;
  private torsoNode!: Node;
  private headNode!: Node;
  private armNode!: Node;
  private weaponNode!: Node;
  private horseNode?: Node;
  private horseBodyNode?: Node;
  private horseFrontLeg?: Node;
  private horseBackLeg?: Node;
  private horseHeadNode?: Node;
  private horseTailNode?: Node;
  private hpBarNode!: Node;

  // 计时与动画控制
  private shootCool: number = 1.8;
  private animTimer: number = 0;
  private prepShoot: number = 0;
  private dustTimer: number = 0;
  private residualSlowTimer: number = 0;
  private residualSlowFactor: number = 1;

  // 驱邪回调（通知 LanternNightScene 投射飞符）
  public onEnemyFire?: (fromPos: Vec3, toPos: Vec3, dmg: number) => void;

  onLoad() {
    this.buildSkeleton();
  }

  // 初始化兵种数据与外貌
  init(kind: EnemyKind, isElite: boolean = false, level: number = 1) {
    this.kind = kind;
    this.isElite = isElite;
    const hpMul = 1 + (level - 1) * 0.12;

    switch (kind) {
      case 'brawler':
        this.maxHp = Math.round(76 * hpMul);
        this.spd = 130;
        this.atkDmg = 12;
        this.atkRange = 50;
        this.shootCool = 1.3;
        break;
      case 'gunner':
        this.maxHp = Math.round(90 * hpMul);
        this.spd = 85;
        this.atkDmg = 14;
        this.atkRange = 300;
        this.shootCool = 2.1;
        break;
      case 'shotgunner':
        this.maxHp = Math.round(125 * hpMul);
        this.spd = 65;
        this.atkDmg = 18;
        this.atkRange = 200;
        this.shootCool = 2.6;
        break;
      case 'bomber':
        this.maxHp = Math.round(70 * hpMul);
        this.spd = 140;
        this.atkDmg = 22;
        this.atkRange = 40;
        this.shootCool = 1.4;
        break;
      case 'rider':
        this.maxHp = Math.round(155 * hpMul);
        this.spd = 180;
        this.atkDmg = 16;
        this.atkRange = 280;
        this.shootCool = 2.0;
        break;
    }

    this.atkDmg = Math.round(this.atkDmg * (1 + (level - 1) * 0.06));
    this.shootCool /= 1 + (level - 1) * 0.035;
    this.spd *= 1 + (level - 1) * 0.012;

    // 精英怪拥有更高的属性
    if (isElite) {
      this.maxHp = Math.round(this.maxHp * 1.8);
      this.spd *= 1.15;
      this.atkDmg = Math.round(this.atkDmg * 1.25);
    }
    this.hp = this.maxHp;

    // 重新根据兵种绘制全身造型与武器细节
    this.redrawVisuals();
    this.updateHpBar();
  }

  // 搭建分层骨骼节点树
  private buildSkeleton() {
    // 脚底阴影
    this.shadowNode = new Node('Shadow');
    this.shadowNode.setPosition(0, -22, 0);
    this.node.addChild(this.shadowNode);
    const sg = this.shadowNode.addComponent(Graphics);
    sg.fillColor = new Color(15, 10, 8, 80);
    sg.ellipse(0, 0, 20, 8);
    sg.fill();

    // 独立左右腿（走路奔跑时交替摆动，彻底告别单块灵印）
    this.legLeftNode = new Node('LegL');
    this.legLeftNode.setPosition(-5, -6, 0);
    this.node.addChild(this.legLeftNode);

    this.legRightNode = new Node('LegR');
    this.legRightNode.setPosition(5, -6, 0);
    this.node.addChild(this.legRightNode);

    // 躯干层
    this.bodyRoot = new Node('BodyRoot');
    this.node.addChild(this.bodyRoot);

    this.torsoNode = new Node('Torso');
    this.bodyRoot.addChild(this.torsoNode);

    // 头部
    this.headNode = new Node('Head');
    this.headNode.setPosition(0, 20, 0);
    this.bodyRoot.addChild(this.headNode);

    // 手臂与武器
    this.armNode = new Node('Arm');
    this.armNode.setPosition(6, 9, 0);
    this.bodyRoot.addChild(this.armNode);

    this.weaponNode = new Node('Weapon');
    this.weaponNode.setPosition(15, 0, 0);
    this.armNode.addChild(this.weaponNode);

    // 头顶小血条
    this.hpBarNode = new Node('HpBar');
    this.hpBarNode.setPosition(0, 48, 0);
    this.node.addChild(this.hpBarNode);
  }

  // 细致绘制各类敌人造型（马匹、头巾、重甲、炸药等）
  private redrawVisuals() {
    // 骑兽夜叉特殊处理：隐藏双腿，生成夜兽
    if (this.kind === 'rider') {
      this.legLeftNode.active = false;
      this.legRightNode.active = false;
      if (!this.horseNode) {
        this.horseNode = new Node('Horse');
        this.horseNode.setPosition(0, -6, 0);
        this.node.addChild(this.horseNode);
      }
      this.drawHorse(this.horseNode);
      this.bodyRoot.setPosition(0, 16, 0);
    } else {
      if (this.horseNode) {
        this.horseNode.destroy();
        this.horseNode = undefined;
      }
      this.legLeftNode.active = true;
      this.legRightNode.active = true;
      this.bodyRoot.setPosition(0, 0, 0);

      // 绘制左右腿
      this.drawEnemyLeg(this.legLeftNode, true);
      this.drawEnemyLeg(this.legRightNode, false);
    }

    // 绘制躯干、头部与武器
    this.drawEnemyTorso(this.torsoNode);
    this.drawEnemyHead(this.headNode);
    this.drawEnemyWeapon(this.weaponNode);
  }

  // 绘制敌人双腿（五类邪祟各自不同的下肢、纸片、兽足与夜行结构）
  private drawEnemyLeg(node: Node, isLeft: boolean) {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics); g.clear();
    const sx = isLeft ? -1 : 1;
    if (this.kind === 'brawler') {
      g.fillColor = new Color(47, 43, 55); g.moveTo(-5,-2); g.lineTo(4,-4); g.lineTo(7,-15); g.lineTo(1,-20); g.lineTo(-7,-14); g.close(); g.fill();
      g.fillColor = new Color(101, 86, 72); g.moveTo(sx*2,-15); g.lineTo(sx*10,-21); g.lineTo(sx*4,-19); g.close(); g.fill();
      g.strokeColor = new Color(169,57,51); g.lineWidth=1.5; g.moveTo(-3,-7); g.lineTo(3,-11); g.stroke();
    } else if (this.kind === 'gunner') {
      g.fillColor = new Color(71, 82, 111, 130); g.moveTo(-5,0); g.bezierCurveTo(-8,-8,-5,-16,-2,-21); g.lineTo(2,-21); g.bezierCurveTo(6,-15,7,-7,5,0); g.close(); g.fill();
      g.strokeColor = new Color(219,188,115,150); g.lineWidth=1; g.moveTo(-4,-11); g.bezierCurveTo(0,-14,3,-8,5,-15); g.stroke();
    } else if (this.kind === 'shotgunner') {
      g.fillColor = new Color(226, 216, 183); g.moveTo(-5,0); g.lineTo(5,0); g.lineTo(4,-17); g.lineTo(-4,-17); g.close(); g.fill();
      g.strokeColor = new Color(151,48,44); g.lineWidth=1.4; g.moveTo(-4,-6); g.lineTo(4,-9); g.moveTo(-4,-13); g.lineTo(4,-15); g.stroke();
      g.fillColor = new Color(42,35,48); g.roundRect(-5,-20,10,4,1); g.fill();
    } else if (this.kind === 'bomber') {
      g.fillColor = new Color(205, 190, 153); g.moveTo(-4,0); g.lineTo(5,-2); g.lineTo(3,-18); g.lineTo(-6,-15); g.close(); g.fill();
      g.strokeColor = new Color(184,51,45); g.lineWidth=2; g.moveTo(-4,-4); g.lineTo(4,-14); g.moveTo(3,-5); g.lineTo(-4,-13); g.stroke();
    } else {
      g.fillColor = new Color(56, 41, 65); g.roundRect(-4,-15,8,16,3); g.fill();
      g.fillColor = new Color(186,56,48); g.rect(-4,-8,8,3); g.fill();
      g.fillColor = new Color(29,27,35); g.roundRect(-5,-20,10,6,2); g.fill();
    }
  }

  // 绘制敌人躯干（彻底告别单一色块，丰富呈现不同职业装束）
  private drawEnemyTorso(node: Node) {
    const g=node.getComponent(Graphics)||node.addComponent(Graphics); g.clear();
    if(this.kind==='brawler'){
      g.fillColor=new Color(53,50,61); g.moveTo(-13,16); g.bezierCurveTo(-18,9,-17,-5,-8,-9); g.lineTo(9,-7); g.bezierCurveTo(17,-2,16,11,11,17); g.close(); g.fill();
      g.fillColor=new Color(110,91,72); g.moveTo(-9,4); g.lineTo(0,12); g.lineTo(9,4); g.lineTo(4,-5); g.lineTo(-5,-5); g.close(); g.fill();
      g.strokeColor=new Color(170,52,47); g.lineWidth=2; g.moveTo(-6,1); g.bezierCurveTo(-1,6,3,-4,7,2); g.stroke();
    } else if(this.kind==='gunner'){
      g.fillColor=new Color(46,55,87,170); g.moveTo(-11,18); g.lineTo(11,18); g.bezierCurveTo(15,5,13,-13,5,-24); g.bezierCurveTo(1,-16,-4,-16,-8,-25); g.bezierCurveTo(-15,-10,-16,6,-11,18); g.close(); g.fill();
      g.strokeColor=new Color(105,132,168,180); g.lineWidth=1.5; g.moveTo(-7,12); g.bezierCurveTo(-2,4,3,10,8,0); g.moveTo(-9,4); g.bezierCurveTo(-2,-5,5,1,9,-10); g.stroke();
    } else if(this.kind==='shotgunner'){
      g.fillColor=new Color(226,214,177); g.moveTo(0,23); g.lineTo(26,2); g.lineTo(0,-18); g.lineTo(-26,2); g.close(); g.fill();
      g.strokeColor=new Color(142,47,43); g.lineWidth=2;
      for(let a=-20;a<=20;a+=10){g.moveTo(0,3); g.lineTo(a, a<0?-8:12);} g.stroke();
      g.fillColor=new Color(38,38,49); g.circle(0,3,5); g.fill();
    } else if(this.kind==='bomber'){
      g.fillColor=new Color(218,199,157); g.moveTo(-12,17); g.lineTo(10,18); g.lineTo(13,-10); g.lineTo(-10,-13); g.close(); g.fill();
      g.strokeColor=new Color(174,49,44); g.lineWidth=2; g.moveTo(-9,12); g.lineTo(8,-8); g.moveTo(8,13); g.lineTo(-7,-9); g.stroke();
      for(let y=8;y>=-6;y-=7){g.fillColor=new Color(139,39,39); g.rect(-3,y,6,3); g.fill();}
    } else {
      g.fillColor=new Color(68,41,79); g.moveTo(-14,18); g.lineTo(14,18); g.lineTo(18,-7); g.lineTo(-18,-7); g.close(); g.fill();
      g.fillColor=new Color(189,55,48); g.moveTo(-17,7); g.lineTo(17,7); g.lineTo(13,1); g.lineTo(-13,1); g.close(); g.fill();
      g.strokeColor=new Color(225,182,91); g.lineWidth=1.5; g.moveTo(-12,14); g.lineTo(10,-3); g.stroke();
    }
    if(this.isElite){ g.strokeColor=new Color(244,197,97); g.lineWidth=2; g.roundRect(-16,-14,32,38,7); g.stroke(); }
  }

  // 绘制敌人头部（丰富五官、刀疤、面巾、桶盔与风镜）
  private drawEnemyHead(node: Node) {
    const g=node.getComponent(Graphics)||node.addComponent(Graphics); g.clear();
    if(this.kind==='brawler'){
      g.fillColor=new Color(89,76,69); g.moveTo(-10,-5); g.lineTo(-9,9); g.lineTo(-4,15); g.lineTo(0,10); g.lineTo(5,15); g.lineTo(10,8); g.lineTo(9,-5); g.close(); g.fill();
      g.fillColor=new Color(237,208,121); g.ellipse(-4,4,2.8,1.5); g.ellipse(4,4,2.8,1.5); g.fill();
      g.fillColor=new Color(38,28,28); g.moveTo(-5,-2); g.lineTo(0,-7); g.lineTo(5,-2); g.lineTo(0,0); g.close(); g.fill();
    } else if(this.kind==='gunner'){
      g.fillColor=new Color(188,202,207,125); g.ellipse(0,3,8,12); g.fill();
      g.fillColor=new Color(231,197,105,200); g.circle(-3,5,1.3); g.circle(3,5,1.3); g.fill();
      g.strokeColor=new Color(98,114,147,170); g.lineWidth=2; g.moveTo(-8,11); g.bezierCurveTo(-14,8,-14,-2,-10,-8); g.moveTo(8,11); g.bezierCurveTo(14,8,14,-2,10,-8); g.stroke();
    } else if(this.kind==='shotgunner'){
      g.fillColor=new Color(238,225,191); g.circle(0,2,10); g.fill();
      g.strokeColor=new Color(151,49,44); g.lineWidth=2; for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(0,2);g.lineTo(Math.cos(a)*10,2+Math.sin(a)*10);} g.stroke();
      g.fillColor=new Color(26,24,32); g.ellipse(0,2,3,2); g.fill();
    } else if(this.kind==='bomber'){
      g.fillColor=new Color(217,201,164); g.moveTo(-8,-5);g.lineTo(-7,9);g.lineTo(0,14);g.lineTo(8,8);g.lineTo(7,-6);g.close();g.fill();
      g.strokeColor=new Color(163,45,43);g.lineWidth=2;g.moveTo(-5,8);g.lineTo(5,-3);g.moveTo(5,8);g.lineTo(-4,-4);g.stroke();
      g.fillColor=new Color(35,29,35);g.circle(-3,3,1.5);g.circle(3,3,1.5);g.fill();
    } else {
      g.fillColor=new Color(105,78,68); g.roundRect(-7,-5,14,15,4); g.fill();
      g.fillColor=new Color(34,27,42); g.moveTo(-9,11);g.lineTo(0,19);g.lineTo(9,11);g.lineTo(6,7);g.lineTo(-6,7);g.close();g.fill();
      g.fillColor=new Color(230,183,89);g.circle(-2.7,4,1.2);g.circle(2.7,4,1.2);g.fill();
    }
  }

  // 绘制敌人武器（极高写实细节刻画）
  private drawEnemyWeapon(node: Node) {
    const g=node.getComponent(Graphics)||node.addComponent(Graphics); g.clear();
    if(this.kind==='brawler'){
      g.strokeColor=new Color(125,82,63);g.lineWidth=4;g.moveTo(-4,0);g.lineTo(13,1);g.stroke();
      g.fillColor=new Color(118,104,83);g.moveTo(12,-5);g.bezierCurveTo(23,-2,24,6,13,9);g.lineTo(17,2);g.close();g.fill();
    } else if(this.kind==='gunner'){
      g.strokeColor=new Color(201,160,83);g.lineWidth=2;g.moveTo(0,0);g.lineTo(16,-4);g.stroke();
      g.fillColor=new Color(89,55,54);g.roundRect(10,-11,13,16,3);g.fill();
      g.fillColor=new Color(246,193,83,210);g.ellipse(16,-3,6,8);g.fill();
    } else if(this.kind==='shotgunner'){
      g.fillColor=new Color(224,213,177);g.moveTo(1,0);g.lineTo(22,10);g.lineTo(20,-12);g.close();g.fill();
      g.strokeColor=new Color(151,48,43);g.lineWidth=1.5;g.moveTo(2,0);g.lineTo(20,9);g.moveTo(2,0);g.lineTo(20,-11);g.stroke();
    } else if(this.kind==='bomber'){
      g.fillColor=new Color(226,207,165);g.roundRect(2,-9,15,18,2);g.fill();
      g.strokeColor=new Color(179,48,43);g.lineWidth=2;g.moveTo(5,6);g.lineTo(14,-6);g.moveTo(14,6);g.lineTo(5,-6);g.stroke();
      g.fillColor=new Color(245,169,66);g.circle(18,7,2.5);g.fill();
    } else {
      g.strokeColor=new Color(76,55,75);g.lineWidth=5;g.moveTo(-3,0);g.lineTo(25,0);g.stroke();
      g.fillColor=new Color(205,164,83);g.moveTo(21,-5);g.lineTo(31,0);g.lineTo(21,5);g.close();g.fill();
    }
  }

  // 精细绘制奔腾夜兽（躯干、独立前腿、独立后腿、可点头马头、飘逸波浪马尾）
  private drawHorse(node: Node) {
    node.removeAllChildren();

    this.horseBodyNode=new Node('NightBeastBody');node.addChild(this.horseBodyNode);
    const bg=this.horseBodyNode.addComponent(Graphics);
    bg.fillColor=new Color(48,38,61);
    bg.moveTo(-30,4);bg.bezierCurveTo(-25,17,-5,19,14,15);bg.bezierCurveTo(27,12,34,2,26,-9);
    bg.bezierCurveTo(14,-18,-9,-18,-26,-10);bg.close();bg.fill();
    bg.fillColor=new Color(83,54,85,190);
    bg.moveTo(-24,5);bg.bezierCurveTo(-11,12,7,13,22,7);bg.bezierCurveTo(12,2,-4,-2,-21,-1);bg.close();bg.fill();
    bg.strokeColor=new Color(186,56,50);bg.lineWidth=2;
    bg.moveTo(-18,7);bg.bezierCurveTo(-5,14,4,-3,18,6);bg.moveTo(-14,-4);bg.bezierCurveTo(-2,4,9,-9,20,-2);bg.stroke();
    // bone-like harness and talisman tags
    bg.strokeColor=new Color(199,168,103);bg.lineWidth=2;bg.moveTo(-4,15);bg.lineTo(5,-14);bg.moveTo(-16,12);bg.lineTo(17,-9);bg.stroke();
    for(let x=-14;x<=14;x+=14){bg.fillColor=new Color(223,208,164);bg.moveTo(x,11);bg.lineTo(x+7,9);bg.lineTo(x+6,-1);bg.lineTo(x-1,1);bg.close();bg.fill();}

    this.horseHeadNode=new Node('NightBeastHead');node.addChild(this.horseHeadNode);
    const hg=this.horseHeadNode.addComponent(Graphics);
    hg.fillColor=new Color(53,41,66);hg.moveTo(12,7);hg.bezierCurveTo(21,14,22,25,28,30);hg.lineTo(38,21);hg.lineTo(30,5);hg.close();hg.fill();
    hg.fillColor=new Color(80,57,78);hg.moveTo(25,25);hg.lineTo(31,37);hg.lineTo(34,25);hg.close();hg.fill();
    hg.moveTo(18,20);hg.lineTo(19,33);hg.lineTo(24,23);hg.close();hg.fill();
    hg.fillColor=new Color(247,185,75);hg.ellipse(32,21,3.5,2);hg.fill();
    hg.fillColor=new Color(32,22,34);hg.ellipse(39,15,2,1.3);hg.fill();
    hg.strokeColor=new Color(126,74,145);hg.lineWidth=2;
    hg.moveTo(15,12);hg.bezierCurveTo(8,20,11,28,17,31);hg.moveTo(13,6);hg.bezierCurveTo(4,12,8,20,14,23);hg.stroke();

    this.horseFrontLeg=new Node('NightBeastFrontLeg');this.horseFrontLeg.setPosition(15,-7,0);node.addChild(this.horseFrontLeg);this.drawSingleHorseLeg(this.horseFrontLeg);
    this.horseBackLeg=new Node('NightBeastBackLeg');this.horseBackLeg.setPosition(-16,-7,0);node.addChild(this.horseBackLeg);this.drawSingleHorseLeg(this.horseBackLeg);

    this.horseTailNode=new Node('SpiritTail');this.horseTailNode.setPosition(-24,5,0);node.addChild(this.horseTailNode);
    const tg=this.horseTailNode.addComponent(Graphics);
    tg.fillColor=new Color(76,48,93,190);tg.moveTo(0,2);tg.bezierCurveTo(-14,6,-26,-5,-29,-17);tg.bezierCurveTo(-21,-10,-20,-26,-10,-30);tg.bezierCurveTo(-7,-18,-1,-8,0,2);tg.close();tg.fill();
    tg.strokeColor=new Color(152,91,177,150);tg.lineWidth=1.5;tg.moveTo(-3,0);tg.bezierCurveTo(-14,-5,-18,-13,-13,-25);tg.stroke();
  }

  // 绘制单条马腿（大腿肌肉、小腿关节、白飞节与铁掌）
  private drawSingleHorseLeg(node: Node) {
    const g=node.addComponent(Graphics);
    g.fillColor=new Color(48,37,59);g.moveTo(-5,1);g.lineTo(5,1);g.lineTo(7,-12);g.lineTo(2,-18);g.lineTo(-4,-14);g.close();g.fill();
    g.strokeColor=new Color(101,67,111);g.lineWidth=1.5;g.moveTo(-2,-2);g.lineTo(3,-13);g.stroke();
    g.fillColor=new Color(111,82,68);g.moveTo(-4,-15);g.lineTo(5,-17);g.lineTo(9,-22);g.lineTo(1,-23);g.lineTo(-7,-19);g.close();g.fill();
    g.strokeColor=new Color(211,172,92);g.lineWidth=1;g.moveTo(-3,-18);g.lineTo(5,-20);g.stroke();
  }

  // 更新头顶小血条
  private updateHpBar() {
    const g = this.hpBarNode.getComponent(Graphics) || this.hpBarNode.addComponent(Graphics);
    g.clear();

    const w = 38;
    const h = 5;

    // 暗黑边框底槽
    g.fillColor = new Color(20, 20, 20, 190);
    g.roundRect(-w / 2, -h / 2, w, h, 2);
    g.fill();

    // 剩余鲜红血量（精英怪为金橙色）
    const ratio = Math.max(0, this.hp / this.maxHp);
    g.fillColor = this.isElite ? new Color(255, 175, 40) : new Color(215, 45, 45);
    g.roundRect(-w / 2 + 1, -h / 2 + 1, (w - 2) * ratio, h - 2, 1);
    g.fill();
  }

  public applyResidualSlow(duration: number = 0.35, factor: number = 0.55) {
    if (this.isDead) return;
    this.residualSlowTimer = Math.max(this.residualSlowTimer, duration);
    this.residualSlowFactor = Math.min(this.residualSlowFactor, factor);
  }

  // 承受伤害
  takeDmg(amount: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;
    this.updateHpBar();

    // 受击闪白缩放
    tween(this.bodyRoot)
      .to(0.04, { scale: new Vec3(1.15, 0.85, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();

    if (this.hp <= 0) {
      this.playDeath();
      return true;
    }
    return false;
  }

  // 帅气后仰倒地死亡、地面滑行沙尘带、帽子武器脱手飞出
  private playDeath() {
    this.isDead=true;this.hpBarNode.active=false;this.legLeftNode.active=false;this.legRightNode.active=false;
    if(this.shadowNode)this.shadowNode.active=false;
    const parent=this.node.parent;
    // 各类邪祟死亡都产生纸灰、灵火、裂纹碎片的组合效果，而不是留下简单圆圈
    if(parent){
      for(let i=0;i<7;i++){
        const shard=new Node('SpiritDeathShard');shard.setPosition(this.node.position);parent.addChild(shard);
        const g=shard.addComponent(Graphics);
        if(i%2===0){g.fillColor=new Color(220,204,163,190);g.moveTo(-3,-6);g.lineTo(5,-3);g.lineTo(2,6);g.lineTo(-5,3);g.close();g.fill();g.strokeColor=new Color(166,48,44);g.lineWidth=1;g.moveTo(-1,3);g.lineTo(2,-3);g.stroke();}
        else{g.fillColor=new Color(110,70,130,155);g.moveTo(0,7);g.bezierCurveTo(6,2,4,-5,0,-8);g.bezierCurveTo(-5,-3,-4,3,0,7);g.fill();}
        const a=(i/7)*Math.PI*2+(Math.random()-.5)*.4,dist=24+Math.random()*28;
        tween(shard).by(.38,{position:new Vec3(Math.cos(a)*dist,Math.sin(a)*dist+18,0),angle:(Math.random()-.5)*300,scale:new Vec3(.55,.55,1)},{easing:'quadOut'}).call(()=>shard.destroy()).start();
      }
      const residue=new Node('DissolvingInk');residue.setPosition(this.node.position.x,this.node.position.y-16,0);parent.addChild(residue);
      const rg=residue.addComponent(Graphics);rg.strokeColor=new Color(73,54,85,120);rg.lineWidth=4;
      rg.moveTo(-20,0);rg.bezierCurveTo(-12,9,-4,-6,4,2);rg.bezierCurveTo(10,9,15,-5,23,1);rg.stroke();
      rg.strokeColor=new Color(151,70,84,85);rg.lineWidth=2;rg.moveTo(-13,5);rg.bezierCurveTo(-4,12,6,-8,16,4);rg.stroke();
      tween(residue).to(.65,{scale:new Vec3(1.6,.55,1)}).call(()=>residue.destroy()).start();
    }
    if(this.kind==='rider'&&this.horseNode){
      tween(this.horseNode).to(.2,{angle:-18,position:new Vec3(-8,-10,0)}).to(.3,{angle:-45,position:new Vec3(-20,-22,0)}).start();
      tween(this.bodyRoot).to(.18,{position:new Vec3(8,28,0),angle:26}).to(.35,{position:new Vec3(28,-18,0),angle:95}).start();
    }else if(this.kind==='gunner'){
      tween(this.bodyRoot).to(.22,{position:new Vec3(0,8,0),scale:new Vec3(.9,1.12,1)}).to(.35,{position:new Vec3(-9,-22,0),angle:-68,scale:new Vec3(1,1,1)}).start();
    }else if(this.kind==='shotgunner'){
      tween(this.bodyRoot).to(.18,{scale:new Vec3(1.2,.82,1),position:new Vec3(0,-6,0)}).to(.4,{scale:new Vec3(.75,1.2,1),position:new Vec3(0,-26,0),angle:20}).start();
    }else if(this.kind==='bomber'){
      tween(this.bodyRoot).to(.12,{scale:new Vec3(.8,1.25,1),angle:-12}).to(.16,{scale:new Vec3(1.22,.72,1),angle:18}).to(.3,{position:new Vec3(12,-24,0),angle:75,scale:new Vec3(1,1,1)}).start();
    }else{
      tween(this.bodyRoot).to(.16,{position:new Vec3(6,3,0),angle:16}).to(.34,{position:new Vec3(-14,-20,0),angle:-82}).start();
    }
    this.scheduleOnce(()=>{if(this.node.isValid)this.node.destroy();},.85);
  }

  // 敌人每帧AI行为驱动
  updateEnemy(dt: number, heroPos: Vec3) {
    if (this.isDead) return;

    if (this.residualSlowTimer > 0) {
      this.residualSlowTimer = Math.max(0, this.residualSlowTimer - dt);
      if (this.residualSlowTimer <= 0) this.residualSlowFactor = 1;
    }
    const spiritTempo = this.residualSlowTimer > 0 ? this.residualSlowFactor : 1;
    this.animTimer += dt * 8 * spiritTempo;
    const myPos = this.node.position;

    // 计算朝向主角的向量
    const dx = heroPos.x - myPos.x;
    const dy = heroPos.y - myPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 面向调整
    if (dx < 0) {
      this.node.setScale(-1, 1, 1);
    } else {
      this.node.setScale(1, 1, 1);
    }

    // 瞄准主角
    const rad = Math.atan2(dy, Math.abs(dx));
    this.armNode.angle = (rad * 180) / Math.PI;

    // 移动与攻击判断
    if (dist > this.atkRange) {
      // 追击主角
      const step = this.spd * spiritTempo * dt;
      const nx = myPos.x + (dx / dist) * step;
      const ny = myPos.y + (dy / dist) * step;
      this.node.setPosition(nx, ny, 0);

      // 迈动步态、压扁弹起与奔腾动画（彻底告别呆板滑步）
      if (this.kind !== 'rider') {
        const legAngle = Math.sin(this.animTimer) * 35;
        this.legLeftNode.angle = legAngle;
        this.legRightNode.angle = -legAngle;

        // 躯干压扁拉伸与跑步颠簸（生动的弹性弹力反馈）
        const sq = Math.sin(this.animTimer * 2) * 0.08;
        this.bodyRoot.setScale(1 - sq, 1 + sq, 1);
        this.bodyRoot.setPosition(0, Math.abs(Math.sin(this.animTimer * 2)) * 3.5, 0);

        // 兵种特有的奔跑倾角与冲锋体态
        if (this.kind === 'bomber') {
          this.bodyRoot.angle = 14; // 爆符傀儡前倾狂奔
        } else if (this.kind === 'brawler') {
          this.bodyRoot.angle = 8;  // 兽祟举刀冲锋
        } else {
          this.bodyRoot.angle = 5;
        }
      } else {
        // 骑兽夜叉：夜兽四肢前后大幅交替奔腾跨越、马头起伏、马身俯仰颠簸与马尾飞扬
        if (this.horseFrontLeg && this.horseBackLeg && this.horseNode) {
          const gallopCycle = Math.sin(this.animTimer * 1.8);
          this.horseFrontLeg.angle = gallopCycle * 40;
          this.horseBackLeg.angle = -gallopCycle * 40;
          this.horseNode.angle = gallopCycle * 8; // 夜兽身躯俯仰
          if (this.horseHeadNode) {
            this.horseHeadNode.setPosition(0, gallopCycle * 3.0, 0); // 马头起伏
          }
          if (this.horseTailNode) {
            this.horseTailNode.angle = -20 + Math.sin(this.animTimer * 2.4) * 22; // 马尾剧烈飘扬
          }
        }
        this.bodyRoot.setPosition(0, 16 + Math.sin(this.animTimer * 1.8) * 4, 0);
      }

      // 脚底持续产生奔跑沙尘团
      this.dustTimer += dt;
      if (this.dustTimer >= 0.14) {
        this.dustTimer = 0;
        this.spawnStepDust(myPos);
      }
    } else {
      // 站定后也保持各兵种独有的呼吸/漂浮/折纸/兽骑待机，不允许静止贴图
      if (this.kind !== 'rider') {
        if(this.kind==='brawler'){
          this.legLeftNode.angle=Math.sin(this.animTimer*.7)*5;this.legRightNode.angle=-this.legLeftNode.angle;
          this.bodyRoot.setScale(1+Math.sin(this.animTimer)*.025,1-Math.sin(this.animTimer)*.025,1);
          this.headNode.angle=Math.sin(this.animTimer*.55)*3;
        }else if(this.kind==='gunner'){
          this.bodyRoot.setPosition(0,Math.sin(this.animTimer*.75)*4,0);
          this.armNode.angle += Math.sin(this.animTimer*.65)*2;
          this.headNode.angle=Math.sin(this.animTimer*.5)*5;
        }else if(this.kind==='shotgunner'){
          this.bodyRoot.setScale(1+Math.sin(this.animTimer*.8)*.04,1-Math.sin(this.animTimer*.8)*.04,1);
          this.headNode.angle=Math.sin(this.animTimer*.5)*7;
        }else{
          this.bodyRoot.angle=Math.sin(this.animTimer*.8)*5;
          this.legLeftNode.angle=Math.sin(this.animTimer)*8;this.legRightNode.angle=-this.legLeftNode.angle;
          this.weaponNode.angle=Math.sin(this.animTimer*1.4)*7;
        }
      } else {
        if (this.horseFrontLeg && this.horseBackLeg && this.horseNode) {
          this.horseFrontLeg.angle = 0;
          this.horseBackLeg.angle = 0;
          this.horseNode.angle = 0;
          if (this.horseHeadNode) this.horseHeadNode.setPosition(0, 0, 0);
          if (this.horseTailNode) this.horseTailNode.angle = Math.sin(this.animTimer) * 8;
        }
        this.bodyRoot.setPosition(0, 16, 0);
      }
      this.prepShoot += dt;
      if (this.prepShoot >= this.shootCool) {
        this.prepShoot = 0;
        this.fireAtHero(heroPos);
      }
    }
  }

  // 敌人脚底喷出奔跑小沙尘团
  private spawnStepDust(pos: Vec3) {
    const parent=this.node.parent;if(!parent)return;
    for(let i=0;i<2;i++){
      const n=new Node('SpiritStepTrace');n.setPosition(pos.x+(Math.random()-.5)*10,pos.y-18,0);parent.addChild(n);
      const g=n.addComponent(Graphics);
      if(this.kind==='brawler'){
        g.strokeColor=new Color(126,95,84,130);g.lineWidth=2;g.moveTo(-7,-2);g.lineTo(-2,5);g.lineTo(2,-1);g.lineTo(7,5);g.stroke();
      }else if(this.kind==='gunner'){
        g.strokeColor=new Color(105,151,174,110);g.lineWidth=2;g.moveTo(-8,0);g.bezierCurveTo(-2,6,3,-6,9,1);g.stroke();
      }else if(this.kind==='shotgunner'){
        g.strokeColor=new Color(219,203,160,120);g.lineWidth=1.5;g.moveTo(-6,2);g.lineTo(0,7);g.lineTo(6,1);g.moveTo(-4,-3);g.lineTo(4,-4);g.stroke();
      }else if(this.kind==='bomber'){
        g.strokeColor=new Color(188,62,53,130);g.lineWidth=2;g.moveTo(-6,-3);g.lineTo(0,6);g.lineTo(6,-4);g.stroke();
      }else{
        g.strokeColor=new Color(132,89,153,130);g.lineWidth=2;g.moveTo(-9,0);g.bezierCurveTo(-2,7,4,-7,10,0);g.stroke();
      }
      tween(n).to(.28,{position:new Vec3(n.position.x+(Math.random()-.5)*10,n.position.y+8,0),scale:new Vec3(1.55,1.25,1),angle:(Math.random()-.5)*20})
        .call(()=>n.destroy()).start();
    }
  }

  // 执行驱邪动作
  private fireAtHero(targetPos: Vec3) {
    if(this.kind==='brawler'){
      tween(this.bodyRoot).to(.08,{angle:18,scale:new Vec3(.92,1.08,1)}).to(.10,{angle:-10,scale:new Vec3(1.08,.94,1)}).to(.10,{angle:0,scale:new Vec3(1,1,1)}).start();
      tween(this.weaponNode).to(.08,{angle:-35,position:new Vec3(8,8,0)}).to(.1,{angle:28,position:new Vec3(20,-2,0)}).to(.1,{angle:0,position:new Vec3(15,0,0)}).start();
    }else if(this.kind==='gunner'){
      tween(this.bodyRoot).to(.12,{position:new Vec3(0,5,0),scale:new Vec3(.98,1.06,1)}).to(.16,{position:new Vec3(0,0,0),scale:new Vec3(1,1,1)}).start();
      tween(this.weaponNode).to(.08,{angle:-12,position:new Vec3(11,4,0)}).to(.08,{angle:8,position:new Vec3(17,-2,0)}).to(.1,{angle:0,position:new Vec3(15,0,0)}).start();
    }else if(this.kind==='shotgunner'){
      tween(this.bodyRoot).to(.12,{angle:-8,scale:new Vec3(1.08,.9,1)}).to(.18,{angle:0,scale:new Vec3(1,1,1)}).start();
      tween(this.weaponNode).to(.08,{angle:22,scale:new Vec3(1.12,.9,1)}).to(.16,{angle:0,scale:new Vec3(1,1,1)}).start();
    }else if(this.kind==='bomber'){
      tween(this.bodyRoot).to(.12,{angle:-16,position:new Vec3(0,-5,0)}).to(.12,{angle:15,position:new Vec3(0,5,0)}).to(.12,{angle:0,position:new Vec3(0,0,0)}).start();
      tween(this.weaponNode).to(.1,{position:new Vec3(3,13,0),angle:-35}).to(.1,{position:new Vec3(22,5,0),angle:20}).to(.1,{position:new Vec3(15,0,0),angle:0}).start();
    }else{
      if(this.horseNode)tween(this.horseNode).to(.1,{scale:new Vec3(1.08,.9,1),angle:-5}).to(.13,{scale:new Vec3(.96,1.06,1),angle:3}).to(.12,{scale:new Vec3(1,1,1),angle:0}).start();
      tween(this.weaponNode).to(.07,{angle:-15}).to(.08,{angle:12}).to(.1,{angle:0}).start();
    }
    if(this.onEnemyFire)this.onEnemyFire(this.node.position,targetPos,this.atkDmg);
  }
}
