// 牛仔主角实体类
// 纯 Graphics 矢量分层骨骼节点绘制与待机、奔跑、拔枪、射击后坐力、翻滚闪避动画

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';
import { GunType } from './GameData';

const { ccclass } = _decorator;

export type HeroAction = 'idle' | 'run' | 'roll' | 'hit' | 'dead';

@ccclass('HeroActor')
export class HeroActor extends Component {
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
  public isInvincible: boolean = false; // 翻滚或受击保护期间无敌

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

    // 头部（脸型、短须、雪茄、帅气牛仔宽檐帽）
    this.headNode = new Node('Head');
    this.headNode.setPosition(0, 24, 0);
    this.bodyRoot.addChild(this.headNode);
    this.drawHead(this.headNode);

    // 持枪手臂与枪支
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
    const g = node.addComponent(Graphics);
    g.clear();

    // 深蓝灰牛仔裤腿
    g.fillColor = new Color(42, 52, 65);
    g.roundRect(-4.5, -14, 9, 16, 2);
    g.fill();

    // 牛仔皮套裤（Chaps）外侧流苏与银色海螺垫片
    g.fillColor = new Color(75, 45, 25);
    const fringeX = isLeft ? -5 : 5;
    g.rect(fringeX - 1.5, -13, 3, 14);
    g.fill();
    // 3个银色圆形海螺钉
    g.fillColor = new Color(225, 230, 240);
    g.circle(fringeX, -3, 1.2);
    g.circle(fringeX, -7, 1.2);
    g.circle(fringeX, -11, 1.2);
    g.fill();

    // 棕色皮马靴（双层鞋底与翘尖）
    g.fillColor = new Color(68, 38, 20);
    g.roundRect(-5, -20, 10, 8, 2);
    g.fill();
    // 靴尖微翘厚底
    g.fillColor = new Color(40, 22, 12);
    g.rect(-5, -21.5, 10, 2);
    g.ellipse(isLeft ? -4.5 : 4.5, -18.5, 4.5, 3.2);
    g.fill();

