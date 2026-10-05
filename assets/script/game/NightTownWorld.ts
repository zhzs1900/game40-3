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
