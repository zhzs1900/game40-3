// 关卡导演与战斗波次闭环推进系统
// 严密负责8大关卡波次生成、随机突发事件、精英降临、Boss登场与防卡死心跳检测

import { Node, Vec3 } from 'cc';
import { AreaInfo, BuffPool, StageList } from './NightTownData';
import { SpiritActor, EnemyKind } from './SpiritActor';
import { NightTownGateSpirit } from './NightTownGateSpirit';

export interface WaveTarget {
  waveIdx: number;
  totalKillsNeeded: number;
  isBossWave: boolean;
  isEventWave: boolean;
  eventTitle?: string;
}

export class NightTownDirector {
  public curLevel: number = 1;
  public stageInfo!: AreaInfo;
  public curWave: number = 1;
  public maxWave: number = 3;

  public killsInWave: number = 0;
  public killsNeeded: number = 6;
  public isBossActive: boolean = false;
  public isCleared: boolean = false;

  // 活跃实体引用
  public activeEnemies: SpiritActor[] = [];
  public activeBoss: NightTownGateSpirit | null = null;

  // 关卡推进与事件通知
  public onWaveStart?: (wave: number, title: string) => void;
  public onTriggerUpgrade?: () => void;
  public onStageVictory?: () => void;

  // 心跳防卡死自检
  private deadlockCheckTimer: number = 0;
  private spawnCool: number = 0;
  private pendingSpawns: EnemyKind[] = [];

  constructor(level: number) {
    this.curLevel = level;
    // 安全读取关卡配置，防止越界
    const info = StageList.find(s => s.level === level) || StageList[0];
    this.stageInfo = info;
    this.maxWave = info.waveCount;
  }

  // 开启关卡第一波
  startLevel() {
    this.curWave = 1;
    this.killsInWave = 0;
    this.isBossActive = false;
    this.isCleared = false;
    this.activeEnemies = [];
    this.activeBoss = null;

    this.startCurrentWave();
  }

  // 开启当前波次
  private startCurrentWave() {
    this.killsInWave = 0;
    this.pendingSpawns = [];
    this.spawnCool = 0;
    const isBoss = this.curWave >= this.maxWave;
    const isEvent = !isBoss && this.curWave === 2;

    if (isBoss) {
      this.killsNeeded = 1; // 击败Boss即胜
      if (this.onWaveStart) {
        this.onWaveStart(this.curWave, `决战：${this.stageInfo.bossName}`);
      }
    } else if (isEvent) {
      this.killsNeeded = this.stageInfo.enemyCount + (this.curWave - 1) * 2 + 2;
      // 突发事件波次：马队突袭或狂暴突击
      const kindPool: EnemyKind[] = ['rider', 'bomber', 'gunner'];
      for (let i = 0; i < this.killsNeeded; i++) {
        this.pendingSpawns.push(kindPool[i % kindPool.length]);
      }
      if (this.onWaveStart) {
        this.onWaveStart(this.curWave, '突发事件：铁道突袭马队');
      }
    } else {
      // 常规波次
      this.killsNeeded = this.stageInfo.enemyCount + (this.curWave - 1) * 2;
      const kindPool: EnemyKind[] = ['brawler', 'gunner', 'shotgunner'];
      for (let i = 0; i < this.killsNeeded; i++) {
        this.pendingSpawns.push(kindPool[i % kindPool.length]);
      }
      if (this.onWaveStart) {
        this.onWaveStart(this.curWave, `第${this.curWave}波：清剿残匪`);
      }
    }
  }

  // 帧更新驱动刷怪调度与防卡死心跳
  updateDirector(
    dt: number,
    enemyRoot: Node,
    heroPos: Vec3,
    onEnemySpawn: (e: SpiritActor) => void,
    onBossSpawn: (b: NightTownGateSpirit) => void
  ) {
    if (this.isCleared) return;

    // 1. 处理待生成的常规敌人队列
    this.spawnCool -= dt;
    if (this.spawnCool <= 0 && this.pendingSpawns.length > 0 && this.activeEnemies.length < this.stageInfo.maxEnemies) {
      this.spawnCool = this.stageInfo.spawnInterval;
      const kind = this.pendingSpawns.shift()!;
      const isElite = this.pendingSpawns.length === 0 ||
        (this.curLevel >= 5 && this.pendingSpawns.length === Math.floor(this.killsNeeded / 2));
      const ePos = this.calcSafeSpawnPos(heroPos);

      const eNode = new Node(`Enemy_${Date.now()}`);
      eNode.setPosition(ePos);
      enemyRoot.addChild(eNode);

      const enemy = eNode.addComponent(SpiritActor);
      enemy.init(kind, isElite, this.curLevel);

      this.activeEnemies.push(enemy);
      onEnemySpawn(enemy);
    }

    // 2. 如果是Boss波且Boss未登场，且杂兵已清空，生成Boss
    if (this.curWave >= this.maxWave && !this.isBossActive && this.activeEnemies.length === 0) {
      this.isBossActive = true;
      const bNode = new Node('BossActor');
      bNode.setPosition(0, 220, 0); // 在上方霸气出场
      enemyRoot.addChild(bNode);

      const boss = bNode.addComponent(NightTownGateSpirit);
      boss.initBoss(this.stageInfo.bossName, this.stageInfo.bossHp, this.curLevel);
      this.activeBoss = boss;
      onBossSpawn(boss);
    }

    // 3. 严格防卡死自检闭环系统（每 1.2 秒检测一次状态一致性）
    this.deadlockCheckTimer += dt;
    if (this.deadlockCheckTimer >= 1.2) {
      this.deadlockCheckTimer = 0;
      this.checkAndResolveDeadlock(enemyRoot, heroPos, onEnemySpawn);
    }
  }

