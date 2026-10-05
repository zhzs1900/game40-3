// 8大关卡场景绘制与动态环境系统
// 绘制精细的西部铁轨、车站木棚、酒馆百叶门、摇曳油灯、翻滚风滚草、矿坑与蒸汽工厂
// 包含真实的动态环境动画（风滚草滚动、油灯烛光闪烁、百叶门晃动、蒸汽喷雾、箱体受击回弹）

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

// 掩体障碍物数据
export interface ObstacleItem {
  node: Node;
  pos: Vec3;
  width: number;
  height: number;
  isExplosive: boolean; // 是否是炸药桶
  hp: number;
}

@ccclass('SceneWorld')
export class SceneWorld extends Component {
  private bgGraphicsRoot!: Node;
  private decoRoot!: Node;
  private dynamicRoot!: Node;
  private obstacleRoot!: Node;

  public obstacles: ObstacleItem[] = [];

  // 动态环境元素节点
  private tumbleNode?: Node;
  private lanternNode?: Node;
  private doorsNode?: Node;
  private steamNode?: Node;
  private curLevel: number = 1;
  private worldTimer: number = 0;

  // 箱子炸裂回调
  public onBoxBreak?: (pos: Vec3, isExplode: boolean) => void;

  onLoad() {
    this.bgGraphicsRoot = new Node('SceneBg');
    this.decoRoot = new Node('SceneDeco');
    this.dynamicRoot = new Node('SceneDynamic');
    this.obstacleRoot = new Node('SceneObstacles');

    this.node.addChild(this.bgGraphicsRoot);
    this.node.addChild(this.decoRoot);
    this.node.addChild(this.dynamicRoot);
    this.node.addChild(this.obstacleRoot);
  }

  // 构建关卡场景（根据1-8关主题定制）
  buildStage(level: number) {
    this.curLevel = level;
    this.bgGraphicsRoot.removeAllChildren();
    this.decoRoot.removeAllChildren();
    this.dynamicRoot.removeAllChildren();
    this.obstacleRoot.removeAllChildren();
    this.obstacles = [];
    this.tumbleNode = undefined;
    this.lanternNode = undefined;
    this.doorsNode = undefined;
    this.steamNode = undefined;

    // 1. 绘制底层地貌与质感纹理
    this.drawTerrainBase(level);

    // 2. 绘制场景特色建筑与静态地物
    this.drawSceneTheme(level);

    // 3. 构建动态环境小部件（风滚草、摇晃油灯、百叶门、蒸汽）
    this.setupDynamicProps(level);

    // 4. 生成战斗战术掩体木箱与炸药桶
    this.spawnObstacles(level);
  }

  // 绘制地面底色与细密荒野纹理
  private drawTerrainBase(level: number) {
    const bgNode = new Node('Terrain');
    this.bgGraphicsRoot.addChild(bgNode);
    const g = bgNode.addComponent(Graphics);
    g.clear();

    const w = 720;
    const h = 1280;

    // 根据关卡色调区分地貌
    let groundCol = new Color(215, 175, 120);
    switch (level) {
      case 1: groundCol = new Color(212, 170, 118); break; // 边境车站：黄土沙地
      case 2: groundCol = new Color(196, 152, 102); break; // 酒馆街：压实泥路与马车辙印
      case 3: groundCol = new Color(82, 74, 68); break;    // 废弃矿区：深灰暗褐岩石
      case 4: groundCol = new Color(185, 92, 58); break;   // 峡谷铁路：红褐色峡谷绝壁
      case 5: groundCol = new Color(228, 188, 112); break; // 淘金小镇：浅金沙滩
      case 6: groundCol = new Color(68, 72, 78); break;    // 蒸汽工厂：冷铁深灰地砖
      case 7: groundCol = new Color(28, 62, 42); break;    // 亡命赌场：复古绿绒赌桌呢
      case 8: groundCol = new Color(42, 28, 38); break;    // 赏金王城：深邃紫灰石板
    }

    g.fillColor = groundCol;
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();

    // 地表细密砂石颗粒与风化纹理
    g.fillColor = new Color(0, 0, 0, 25);
    for (let i = 0; i < 50; i++) {
      const rx = (Math.random() - 0.5) * (w - 60);
      const ry = (Math.random() - 0.5) * (h - 180);
      g.circle(rx, ry, 1.5 + Math.random() * 3.5);
      g.fill();
    }

    // 车辙印暗痕
    g.strokeColor = new Color(0, 0, 0, 18);
    g.lineWidth = 4;
    g.moveTo(-120, -550);
    g.bezierCurveTo(-115, -200, -125, 200, -118, 550);
    g.stroke();
    g.moveTo(-50, -550);
    g.bezierCurveTo(-45, -200, -55, 200, -48, 550);
    g.stroke();
  }

