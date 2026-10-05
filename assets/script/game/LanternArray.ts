// 巡夜灯阵（Gun Kata）系统
// 负责电影级飞符时间、暗幕遮罩、卡牌环绕、目标红星标记与疾风连环拔枪放符

import { _decorator, Color, Component, Graphics, Node, tween, Vec3 } from 'cc';
import { TalismanRenderer } from './TalismanRenderer';

const { ccclass } = _decorator;

@ccclass('LanternArray')
export class LanternArray extends Component {
  public energy: number = 0;
  public readonly maxEnergy: number = 100;
  public isActive: boolean = false;
  private remainingTime: number = 0;
  private targets: Vec3[] = [];

  private darkMaskNode!: Node;
  private cardRingNode!: Node;
  private markRootNode!: Node;

  // 回调通知
  public onTimeSlow?: (factor: number) => void;
  public onExecuteKata?: (targets: Vec3[]) => void;
  public onEnergyChange?: (cur: number, max: number) => void;

  onLoad() {
    // 全屏暗角电影滤镜遮罩
    this.darkMaskNode = new Node('DarkMask');
    this.node.addChild(this.darkMaskNode);
    this.darkMaskNode.active = false;
    const mg = this.darkMaskNode.addComponent(Graphics);
    mg.fillColor = new Color(8, 6, 12, 185);
    mg.rect(-360, -640, 720, 1280);
    mg.fill();

    // 环绕飞牌节点
    this.cardRingNode = new Node('CardRing');
    this.node.addChild(this.cardRingNode);

    // 准星标记节点
    this.markRootNode = new Node('TargetMarks');
    this.node.addChild(this.markRootNode);
  }

  // 增加灯阵能量
  addEnergy(val: number) {
    if (this.isActive) return;
    this.energy = Math.min(this.maxEnergy, this.energy + val);
    if (this.onEnergyChange) {
      this.onEnergyChange(this.energy, this.maxEnergy);
    }
  }

  // 是否已蓄满
  isReady(): boolean {
    return this.energy >= this.maxEnergy;
  }

  // 激活触发巡夜灯阵
  triggerKata(heroPos: Vec3, enemyPositions: Vec3[]) {
    if (this.isActive) return;
    this.isActive = true;
    this.energy = 0;
    if (this.onEnergyChange) {
      this.onEnergyChange(0, this.maxEnergy);
    }

    // 1. 开启电影式黑幕遮罩
    this.darkMaskNode.active = true;

    // 2. 时间极度放慢至 0.2 倍速
    if (this.onTimeSlow) {
      this.onTimeSlow(0.2);
    }

    // 3. 生成 6 张发光符箓在巡夜师周围环绕飞舞
    this.spawnCardOrbit(heroPos);

    // 4. 快速标记视线内所有敌人
    const markedTargets: Vec3[] = [];
    const maxTargets = Math.min(6, enemyPositions.length);
    for (let i = 0; i < maxTargets; i++) {
      const ePos = enemyPositions[i];
      markedTargets.push(ePos.clone());
      this.spawnCrosshairMark(ePos, i * 0.1);
    }

    // 5. 慢动作持续 1.2 秒后结束飞符时间，恢复正常并瞬间拔枪爆发放符！
    this.targets = markedTargets;
    this.remainingTime = 1.2;
  }

  updateKata(dt: number) {
    if (!this.isActive) return;
    this.remainingTime -= dt;
    if (this.remainingTime <= 0) this.endKataAndShoot(this.targets);
  }

  // 生成环绕巡夜师旋转的发光卡牌光环
  private spawnCardOrbit(heroPos: Vec3) {
    for (const child of [...this.cardRingNode.children]) child.destroy();
    this.cardRingNode.removeAllChildren();
    this.cardRingNode.setPosition(heroPos);

    const count = 6;
    const r = 65;
    for (let i = 0; i < count; i++) {
      const c = new Node(`KataCard_${i}`);
      const ang = (i * Math.PI * 2) / count;
      c.setPosition(Math.cos(ang) * r, Math.sin(ang) * r, 0);
      this.cardRingNode.addChild(c);

      TalismanRenderer.drawCard(c, { id: i, suit: 'spade', val: 14 }, 26, 38);
    }

    // 高速旋转光环
    tween(this.cardRingNode)
      .by(1.2, { angle: 720 })
      .start();
  }

  // 在敌人头顶生成红色悬赏十字准星
  private spawnCrosshairMark(targetPos: Vec3, delay: number) {
    this.scheduleOnce(() => {
      const mark = new Node('Crosshair');
      mark.setPosition(targetPos);
      this.markRootNode.addChild(mark);

      const g = mark.addComponent(Graphics);
      // 猩红双准星圈与十字线
      g.strokeColor = new Color(255, 45, 45);
      g.lineWidth = 2.5;
      g.circle(0, 0, 22);
      g.stroke();

      g.moveTo(-30, 0);
      g.lineTo(30, 0);
      g.moveTo(0, -30);
      g.lineTo(0, 30);
      g.stroke();

      // 从外围快速缩放锁定
      mark.setScale(2.5, 2.5, 1);
      tween(mark)
        .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }, delay);
  }

  // 结束飞符时间，执行瞬间极速连击拔枪
  private endKataAndShoot(targets: Vec3[]) {
    this.darkMaskNode.active = false;
    for (const child of [...this.cardRingNode.children]) child.destroy();
    for (const child of [...this.markRootNode.children]) child.destroy();
    this.cardRingNode.removeAllChildren();
    this.markRootNode.removeAllChildren();
    this.isActive = false;

    // 恢复正常时间流速
    if (this.onTimeSlow) {
      this.onTimeSlow(1.0);
    }

    // 触发连续快速拔枪扫射所有被标记的目标！
    if (this.onExecuteKata && targets.length > 0) {
      this.onExecuteKata(targets);
    }
  }
}
