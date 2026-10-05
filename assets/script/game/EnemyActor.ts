// 敌人实体系统
// 涵盖近战刀客、双枪土匪、重甲喷子、炸药疯客、骑马追击者
// 具备完整肢体骨骼、真实迈腿奔跑动画、丰富的服饰纹理与击杀滑行动画

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

export type EnemyKind = 'brawler' | 'gunner' | 'shotgunner' | 'bomber' | 'rider';

@ccclass('EnemyActor')
export class EnemyActor extends Component {
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

  // 开火回调（通知 GameScene 投射子弹）
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

    // 独立左右腿（走路奔跑时交替摆动，彻底告别单块方块）
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
    // 骑马追击者特殊处理：隐藏双腿，生成战马
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

  // 绘制敌人双腿（牛仔裤、皮套裤、护膝、加固马靴与马刺）
  private drawEnemyLeg(node: Node, isLeft: boolean) {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    g.clear();

    const sign = isLeft ? -1 : 1;

    if (this.kind === 'brawler') {
      // 刀客：撕裂毛边深棕皮裤，膝盖绑着带尖铜铆钉的硬皮护膝
      g.fillColor = new Color(65, 38, 22);
      g.roundRect(-3.5, -12, 7, 14, 2);
      g.fill();

      // 膝部粗硬皮垫
      g.fillColor = new Color(95, 55, 30);
      g.roundRect(-4, -6, 8, 6, 2);
      g.fill();
      // 护膝铜铆钉
      g.fillColor = new Color(225, 180, 60);
      g.circle(sign * 1.5, -3, 1.2);
      g.fill();

      // 沾满尘土的厚底粗皮靴
      g.fillColor = new Color(42, 25, 15);
      g.roundRect(-4, -18, 8, 7, 2);
      g.fill();
      // 靴底防滑橡胶齿
      g.fillColor = new Color(20, 12, 8);
      g.rect(-4, -19, 8, 1.8);
      g.fill();
    } else if (this.kind === 'shotgunner') {
      // 重甲狂徒：生铁板护胫与绑带，沉重厚钢头靴
      g.fillColor = new Color(55, 60, 65);
      g.roundRect(-4, -12, 8, 14, 2);
      g.fill();

      // 正面生铁护胫板
      g.fillColor = new Color(110, 115, 125);
      g.roundRect(-3.5, -10, 7, 10, 1.5);
      g.fill();
      // 绑带与螺栓
      g.strokeColor = new Color(30, 32, 36);
      g.lineWidth = 1.0;
      g.moveTo(-3.5, -4);
      g.lineTo(3.5, -4);
      g.stroke();
      g.fillColor = new Color(190, 195, 205);
      g.circle(0, -7, 1.2);
      g.fill();

      // 铁头厚底重甲靴
      g.fillColor = new Color(35, 38, 42);
      g.roundRect(-4.5, -18, 9, 7, 2);
      g.fill();
      g.fillColor = new Color(140, 145, 155);
      g.roundRect(sign > 0 ? 0 : -4.5, -18, 4.5, 3, 1); // 钢头反光
      g.fill();
    } else if (this.kind === 'bomber') {
      // 炸药疯客：炭灰煤屑连体工装裤腿，短皮靴插着备用导火索
      g.fillColor = new Color(50, 52, 58);
      g.roundRect(-3.5, -12, 7, 14, 2);
      g.fill();

      // 翻折短工装靴
      g.fillColor = new Color(75, 45, 25);
      g.roundRect(-4, -17, 8, 6, 2);
      g.fill();
      // 靴边插着一小段白色导火索
      if (isLeft) {
        g.strokeColor = new Color(230, 220, 200);
        g.lineWidth = 1.2;
        g.moveTo(-4, -12);
        g.lineTo(-7, -8);
        g.stroke();
      }
    } else {
      // 双枪土匪：深蓝牛仔斜纹裤，枪套绑腿绳圈，尖头皮马靴与银色马刺
      g.fillColor = new Color(38, 48, 62);
      g.roundRect(-3.5, -12, 7, 14, 2);
      g.fill();

      // 大腿系枪套牛皮绑绳
      g.strokeColor = new Color(85, 48, 25);
      g.lineWidth = 1.2;
      g.moveTo(-3.5, -3);
      g.lineTo(3.5, -3);
      g.stroke();

      // 西部尖头做旧马靴
      g.fillColor = new Color(60, 32, 18);
      g.roundRect(-4, -18, 8, 7, 2);
      g.fill();
      // 翘鞋尖
      g.ellipse(sign * 2.5, -16.5, 3.5, 2.5);
      g.fill();

      // 脚后跟银色小马刺
      g.strokeColor = new Color(220, 225, 235);
      g.lineWidth = 1.2;
      g.circle(-sign * 3.5, -16, 2.2);
      g.stroke();
    }
  }

