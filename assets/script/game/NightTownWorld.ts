// 8大关卡场景绘制与动态环境系统
// 绘制精细的古镇夜巡铁轨、车站木棚、酒馆百叶门、摇曳油灯、闪避风滚草、矿坑与蒸汽工厂
// 包含真实的动态环境动画（风滚草滚动、油灯烛光闪烁、百叶门晃动、蒸汽喷雾、箱体受击回弹）

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

// 掩体障碍物数据
export interface ObstacleItem {
  node: Node;
  pos: Vec3;
  width: number;
  height: number;
  isExplosive: boolean; // 是否是香炉
  hp: number;
}

@ccclass('NightTownWorld')
export class NightTownWorld extends Component {
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

    // 4. 生成战斗战术掩体符封木柜与香炉
    this.spawnObstacles(level);
  }

  // 绘制地面底色与细密荒野纹理
  private drawTerrainBase(level: number) {
    const bgNode=new Node('BlueStoneNight');this.bgGraphicsRoot.addChild(bgNode);
    const g=bgNode.addComponent(Graphics);g.clear();
    const palettes=[
      new Color(26,38,65),new Color(22,35,60),new Color(20,31,54),new Color(28,38,64),
      new Color(30,42,61),new Color(24,36,58),new Color(32,35,61),new Color(18,25,48)
    ];
    g.fillColor=palettes[Math.max(0,Math.min(7,level-1))];g.rect(-360,-640,720,1280);g.fill();
    // staggered blue-stone paving: visible joints without simple repeated rectangles
    g.strokeColor=new Color(79,96,126,95);g.lineWidth=1.2;
    for(let y=-610,row=0;y<610;y+=58,row++){
      const offset=row%2===0?-360:-320;
      for(let x=offset;x<360;x+=82){
        g.moveTo(x+4,y+4);g.bezierCurveTo(x+28,y-2,x+55,y+2,x+78,y+5);
        g.lineTo(x+76,y+50);g.bezierCurveTo(x+51,y+55,x+26,y+51,x+3,y+48);g.close();
      }
    } g.stroke();
    // evil cracks become stronger with level
    g.strokeColor=new Color(103,52,113,80+level*10);g.lineWidth=2;
    for(let i=0;i<7+level;i++){
      const x=-310+((i*97)%620), y=-500+((i*173)%980);
      g.moveTo(x,y);g.lineTo(x+14,y+19);g.lineTo(x+5,y+35);g.lineTo(x+24,y+52);g.stroke();
    }
    // warm pools of lantern light on the road
    for(let i=0;i<4;i++){
      const x=-250+i*165,y=-420+(i%2)*520;
      g.fillColor=new Color(245,177,79,22);g.ellipse(x,y,72,42);g.fill();
      g.fillColor=new Color(246,199,111,16);g.ellipse(x,y,46,28);g.fill();
    }
  }

  // 绘制各个关卡的专属特色矢量场景
  private drawSceneTheme(level: number) {
    const dNode=new Node('NightTownTheme');this.decoRoot.addChild(dNode);
    const g=dNode.addComponent(Graphics);
    // roof silhouettes and eaves frame the combat lane
    g.fillColor=new Color(13,22,39,225);
    g.moveTo(-360,430);g.lineTo(-285,500);g.lineTo(-205,445);g.lineTo(-155,490);g.lineTo(-115,455);g.lineTo(-115,640);g.lineTo(-360,640);g.close();g.fill();
    g.moveTo(360,390);g.lineTo(290,475);g.lineTo(225,440);g.lineTo(165,500);g.lineTo(115,455);g.lineTo(115,640);g.lineTo(360,640);g.close();g.fill();
    g.strokeColor=new Color(91,65,61,190);g.lineWidth=5;g.moveTo(-345,420);g.lineTo(-130,420);g.moveTo(130,420);g.lineTo(345,420);g.stroke();
    // each level adds a recognizable old-town landmark
    if(level===1||level===6){
      g.fillColor=new Color(70,55,56);g.roundRect(-72,255,144,105,7);g.fill();
      g.strokeColor=new Color(177,51,45);g.lineWidth=2;g.roundRect(-65,262,130,91,5);g.stroke();
      for(let x=-45;x<=45;x+=30){g.moveTo(x,270);g.lineTo(x,345);}g.stroke();
    } else if(level===2||level===7){
      g.strokeColor=new Color(205,167,88);g.lineWidth=3;g.moveTo(-170,340);g.bezierCurveTo(-60,395,62,300,175,350);g.stroke();
      for(let x=-150;x<=150;x+=60){g.fillColor=new Color(137,45,49);g.ellipse(x,335+(x%120===0?18:0),15,20);g.fill();}
    } else if(level===3){
      g.fillColor=new Color(23,30,44);g.circle(-190,300,62);g.fill();g.strokeColor=new Color(96,112,135);g.lineWidth=5;g.circle(-190,300,54);g.stroke();
      g.strokeColor=new Color(155,49,47);g.lineWidth=2;g.moveTo(-225,335);g.lineTo(-155,265);g.moveTo(-155,335);g.lineTo(-225,265);g.stroke();
    } else if(level===4){
      g.fillColor=new Color(73,66,76);g.moveTo(-300,250);g.lineTo(300,250);g.lineTo(235,330);g.lineTo(-235,330);g.close();g.fill();
      g.strokeColor=new Color(200,161,84);g.lineWidth=2;for(let x=-220;x<=220;x+=55){g.moveTo(x,260);g.lineTo(x+18,320);}g.stroke();
    } else if(level===5){
      g.fillColor=new Color(76,52,48);g.roundRect(-150,300,300,115,7);g.fill();g.strokeColor=new Color(205,165,87);g.lineWidth=2;g.roundRect(-140,310,280,95,5);g.stroke();
      g.fillColor=new Color(36,31,41);g.moveTo(-185,410);g.lineTo(0,500);g.lineTo(185,410);g.close();g.fill();
    } else {
      g.fillColor=new Color(54,47,60);g.roundRect(-210,280,420,160,9);g.fill();
      g.fillColor=new Color(28,25,37);g.moveTo(-250,440);g.lineTo(0,555);g.lineTo(250,440);g.close();g.fill();
      g.strokeColor=new Color(178,50,46);g.lineWidth=3;g.moveTo(-42,405);g.lineTo(0,455);g.lineTo(42,405);g.stroke();
    }
    // cinnabar seal strips on walls
    for(let x=-300;x<=300;x+=120){
      g.fillColor=new Color(223,205,160,215);g.roundRect(x,455,25,58,2);g.fill();
      g.strokeColor=new Color(177,48,44);g.lineWidth=1.5;g.moveTo(x+5,499);g.bezierCurveTo(x+19,490,x+3,475,x+19,463);g.stroke();
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

  // 2. 荒漠酒馆街（两层古镇夜巡木屋立面、系马桩、粗麻绳、巨大仙人掌）
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

  // 8. 灵息王城（王室红地毯、大理石地砖纹理、铁链与长明火盆）
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
    // swaying lantern
    this.lanternNode=new Node('SwayLantern');this.lanternNode.setPosition(level%2===0?-245:245,355,0);this.dynamicRoot.addChild(this.lanternNode);
    const lg=this.lanternNode.addComponent(Graphics);lg.fillColor=new Color(121,43,43);lg.roundRect(-14,-18,28,36,7);lg.fill();
    lg.strokeColor=new Color(222,177,85);lg.lineWidth=2;lg.moveTo(0,24);lg.lineTo(0,17);lg.roundRect(-14,-18,28,36,7);lg.stroke();
    lg.fillColor=new Color(255,199,91,210);lg.ellipse(0,0,8,13);lg.fill();
    // drifting prayer ribbon
    this.tumbleNode=new Node('DriftTalisman');this.tumbleNode.setPosition(-300,-80,0);this.dynamicRoot.addChild(this.tumbleNode);
    const tg=this.tumbleNode.addComponent(Graphics);tg.fillColor=new Color(226,211,170,180);tg.moveTo(-4,15);tg.lineTo(5,14);tg.lineTo(3,-15);tg.lineTo(-6,-13);tg.close();tg.fill();
    tg.strokeColor=new Color(174,49,45);tg.lineWidth=1.5;tg.moveTo(-2,8);tg.bezierCurveTo(4,3,-3,-3,2,-9);tg.stroke();
    this.doorsNode=undefined;this.steamNode=undefined;
  }

  public isPaused: boolean = false;

  // 每帧驱动环境动态（残符飘移、灯笼摇曳与灵火呼吸）
  update(dt: number) {
    if (this.isPaused) return;
    this.worldTimer += dt;

    // 1. 驱动风滚草在地面闪避蹦跳
    if (this.tumbleNode && this.tumbleNode.isValid) {
      const curX = this.tumbleNode.position.x + dt * 68;
      const driftY = -80 + Math.sin(this.worldTimer * 2.4) * 18;
      this.tumbleNode.setPosition(curX, driftY, 0);
      this.tumbleNode.angle = Math.sin(this.worldTimer * 2.1) * 12;

      // 跑出屏幕右侧后循环回到左侧
      if (curX > 380) {
        this.tumbleNode.setPosition(-380, -80, 0);
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
        g.roundRect(-14,-18,28,36,7); g.stroke();
        g.fillColor = new Color(121,43,43,220); g.roundRect(-12,-16,24,32,6); g.fill();
        g.fillColor = new Color(255,220,90); g.ellipse(0,-1,5,9); g.fill();
        g.fillColor = new Color(255,210,70,alpha); g.circle(0,-1,haloR); g.fill();
      }
    }

    // 3. 酒馆百叶摇摆门随微风轻晃
    if (this.doorsNode && this.doorsNode.isValid) {
      const scaleX = 1 + Math.sin(this.worldTimer * 2.6) * 0.08;
      this.doorsNode.setScale(scaleX, 1, 1);
    }
  }

  // 战术掩体布局：摆放坚固符封木柜与香炉
  private spawnObstacles(level: number) {
    const count=4+Math.min(3,Math.floor(level/2));
    for(let i=0;i<count;i++){
      const n=new Node(i%3===0?'IncenseBurner':'SealCabinet');
      const x=-235+((i*151)%470), y=-260+((i*213)%560);
      n.setPosition(x,y,0);this.obstacleRoot.addChild(n);
      const explosive=i%3===0;this.drawBoxShape(n,explosive);
      this.obstacles.push({node:n,pos:new Vec3(x,y,0),width:explosive?44:58,height:explosive?48:58,isExplosive:explosive,hp:explosive?55:85+level*5});
    }
    // ancient well as a solid-looking environmental cover without adding a new collision system
    if(level===3||level===8){
      const w=new Node('OldWell');w.setPosition(-190,120,0);this.obstacleRoot.addChild(w);
      const g=w.addComponent(Graphics);g.fillColor=new Color(48,52,64);g.ellipse(0,0,48,24);g.fill();g.strokeColor=new Color(112,124,143);g.lineWidth=5;g.ellipse(0,0,43,20);g.stroke();
      g.fillColor=new Color(14,20,32);g.ellipse(0,2,32,12);g.fill();g.strokeColor=new Color(111,54,118,150);g.lineWidth=2;g.moveTo(-18,2);g.bezierCurveTo(-5,11,7,-8,20,3);g.stroke();
    }
  }

  // 精细绘制符封木柜与带危险骷髅标的香炉（绝非简单几何图形）
  private drawBoxShape(node: Node, isExplosive: boolean) {
    const g=node.addComponent(Graphics);g.clear();
    if(!isExplosive){
      g.fillColor=new Color(80,58,49);g.roundRect(-29,-27,58,54,5);g.fill();
      g.strokeColor=new Color(40,34,39);g.lineWidth=4;g.roundRect(-29,-27,58,54,5);g.stroke();
      g.strokeColor=new Color(147,103,66);g.lineWidth=2;g.moveTo(-23,14);g.lineTo(23,14);g.moveTo(-23,-12);g.lineTo(23,-12);g.stroke();
      g.fillColor=new Color(224,208,165);g.roundRect(-8,-21,16,42,2);g.fill();
      g.strokeColor=new Color(177,49,44);g.lineWidth=1.8;g.moveTo(-4,13);g.bezierCurveTo(5,7,-5,-2,4,-10);g.moveTo(-5,-14);g.lineTo(5,-14);g.stroke();
      g.fillColor=new Color(202,158,78);g.circle(-21,19,2);g.circle(21,19,2);g.circle(-21,-19,2);g.circle(21,-19,2);g.fill();
    } else {
      g.fillColor=new Color(77,64,58);g.moveTo(-18,-20);g.lineTo(18,-20);g.lineTo(22,13);g.lineTo(14,23);g.lineTo(-14,23);g.lineTo(-22,13);g.close();g.fill();
      g.strokeColor=new Color(191,147,72);g.lineWidth=3;g.moveTo(-18,-10);g.lineTo(18,-10);g.moveTo(-18,12);g.lineTo(18,12);g.stroke();
      g.fillColor=new Color(174,48,44);g.roundRect(-10,-7,20,18,3);g.fill();
      g.strokeColor=new Color(238,196,105);g.lineWidth=1.5;g.moveTo(-5,6);g.lineTo(5,-2);g.moveTo(-4,-3);g.lineTo(5,6);g.stroke();
      g.fillColor=new Color(245,175,73,160);g.ellipse(0,27,8,11);g.fill();
    }
  }

  // 掩体受到飞符攻击（带有弹性受击抖动回弹与碎屑）
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