    // 脚后跟银色马刺五角齿轮
    g.strokeColor = new Color(230, 235, 245);
    g.lineWidth = 1.5;
    const spurX = isLeft ? 4.5 : -4.5;
    g.circle(spurX, -18, 3);
    g.stroke();
    // 齿轮尖刺
    g.fillColor = new Color(240, 240, 255);
    g.rect(spurX - 0.8, -21.5, 1.6, 7);
    g.rect(spurX - 3.5, -18.8, 7, 1.6);
    g.fill();
  }

  // 绘制长风衣下摆（双层披肩、撕裂毛边与风衣暗褶）
  private drawCape(node: Node) {
    const g = node.addComponent(Graphics);
    g.clear();

    // 外层暗褐厚牛皮风衣
    g.fillColor = new Color(72, 42, 24);
    g.moveTo(-13, 0);
    g.lineTo(13, 0);
    g.lineTo(18, -27);
    g.lineTo(-18, -27);
    g.close();
    g.fill();

    // 内衬深色夹里
    g.fillColor = new Color(48, 28, 16);
    g.moveTo(-11, -2);
    g.lineTo(0, -2);
    g.lineTo(-2, -26);
    g.lineTo(-16, -26);
    g.close();
    g.fill();

    // 背部防雨小披肩层（Capelet）
    g.fillColor = new Color(85, 52, 30);
    g.moveTo(-12, 0);
    g.lineTo(12, 0);
    g.lineTo(14, -10);
    g.lineTo(-14, -10);
    g.close();
    g.fill();

    // 风衣磨损毛边与裂口细节
    g.strokeColor = new Color(38, 22, 12);
    g.lineWidth = 1.2;
    g.moveTo(-16, -27);
    g.lineTo(-12, -23);
    g.lineTo(-8, -27);
    g.lineTo(-2, -24);
    g.lineTo(4, -27);
    g.lineTo(11, -24);
    g.lineTo(18, -27);
    g.stroke();
  }

  // 绘制躯干（亚麻开领衬衫、做旧皮背心、立体子弹带）
  private drawTorso(node: Node) {
    const g = node.addComponent(Graphics);
    g.clear();

    // 粗布亚麻米白衬衫
    g.fillColor = new Color(228, 222, 208);
    g.roundRect(-9, -4, 18, 24, 3);
    g.fill();

    // V型开领露出的古铜色肌肤与胸锁线条
    g.fillColor = new Color(215, 165, 130);
    g.moveTo(-4, 20);
    g.lineTo(4, 20);
    g.lineTo(0, 11);
    g.close();
    g.fill();

    // 深褐做旧皮背心（双侧对称翻领）
    g.fillColor = new Color(90, 52, 30);
    g.moveTo(-10, 20);
    g.lineTo(-3, 20);
    g.lineTo(-1.5, 4);
    g.lineTo(-10, -3);
    g.close();
    g.fill();

    g.moveTo(10, 20);
    g.lineTo(3, 20);
    g.lineTo(1.5, 4);
    g.lineTo(10, -3);
    g.close();
    g.fill();

    // 黄铜小排扣
    g.fillColor = new Color(230, 185, 60);
    g.circle(0, 3, 1.2);
    g.circle(0, -1, 1.2);
    g.fill();

    // 斜跨宽牛皮子弹带（带缝线压纹）
    g.strokeColor = new Color(55, 32, 16);
    g.lineWidth = 4.5;
    g.moveTo(-9, 18);
    g.lineTo(9, -2);
    g.stroke();

    // 4颗立体高光步枪弹药（金色铜壳+银铅弹尖）
    const bulletPts = [
      { x: -5, y: 13 },
      { x: -1.5, y: 9 },
      { x: 2, y: 5 },
      { x: 5.5, y: 1 }
    ];
    for (const pt of bulletPts) {
      // 铜壳
      g.fillColor = new Color(235, 190, 55);
      g.rect(pt.x - 1.2, pt.y - 1.2, 2.4, 2.4);
      g.fill();
      // 银色弹头
      g.fillColor = new Color(200, 205, 215);
      g.circle(pt.x + 0.8, pt.y - 0.8, 1.0);
      g.fill();
    }

    // 颈部潇洒系结的鲜红西部领巾（带飘拂角）
    g.fillColor = new Color(195, 32, 32);
    g.moveTo(-7, 20);
    g.lineTo(0, 23);
    g.lineTo(7, 20);
    g.lineTo(3, 13);
    g.lineTo(-3, 13);
    g.close();
    g.fill();
    // 领巾系角
    g.moveTo(0, 14);
    g.lineTo(2, 8);
    g.lineTo(0, 9);
    g.lineTo(-2, 8);
    g.close();
    g.fill();
  }

  // 绘制腰间皮枪套（大腿系腿皮绳与雕花铜带扣）
  private drawHolster(node: Node) {
    const g = node.addComponent(Graphics);
    g.clear();

    // 雕花皮带
    g.fillColor = new Color(55, 32, 16);
    g.rect(-8, 0, 16, 3);
    g.fill();

    // 经典右侧倾斜快拔皮枪套
    g.fillColor = new Color(68, 38, 20);
    g.moveTo(-2, 0);
    g.lineTo(5, 0);
    g.lineTo(3, -15);
    g.lineTo(-3, -13);
    g.close();
    g.fill();

    // 固定在右大腿上的系腿小皮带（Leg Tie）
    g.strokeColor = new Color(48, 26, 14);
    g.lineWidth = 1.2;
    g.moveTo(-3, -10);
    g.lineTo(-7, -11);
    g.stroke();

    // 雕花黄铜带扣
    g.fillColor = new Color(225, 180, 60);
    g.circle(0, 1.5, 1.8);
    g.fill();
  }

  // 绘制头部、牛仔宽檐帽、斜插羽毛、微斑胡茬与雪茄
  private drawHead(node: Node) {
    const g = node.addComponent(Graphics);
    g.clear();

    // 刚毅脸庞与下颌阴影
    g.fillColor = new Color(235, 185, 150);
    g.roundRect(-7, -4, 14, 15, 3.5);
    g.fill();

    // 下巴刚毅短胡茬（细密小层次点阵）
    g.fillColor = new Color(90, 65, 55, 160);
    for (let x = -5; x <= 5; x += 1.8) {
      for (let y = -3; y <= 1; y += 1.8) {
        g.circle(x, y, 0.7);
      }
    }
    g.fill();

    // 锐利眼神与剑眉
    g.strokeColor = new Color(40, 25, 15);
    g.lineWidth = 1.2;
    g.moveTo(0.5, 6);
    g.lineTo(4, 5.5);
    g.moveTo(-0.5, 6);
    g.lineTo(-4, 5.5);
    g.stroke();

    g.fillColor = new Color(20, 18, 18);
    g.circle(2.2, 4, 1.1);
    g.circle(-2.2, 4, 1.1);
    g.fill();

    // 嘴角雪茄（多层烟草纹路、金色烟标、明亮发光余烬）
    g.fillColor = new Color(95, 52, 28);
    g.rect(4, -0.5, 8, 2.5);
    g.fill();
    // 金色烟标环
    g.fillColor = new Color(235, 195, 60);
    g.rect(7, -0.5, 2, 2.5);
    g.fill();
    // 烟头火星余烬
    g.fillColor = new Color(255, 55, 15);
    g.circle(12, 0.7, 1.3);
    g.fill();
    g.fillColor = new Color(255, 215, 80);
    g.circle(12, 0.7, 0.6);
    g.fill();

    // 西部宽檐帽（起伏弧度卷边、编织帽箍、双缝线与斜插翠蓝羽毛）
    // 宽檐底层阴影
    g.fillColor = new Color(45, 26, 14);
    g.ellipse(0, 10, 24, 5);
    g.fill();
    // 弧度卷边帽檐
    g.fillColor = new Color(72, 42, 22);
    g.ellipse(0, 11.5, 23.5, 4.5);
    g.fill();
    // 帽檐缝线虚线
    g.strokeColor = new Color(130, 85, 45);
    g.lineWidth = 0.8;
    g.ellipse(0, 11.5, 21, 3.8);
    g.stroke();

    // 立体梯形帽筒
    g.fillColor = new Color(86, 50, 28);
    g.moveTo(-10, 11);
    g.lineTo(10, 11);
    g.lineTo(8.5, 23);
    g.lineTo(-8.5, 23);
    g.close();
    g.fill();

    // 压花编织皮帽箍
    g.fillColor = new Color(40, 22, 12);
    g.rect(-10, 11.5, 20, 3.5);
    g.fill();
    // 黄铜马蹄带扣
    g.strokeColor = new Color(240, 195, 65);
    g.lineWidth = 1.2;
    g.circle(-1.5, 13, 1.8);
    g.stroke();

    // 斜插翠蓝野鸡羽毛（带羽梗与深蓝羽斑）
    g.strokeColor = new Color(240, 240, 250);
    g.lineWidth = 1;
    g.moveTo(2, 13);
    g.lineTo(10, 27);
    g.stroke();
    // 翠绿与深蓝羽瓣
    g.fillColor = new Color(25, 135, 165);
    g.ellipse(7, 21, 3, 6);
    g.fill();
  }

  // 绘制手臂与皮手套
  private drawArm(node: Node) {
    const g = node.addComponent(Graphics);
    g.clear();

    // 风衣衣袖（带褶皱与皮带扣）
    g.fillColor = new Color(82, 48, 26);
    g.roundRect(0, -3.5, 14, 7, 3);
    g.fill();
    // 袖口紧固皮带
    g.fillColor = new Color(45, 25, 15);
    g.rect(10, -3.5, 2.5, 7);
    g.fill();

    // 深色做旧皮手套（紧握姿势）
    g.fillColor = new Color(52, 30, 16);
    g.circle(15, 0, 3.8);
    g.fill();
    g.fillColor = new Color(210, 165, 60);
    g.circle(14, 1.5, 1.0); // 手套黄铜铆钉
    g.fill();
  }

  // 绘制枪支模型（全面提升5种武器的细节结构）
  private drawGun(node: Node, gun: GunType) {
    let g = node.getComponent(Graphics);
    if (!g) {
      g = node.addComponent(Graphics);
    }
    g.clear();

    switch (gun) {
      case 'revolver':
      case 'bounce': {
        // 牛仔柯尔特左轮：红木雕花手柄、黄铜击锤、转轮膛线槽、八角枪管
        // 握把
        g.fillColor = new Color(115, 48, 22);
        g.roundRect(-3, -7, 5.5, 9, 2);
        g.fill();
        g.fillColor = new Color(225, 185, 60);
        g.circle(-0.5, -3, 1.0); // 握把黄铜螺丝
        g.fill();

        // 银灰枪机与八角枪管
        g.fillColor = new Color(175, 180, 188);
        g.roundRect(0, -1.2, 16, 4.2, 1);
        g.fill();
        // 枪口准星尖
        g.fillColor = new Color(80, 85, 95);
        g.rect(14, 2.2, 1.8, 1.5);
        g.fill();

        // 转轮弹巢（带有6个阴影膛线槽孔）
        g.fillColor = new Color(85, 90, 100);
        g.circle(2.5, 0.8, 3.8);
        g.fill();
        g.fillColor = new Color(45, 50, 60);
        g.circle(1.2, 2.2, 1.0);
        g.circle(3.8, 2.2, 1.0);
        g.circle(2.5, -0.5, 1.0);
        g.fill();

        // 击锤与扳机护圈
        g.fillColor = new Color(60, 65, 75);
        g.rect(-2, 3, 3, 2.5);
        g.fill();
        g.strokeColor = new Color(140, 145, 155);
        g.lineWidth = 1.0;
        g.ellipse(1, -2, 2.5, 1.8);
        g.stroke();
        break;
      }
      case 'lever': {
        // 温彻斯特1873步枪：红木长枪托、亮黄铜机匣、长下管弹仓、杠杆环
        g.fillColor = new Color(90, 42, 18);
        g.roundRect(-9, -4.5, 10, 6.5, 2); // 木托
        g.fill();
        // 经典黄铜机匣
        g.fillColor = new Color(215, 168, 55);
        g.roundRect(0, -2, 7, 5.5, 1);
        g.fill();
        // 黑色长枪管与下弹仓
        g.fillColor = new Color(45, 48, 55);
        g.roundRect(6, -0.8, 19, 3.5, 1);
        g.roundRect(6, -2.5, 18, 1.8, 0.5); // 下置供弹管
        g.fill();
        // 杠杆扳机大圆环
        g.strokeColor = new Color(190, 195, 205);
        g.lineWidth = 1.2;
        g.ellipse(1.5, -3.8, 3.5, 2.2);
        g.stroke();
        break;
      }
      case 'shotgun': {
        // 双管霰弹枪：厚重木托、双排并列粗大发黑枪口、折管扣
        g.fillColor = new Color(85, 40, 18);
        g.roundRect(-8, -4.5, 9, 6.5, 2);
        g.fill();
        // 枪机
        g.fillColor = new Color(65, 70, 80);
        g.roundRect(0, -2.5, 6, 6.8, 1.5);
        g.fill();
        // 双管并排黑色大口径枪管
        g.fillColor = new Color(42, 45, 52);
        g.roundRect(5, -2.8, 15, 7, 1.5);
        g.fill();
        // 双枪孔切面
        g.fillColor = new Color(15, 15, 18);
        g.ellipse(20, 0.8, 1.2, 1.6);
        g.ellipse(20, -1.0, 1.2, 1.6);
        g.fill();
        break;
      }
      case 'cannon': {
        // 炸药重型发射炮：生锈铸铁炮身、加固黄铜箍圈、压力表盘与粗大炮管
        g.fillColor = new Color(75, 38, 18);
        g.roundRect(-7, -4.5, 8, 7.5, 2);
        g.fill();
        // 厚重铸铁炮身
        g.fillColor = new Color(55, 58, 65);
        g.roundRect(0, -4, 20, 9.5, 2);
        g.fill();
        // 加固黄铜铆钉箍
        g.fillColor = new Color(225, 170, 50);
        g.rect(6, -4, 2.5, 9.5);
        g.rect(14, -4, 2.5, 9.5);
        g.fill();
        // 侧面小气压表盘
        g.fillColor = new Color(255, 255, 255);
        g.circle(4, 4, 2.2);
        g.fill();
        g.strokeColor = new Color(210, 150, 40);
        g.lineWidth = 0.8;
        g.circle(4, 4, 2.2);
        g.stroke();
        // 黑色深邃炮口
        g.fillColor = new Color(15, 15, 15);
        g.ellipse(20, 0.7, 2.2, 4.5);
        g.fill();
        break;
      }
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

  // 获得枪口发射点世界坐标
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

  // 执行翻滚闪避动作（360度旋转、扬尘、无敌判定）
  startRoll(dir: Vec3, onDone?: () => void) {
    if (this.curAction === 'roll' || this.curAction === 'dead') return;
    this.curAction = 'roll';
    this.isInvincible = true;
    this.rollTimer = 0.35;

    // 翻滚时扬起剧烈的连环沙暴气团
    for (let i = 0; i < 6; i++) {
      this.scheduleOnce(() => {
        if (this.isValid) this.spawnDustPuff();
      }, i * 0.05);
    }

    // 自身旋转翻滚一圈
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

  // 射击后坐力动作动画与抛壳
  playShootRecoil() {
    if (this.curAction === 'roll' || this.curAction === 'dead') return;

    // 枪支猛烈后拉并微抬
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

    // 牛仔帽子翻滚脱落飞出
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