  // 绘制各个关卡的专属特色矢量场景
  private drawSceneTheme(level: number) {
    const dNode = new Node('ThemeVisual');
    this.decoRoot.addChild(dNode);
    const g = dNode.addComponent(Graphics);

    switch (level) {
      case 1:
        this.drawStation(g);
        break;
      case 2:
        this.drawSaloon(g);
        break;
      case 3:
        this.drawMine(g);
        break;
      case 4:
        this.drawCanyon(g);
        break;
      case 5:
        this.drawGoldTown(g);
        break;
      case 6:
        this.drawFactory(g);
        break;
      case 7:
        this.drawCasino(g);
        break;
      case 8:
        this.drawPalace(g);
        break;
    }
  }

  // 1. 边境车站（精致双轨、道钉、碎石道砟、车站木雨棚）
  private drawStation(g: Graphics) {
    // 枕木下方碎石道砟（Ballast）
    g.fillColor = new Color(145, 125, 100, 140);
    g.rect(-185, -600, 110, 1200);
    g.fill();

    // 密集的做旧实木枕木（深浅条纹与裂缝）
    for (let y = -580; y <= 580; y += 42) {
      g.fillColor = new Color(85, 52, 28);
      g.roundRect(-180, y, 100, 13, 2);
      g.fill();

      // 枕木裂痕
      g.strokeColor = new Color(50, 28, 14);
      g.lineWidth = 1.0;
      g.moveTo(-175, y + 6);
      g.lineTo(-140, y + 6);
      g.stroke();
    }

    // 贯穿地面的两条冷铁双轨（带银白光反射）
    g.strokeColor = new Color(55, 60, 68);
    g.lineWidth = 7;
    g.moveTo(-160, -600);
    g.lineTo(-160, 600);
    g.moveTo(-100, -600);
    g.lineTo(-100, 600);
    g.stroke();

    // 铁轨正上方高光细线
    g.strokeColor = new Color(205, 210, 220);
    g.lineWidth = 2.2;
    g.moveTo(-160, -600);
    g.lineTo(-160, 600);
    g.moveTo(-100, -600);
    g.lineTo(-100, 600);
    g.stroke();

    // 铁轨道钉（Spikes）
    g.fillColor = new Color(25, 25, 30);
    for (let y = -580; y <= 580; y += 42) {
      g.circle(-165, y + 6, 1.8);
      g.circle(-155, y + 6, 1.8);
      g.circle(-105, y + 6, 1.8);
      g.circle(-95, y + 6, 1.8);
      g.fill();
    }

    // 站台粗木立柱与挑梁雨棚
    g.fillColor = new Color(75, 42, 22);
    g.rect(140, 200, 18, 270);
    g.rect(260, 200, 18, 270);
    g.fill();

    // 挑梁斜撑
    g.strokeColor = new Color(90, 52, 28);
    g.lineWidth = 5;
    g.moveTo(149, 420);
    g.lineTo(170, 465);
    g.moveTo(269, 420);
    g.lineTo(245, 465);
    g.stroke();

    // 雨棚木瓦顶
    g.fillColor = new Color(115, 65, 35);
    g.roundRect(110, 465, 195, 26, 4);
    g.fill();
    g.strokeColor = new Color(60, 32, 16);
    g.lineWidth = 2.0;
    g.roundRect(110, 465, 195, 26, 4);
    g.stroke();
  }