  // 绘制敌人躯干（彻底告别单一色块，丰富呈现不同职业装束）
  private drawEnemyTorso(node: Node) {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    g.clear();

    if (this.kind === 'brawler') {
      // 刀客：袒胸深褐粗麻衬衣，露出胸口肌肉纹理与横贯前胸的刀疤，扎红色大腰封
      g.fillColor = new Color(130, 85, 55);
      g.roundRect(-10, -6, 20, 24, 3);
      g.fill();

      // 敞开衣领露出小麦色胸膛
      g.fillColor = new Color(205, 145, 110);
      g.moveTo(-4, 18);
      g.lineTo(4, 18);
      g.lineTo(0, 4);
      g.close();
      g.fill();

      // 胸前粉红陈年刀伤痕
      g.strokeColor = new Color(160, 60, 60);
      g.lineWidth = 1.5;
      g.moveTo(-3, 14);
      g.lineTo(2, 6);
      g.stroke();

      // 鲜红宽大扎腰腰封（Sash）
      g.fillColor = new Color(180, 35, 35);
      g.rect(-10.5, -5, 21, 8);
      g.fill();

      // 外扎带方扣的宽皮带
      g.fillColor = new Color(55, 30, 15);
      g.rect(-10, -3, 20, 4);
      g.fill();
      g.strokeColor = new Color(225, 185, 60);
      g.lineWidth = 1.2;
      g.rect(-3, -4, 6, 6);
      g.stroke();

      // 腰侧挂磨刀石袋与备用匕首鞘
      g.fillColor = new Color(85, 45, 25);
      g.roundRect(-12, -4, 3.5, 9, 1);
      g.fill();
    } else if (this.kind === 'shotgunner') {
      // 重甲狂徒：沉厚生铁铸造护胸甲（锻造锤击纹、加固边缘、反光重螺母）、护颈与护肩
      g.fillColor = new Color(60, 65, 72);
      g.roundRect(-12, -6, 24, 25, 4);
      g.fill();

      // 金属高领护喉圈（Gorget）
      g.fillColor = new Color(85, 90, 100);
      g.moveTo(-8, 19);
      g.lineTo(8, 19);
      g.lineTo(6, 13);
      g.lineTo(-6, 13);
      g.close();
      g.fill();

      // 厚胸甲加固折棱与中央龙骨线
      g.strokeColor = new Color(35, 38, 45);
      g.lineWidth = 1.5;
      g.moveTo(0, 15);
      g.lineTo(0, -4);
      g.stroke();

      // 四角重型加固圆铆钉
      g.fillColor = new Color(195, 200, 210);
      g.circle(-8, 12, 1.8);
      g.circle(8, 12, 1.8);
      g.circle(-8, -1, 1.8);
      g.circle(8, -1, 1.8);
      g.fill();

      // 腹部三联装红色大号霰弹弹药袋
      g.fillColor = new Color(75, 42, 22);
      g.roundRect(-9, -7, 18, 5, 1.5);
      g.fill();
      g.fillColor = new Color(225, 45, 40);
      g.circle(-5, -4.5, 1.4);
      g.circle(0, -4.5, 1.4);
      g.circle(5, -4.5, 1.4);
      g.fill();
    } else if (this.kind === 'bomber') {
      // 炸药疯客：煤屑工装斜纹围裙，腰部缠满整排红色雷管束，胸前挂防毒滤罐
      g.fillColor = new Color(90, 55, 30);
      g.roundRect(-9, -6, 18, 24, 3);
      g.fill();

      // 工装深灰帆布前围裙
      g.fillColor = new Color(50, 52, 58);
      g.roundRect(-7, -4, 14, 18, 2);
      g.fill();

      // 胸前斜挎的防毒面具圆柱滤罐
      g.fillColor = new Color(85, 95, 75);
      g.roundRect(1, 4, 6, 10, 2);
      g.fill();
      g.strokeColor = new Color(30, 35, 25);
      g.lineWidth = 1.0;
      g.moveTo(1, 7);
      g.lineTo(7, 7);
      g.moveTo(1, 10);
      g.lineTo(7, 10);
      g.stroke();

      // 腰间整圈红色雷管束（黑色胶带捆扎）
      g.fillColor = new Color(215, 35, 35);
      g.rect(-13, -4, 4, 14);
      g.rect(-10, -5, 4, 15);
      g.fill();
      // 黑色电工胶带封口
      g.fillColor = new Color(20, 20, 25);
      g.rect(-13.5, 0, 7.5, 3);
      g.fill();
      // 雷管顶部引信
      g.strokeColor = new Color(240, 225, 200);
      g.lineWidth = 1.2;
      g.moveTo(-11, 10);
      g.lineTo(-13, 15);
      g.stroke();
    } else if (this.kind === 'rider') {
      // 骑马追击者：身披墨西哥刺绣流苏斗篷（Poncho）
      g.fillColor = new Color(175, 45, 35);
      g.moveTo(-12, 18);
      g.lineTo(12, 18);
      g.lineTo(15, -4);
      g.lineTo(-15, -4);
      g.close();
      g.fill();

      // 阿兹特克几何条纹装饰
      g.fillColor = new Color(245, 230, 180);
      g.rect(-13, 4, 26, 3);
      g.fill();
      g.fillColor = new Color(30, 25, 20);
      g.rect(-13, 8, 26, 1.8);
      g.fill();

      // 下摆流苏垂穗
      g.strokeColor = new Color(215, 185, 120);
      g.lineWidth = 1.2;
      for (let x = -13; x <= 13; x += 3) {
        g.moveTo(x, -4);
        g.lineTo(x, -8);
      }
      g.stroke();
    } else {
      // 双枪土匪：双交叉斜挎牛皮子弹带（每颗子弹独立反光），深色翻领牛仔马甲与怀表链
      g.fillColor = new Color(55, 62, 58);
      g.roundRect(-9, -6, 18, 24, 3);
      g.fill();

      // 双交叉牛皮子弹带（Bandolier）
      g.strokeColor = new Color(90, 52, 28);
      g.lineWidth = 3.2;
      g.moveTo(-9, 16);
      g.lineTo(9, -2);
      g.moveTo(9, 16);
      g.lineTo(-9, -2);
      g.stroke();

      // 闪闪发亮的黄铜子弹粒
      g.fillColor = new Color(255, 215, 75);
      g.circle(-4, 11, 1.3);
      g.circle(0, 7, 1.3);
      g.circle(4, 3, 1.3);
      g.circle(4, 11, 1.3);
      g.circle(-4, 3, 1.3);
      g.fill();

      // 牛皮腰带与黄铜皮带扣
      g.fillColor = new Color(65, 35, 18);
      g.rect(-9.5, -4, 19, 4);
      g.fill();
      g.strokeColor = new Color(245, 205, 75);
      g.lineWidth = 1.2;
      g.rect(-2.5, -5, 5, 6);
      g.stroke();

      // 银色细怀表链
      g.strokeColor = new Color(210, 215, 225);
      g.lineWidth = 1.0;
      g.moveTo(-4, 1);
      g.bezierCurveTo(-1, -3, 3, -3, 5, 0);
      g.stroke();
    }

    // 精英怪专属凶悍标识：佩戴黄金悬赏骷髅星标，彻底杜绝突兀单线圆圈
    if (this.isElite) {
      g.fillColor = new Color(195, 35, 30);
      g.roundRect(-6, 3, 12, 7, 2);
      g.fill();
      g.fillColor = new Color(255, 215, 65);
      g.roundRect(-4, 4.5, 8, 4, 1);
      g.fill();
    }
  }