  // 敌人被消灭时的统计
  recordKill(enemy: SpiritActor) {
    const idx = this.activeEnemies.indexOf(enemy);
    if (idx < 0 || this.isCleared) return;
    if (idx >= 0) {
      this.activeEnemies.splice(idx, 1);
    }

    this.killsInWave++;

    // 检查是否完成当前波次
    if (!this.isBossActive && this.killsInWave >= this.killsNeeded && this.activeEnemies.length === 0) {
      this.advanceWave();
    }
  }

  // Boss 被击败
  recordBossKill() {
    if (this.isCleared) return;
    this.isBossActive = false;
    this.activeBoss = null;
    this.isCleared = true;

    // 立即停止战斗，胜利展示的延时由场景生命周期管理。
    if (this.onStageVictory) {
      this.onStageVictory();
    }
  }

  // 推进到下一波次并触发强化
  private advanceWave() {
    if (this.curWave < this.maxWave) {
      this.curWave++;
      // 波次间隔奖励三选一 Roguelite 升级
      if (this.onTriggerUpgrade) {
        this.onTriggerUpgrade();
      } else {
        this.startCurrentWave();
      }
    }
  }

  // 玩家选完升级后真正吹响新一波进攻号角
  startNextWave() {
    this.startCurrentWave();
  }

  // 计算安全合法的怪物刷新点（避开玩家周边180像素，限制在合法走廊）
  private calcSafeSpawnPos(heroPos: Vec3): Vec3 {
    let spawnX = 0;
    let spawnY = 0;

    for (let attempts = 0; attempts < 10; attempts++) {
      spawnX = (Math.random() - 0.5) * 520;
      spawnY = (Math.random() - 0.5) * 700;

      const dx = spawnX - heroPos.x;
      const dy = spawnY - heroPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 与主角保持适当安全战术距离
      if (dist >= 200 && dist <= 550) {
        break;
      }
    }

    return new Vec3(spawnX, spawnY, 0);
  }

  // 严格自检与防卡死兜底逻辑
  private checkAndResolveDeadlock(enemyRoot: Node, heroPos: Vec3, onEnemySpawn: (e: SpiritActor) => void) {
    // 清理已经被销毁但指针残留的空节点
    this.activeEnemies = this.activeEnemies.filter(e => e && e.isValid && e.node && e.node.isValid && !e.isDead);

    // 情况A：非Boss波，还有未满足的击杀指标，但屏幕上怪已死光且待生成队列空了（生成失败兜底）
    if (!this.isBossActive && this.killsInWave < this.killsNeeded && this.activeEnemies.length === 0 && this.pendingSpawns.length === 0) {
      // 紧急补刷一名替补邪祟，确保任务能够达成
      const eNode = new Node(`EnemyBackup_${Date.now()}`);
      eNode.setPosition(this.calcSafeSpawnPos(heroPos));
      enemyRoot.addChild(eNode);

      const enemy = eNode.addComponent(SpiritActor);
      enemy.init('gunner', false, this.curLevel);
      this.activeEnemies.push(enemy);
      onEnemySpawn(enemy);
      return;
    }

    // 情况B：非Boss波，如果指标已经达到，且场上敌人数为0，自动推进下一波
    if (!this.isBossActive && this.killsInWave >= this.killsNeeded && this.activeEnemies.length === 0) {
      this.advanceWave();
      return;
    }

    // 情况C：Boss波中，若Boss已被击杀但状态遗漏，强制判定通关
    if (this.isBossActive && this.activeBoss && (!this.activeBoss.isValid || this.activeBoss.isDead)) {
      this.recordBossKill();
    }
  }
}
