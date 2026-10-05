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
  private windCharmNodes: Node[] = [];
  private spiritMistNodes: Node[] = [];

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
    this.windCharmNodes = [];
    this.spiritMistNodes = [];

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
    const dNode=new Node('NightTownTheme');this.decoRoot.addChild(dNode);const g=dNode.addComponent(Graphics);

    // 两侧古镇建筑形成不规则层叠剪影：瓦脊、飞檐、木柱、窗棂和悬挂符条
    const drawHouse=(sx:number, baseY:number, mirror:number)=>{
      g.fillColor=new Color(12,21,38,238);
      g.moveTo(sx,baseY);g.lineTo(sx+mirror*42,baseY+18);g.lineTo(sx+mirror*77,baseY+52);g.lineTo(sx+mirror*116,baseY+30);
      g.lineTo(sx+mirror*154,baseY+74);g.lineTo(sx+mirror*196,baseY+42);g.lineTo(sx+mirror*220,baseY+18);g.lineTo(sx+mirror*220,640);g.lineTo(sx,640);g.close();g.fill();
      g.strokeColor=new Color(88,67,66,210);g.lineWidth=5;
      g.moveTo(sx+mirror*14,baseY+7);g.bezierCurveTo(sx+mirror*64,baseY+38,sx+mirror*130,baseY+13,sx+mirror*207,baseY+27);g.stroke();
      g.strokeColor=new Color(119,92,75,155);g.lineWidth=2;
      for(let i=0;i<4;i++){const x=sx+mirror*(38+i*48);g.moveTo(x,baseY+25);g.lineTo(x,baseY+145);}
      g.stroke();
      // 窗棂和暖灯，不用单一方块，采用弧顶窗+分格
      for(let i=0;i<3;i++){
        const x=sx+mirror*(55+i*58),y=baseY+96+(i%2)*18;
        g.fillColor=new Color(242,176,77,35);g.moveTo(x-mirror*14,y-17);g.lineTo(x+mirror*14,y-17);g.bezierCurveTo(x+mirror*16,y+8,x-mirror*16,y+8,x-mirror*14,y-17);g.fill();
        g.strokeColor=new Color(180,137,73,130);g.lineWidth=1;g.moveTo(x,y-15);g.lineTo(x,y+5);g.moveTo(x-mirror*10,y-3);g.lineTo(x+mirror*10,y-3);g.stroke();
      }
    };
    drawHouse(-360,402,1);drawHouse(360,382,-1);

    // 中央关卡地标
    if(level===1||level===6){
      g.fillColor=new Color(68,54,56);g.moveTo(-78,258);g.lineTo(-66,244);g.lineTo(66,244);g.lineTo(82,258);g.lineTo(70,360);g.lineTo(-70,360);g.close();g.fill();
      g.strokeColor=new Color(183,52,47);g.lineWidth=2.2;g.moveTo(-62,273);g.bezierCurveTo(-25,258,25,258,62,273);g.lineTo(57,347);g.lineTo(-57,347);g.close();g.stroke();
      g.strokeColor=new Color(205,167,90);g.lineWidth=1.2;for(let x=-42;x<=42;x+=28){g.moveTo(x,270);g.lineTo(x,345);}g.stroke();
    }else if(level===2||level===7){
      g.strokeColor=new Color(210,169,87);g.lineWidth=3;g.moveTo(-195,335);g.bezierCurveTo(-92,405,82,294,196,348);g.stroke();
      for(let x=-160;x<=160;x+=64){
        g.fillColor=new Color(131,43,47);g.moveTo(x-15,340);g.bezierCurveTo(x-18,320,x+18,320,x+15,340);g.lineTo(x+9,360);g.lineTo(x-9,360);g.close();g.fill();
        g.fillColor=new Color(250,187,82,165);g.ellipse(x,342,7,10);g.fill();
      }
    }else if(level===3){
      g.fillColor=new Color(22,29,43);g.ellipse(-190,300,64,40);g.fill();g.strokeColor=new Color(102,115,137);g.lineWidth=6;g.ellipse(-190,300,56,33);g.stroke();
      g.strokeColor=new Color(145,68,158,150);g.lineWidth=2;g.moveTo(-227,307);g.bezierCurveTo(-209,325,-182,276,-150,302);g.stroke();
      g.fillColor=new Color(224,208,165);g.moveTo(-204,345);g.lineTo(-190,353);g.lineTo(-177,345);g.lineTo(-182,325);g.lineTo(-199,325);g.close();g.fill();
    }else if(level===4){
      g.fillColor=new Color(70,66,76);g.moveTo(-300,250);g.bezierCurveTo(-170,230,170,230,300,250);g.lineTo(238,330);g.bezierCurveTo(115,310,-118,310,-238,330);g.close();g.fill();
      g.strokeColor=new Color(203,164,86);g.lineWidth=2;for(let x=-220;x<=220;x+=55){g.moveTo(x,258);g.bezierCurveTo(x+4,278,x+12,298,x+18,319);}g.stroke();
    }else if(level===5){
      g.fillColor=new Color(73,51,49);g.moveTo(-158,304);g.lineTo(-143,288);g.lineTo(142,288);g.lineTo(160,304);g.lineTo(147,415);g.lineTo(-145,415);g.close();g.fill();
      g.fillColor=new Color(31,29,39);g.moveTo(-188,412);g.bezierCurveTo(-96,450,-44,494,0,512);g.bezierCurveTo(52,488,104,451,190,412);g.close();g.fill();
      g.strokeColor=new Color(207,168,90);g.lineWidth=2;g.moveTo(-128,325);g.bezierCurveTo(-58,304,57,304,129,325);g.stroke();
    }else{
      g.fillColor=new Color(53,46,59);g.moveTo(-216,279);g.lineTo(-200,260);g.lineTo(200,260);g.lineTo(218,279);g.lineTo(208,441);g.lineTo(-205,441);g.close();g.fill();
      g.fillColor=new Color(26,24,36);g.moveTo(-258,440);g.bezierCurveTo(-142,462,-67,523,0,558);g.bezierCurveTo(70,522,145,466,260,440);g.close();g.fill();
      g.strokeColor=new Color(181,50,46);g.lineWidth=3;g.moveTo(-45,404);g.bezierCurveTo(-11,432,11,432,45,404);g.moveTo(0,435);g.lineTo(0,463);g.stroke();
    }

    // 墙面符纸、木牌裂纹、檐下绳结
    for(let x=-300;x<=300;x+=120){
      g.fillColor=new Color(223,205,160,215);g.moveTo(x-12,454);g.lineTo(x+11,452);g.lineTo(x+14,509);g.lineTo(x-10,512);g.close();g.fill();
      g.strokeColor=new Color(177,48,44);g.lineWidth=1.5;g.moveTo(x-6,500);g.bezierCurveTo(x+9,492,x-8,476,x+8,465);g.moveTo(x-5,481);g.lineTo(x+7,482);g.stroke();
      g.strokeColor=new Color(87,69,66,120);g.lineWidth=1;g.moveTo(x-22,437);g.bezierCurveTo(x-7,447,x+9,433,x+24,444);g.stroke();
    }
  }

  // 构建各个关卡的专属动态小道具（风滚草、摇晃油灯、百叶门、蒸汽喷雾）
  private setupDynamicProps(level: number) {
    this.lanternNode=new Node('SwayLantern');this.lanternNode.setPosition(level%2===0?-245:245,355,0);this.dynamicRoot.addChild(this.lanternNode);
    const lg=this.lanternNode.addComponent(Graphics);
    lg.strokeColor=new Color(117,83,64);lg.lineWidth=2;lg.moveTo(0,29);lg.bezierCurveTo(-7,23,7,20,0,16);lg.stroke();
    lg.fillColor=new Color(118,42,44);lg.moveTo(-14,14);lg.bezierCurveTo(-19,2,-15,-13,-8,-18);lg.lineTo(8,-18);lg.bezierCurveTo(15,-12,19,2,14,14);lg.close();lg.fill();
    lg.strokeColor=new Color(224,179,88);lg.lineWidth=2;lg.moveTo(-12,11);lg.bezierCurveTo(0,16,0,-18,12,11);lg.stroke();
    lg.fillColor=new Color(255,201,92,210);lg.moveTo(0,9);lg.bezierCurveTo(7,4,5,-7,0,-12);lg.bezierCurveTo(-6,-6,-6,4,0,9);lg.fill();

    this.tumbleNode=new Node('DriftTalisman');this.tumbleNode.setPosition(-300,-80,0);this.dynamicRoot.addChild(this.tumbleNode);
    const tg=this.tumbleNode.addComponent(Graphics);tg.fillColor=new Color(226,211,170,180);
    tg.moveTo(-5,16);tg.lineTo(6,13);tg.lineTo(4,-15);tg.lineTo(-7,-12);tg.close();tg.fill();
    tg.strokeColor=new Color(174,49,45);tg.lineWidth=1.5;tg.moveTo(-2,9);tg.bezierCurveTo(4,3,-4,-3,3,-10);tg.stroke();

    // 檐下风符与丝穗，分别摆动
    for(let i=0;i<5;i++){
      const n=new Node('WindCharm_'+i);n.setPosition(-280+i*140,390+(i%2)*26,0);this.dynamicRoot.addChild(n);this.windCharmNodes.push(n);
      const g=n.addComponent(Graphics);g.strokeColor=new Color(124,91,72,180);g.lineWidth=1.3;g.moveTo(0,18);g.lineTo(0,8);g.stroke();
      g.fillColor=new Color(221,205,165,200);g.moveTo(-6,8);g.lineTo(6,7);g.lineTo(4,-15);g.lineTo(-7,-13);g.close();g.fill();
      g.strokeColor=new Color(173,49,45);g.lineWidth=1.2;g.moveTo(-3,3);g.bezierCurveTo(4,0,-4,-6,3,-10);g.stroke();
      g.strokeColor=new Color(210,166,86,150);g.moveTo(-2,-15);g.bezierCurveTo(-6,-23,3,-25,-2,-32);g.moveTo(2,-15);g.bezierCurveTo(6,-22,-2,-27,3,-31);g.stroke();
    }

    // 地面低空邪雾，用曲线笔迹而非圆形烟团
    for(let i=0;i<4;i++){
      const n=new Node('SpiritMist_'+i);n.setPosition(-270+i*180,-210+(i%2)*150,0);this.dynamicRoot.addChild(n);this.spiritMistNodes.push(n);
      const g=n.addComponent(Graphics);g.strokeColor=new Color(92,68,122,65);g.lineWidth=5;
      g.moveTo(-28,0);g.bezierCurveTo(-12,13,3,-11,17,3);g.bezierCurveTo(26,11,35,1,42,7);g.stroke();
      g.strokeColor=new Color(115,82,142,38);g.lineWidth=2;g.moveTo(-18,8);g.bezierCurveTo(-1,18,13,-2,31,8);g.stroke();
    }
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

    for(let i=0;i<this.windCharmNodes.length;i++){
      const n=this.windCharmNodes[i];if(n?.isValid){n.angle=Math.sin(this.worldTimer*1.7+i*.8)*10;n.setScale(1,1+Math.sin(this.worldTimer*2.1+i)*.05,1);}
    }
    for(let i=0;i<this.spiritMistNodes.length;i++){
      const n=this.spiritMistNodes[i];if(n?.isValid){n.setPosition(-280+((this.worldTimer*(16+i*3)+i*170)%620),-220+(i%2)*160+Math.sin(this.worldTimer*.8+i)*12,0);n.setScale(1+Math.sin(this.worldTimer*.7+i)*.16,1,1);}
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