  // 2. 荒漠酒馆街（两层西部木屋立面、系马桩、粗麻绳、巨大仙人掌）
  private drawSaloon(g: Graphics) {
    // 酒馆木屋门楼正立面（顶部横向实木板拼合）
    g.fillColor = new Color(108, 68, 40);
    g.roundRect(-240, 360, 480, 150, 4);
    g.fill();

    // 木板纵横接缝与深色阴影
    g.strokeColor = new Color(65, 38, 20);
    g.lineWidth = 1.5;
    for (let y = 380; y <= 500; y += 22) {
      g.moveTo(-240, y);
      g.lineTo(240, y);
    }
    g.stroke();

    // “SALOON” 招牌木板与黄铜铆钉边框
    g.fillColor = new Color(55, 30, 16);
    g.roundRect(-160, 420, 320, 56, 5);
    g.fill();
    g.strokeColor = new Color(230, 190, 85);
    g.lineWidth = 2.2;
    g.roundRect(-155, 425, 310, 46, 4);
    g.stroke();

    // 招牌上的牛头骨装饰（Longhorn）
    g.fillColor = new Color(245, 240, 225);
    g.circle(0, 452, 6);
    g.fill();
    g.strokeColor = new Color(240, 235, 220);
    g.lineWidth = 2.5;
    g.moveTo(-5, 454);
    g.bezierCurveTo(-22, 466, -26, 482, -32, 485);
    g.moveTo(5, 454);
    g.bezierCurveTo(22, 466, 26, 482, 32, 485);
    g.stroke();

    // 系马桩与粗麻绳圈
    g.fillColor = new Color(85, 48, 25);
    g.roundRect(-180, -220, 14, 55, 3);
    g.roundRect(-80, -220, 14, 55, 3);
    g.fill();
    g.strokeColor = new Color(190, 150, 90);
    g.lineWidth = 3.0;
    g.moveTo(-180, -185);
    g.bezierCurveTo(-130, -165, -130, -165, -80, -185);
    g.stroke();

    // 巨型沙漠仙人掌（带针刺与花朵）
    this.drawDetailedCactus(g, -260, -80);
    this.drawDetailedCactus(g, 250, 100);
  }

  // 绘制带有深浅肋条纹理与针刺的仙人掌
  private drawDetailedCactus(g: Graphics, x: number, y: number) {
    // 主干深绿
    g.fillColor = new Color(48, 115, 52);
    g.roundRect(x - 10, y, 20, 105, 10);
    g.fill();

    // 主干浅绿凸起肋条
    g.strokeColor = new Color(75, 155, 80);
    g.lineWidth = 2.5;
    g.moveTo(x - 4, y + 10);
    g.lineTo(x - 4, y + 95);
    g.moveTo(x + 4, y + 10);
    g.lineTo(x + 4, y + 95);
    g.stroke();

    // 弯曲左臂
    g.fillColor = new Color(48, 115, 52);
    g.roundRect(x - 32, y + 30, 26, 14, 7);
    g.roundRect(x - 32, y + 30, 14, 45, 7);
    g.fill();

    // 弯曲右臂
    g.roundRect(x + 6, y + 50, 26, 14, 7);
    g.roundRect(x + 18, y + 50, 14, 42, 7);
    g.fill();

    // 针刺
    g.strokeColor = new Color(245, 235, 170);
    g.lineWidth = 1.0;
    for (let dy = 15; dy <= 90; dy += 18) {
      g.moveTo(x - 10, y + dy);
      g.lineTo(x - 14, y + dy + 2);
      g.moveTo(x + 10, y + dy);
      g.lineTo(x + 14, y + dy + 2);
    }
    g.stroke();

    // 顶端金黄沙漠小花
    g.fillColor = new Color(255, 210, 50);
    g.circle(x, y + 106, 3.5);
    g.fill();
  }