  // 绘制敌人头部（丰富五官、刀疤、面巾、桶盔与风镜）
  private drawEnemyHead(node: Node) {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    g.clear();

    if (this.kind === 'brawler') {
      // 刀客：方下巴刚猛脸庞、眼角巨大十字裂痕刀疤、红黑海盗碎花头巾、嘴叼草秆与金牙
      g.fillColor = new Color(215, 155, 120);
      g.roundRect(-6.5, -4, 13, 14, 3);
      g.fill();

      // 下巴青黑胡茬
      g.fillColor = new Color(90, 65, 55, 140);
      g.roundRect(-5, -4, 10, 4, 1.5);
      g.fill();

      // 从眉骨劈到脸颊的深红大刀疤
      g.strokeColor = new Color(165, 35, 35);
      g.lineWidth = 1.5;
      g.moveTo(-2, 7);
      g.lineTo(3, -1);
      g.stroke();
      g.moveTo(0, 4);
      g.lineTo(2, 2);
      g.stroke();

      // 凶悍黑眼圈与反光金牙
      g.fillColor = new Color(25, 20, 20);
      g.circle(-2.5, 4, 1.2);
      g.circle(2.5, 4, 1.2);
      g.fill();
      g.fillColor = new Color(255, 215, 60);
      g.rect(1, -2, 2, 1.6); // 金牙闪耀
      g.fill();

      // 嘴里叼着的干草秆
      g.strokeColor = new Color(230, 205, 110);
      g.lineWidth = 1.2;
      g.moveTo(2.5, -2);
      g.lineTo(8, -4);
      g.stroke();

      // 额头绑着的红黑碎花海盗头巾（Bandana）
      g.fillColor = new Color(195, 30, 30);
      g.roundRect(-7.5, 4, 15, 8, 3);
      g.fill();
      // 头巾脑后系带在风中翻卷
      g.moveTo(-7.5, 7);
      g.bezierCurveTo(-12, 12, -15, 6, -18, 9);
      g.lineTo(-13, 5);
      g.close();
      g.fill();
    } else if (this.kind === 'shotgunner') {
      // 重甲狂徒：沉重冷轧生铁水桶头盔，正中央狭长发红光观测缝
      g.fillColor = new Color(55, 60, 68);
      g.roundRect(-7.5, -4, 15, 17, 3);
      g.fill();

      // 侧面紧固大螺栓
      g.fillColor = new Color(175, 180, 190);
      g.circle(-6, 2, 1.4);
      g.circle(6, 2, 1.4);
      g.fill();

      // 水平狭长深红恶魔观测缝（红芒发光）
      g.fillColor = new Color(20, 15, 15);
      g.rect(-5, 3, 10, 2.5);
      g.fill();
      g.fillColor = new Color(255, 45, 35);
      g.rect(-4, 3.5, 8, 1.5);
      g.fill();
    } else if (this.kind === 'bomber') {
      // 炸药疯客：蒸汽朋克双圆黄铜厚风镜，被炸焦的杂乱卷发，满脸火药油污，疯狂大笑
      g.fillColor = new Color(220, 165, 130);
      g.roundRect(-6.5, -4, 13, 14, 3);
      g.fill();

      // 脸部黑色火药烟尘污斑
      g.fillColor = new Color(30, 30, 35, 160);
      g.circle(-3, -1, 2.2);
      g.circle(3, 1, 1.8);
      g.fill();

      // 咧开大嘴疯狂狂笑（露出参差不齐的牙齿）
      g.fillColor = new Color(40, 15, 15);
      g.roundRect(-4, -3.5, 8, 4, 1.5);
      g.fill();
      g.fillColor = new Color(245, 235, 205);
      g.rect(-3, -3, 2, 1.4);
      g.rect(1, -3, 2, 1.4);
      g.fill();

      // 蒸汽朋克精密黄铜双联风镜（圆环、镜框铆钉、反光深墨绿镜片）
      g.fillColor = new Color(210, 165, 55);
      g.circle(-3.2, 4, 3.8);
      g.circle(3.2, 4, 3.8);
      g.fill();
      g.fillColor = new Color(25, 45, 35);
      g.circle(-3.2, 4, 2.5);
      g.circle(3.2, 4, 2.5);
      g.fill();
      // 镜片高光斑
      g.fillColor = new Color(255, 255, 255);
      g.circle(-2.2, 5, 0.9);
      g.circle(4.2, 5, 0.9);
      g.fill();

      // 爆炸炸焦的卷曲乱发（向四周炸开）
      g.fillColor = new Color(35, 28, 24);
      g.circle(-6, 9, 3);
      g.circle(0, 11, 3.5);
      g.circle(6, 9, 3);
      g.fill();
    } else if (this.kind === 'rider') {
      // 骑马追击者：宽大墨西哥草帽（Sombrero，草编螺旋、圆球吊穗、五角星），墨绿面巾
      g.fillColor = new Color(215, 160, 125);
      g.roundRect(-6, -4, 12, 13, 3);
      g.fill();

      // 墨绿面巾
      g.fillColor = new Color(35, 60, 42);
      g.roundRect(-6, -4, 12, 6.5, 2);
      g.fill();

      // 宽大墨西哥草帽（帽顶高耸、帽檐超宽带吊穗）
      g.fillColor = new Color(215, 185, 130);
      g.ellipse(0, 9, 21, 5); // 宽大帽檐
      g.fill();
      g.roundRect(-7, 8, 14, 10, 3); // 锥形帽顶
      g.fill();
      // 帽檐刺绣花边与吊穗
      g.strokeColor = new Color(160, 40, 30);
      g.lineWidth = 1.2;
      g.moveTo(-18, 9);
      g.lineTo(18, 9);
      g.stroke();
    } else {
      // 双枪土匪：卷边做旧牛仔帽带弹孔裂痕，黑色三角面巾，阴鸷冷酷眼神
      g.fillColor = new Color(220, 165, 130);
      g.roundRect(-6, -4, 12, 13, 3);
      g.fill();

      // 警惕阴冷的眼神（眼白与黑瞳仁）
      g.fillColor = new Color(245, 245, 245);
      g.circle(-2.5, 3.5, 1.4);
      g.circle(2.5, 3.5, 1.4);
      g.fill();
      g.fillColor = new Color(20, 20, 25);
      g.circle(-2.2, 3.5, 0.8);
      g.circle(2.8, 3.5, 0.8);
      g.fill();

      // 黑色盗匪三角面巾（遮住口鼻，带自然折皱与垂摆）
      g.fillColor = new Color(28, 28, 35);
      g.roundRect(-6.5, -4, 13, 7, 2);
      g.fill();
      g.moveTo(-2, -4);
      g.lineTo(2, -4);
      g.lineTo(0, -7);
      g.close();
      g.fill();

      // 棕黑双边翘卷牛仔帽（帽带蛇皮花纹、被子弹穿透的焦黑弹孔）
      g.fillColor = new Color(60, 42, 30);
      g.ellipse(0, 9, 19, 4.8);
      g.fill();
      g.roundRect(-8, 8.5, 16, 9.5, 2.5);
      g.fill();
      // 帽带
      g.fillColor = new Color(185, 145, 75);
      g.rect(-8, 9, 16, 1.8);
      g.fill();
      // 帽檐被子弹打穿的焦黑弹洞
      g.fillColor = new Color(15, 12, 10);
      g.circle(6.5, 9, 1.2);
      g.fill();
    }
  }

