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

  // 绘制敌人双腿（巡夜师裤、皮套裤、护膝、加固马靴与马刺）
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

    // 1. 夜兽躯干与雕花马鞍
    this.horseBodyNode = new Node('HBody');
    node.addChild(this.horseBodyNode);
    const bg = this.horseBodyNode.addComponent(Graphics);
    // 枣红褐色健壮马身（富有肌肉弧度）
    bg.fillColor = new Color(120, 58, 26);
    bg.ellipse(0, 0, 30, 15);
    bg.fill();
    // 饱满臀部肌肉暗影
    bg.fillColor = new Color(95, 45, 20);
    bg.circle(-14, 2, 11);
    bg.fill();

    // 墨西哥条纹马毯（红白黑三道民俗条纹）
    bg.fillColor = new Color(210, 45, 45);
    bg.rect(-10, 5, 20, 5);
    bg.fill();
    bg.fillColor = new Color(245, 240, 220);
    bg.rect(-10, 7, 20, 1.5);
    bg.fill();

    // 深色雕花牛皮马鞍与银色马镫
    bg.fillColor = new Color(55, 28, 14);
    bg.roundRect(-8, 8, 16, 7, 2.5);
    bg.fill();
    bg.strokeColor = new Color(220, 225, 235);
    bg.lineWidth = 1.2;
    bg.moveTo(0, 8);
    bg.lineTo(0, -6);
    bg.stroke();
    bg.ellipse(0, -7, 2.5, 1.5);
    bg.stroke();

    // 2. 夜兽头部（马颈、立体马头、黑眼珠、白高光、立耳、波浪鬃毛）
    this.horseHeadNode = new Node('HHead');
    node.addChild(this.horseHeadNode);
    const hg = this.horseHeadNode.addComponent(Graphics);
    hg.fillColor = new Color(120, 58, 26);
    hg.moveTo(15, 6);
    hg.lineTo(28, 23);
    hg.lineTo(37, 19);
    hg.lineTo(24, 0);
    hg.close();
    hg.fill();
    // 立体马头
    hg.ellipse(33, 19, 7.5, 5.2);
    hg.fill();
    // 黑色深邃马眼与高光白点
    hg.fillColor = new Color(20, 15, 15);
    hg.circle(34, 21, 1.5);
    hg.fill();
    hg.fillColor = new Color(255, 255, 255);
    hg.circle(34.3, 21.3, 0.6);
    hg.fill();
    // 喷气黑鼻孔
    hg.fillColor = new Color(40, 20, 15);
    hg.ellipse(38.5, 17, 1.2, 0.8);
    hg.fill();
    // 竖立敏锐马耳
    hg.fillColor = new Color(105, 50, 22);
    hg.moveTo(27, 24);
    hg.lineTo(30, 31);
    hg.lineTo(32, 24);
    hg.close();
    hg.fill();
    // 飘逸黑色波浪马鬃
    hg.fillColor = new Color(28, 18, 14);
    hg.moveTo(18, 13);
    hg.bezierCurveTo(20, 20, 22, 26, 25, 27);
    hg.lineTo(22, 27);
    hg.close();
    hg.fill();
    hg.moveTo(14, 8);
    hg.bezierCurveTo(16, 14, 18, 20, 21, 21);
    hg.lineTo(18, 21);
    hg.close();
    hg.fill();

    // 3. 独立前马腿（可向前大跨步屈膝）
    this.horseFrontLeg = new Node('HFrontLeg');
    this.horseFrontLeg.setPosition(14, -6, 0);
    node.addChild(this.horseFrontLeg);
    this.drawSingleHorseLeg(this.horseFrontLeg);

    // 4. 独立后马腿（可向后蹬地）
    this.horseBackLeg = new Node('HBackLeg');
    this.horseBackLeg.setPosition(-16, -6, 0);
    node.addChild(this.horseBackLeg);
    this.drawSingleHorseLeg(this.horseBackLeg);

    // 5. 独立飘摇马尾
    this.horseTailNode = new Node('HTail');
    this.horseTailNode.setPosition(-22, 6, 0);
    node.addChild(this.horseTailNode);
    const tg = this.horseTailNode.addComponent(Graphics);
    tg.fillColor = new Color(25, 16, 12);
    tg.moveTo(0, 0);
    tg.bezierCurveTo(-15, -7, -22, -22, -12, -28);
    tg.bezierCurveTo(-9, -17, -4, -6, 0, 0);
    tg.close();
    tg.fill();
  }

  // 绘制单条马腿（大腿肌肉、小腿关节、白飞节与铁掌）
  private drawSingleHorseLeg(node: Node) {
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(100, 48, 22);
    g.roundRect(-3, -13, 6, 14, 2);
    g.fill();
    // 蹄腕白色飞节毛
    g.fillColor = new Color(245, 240, 230);
    g.rect(-3, -15, 6, 2.5);
    g.fill();
    // 黑色坚硬马蹄铁掌
    g.fillColor = new Color(25, 25, 28);
    g.rect(-3, -18, 6, 3);
    g.fill();
    g.fillColor = new Color(190, 195, 205);
    g.rect(-3, -18.5, 6, 0.8); // 蹄铁银光反光掌面
    g.fill();
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
    this.isDead = true;
    this.hpBarNode.active = false;
    this.legLeftNode.active = false;
    this.legRightNode.active = false;
    if (this.shadowNode) {
      this.shadowNode.active = false; // 隐藏脚底阴影，避免倒地后原地突兀残留黑色圆圈
    }

    // 身体向后猛烈仰倒并滑行
    tween(this.bodyRoot)
      .to(0.25, { position: new Vec3(-14, -14, 0), angle: -85 }, { easing: 'quadIn' })
      .start();

    // 地面滑行沙尘带
    const dustParent = this.node.parent;
    if (dustParent) {
      for (let i = 0; i < 4; i++) {
        const slideDust = new Node('SlideDust');
        slideDust.setPosition(this.node.position.x - i * 8, this.node.position.y - 14, 0);
        dustParent.addChild(slideDust);
        const dg = slideDust.addComponent(Graphics);
        dg.fillColor = new Color(205, 180, 140, 160);
        dg.circle(0, 0, 4 + i * 2);
        dg.fill();
        tween(slideDust)
          .to(0.35, { scale: new Vec3(2.2, 2.2, 1) })
          .call(() => slideDust.destroy())
          .start();
      }
    }

    // 武器脱手旋转飞掷
    const flyWpn = new Node('FlyWeapon');
    this.node.parent?.addChild(flyWpn);
    flyWpn.setPosition(this.node.position.x + 10, this.node.position.y + 10, 0);
    const wg = flyWpn.addComponent(Graphics);
    wg.fillColor = new Color(120, 120, 130);
    wg.roundRect(-6, -2, 12, 4, 1);
    wg.fill();

    tween(flyWpn)
      .by(0.35, { position: new Vec3(35, 30, 0), angle: 480 }, { easing: 'quadOut' })
      .by(0.25, { position: new Vec3(15, -45, 0), angle: 180 }, { easing: 'quadIn' })
      .call(() => flyWpn.destroy())
      .start();

    // 敌人帽子飞起
    const flyHat = new Node('FlyHat');
    this.node.parent?.addChild(flyHat);
    flyHat.setPosition(this.node.position.x, this.node.position.y + 20, 0);
    const hg = flyHat.addComponent(Graphics);
    hg.fillColor = new Color(60, 45, 35);
    hg.ellipse(0, 0, 16, 4);
    hg.fill();

    tween(flyHat)
      .by(0.4, { position: new Vec3(-25, 45, 0), angle: -360 }, { easing: 'quadOut' })
      .by(0.25, { position: new Vec3(-10, -55, 0), angle: -180 }, { easing: 'quadIn' })
      .call(() => flyHat.destroy())
      .start();

    // 0.8秒后完全淡化移除
    this.scheduleOnce(() => {
      this.node.destroy();
    }, 0.8);
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
      // 站定进入射程
      if (this.kind !== 'rider') {
        this.legLeftNode.angle = 0;
        this.legRightNode.angle = 0;
        this.bodyRoot.setScale(1, 1, 1);
        this.bodyRoot.angle = 0;
        this.bodyRoot.setPosition(0, 0, 0);
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
    const parent = this.node.parent;
    if (!parent) return;

    const dust = new Node('EnemyDust');
    dust.setPosition(pos.x + (Math.random() - 0.5) * 8, pos.y - 18, 0);
    parent.addChild(dust);

    const g = dust.addComponent(Graphics);
    g.fillColor = new Color(104, 129, 157, 95);
    g.circle(0, 0, 3.5);
    g.fill();

    tween(dust)
      .to(0.22, { scale: new Vec3(1.8, 1.8, 1) })
      .call(() => dust.destroy())
      .start();
  }

  // 执行驱邪动作
  private fireAtHero(targetPos: Vec3) {
    // 举枪后坐力
    tween(this.weaponNode)
      .to(0.05, { position: new Vec3(8, 2, 0) })
      .to(0.12, { position: new Vec3(15, 0, 0) })
      .start();

    if (this.onEnemyFire) {
      this.onEnemyFire(this.node.position, targetPos, this.atkDmg);
    }
  }
}