  // 3. 废弃矿区（粗重原木支架、斜撑角铁、脱轨生锈矿车与金矿脉）
  private drawMine(g: Graphics) {
    // 粗壮原木坑道支柱
    g.fillColor = new Color(48, 30, 18);
    g.rect(-280, -220, 28, 440);
    g.rect(260, -220, 28, 440);
    g.fill();

    // 顶横原木梁
    g.fillColor = new Color(62, 38, 22);
    g.rect(-295, 210, 590, 32);
    g.fill();

    // 加固角铁铁板与圆铆钉
    g.fillColor = new Color(55, 60, 65);
    g.rect(-282, 195, 32, 32);
    g.rect(258, 195, 32, 32);
    g.fill();
    g.fillColor = new Color(195, 200, 210);
    g.circle(-266, 211, 2.0);
    g.circle(274, 211, 2.0);
    g.fill();

    // 脱轨生锈厚铸铁矿车（侧翻在左下方）
    g.fillColor = new Color(85, 45, 30);
    g.moveTo(-210, -140);
    g.lineTo(-140, -120);
    g.lineTo(-150, -70);
    g.lineTo(-220, -90);
    g.close();
    g.fill();
    // 铸铁轮子
    g.fillColor = new Color(30, 32, 38);
    g.circle(-185, -135, 9);
    g.circle(-145, -125, 9);
    g.fill();

    // 散落闪烁的金矿石微粒
    g.fillColor = new Color(255, 215, 60);
    for (let i = 0; i < 20; i++) {
      const qx = (Math.random() - 0.5) * 480;
      const qy = (Math.random() - 0.5) * 580;
      g.circle(qx, qy, 2.0 + Math.random() * 2.5);
      g.fill();
    }
  }

  // 4. 峡谷铁路（层理分明的红砂岩绝壁、深裂谷、呼啸狂风沙流）
  private drawCanyon(g: Graphics) {
    // 左绝壁红砂岩层理
    g.fillColor = new Color(145, 65, 40);
    g.moveTo(-360, -600);
    g.lineTo(-230, -600);
    g.lineTo(-260, -150);
    g.lineTo(-210, 200);
    g.lineTo(-250, 600);
    g.lineTo(-360, 600);
    g.close();
    g.fill();

    // 右绝壁红砂岩层理
    g.fillColor = new Color(145, 65, 40);
    g.moveTo(360, -600);
    g.lineTo(240, -600);
    g.lineTo(270, -100);
    g.lineTo(220, 250);
    g.lineTo(260, 600);
    g.lineTo(360, 600);
    g.close();
    g.fill();

    // 深色阴影裂纹
    g.strokeColor = new Color(90, 32, 18);
    g.lineWidth = 3.0;
    g.moveTo(-230, -600);
    g.lineTo(-260, -150);
    g.lineTo(-210, 200);
    g.lineTo(-250, 600);
    g.moveTo(240, -600);
    g.lineTo(270, -100);
    g.lineTo(220, 250);
    g.lineTo(260, 600);
    g.stroke();

    // 呼啸白色风速流线
    g.strokeColor = new Color(255, 255, 255, 80);
    g.lineWidth = 1.6;
    g.moveTo(-80, -380);
    g.bezierCurveTo(-70, -100, -90, 150, -80, 450);
    g.moveTo(90, -320);
    g.bezierCurveTo(100, -50, 80, 200, 90, 480);
    g.stroke();
  }

  // 5. 淘金小镇（蜿蜒清澈溪流、淘金木洗槽、金沙波光粼粼）
  private drawGoldTown(g: Graphics) {
    // 蜿蜒溪流河床（半透明渐变碧蓝）
    g.fillColor = new Color(75, 140, 175, 140);
    g.moveTo(-360, -500);
    g.bezierCurveTo(-100, -300, 80, 50, 280, 600);
    g.lineTo(360, 600);
    g.lineTo(360, -600);
    g.lineTo(-360, -600);
    g.close();
    g.fill();

    // 水流波光反光白纹
    g.strokeColor = new Color(230, 245, 255, 120);
    g.lineWidth = 2.0;
    g.moveTo(-180, -420);
    g.bezierCurveTo(-80, -320, 20, -100, 160, 200);
    g.stroke();

    // 木制淘金洗矿长槽（Sluice Box）
    g.fillColor = new Color(95, 52, 26);
    g.roundRect(-210, 60, 140, 28, 3);
    g.fill();
    // 槽底阻砂挡板（Riffles）
    g.strokeColor = new Color(55, 28, 14);
    g.lineWidth = 2.2;
    for (let x = -200; x <= -80; x += 18) {
      g.moveTo(x, 60);
      g.lineTo(x, 88);
    }
    g.stroke();
  }