  // 绘制敌人武器（极高写实细节刻画）
  private drawEnemyWeapon(node: Node) {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    g.clear();

    if (this.kind === 'brawler') {
      // 锯齿开山大砍刀：加厚刀脊、三道倒刺锯齿、深陷排血槽、锋利刃面抛光、鹿角刀柄与手绳
      g.fillColor = new Color(110, 58, 25);
      g.rect(-5, -1.5, 6, 3.5); // 鹿角柄
      g.fill();
      // 椭圆黄铜护手
      g.fillColor = new Color(225, 185, 60);
      g.ellipse(1, 0, 1.5, 4);
      g.fill();

      // 银光闪闪重型大刀身
      g.fillColor = new Color(220, 225, 235);
      g.moveTo(2, -2.5);
      g.lineTo(19, 1);
      g.lineTo(23, 11);
      g.lineTo(8, 5);
      g.close();
      g.fill();

      // 刀背锯齿与深黑排血槽
      g.strokeColor = new Color(85, 90, 100);
      g.lineWidth = 1.3;
      g.moveTo(4, 1.5);
      g.lineTo(16, 4);
      g.stroke();

      // 刀柄末端垂挂防脱落编织牛皮手绳
      g.strokeColor = new Color(85, 45, 20);
      g.lineWidth = 1.2;
      g.moveTo(-5, 0);
      g.bezierCurveTo(-8, -4, -6, -8, -4, -9);
      g.stroke();
    } else if (this.kind === 'shotgunner') {
      // 重型截短双管霰弹枪：缠绕血污布条绷带、粗大双枪管、双击锤、胡桃木切短枪托
      g.fillColor = new Color(45, 48, 55);
      g.roundRect(0, -4, 21, 8, 2);
      g.fill();

      // 枪管防烫泥垢白绷带
      g.fillColor = new Color(215, 210, 195);
      g.rect(6, -4, 3, 8);
      g.rect(12, -4, 3, 8);
      g.fill();

      // 并列粗大双枪眼深邃黑洞
      g.fillColor = new Color(12, 12, 15);
      g.circle(21, 1.4, 1.7);
      g.circle(21, -1.4, 1.7);
      g.fill();

      // 两个外露高耸击锤
      g.fillColor = new Color(160, 165, 175);
      g.rect(1, 3.5, 2, 2.5);
      g.rect(1, -6, 2, 2.5);
      g.fill();
    } else if (this.kind === 'bomber') {
      // 铸铁球形引信炸弹：粗糙生铁球壳、铸造合缝棱、黄铜引信口、燃烧的麻绳引信喷发动态火星
      g.fillColor = new Color(32, 34, 40);
      g.circle(8, 0, 8);
      g.fill();
      // 铸铁合模棱线
      g.strokeColor = new Color(65, 70, 80);
      g.lineWidth = 1.0;
      g.circle(8, 0, 8);
      g.stroke();

      // 黄铜引信螺纹口
      g.fillColor = new Color(210, 165, 60);
      g.rect(12, 3, 3, 3);
      g.fill();

      // 弯曲麻绳引信
      g.strokeColor = new Color(175, 130, 75);
      g.lineWidth = 1.3;
      g.moveTo(13, 5);
      g.bezierCurveTo(15, 8, 13, 12, 16, 14);
      g.stroke();

      // 引线顶端喷发的炽热火花
      g.fillColor = new Color(255, 215, 55);
      g.circle(16, 14, 2.8);
      g.fill();
      g.fillColor = new Color(255, 90, 30);
      g.circle(17, 15, 1.5);
      g.fill();
    } else if (this.kind === 'rider') {
      // 骑兵长温彻斯特步枪：金黄铜机匣、深色木质护木与伸长的冷黑枪管
      g.fillColor = new Color(42, 45, 50);
      g.rect(0, -2, 26, 4); // 长枪管
      g.fill();
      g.fillColor = new Color(225, 185, 65);
      g.rect(2, -2.5, 6, 5); // 黄金机匣
      g.fill();
      g.fillColor = new Color(110, 55, 25);
      g.rect(8, -1.8, 8, 3.6); // 护木
      g.fill();
    } else {
      // 双枪土匪做旧柯尔特转轮：烤蓝八角长枪管、旋转六孔弹巢、象牙白雕花握把、后扳击锤
      g.fillColor = new Color(80, 85, 92);
      g.roundRect(0, -1.8, 15, 4.4, 1.2);
      g.fill();

      // 六孔旋转弹巢
      g.fillColor = new Color(42, 45, 50);
      g.circle(3.5, 0.4, 3.0);
      g.fill();

      // 象牙白雕花手柄
      g.fillColor = new Color(245, 240, 225);
      g.roundRect(-4, -4, 4.5, 6, 1.5);
      g.fill();

      // 后扳击锤
      g.fillColor = new Color(180, 185, 195);
      g.rect(-1, 2, 2, 2);
      g.fill();
    }
  }