  // 6. 蒸汽工厂（粗壮生锈蒸汽管道、铜齿轮、防烫石棉缠带与压力表）
  private drawFactory(g: Graphics) {
    // 纵横粗重工业蒸汽铜管道
    g.strokeColor = new Color(165, 105, 42);
    g.lineWidth = 16;
    g.moveTo(-360, 340);
    g.lineTo(360, 340);
    g.moveTo(-180, -600);
    g.lineTo(-180, 600);
    g.stroke();

    // 防烫石棉加固缠带
    g.strokeColor = new Color(225, 215, 195);
    g.lineWidth = 18;
    g.moveTo(-20, 340);
    g.lineTo(20, 340);
    g.moveTo(-180, 80);
    g.lineTo(-180, 120);
    g.stroke();

    // 管道凸缘连接盘与六角螺栓
    g.fillColor = new Color(75, 45, 20);
    g.roundRect(140, 328, 12, 24, 2);
    g.fill();
    g.fillColor = new Color(230, 185, 60);
    g.circle(146, 334, 1.6);
    g.circle(146, 346, 1.6);
    g.fill();

    // 工业圆盘压力表（白色表盘、黄铜外圈与红指针）
    g.fillColor = new Color(245, 245, 245);
    g.circle(-80, 340, 14);
    g.fill();
    g.strokeColor = new Color(210, 160, 50);
    g.lineWidth = 2.5;
    g.circle(-80, 340, 14);
    g.stroke();
    // 红色压力指针
    g.strokeColor = new Color(220, 40, 40);
    g.lineWidth = 1.8;
    g.moveTo(-80, 340);
    g.lineTo(-72, 348);
    g.stroke();
  }

  // 7. 亡命赌场（奢华深绿呢绒、金色巨型轮盘纹、散落筹码与烫金扑克）
  private drawCasino(g: Graphics) {
    // 中央法式经典转盘暗纹（金色同心圆与放射线）
    g.strokeColor = new Color(215, 175, 55, 80);
    g.lineWidth = 2.5;
    g.circle(0, 0, 160);
    g.circle(0, 0, 110);
    g.circle(0, 0, 50);
    g.stroke();

    // 轮盘红黑分格放射隔板
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI) / 8;
      g.moveTo(Math.cos(ang) * 50, Math.sin(ang) * 50);
      g.lineTo(Math.cos(ang) * 160, Math.sin(ang) * 160);
    }
    g.stroke();

    // 散落在赌台各处的筹码堆
    const chipCols = [new Color(220, 40, 40), new Color(40, 80, 210), new Color(235, 195, 55)];
    for (let i = 0; i < 12; i++) {
      const cx = (Math.random() - 0.5) * 460;
      const cy = (Math.random() - 0.5) * 560;
      g.fillColor = chipCols[i % 3];
      g.circle(cx, cy, 7);
      g.fill();
      g.strokeColor = new Color(255, 255, 255);
      g.lineWidth = 1.2;
      g.circle(cx, cy, 5);
      g.stroke();
    }
  }

  // 8. 赏金王城（王室红地毯、大理石地砖纹理、铁链与长明火盆）
  private drawPalace(g: Graphics) {
    // 宽幅红绒王室迎宾长地毯（两边金色流苏镶边）
    g.fillColor = new Color(145, 25, 35);
    g.rect(-90, -600, 180, 1200);
    g.fill();
    g.strokeColor = new Color(235, 190, 60);
    g.lineWidth = 3.5;
    g.moveTo(-90, -600);
    g.lineTo(-90, 600);
    g.moveTo(90, -600);
    g.lineTo(90, 600);
    g.stroke();

    // 地毯两侧大理石地砖分割接缝
    g.strokeColor = new Color(25, 20, 25, 120);
    g.lineWidth = 1.5;
    for (let y = -580; y <= 580; y += 70) {
      g.moveTo(-360, y);
      g.lineTo(-90, y);
      g.moveTo(90, y);
      g.lineTo(360, y);
    }
    g.stroke();
  }

  // 构建各个关卡的专属动态小道具（风滚草、摇晃油灯、百叶门、蒸汽喷雾）
  private setupDynamicProps(level: number) {
    // 1. 荒漠风滚草（随风自转并在地面颠簸起伏前进）
    if (level === 1 || level === 2 || level === 4 || level === 5) {
      this.tumbleNode = new Node('Tumbleweed');
      this.tumbleNode.setPosition(-340, -180, 0);
      this.dynamicRoot.addChild(this.tumbleNode);

      const tg = this.tumbleNode.addComponent(Graphics);
      // 缠绕荆棘球体
      tg.strokeColor = new Color(135, 95, 52);
      tg.lineWidth = 1.8;
      for (let i = 0; i < 7; i++) {
        const rad = (i * Math.PI) / 3.5;
        tg.ellipse(0, 0, 14, 8);
        tg.stroke();
      }
    }

    // 2. 酒馆摇曳油灯（微风轻摇，暖黄烛光光圈呼吸闪烁）
    if (level === 1 || level === 2) {
      this.lanternNode = new Node('Lantern');
      this.lanternNode.setPosition(140, 200, 0);
      this.dynamicRoot.addChild(this.lanternNode);

      const lg = this.lanternNode.addComponent(Graphics);
      // 黄铜防风提梁灯架
      lg.strokeColor = new Color(185, 135, 45);
      lg.lineWidth = 1.5;
      lg.rect(-6, -10, 12, 18);
      lg.stroke();
      // 内部跳动黄色灯芯火苗
      lg.fillColor = new Color(255, 220, 70);
      lg.ellipse(0, -2, 3, 5);
      lg.fill();
      // 柔和光晕
      lg.fillColor = new Color(255, 210, 60, 80);
      lg.circle(0, -2, 22);
      lg.fill();
    }

    // 3. 酒馆摇摆门（百叶扇动）
    if (level === 2) {
      this.doorsNode = new Node('SaloonDoors');
      this.doorsNode.setPosition(0, 360, 0);
      this.dynamicRoot.addChild(this.doorsNode);

      const dg = this.doorsNode.addComponent(Graphics);
      // 左扇与右扇百叶门
      dg.fillColor = new Color(130, 80, 42);
      dg.roundRect(-42, -25, 38, 50, 3);
      dg.roundRect(4, -25, 38, 50, 3);
      dg.fill();
      // 百叶木缝
      dg.strokeColor = new Color(75, 42, 20);
      dg.lineWidth = 1.5;
      for (let y = -20; y <= 20; y += 8) {
        dg.moveTo(-40, y);
        dg.lineTo(-6, y);
        dg.moveTo(6, y);
        dg.lineTo(40, y);
      }
      dg.stroke();
    }
  }

  public isPaused: boolean = false;

  // 每帧驱动环境动态（风滚草翻滚前进、油灯摇曳与光晕闪烁、百叶门晃动）
  update(dt: number) {
    if (this.isPaused) return;
    this.worldTimer += dt;

    // 1. 驱动风滚草在地面翻滚蹦跳
    if (this.tumbleNode && this.tumbleNode.isValid) {
      const curX = this.tumbleNode.position.x + dt * 68;
      // 模拟地面反弹起伏曲线
      const bounceY = -180 + Math.abs(Math.sin(this.worldTimer * 3.5)) * 22;
      this.tumbleNode.setPosition(curX, bounceY, 0);
      this.tumbleNode.angle -= dt * 240; // 滚动自转

      // 跑出屏幕右侧后循环回到左侧
      if (curX > 380) {
        this.tumbleNode.setPosition(-380, -180, 0);
      }
    }

    // 2. 油灯暖黄烛光闪烁与轻摇
    if (this.lanternNode && this.lanternNode.isValid) {
      this.lanternNode.angle = Math.sin(this.worldTimer * 2.2) * 5;
      const g = this.lanternNode.getComponent(Graphics);
      if (g) {
        // 光晕呼吸轻微明暗变幻
        const haloR = 20 + Math.sin(this.worldTimer * 12) * 3;
        const alpha = Math.floor(70 + Math.sin(this.worldTimer * 16) * 20);
        g.clear();
        g.strokeColor = new Color(185, 135, 45);
        g.lineWidth = 1.5;
        g.rect(-6, -10, 12, 18);
        g.stroke();
        g.fillColor = new Color(255, 220, 70);
        g.ellipse(0, -2, 3, 5);
        g.fill();
        g.fillColor = new Color(255, 210, 60, alpha);
        g.circle(0, -2, haloR);
        g.fill();
      }
    }

    // 3. 酒馆百叶摇摆门随微风轻晃
    if (this.doorsNode && this.doorsNode.isValid) {
      const scaleX = 1 + Math.sin(this.worldTimer * 2.6) * 0.08;
      this.doorsNode.setScale(scaleX, 1, 1);
    }
  }

  // 战术掩体布局：摆放坚固木箱与炸药桶
  private spawnObstacles(level: number) {
    const positions = [
      { x: -160, y: 150, explosive: false },
      { x: 160, y: 150, explosive: false },
      { x: -180, y: -150, explosive: true },
      { x: 180, y: -150, explosive: false },
      { x: 0, y: 0, explosive: true },
    ];

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const boxNode = new Node(`Obstacle_${i}`);
      boxNode.setPosition(p.x, p.y, 0);
      this.obstacleRoot.addChild(boxNode);

      const isExplosive = p.explosive;
      this.drawBoxShape(boxNode, isExplosive);

      this.obstacles.push({
        node: boxNode,
        pos: new Vec3(p.x, p.y, 0),
        width: 44,
        height: 44,
        isExplosive,
        hp: isExplosive ? 30 : 60,
      });
    }
  }

  // 精细绘制木箱与带危险骷髅标的炸药桶（绝非简单几何图形）
  private drawBoxShape(node: Node, isExplosive: boolean) {
    const g = node.addComponent(Graphics);
    g.clear();

    const sz = 44;
    const half = sz / 2;

    if (!isExplosive) {
      // 传统西部重型做旧实木箱
      // 1. 底层木板
      g.fillColor = new Color(130, 80, 42);
      g.roundRect(-half, -half, sz, sz, 4);
      g.fill();

      // 2. 天然原木纹理与木板深色接缝
      g.strokeColor = new Color(75, 42, 20);
      g.lineWidth = 1.8;
      g.moveTo(-half, -half / 3);
      g.lineTo(half, -half / 3);
      g.moveTo(-half, half / 3);
      g.lineTo(half, half / 3);
      g.stroke();

      // 细腻天然木纹弧线与木结轮廓
      g.strokeColor = new Color(105, 62, 32, 140);
      g.lineWidth = 1.0;
      g.moveTo(-half + 6, -half + 5);
      g.bezierCurveTo(-half + 16, -half + 9, half - 10, -half + 4, half - 4, -half + 7);
      g.stroke();
      g.moveTo(-half + 4, 3);
      g.bezierCurveTo(-half + 20, 7, half - 12, 1, half - 5, 5);
      g.stroke();
      // 木结
      g.fillColor = new Color(85, 48, 24);
      g.ellipse(6, -half / 3 + 6, 2.5, 1.8);
      g.fill();

      // 3. X型外层加固厚木条与阴影
      g.strokeColor = new Color(60, 32, 16);
      g.lineWidth = 3.5;
      g.moveTo(-half + 4, -half + 4);
      g.lineTo(half - 4, half - 4);
      g.moveTo(-half + 4, half - 4);
      g.lineTo(half - 4, -half + 4);
      g.stroke();
      g.strokeColor = new Color(105, 60, 30);
      g.lineWidth = 2.2;
      g.moveTo(-half + 4, -half + 4);
      g.lineTo(half - 4, half - 4);
      g.moveTo(-half + 4, half - 4);
      g.lineTo(half - 4, -half + 4);
      g.stroke();

      // 4. 四角加固生锈黑铁铁皮角码（带4颗凸起银白高光圆铆钉）
      g.fillColor = new Color(48, 52, 58);
      g.rect(-half, half - 7, 7, 7);
      g.rect(half - 7, half - 7, 7, 7);
      g.rect(-half, -half, 7, 7);
      g.rect(half - 7, -half, 7, 7);
      g.fill();

      // 铆钉
      g.fillColor = new Color(210, 215, 225);
      g.circle(-half + 3.5, half - 3.5, 1.2);
      g.circle(half - 3.5, half - 3.5, 1.2);
      g.circle(-half + 3.5, -half + 3.5, 1.2);
      g.circle(half - 3.5, -half + 3.5, 1.2);
      g.fill();

      // 5. 箱体黑色模板喷字“TNT”
      g.fillColor = new Color(25, 20, 18, 160);
      g.rect(-10, -3, 20, 6);
      g.fill();
    } else {
      // 红色烈性火药圆桶（弧形鼓腰桶板、双重铸铁铁箍与嘶嘶燃烧引信）
      // 1. 鼓腰木桶身
      g.fillColor = new Color(195, 36, 36);
      g.moveTo(-half + 3, -half);
      g.bezierCurveTo(-half - 3, 0, -half - 3, 0, -half + 3, half);
      g.lineTo(half - 3, half);
      g.bezierCurveTo(half + 3, 0, half + 3, 0, half - 3, -half);
      g.close();
      g.fill();

      // 2. 上下双道粗犷黑铁铁箍与黄铜铆钉
      g.fillColor = new Color(38, 40, 45);
      g.rect(-half - 1, -half + 6, sz + 2, 4);
      g.rect(-half - 1, half - 10, sz + 2, 4);
      g.fill();
      // 铁箍上的固定黄铜铆钉
      g.fillColor = new Color(230, 185, 60);
      g.circle(-8, -half + 8, 1.0);
      g.circle(0, -half + 8, 1.0);
      g.circle(8, -half + 8, 1.0);
      g.circle(-8, half - 8, 1.0);
      g.circle(0, half - 8, 1.0);
      g.circle(8, half - 8, 1.0);
      g.fill();

      // 3. 黄黑相间危险警戒条纹
      g.strokeColor = new Color(245, 210, 45);
      g.lineWidth = 2.5;
      g.moveTo(-half + 2, -1);
      g.lineTo(half - 2, -1);
      g.stroke();

      // 4. 桶身精致白色骷髅与交叉骨标识
      g.fillColor = new Color(255, 255, 255);
      g.circle(0, 5, 4.5); // 颅骨
      g.fill();
      g.strokeColor = new Color(255, 255, 255);
      g.lineWidth = 1.5;
      g.moveTo(-5, -3);
      g.lineTo(5, 3);
      g.moveTo(5, -3);
      g.lineTo(-5, 3);
      g.stroke();
      // 眼窝
      g.fillColor = new Color(20, 20, 20);
      g.circle(-1.8, 5, 1.1);
      g.circle(1.8, 5, 1.1);
      g.fill();

      // 5. 顶部燃烧冒火花的扭曲麻绳引信
      g.strokeColor = new Color(175, 130, 75);
      g.lineWidth = 1.8;
      g.moveTo(0, half);
      g.bezierCurveTo(4, half + 5, 1, half + 10, 5, half + 13);
      g.stroke();
      // 引线顶端火花
      g.fillColor = new Color(255, 225, 60);
      g.circle(5, half + 13, 2.5);
      g.fill();
      g.fillColor = new Color(255, 70, 20);
      g.circle(5, half + 13, 1.2);
      g.fill();
    }
  }

  // 掩体受到子弹攻击（带有弹性受击抖动回弹与碎屑）
  hitObstacle(index: number, dmg: number): boolean {
    if (index < 0 || index >= this.obstacles.length) return false;
    const ob = this.obstacles[index];
    ob.hp -= dmg;

    // 受击弹性形变动画（压扁弹起，生动反馈）
    tween(ob.node)
      .to(0.04, { scale: new Vec3(1.15, 0.88, 1) })
      .to(0.05, { scale: new Vec3(0.92, 1.1, 1) })
      .to(0.06, { scale: new Vec3(1.0, 1.0, 1) })
      .start();

    if (ob.hp <= 0) {
      // 破坏移除
      const pos = ob.node.position.clone();
      const isExp = ob.isExplosive;
      ob.node.destroy();
      this.obstacles.splice(index, 1);

      if (this.onBoxBreak) {
        this.onBoxBreak(pos, isExp);
      }
      return true;
    }
    return false;
  }
}