  // 精细绘制奔腾战马（躯干、独立前腿、独立后腿、可点头马头、飘逸波浪马尾）
  private drawHorse(node: Node) {
    node.removeAllChildren();

    // 1. 战马躯干与雕花马鞍
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

    // 2. 战马头部（马颈、立体马头、黑眼珠、白高光、立耳、波浪鬃毛）
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

    this.animTimer += dt * 8;
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
      const step = this.spd * dt;
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
          this.bodyRoot.angle = 14; // 炸药疯客前倾狂奔
        } else if (this.kind === 'brawler') {
          this.bodyRoot.angle = 8;  // 刀客举刀冲锋
        } else {
          this.bodyRoot.angle = 5;
        }
      } else {
        // 骑马追击者：战马四肢前后大幅交替奔腾跨越、马头起伏、马身俯仰颠簸与马尾飞扬
        if (this.horseFrontLeg && this.horseBackLeg && this.horseNode) {
          const gallopCycle = Math.sin(this.animTimer * 1.8);
          this.horseFrontLeg.angle = gallopCycle * 40;
          this.horseBackLeg.angle = -gallopCycle * 40;
          this.horseNode.angle = gallopCycle * 8; // 战马身躯俯仰
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
    g.fillColor = new Color(210, 185, 145, 120);
    g.circle(0, 0, 3.5);
    g.fill();

    tween(dust)
      .to(0.22, { scale: new Vec3(1.8, 1.8, 1) })
      .call(() => dust.destroy())
      .start();
  }

  // 执行开火动作
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
