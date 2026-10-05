// 游戏核心业务总入口
// 组装并驱动主角、弹匣卡牌、枪械、敌人波次、枪斗时刻与框架对接

import { _decorator, Color, Component, EventKeyboard, Graphics, Input, input, KeyCode, Label, Node, tween, UITransform, Vec3 } from 'cc';
import { GameUI } from '../framework/ui/GameUI';
import { rewardedAdGameService } from '../common/services/RewardedAdGameService';
import type { GameResult } from '../common/services/GameProgress';
import { baseGameConfig } from '../config/baseGameConfig';

import { BuffOption, BuffPool, CardItem, ComboType, HandCombo, ProfileMgr, SoundMgr, StageList, SuitType } from './GameData';
import { CardDeck } from './CardDeck';
import { HeroActor } from './HeroActor';
import { EnemyActor } from './EnemyActor';
import { BossCardKing } from './BossCardKing';
import { BulletData, BulletPool } from './BulletPool';
import { SceneWorld } from './SceneWorld';
import { GunSystem } from './GunSystem';
import { GunKataTime } from './GunKataTime';
import { TouchPad } from './TouchPad';
import { StageDirector } from './StageDirector';
import { CardRenderer } from './CardRenderer';

// 运行时确保封面只显示《纸牌赏金枪》，不修改config文件结构
(baseGameConfig as any).gameTitle = '纸牌赏金枪';

const { ccclass } = _decorator;

@ccclass('GameScene')
export class GameScene extends Component {
  public level: number = 1;
  private onFinish!: (result: GameResult) => void;
  private onMenuCallback!: () => void;

  // 核心子系统
  private deck: CardDeck = new CardDeck();
  private gunSys: GunSystem = new GunSystem('revolver');
  private director!: StageDirector;

  // 节点与组件
  private worldRoot!: Node;
  private hero!: HeroActor;
  private bulletPool!: BulletPool;
  private sceneWorld!: SceneWorld;
  private kataSys!: GunKataTime;
  private touchPad!: TouchPad;

  // 容器层
  private entityRoot!: Node;
  private uiRoot!: Node;

  // 游戏全局状态与流速
  public isPaused: boolean = false;
  private timeScale: number = 1.0;
  private hasFinished: boolean = false;
  private coinsInGame: number = 0;

  // 摇杆输入与射击朝向
  private currentMoveDir: Vec3 = new Vec3(0, 0, 0);
  private currentAimDir: Vec3 = new Vec3(1, 0, 0);

  // 翻滚冷却
  private rollCoolTimer: number = 0;
  private canRevive: boolean = true; // 每局提供一次广告复活机会
  private handLimit: number = 5;
  private rollCooldown: number = 1;
  private fireCoolTimer: number = 0;
  private pausedBeforeDisable: boolean = false;
  private adPending: boolean = false;
  private pendingShots: { data: BulletData; delay: number }[] = [];
  private pendingKataShots: { run: () => void; delay: number }[] = [];

  initialize(ui: GameUI, level: number, onFinish: (result: GameResult) => void, onMenu: () => void) {
    this.level = level;
    this.onFinish = onFinish;
    this.onMenuCallback = onMenu;

    // 底图渲染
    ui.image(this.node, 'background', 720, 1280);

    const gameplay = ui.node(this.node, 'GameplayRoot', 720, 1280);
    this.renderGameplay(gameplay, level);

    // 恢复框架原版暂停菜单按钮，使用原来的图标 icons/icon-1
    ui.button(this.node, '', 300, 580, 64, 64, () => {
      onMenu();
    }, 'icons/icon-1');
  }

  // 构建关卡节点与全套核心玩法系统
  protected renderGameplay(root: Node, level: number) {
    this.worldRoot = root;
    this.hasFinished = false;
    this.isPaused = false;
    this.timeScale = 1.0;
    this.canRevive = true;

    // 初始化西部主题原生音频系统
    SoundMgr.inst.init(root);

    // 读取存档并赋予金币与初始枪支
    const profile = ProfileMgr.load();
    this.coinsInGame = profile.coins;
    this.gunSys.curGun = profile.curGun || 'revolver';

    // 1. 创建场景背景与掩体
    const worldNode = new Node('SceneWorldNode');
    root.addChild(worldNode);
    this.sceneWorld = worldNode.addComponent(SceneWorld);
    this.sceneWorld.buildStage(level);
    this.sceneWorld.onBoxBreak = (pos, isExp) => this.handleBoxBroken(pos, isExp);

    // 2. 实体层（牛仔、敌人、Boss）
    this.entityRoot = new Node('EntityRoot');
    root.addChild(this.entityRoot);

    // 3. 子弹特效层
    const bNode = new Node('BulletPoolNode');
    root.addChild(bNode);
    this.bulletPool = bNode.addComponent(BulletPool);
    this.bulletPool.onShakeScreen = intensity => this.shakeWorld(intensity);

    // 4. 枪斗时刻层
    const kataNode = new Node('KataNode');
    root.addChild(kataNode);
    this.kataSys = kataNode.addComponent(GunKataTime);
    this.kataSys.onTimeSlow = factor => { this.timeScale = factor; };
    this.kataSys.onExecuteKata = targets => this.executeKataShooting(targets);
    this.kataSys.onEnergyChange = (cur, max) => this.touchPad.redrawKataBadge(cur, max);

    // 5. 实例化主角牛仔
    const heroNode = new Node('HeroCowboy');
    heroNode.setPosition(0, -180, 0);
    this.entityRoot.addChild(heroNode);
    this.hero = heroNode.addComponent(HeroActor);
    this.hero.switchGun(this.gunSys.curGun);

    // 6. UI与触控面板层
    this.uiRoot = new Node('UIRoot');
    root.addChild(this.uiRoot);
    this.touchPad = this.uiRoot.addComponent(TouchPad);

    // 关联触摸与电脑端键盘事件
    this.bindTouchControls();
    this.bindKeyboardControls();

    // 7. 关卡调度导演初始化
    this.director = new StageDirector(level);
    this.director.onWaveStart = (w, title) => {
      this.touchPad.updateStageName(`${this.director.stageInfo.name} - ${title}`);
    };
    this.director.onTriggerUpgrade = () => this.popRogueliteUpgrade();
    this.director.onStageVictory = () => this.handleVictory();

    // 8. 开局发初始手牌
    this.deck.resetDeck();
    this.deck.fillHand(5);
    this.refreshHandUI();
    this.touchPad.updateCoins(this.coinsInGame);
    this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);

    // 启动波次
    this.director.startLevel();
  }

  // 绑定全部移动端触摸与交互
  private bindTouchControls() {
    // 虚拟摇杆控制移动
    this.touchPad.onMove = dir => {
      this.currentMoveDir.set(dir);
      if (dir.length() > 0.1) {
        this.currentAimDir.set(dir.x, dir.y, 0).normalize();
        this.hero.setAim(this.currentAimDir);
      }
    };

    // 关联手牌选择变更
    this.touchPad.onSelectionChange = (selectedIds) => {
      const hand = this.deck.getHand();
      if (selectedIds.length > 0) {
        const picked = hand.filter(c => selectedIds.indexOf(c.id) >= 0);
        const combo = this.deck.evaluateCombo(picked);
        this.touchPad.setComboHint(combo);
      } else {
        const best = this.deck.pickBestCombo();
        this.touchPad.setComboHint(best);
      }
    };

    // 出牌射击大按钮
    this.touchPad.onFireCombo = () => {
      if (this.isPaused || this.hero.curAction === 'dead') return;
      this.fireBestCombo();
    };

    // 翻滚闪避大按钮
    this.touchPad.onRoll = () => {
      this.triggerHeroRoll();
    };

    // 枪斗时刻大徽章激活
    this.touchPad.onTriggerKata = () => {
      if (this.isPaused || !this.kataSys.isReady()) return;
      const enemyPositions = this.director.activeEnemies.map(e => e.node.position);
      if (this.director.activeBoss && this.director.activeBoss.isValid) {
        enemyPositions.push(this.director.activeBoss.node.position);
      }
      this.kataSys.triggerKata(this.hero.node.position, enemyPositions);
    };

    // 点击单张手牌快速打出
    this.touchPad.onCardClick = card => {
      if (this.isPaused || this.hero.curAction === 'dead') return;
      const combo: HandCombo = {
        type: 'single',
        cards: [card],
        power: 1.0,
        mainSuit: card.suit,
        name: '单牌点射'
      };
      this.executeFire(combo);
    };



    // 常驻【王牌补给 AD】广告按钮
    this.touchPad.onAdSupplyClick = () => {
      if (this.hasFinished || this.isPaused || this.adPending) return;
      this.adPending = true;
      this.isPaused = true;
      // 调用激励广告统一服务
      void rewardedAdGameService.show('trump_supply', () => {
        // 观看成功奖励：塞入万能Joker并补满手牌，同时触发枪斗时刻蓄能！
        if (!this.isValid || this.hasFinished) return;
        if (this.deck.getHand().length >= this.handLimit) {
          this.deck.discardCards([this.deck.getHand()[0]]);
        }
        this.deck.insertJoker();
        this.deck.fillHand(this.handLimit);
        this.refreshHandUI();
        this.kataSys.addEnergy(40);
        this.showFloatNotice('获得万能王牌Joker！');
      }).catch(() => {
        if (this.isValid) this.showFloatNotice('广告暂不可用，请稍后重试');
      }).then(() => {
        if (!this.isValid || this.hasFinished) return;
        this.adPending = false;
        if (this.enabled) this.isPaused = false;
        else this.pausedBeforeDisable = false;
      });
    };

    // 升级三选一选中
    this.touchPad.onSelectBuff = buff => {
      this.applyBuff(buff);
      // 波次补给只提供有限续航，保留上一波受伤的代价。
      this.hero.heal(12);
      this.hero.addShield(5);
      this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
      // 清理全场残余弹幕
      this.bulletPool.clearEnemyBullets();
      // 正式吹响下一波战斗号角
      this.director.startNextWave();
      this.isPaused = false; // 选完升级解冻游戏
    };
  }

  // 记录电脑端按键按下状态
  private keyState: { [key: number]: boolean } = {};

  // 绑定电脑键盘操作（方便直接在电脑浏览器用WASD测试）
  private bindKeyboardControls() {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  // 键盘按下事件
  private onKeyDown(e: EventKeyboard) {
    this.keyState[e.keyCode] = true;
    this.calcKeyDir();

    // 空格键翻滚
    if (e.keyCode === KeyCode.SPACE) {
      this.triggerHeroRoll();
    }
    // J 键或者回车键开火打出最优组合
    else if (e.keyCode === KeyCode.KEY_J || e.keyCode === KeyCode.ENTER) {
      if (!this.isPaused && this.hero.curAction !== 'dead') {
        this.fireBestCombo();
      }
    }
    // K 键或 E 键触发枪斗时刻
    else if (e.keyCode === KeyCode.KEY_K || e.keyCode === KeyCode.KEY_E) {
      if (!this.isPaused && this.kataSys.isReady()) {
        const enemyPositions = this.director.activeEnemies.map(en => en.node.position);
        if (this.director.activeBoss && this.director.activeBoss.isValid) {
          enemyPositions.push(this.director.activeBoss.node.position);
        }
        this.kataSys.triggerKata(this.hero.node.position, enemyPositions);
      }
    }
    // 数字键 1 到 5 打出对应手牌
    else if (e.keyCode >= KeyCode.DIGIT_1 && e.keyCode <= KeyCode.DIGIT_5) {
      const idx = e.keyCode - KeyCode.DIGIT_1;
      const hand = this.deck.getHand();
      if (idx < hand.length && !this.isPaused && this.hero.curAction !== 'dead') {
        const card = hand[idx];
        const combo: HandCombo = {
          type: 'single',
          cards: [card],
          power: 1.0,
          mainSuit: card.suit,
          name: '单牌点射'
        };
        this.executeFire(combo);
      }
    }
  }

  // 键盘松开事件
  private onKeyUp(e: EventKeyboard) {
    this.keyState[e.keyCode] = false;
    this.calcKeyDir();
  }

  // 计算 WASD 或上下左右方向键的合成移动向量
  private calcKeyDir() {
    let dx = 0;
    let dy = 0;

    // 向上：W 或 上箭头
    if (this.keyState[KeyCode.KEY_W] || this.keyState[KeyCode.ARROW_UP]) dy += 1;
    // 向下：S 或 下箭头
    if (this.keyState[KeyCode.KEY_S] || this.keyState[KeyCode.ARROW_DOWN]) dy -= 1;
    // 向左：A 或 左箭头
    if (this.keyState[KeyCode.KEY_A] || this.keyState[KeyCode.ARROW_LEFT]) dx -= 1;
    // 向右：D 或 右箭头
    if (this.keyState[KeyCode.KEY_D] || this.keyState[KeyCode.ARROW_RIGHT]) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const dir = new Vec3(dx, dy, 0).normalize();
      this.currentMoveDir.set(dir);
      this.currentAimDir.set(dir.x, dir.y, 0).normalize();
      this.hero.setAim(this.currentAimDir);
    } else {
      // 没按按键时，如果触控摇杆也没拖拽，就把速度清零
      if (!this.touchPad || !this.touchPad.isJoystickDragging()) {
        this.currentMoveDir.set(0, 0, 0);
      }
    }
  }

  // 触发翻滚闪避（触控按键和键盘空格共用）
  private triggerHeroRoll() {
    if (this.isPaused || this.rollCoolTimer > 0 || this.hero.curAction === 'dead' || this.hero.curAction === 'roll') return;
    this.rollCoolTimer = this.rollCooldown;
    const rollDir = this.currentMoveDir.length() > 0.1 ? this.currentMoveDir.clone().normalize() : this.currentAimDir.clone();
    this.hero.startRoll(rollDir);
    SoundMgr.inst.playRoll();

    // 快速翻滚位移
    this.rollDirection.set(rollDir);

    // 翻滚闪避加枪斗值
    this.kataSys.addEnergy(3);
  }

  // 刷新手牌UI展示与出牌大按钮提示文本
  private refreshHandUI() {
    const hand = this.deck.getHand();
    this.touchPad.updateHandDisplay(hand);
    const best = this.deck.pickBestCombo();
    this.touchPad.setComboHint(best);
  }

  // 寻找最近的敌对目标作为自动微锁朝向
  private findNearestTargetPos(): Vec3 | null {
    const hPos = this.hero.node.position;
    let closestPos: Vec3 | null = null;
    let minD = 999999;

    // 遍历小怪
    for (const e of this.director.activeEnemies) {
      if (e.isValid && !e.isDead) {
        const d = Vec3.distance(hPos, e.node.position);
        if (d < minD) {
          minD = d;
          closestPos = e.node.position;
        }
      }
    }

    // 检查Boss
    if (this.director.activeBoss && this.director.activeBoss.isValid && !this.director.activeBoss.isDead) {
      const d = Vec3.distance(hPos, this.director.activeBoss.node.position);
      if (d < minD) {
        closestPos = this.director.activeBoss.node.position;
      }
    }

    return closestPos;
  }

  // 打出当前手里的最佳牌型组合或玩家选中的牌组
  private fireBestCombo() {
    const hand = this.deck.getHand();
    if (hand.length === 0) return;

    let combo: HandCombo;
    // 优先检查玩家是否手动点选了手牌组合
    const selIds = Array.from(this.touchPad.selectedIds);
    if (selIds.length > 0) {
      const picked = hand.filter(c => selIds.indexOf(c.id) >= 0);
      combo = this.deck.evaluateCombo(picked);
      this.touchPad.clearSelection();
    } else {
      combo = this.deck.pickBestCombo();
    }

    this.executeFire(combo);
  }

  // 执行具体开火流程：飞牌动画 -> 枪口闪光 -> 投射子弹
  private executeFire(combo: HandCombo) {
    if (this.isPaused || this.hasFinished || this.fireCoolTimer > 0 || this.hero.curAction === 'dead' || combo.cards.length === 0) return;
    const handIds = new Set(this.deck.getHand().map(c => c.id));
    if (combo.cards.some(c => !handIds.has(c.id))) return;
    this.fireCoolTimer = this.gunSys.getConfig().fireRate;

    // 自动微调枪口对准最近敌人
    const nearest = this.findNearestTargetPos();
    if (nearest) {
      this.currentAimDir.set(nearest.x - this.hero.node.position.x, nearest.y - this.hero.node.position.y, 0).normalize();
      this.hero.setAim(this.currentAimDir);
    }

    // 从手牌中消耗
    this.deck.discardCards(combo.cards);
    this.deck.recordPlay(combo.type);

    // 累计枪斗值（牌型越高，充能越快）
    let addKata = 3;
    if (combo.type === 'pair') addKata = 6;
    if (combo.type === 'trips') addKata = 10;
    if (combo.type === 'straight' || combo.type === 'flush') addKata = 18;
    if (combo.type === 'fullhouse') addKata = 25;
    if (combo.type === 'quads') addKata = 100;
    this.kataSys.addEnergy(addKata);

    // 若打出四条，直接激活短暂枪斗时刻！
    if (combo.type === 'quads') {
      const enemyPositions = this.director.activeEnemies.map(e => e.node.position);
      if (this.director.activeBoss && this.director.activeBoss.isValid) {
        enemyPositions.push(this.director.activeBoss.node.position);
      }
      this.kataSys.triggerKata(this.hero.node.position, enemyPositions);
    }

    // 枪手后坐力动作
    this.hero.playShootRecoil();
    SoundMgr.inst.playShoot();
    SoundMgr.inst.playCard();

    // 立即获得最新的枪口位置与朝向，瞬间发射！
    const muzzle = this.hero.getMuzzlePos();
    const heroPos = this.hero.node.position;

    // 枪口火焰与烟雾弹壳
    this.bulletPool.playMuzzleFlash(muzzle, this.currentAimDir);

    // 生成各花色与牌型的专属子弹即刻出膛
    const { bullets, delays } = this.gunSys.makeBullets(muzzle, this.currentAimDir, combo);
    for (let i = 0; i < bullets.length; i++) {
      const bData = bullets[i];
      const dTime = delays[i];
      if (dTime <= 0) {
        this.bulletPool.spawnBullet(bData);
      } else {
        this.pendingShots.push({ data: bData, delay: dTime });
      }
    }

    // 纸牌飞出并化作流光注入枪口
    if (combo.cards.length > 0) {
      CardRenderer.playFlyAnim(this.worldRoot, combo.cards[0], new Vec3(0, -450, 0), heroPos, () => {});
    }

    // 补充新牌
    this.deck.fillHand(this.handLimit);
    this.refreshHandUI();
  }

  // 枪斗时刻极速拔枪扫射
  private executeKataShooting(targets: Vec3[]) {
    if (this.hasFinished || this.hero.curAction === 'dead') return;
    SoundMgr.inst.playKata();
    const hPos = this.hero.node.position;
    for (let i = 0; i < targets.length; i++) {
      const tPos = targets[i];
      const dir = new Vec3(tPos.x - hPos.x, tPos.y - hPos.y, 0).normalize();

      this.pendingKataShots.push({ run: () => {
        if (!this.isValid || this.hasFinished || this.hero.curAction === 'dead') return;
        this.hero.setAim(dir);
        this.hero.playShootRecoil();
        const muzzle = this.hero.getMuzzlePos();
        this.bulletPool.playMuzzleFlash(muzzle, dir);

        // 终结穿甲弹
        this.bulletPool.spawnBullet({
          pos: muzzle,
          dir,
          spd: 900,
          dmg: 120,
          suit: 'spade',
          combo: 'quads',
          isHero: true,
          pierce: 5,
          bounce: 0,
          blastR: 60,
          vampire: 2,
          lifeTime: 1.5,
        });
      }, delay: i * 0.08 });
    }
  }

  // 敌怪开火处理
  private handleEnemyFire(fromPos: Vec3, toPos: Vec3, dmg: number) {
    const dir = new Vec3(toPos.x - fromPos.x, toPos.y - fromPos.y, 0).normalize();
    this.bulletPool.spawnBullet({
      pos: fromPos.clone(),
      dir,
      spd: 300 + (this.level - 1) * 10,
      dmg,
      suit: 'spade',
      combo: 'single',
      isHero: false,
      pierce: 0,
      bounce: 0,
      blastR: 0,
      vampire: 0,
      lifeTime: 2.8,
    });
  }

  // Boss 释放牌型大招投射
  private handleBossFire(fromPos: Vec3, toPos: Vec3, combo: ComboType, suit: SuitType) {
    const dir = new Vec3(toPos.x - fromPos.x, toPos.y - fromPos.y, 0).normalize();
    const rad = Math.atan2(dir.y, dir.x);
    const damageMul = 1 + (this.level - 1) * 0.045;
    const speedBonus = (this.level - 1) * 10;

    if (combo === 'trips') {
      // 三向大招散射
      for (const offset of [-0.3, 0, 0.3]) {
        const curDir = new Vec3(Math.cos(rad + offset), Math.sin(rad + offset), 0);
        this.bulletPool.spawnBullet({
          pos: fromPos.clone(),
          dir: curDir,
          spd: 340 + speedBonus,
          dmg: Math.round(18 * damageMul),
          suit,
          combo,
          isHero: false,
          pierce: 0,
          bounce: 1,
          blastR: 30,
          vampire: 0,
          lifeTime: 3.0,
        });
      }
    } else {
      // 强力重弹
      this.bulletPool.spawnBullet({
        pos: fromPos.clone(),
        dir,
        spd: 360 + speedBonus,
        dmg: Math.round((combo === 'single' ? 16 : 25) * damageMul),
        suit,
        combo,
        isHero: false,
        pierce: 1,
        bounce: 0,
        blastR: 50,
        vampire: 0,
        lifeTime: 3.0,
      });
    }
  }

  // 掩体木箱被打碎
  private handleBoxBroken(pos: Vec3, isExplode: boolean) {
    if (isExplode) {
      // 炸药桶轰鸣爆炸
      this.bulletPool.playExplosion(pos, 90);
      // 炸裂飞溅玻璃与碎石
      CardRenderer.playGlassShards(this.worldRoot, pos);
      // 伤害周边所有敌人
      this.damageEnemiesInRadius(pos, 90, 80);
    } else {
      // 木屑与微量碎屑飞散
      this.bulletPool.playWoodSplinters(pos);
      if (Math.random() < 0.5) {
        CardRenderer.playGlassShards(this.worldRoot, pos);
      }
    }
  }

  // 范围爆炸伤害
  private damageEnemiesInRadius(center: Vec3, radius: number, dmg: number) {
    for (let i = this.director.activeEnemies.length - 1; i >= 0; i--) {
      const e = this.director.activeEnemies[i];
      if (e.isValid && !e.isDead) {
        if (Vec3.distance(center, e.node.position) <= radius) {
          const dead = e.takeDmg(dmg);
          if (dead) {
            this.handleEnemyKilled(e);
          }
        }
      }
    }

    if (this.director.activeBoss && this.director.activeBoss.isValid && !this.director.activeBoss.isDead) {
      if (Vec3.distance(center, this.director.activeBoss.node.position) <= radius) {
        const dead = this.director.activeBoss.takeDmg(dmg);
        if (dead) {
          this.director.recordBossKill();
        }
      }
    }
  }

  // 敌人被消灭，掉落金币与统计
  private handleEnemyKilled(e: EnemyActor) {
    if (this.director.activeEnemies.indexOf(e) < 0) return;
    const gold = e.isElite ? 25 : 8;
    this.coinsInGame += gold;
    this.touchPad.updateCoins(this.coinsInGame);
    ProfileMgr.addGold(gold);
    // 敌人被干掉时，爆散出一小堆赏金金币并播放叮当金币音
    SoundMgr.inst.playCoin();
    this.bulletPool.playCoinDrop(e.node.position, e.isElite ? 8 : 4);
    this.director.recordKill(e);
  }

  // 弹出赌桌三选一升级
  private popRogueliteUpgrade() {
    this.isPaused = true; // 冻结战斗，敌人停止攻击
    SoundMgr.inst.playCard();
    const candidates = [...BuffPool].sort(() => Math.random() - 0.5).slice(0, 3);
    this.touchPad.showUpgradeChoices(candidates);
  }

  // 玩家选择升级
  private applyBuff(buff: BuffOption) {
    switch (buff.id) {
      case 'bounce_plus':
        this.gunSys.extraBounce++;
        break;
      case 'vampire':
        this.gunSys.vampireBonus += 1;
        break;
      case 'straight_spd':
        this.gunSys.straightSpdUp = true;
        break;
      case 'blast_range':
        this.gunSys.blastRadiusMul += 0.5;
        break;
      case 'pierce_dmg':
        this.gunSys.extraPierce++;
        break;
      case 'crit_master':
        this.gunSys.critDmgMul += 0.4;
        break;
      case 'hand_expand':
        this.handLimit = 6;
        this.deck.fillHand(this.handLimit);
        this.refreshHandUI();
        break;
      case 'gun_power':
        this.gunSys.globalDmgMul += 0.2;
        break;
      case 'shield_heart':
        this.hero.addShield(20);
        this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
        break;
      case 'roll_cool':
        this.rollCooldown = 0.65;
        this.rollCoolTimer = 0;
        break;
      case 'gun_shotgun':
        this.gunSys.curGun = 'shotgun';
        this.hero.switchGun('shotgun');
        break;
      case 'gun_lever':
        this.gunSys.curGun = 'lever';
        this.hero.switchGun('lever');
        break;
      case 'gun_bounce':
        this.gunSys.curGun = 'bounce';
        this.hero.switchGun('bounce');
        break;
      case 'gun_cannon':
        this.gunSys.curGun = 'cannon';
        this.hero.switchGun('cannon');
        break;
    }

    // 保存当前武器状态到存档
    const profile = ProfileMgr.load();
    profile.curGun = this.gunSys.curGun;
    ProfileMgr.save(profile);

    this.showFloatNotice(`获得强化：${buff.name}`);
  }

  // 浮动简短通知
  private showFloatNotice(msg: string) {
    const tipNode = new Node('FloatTip');
    tipNode.setPosition(0, 260, 0);
    this.uiRoot.addChild(tipNode);

    const g = tipNode.addComponent(Graphics);
    g.fillColor = new Color(30, 20, 15, 220);
    g.roundRect(-120, -18, 240, 36, 6);
    g.fill();
    g.strokeColor = new Color(225, 185, 70);
    g.lineWidth = 1.5;
    g.roundRect(-120, -18, 240, 36, 6);
    g.stroke();

    const lbl = tipNode.addComponent(Label);
    lbl.string = msg;
    lbl.fontSize = 18;
    lbl.color = new Color(255, 235, 180);

    tween(tipNode)
      .by(0.8, { position: new Vec3(0, 45, 0) })
      .to(0.2, { scale: new Vec3(0, 0, 1) })
      .call(() => tipNode.destroy())
      .start();
  }

  // 屏幕轻微震颤特效
  private shakeWorld(intensity: number) {
    tween(this.worldRoot)
      .to(0.04, { position: new Vec3((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity, 0) })
      .to(0.04, { position: new Vec3(0, 0, 0) })
      .start();
  }

  // 游戏胜利
  private handleVictory() {
    if (this.hasFinished) return;
    this.hasFinished = true;
    this.isPaused = true;
    SoundMgr.inst.playWin();
    this.showFloatNotice('赏金目标全歼！大获全胜！');
    this.scheduleOnce(() => {
      this.finishGame('victory');
    }, 1.2);
  }

  // 游戏失败与激励广告复活
  private handleDefeat() {
    if (this.hasFinished) return;

    // 如果还有复活机会，弹出激励广告复活提示
    if (this.canRevive) {
      this.canRevive = false;
      this.isPaused = true;

      // 弹出广告复活确认框
      const popRevive = new Node('ReviveDialog');
      this.uiRoot.addChild(popRevive);

      const g = popRevive.addComponent(Graphics);
      g.fillColor = new Color(15, 12, 10, 230);
      g.roundRect(-180, -120, 360, 240, 10);
      g.fill();
      g.strokeColor = new Color(225, 175, 60);
      g.lineWidth = 3;
      g.roundRect(-180, -120, 360, 240, 10);
      g.stroke();

      const titleNode = new Node('Title');
      titleNode.setPosition(0, 65, 0);
      popRevive.addChild(titleNode);
      const tl = titleNode.addComponent(Label);
      tl.string = '猎人濒死！是否突围？';
      tl.fontSize = 20;
      tl.color = new Color(255, 230, 150);

      // 确定复活按钮（带AD）
      const okBtn = new Node('OkBtn');
      okBtn.addComponent(UITransform).setContentSize(200, 44);
      okBtn.setPosition(0, -15, 0);
      popRevive.addChild(okBtn);
      const bg = okBtn.addComponent(Graphics);
      bg.fillColor = new Color(175, 40, 35);
      bg.roundRect(-100, -22, 200, 44, 6);
      bg.fill();
      bg.strokeColor = new Color(255, 215, 70);
      bg.lineWidth = 2;
      bg.roundRect(-100, -22, 200, 44, 6);
      bg.stroke();

      const okTxt = new Node('Txt');
      okBtn.addChild(okTxt);
      const okl = okTxt.addComponent(Label);
      okl.string = '观看广告复活 (AD)';
      okl.fontSize = 17;
      okl.color = new Color(255, 245, 210);

      okBtn.on(Node.EventType.TOUCH_END, () => {
        if (this.adPending) return;
        this.adPending = true;
        void rewardedAdGameService.show('revive', () => {
          if (!this.isValid || this.hasFinished) return;
          popRevive.destroy();
          // 广告观看成功：重获新生！
          this.hero.revive();
          if (this.enabled) this.isPaused = false;
          else this.pausedBeforeDisable = false;
          // 清除全场所有敌人的威胁弹幕
          this.bulletPool.clearEnemyBullets();
          // 刷新血量UI
          this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
          // 在主角脚下爆开强力击退冲击波，重伤近身敌人
          this.bulletPool.playExplosion(this.hero.node.position, 160);
          this.damageEnemiesInRadius(this.hero.node.position, 160, 90);
          this.showFloatNotice('绝处逢生！恢复70%生命！');
        }).catch(() => false).then(granted => {
          if (!this.isValid || this.hasFinished) return;
          this.adPending = false;
          if (!granted) this.showFloatNotice('广告未完成，可重试或放弃');
        });
      });

      // 放弃按钮
      const cancelBtn = new Node('CancelBtn');
      cancelBtn.addComponent(UITransform).setContentSize(180, 40);
      cancelBtn.setPosition(0, -75, 0);
      popRevive.addChild(cancelBtn);
      const cl = cancelBtn.addComponent(Label);
      cl.string = '放弃抵抗';
      cl.fontSize = 16;
      cl.color = new Color(170, 160, 155);

      cancelBtn.on(Node.EventType.TOUCH_END, () => {
        if (this.adPending) return;
        popRevive.destroy();
        this.hasFinished = true;
        this.finishGame('failure');
      });
      return;
    }

    this.hasFinished = true;
    this.finishGame('failure');
  }

  // 每一帧逻辑更新循环（遵循暂停与时间缩放约束）
  private rollDirection: Vec3 = new Vec3();
  update(rawDt: number) {
    if (this.isPaused || this.hasFinished) return;

    const dt = rawDt * this.timeScale;
    this.kataSys.updateKata(rawDt);
    for (let i = this.pendingKataShots.length - 1; i >= 0; i--) {
      const shot = this.pendingKataShots[i];
      shot.delay -= rawDt;
      if (shot.delay <= 0) {
        shot.run();
        this.pendingKataShots.splice(i, 1);
      }
    }
    this.fireCoolTimer = Math.max(0, this.fireCoolTimer - dt);
    for (let i = this.pendingShots.length - 1; i >= 0; i--) {
      const shot = this.pendingShots[i];
      shot.delay -= dt;
      if (shot.delay <= 0) {
        this.bulletPool.spawnBullet(shot.data);
        this.pendingShots.splice(i, 1);
      }
    }
    if (this.hero.curAction === 'roll') {
      const pos = this.hero.node.position;
      this.hero.node.setPosition(
        Math.max(-280, Math.min(280, pos.x + this.rollDirection.x * 120 / 0.35 * dt)),
        Math.max(-420, Math.min(380, pos.y + this.rollDirection.y * 120 / 0.35 * dt)), 0);
    }

    // 1. 冷却计数
    if (this.rollCoolTimer > 0) {
      this.rollCoolTimer -= dt;
    }

    // 2. 主角移动与动画
    const isMoving = this.currentMoveDir.length() > 0.1 && this.hero.curAction !== 'dead';
    if (isMoving && this.hero.curAction !== 'roll') {
      const step = this.hero.moveSpd * dt;
      const nx = this.hero.node.position.x + this.currentMoveDir.x * step;
      const ny = this.hero.node.position.y + this.currentMoveDir.y * step;

      // 限制主角在合法屏幕活动区域内
      const clampedX = Math.max(-280, Math.min(280, nx));
      const clampedY = Math.max(-420, Math.min(380, ny));
      this.hero.node.setPosition(clampedX, clampedY, 0);
    }
    this.hero.updateActor(dt, isMoving);

    // 3. 关卡调度器更新
    this.director.updateDirector(
      dt,
      this.entityRoot,
      this.hero.node.position,
      enemy => {
        enemy.onEnemyFire = (from, to, dmg) => this.handleEnemyFire(from, to, dmg);
      },
      boss => {
        boss.onBossFire = (from, to, c, s) => this.handleBossFire(from, to, c, s);
        boss.onSummonMinions = pos => {
          // 召唤2个近卫
          for (let i = 0; i < 2; i++) {
            const mNode = new Node(`Minion_${Date.now()}_${i}`);
            mNode.setPosition(pos.x + (i === 0 ? -50 : 50), pos.y - 40, 0);
            this.entityRoot.addChild(mNode);
            const m = mNode.addComponent(EnemyActor);
            m.init('gunner', false, this.level);
            m.onEnemyFire = (f, t, d) => this.handleEnemyFire(f, t, d);
            this.director.activeEnemies.push(m);
          }
        };
        boss.onHandBroken = () => {
          this.showFloatNotice('破牌成功！Boss陷入虚弱！');
        };
      }
    );
    if (this.isPaused || this.hasFinished) return;

    // 4. 驱动所有敌人与Boss行为
    const hPos = this.hero.node.position;
    for (const e of this.director.activeEnemies) {
      if (e.isValid && !e.isDead) {
        e.updateEnemy(dt, hPos);
      }
    }
    if (this.director.activeBoss && this.director.activeBoss.isValid) {
      this.director.activeBoss.updateBoss(dt, hPos);
    }

    // 5. 更新子弹物理与特效
    this.bulletPool.updateBullets(dt, { minX: -320, maxX: 320, minY: -580, maxY: 580 });

    // 6. 子弹碰撞检测
    this.checkBulletCollisions();
  }

  // 子弹与实体/掩体碰撞判定
  private checkBulletCollisions() {
    const bullets = this.bulletPool.getActiveBullets();
    const hPos = this.hero.node.position;

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      if (this.isPaused || this.hasFinished) return;
      const b = bullets[bi];
      const bPos = b.node.position;

      if (b.data.isHero) {
        // 玩家发射的子弹 -> 检测掩体与敌人
        let consumed = false;

        // 检测木箱与炸药桶
        for (let oi = this.sceneWorld.obstacles.length - 1; oi >= 0; oi--) {
          const ob = this.sceneWorld.obstacles[oi];
          if (!b.hitTargets.has(ob.node) && Vec3.distance(bPos, ob.pos) <= ob.width * 0.6) {
            b.hitTargets.add(ob.node);
            this.sceneWorld.hitObstacle(oi, b.data.dmg);
            if (b.data.pierce <= 0) {
              this.bulletPool.removeBullet(bi);
              consumed = true;
              break;
            }
            b.data.pierce--;
          }
        }
        if (consumed) continue;

        // 检测常规敌人
        const enemies = [...this.director.activeEnemies];
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const enemy = enemies[ei];
          if (enemy.isValid && !enemy.isDead && !b.hitTargets.has(enemy.node)) {
            const ePos = enemy.node.position;
            const hitR = enemy.kind === 'rider' ? 55 : 42;
            const distBullet = Vec3.distance(bPos, ePos);
            const distHero = Vec3.distance(hPos, ePos);
            const isPointBlank = distHero <= 60;

            if (distBullet <= hitR) {
              b.hitTargets.add(enemy.node);
              const killed = enemy.takeDmg(b.data.dmg);
              if (killed) this.handleEnemyKilled(enemy);

              // 贴身射击产生小幅物理击退
              if (isPointBlank && !killed) {
                const repulseDir = new Vec3(ePos.x - hPos.x, ePos.y - hPos.y, 0).normalize();
                enemy.node.setPosition(ePos.x + repulseDir.x * 25, ePos.y + repulseDir.y * 25, 0);
              }

              // 飞溅火花与跳跃伤害数字
              SoundMgr.inst.playHit();
              this.bulletPool.playHitSparks(bPos, b.data.dir);
              this.bulletPool.playDamageNumber(enemy.node.position, b.data.dmg);

              // 黑桃穿透时划出暗紫色割裂光痕
              if (b.data.suit === 'spade') {
                this.bulletPool.playSpadeSlash(enemy.node.position);
              }

              // 红桃吸血特性：发射小红心飞向牛仔主角
              if (b.data.vampire > 0) {
                this.bulletPool.playVampireFly(enemy.node.position, this.hero.node);
                this.hero.heal(b.data.vampire);
                this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
              }

              // 方块范围爆炸
              if (b.data.blastR > 0) {
                SoundMgr.inst.playExplosion();
                this.bulletPool.playExplosion(bPos, b.data.blastR);
                this.damageEnemiesInRadius(bPos, b.data.blastR, b.data.dmg * 0.6);
              }


              // 穿透计数递减
              if (b.data.pierce > 0) {
                b.data.pierce--;
              } else {
                this.bulletPool.removeBullet(bi);
                consumed = true;
                break;
              }
            }
          }
        }
        if (consumed) continue;

        // 检测Boss
        const boss = this.director.activeBoss;
        if (boss && boss.isValid && !boss.isDead) {
          if (!b.hitTargets.has(boss.node) && Vec3.distance(bPos, boss.node.position) <= 65) {
            b.hitTargets.add(boss.node);
            const killed = boss.takeDmg(b.data.dmg);
            SoundMgr.inst.playHit();
            this.bulletPool.playHitSparks(bPos, b.data.dir);
            this.bulletPool.playDamageNumber(boss.node.position, b.data.dmg);

            if (b.data.suit === 'spade') {
              this.bulletPool.playSpadeSlash(boss.node.position);
            }

            if (b.data.vampire > 0) {
              this.bulletPool.playVampireFly(boss.node.position, this.hero.node);
              this.hero.heal(b.data.vampire);
              this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
            }
            if (b.data.blastR > 0) {
              SoundMgr.inst.playExplosion();
              this.bulletPool.playExplosion(bPos, b.data.blastR);
              this.damageEnemiesInRadius(bPos, b.data.blastR, b.data.dmg * 0.6);
            }
            if (killed) {
              SoundMgr.inst.playCoin();
              this.bulletPool.playCoinDrop(boss.node.position, 15);
              this.director.recordBossKill();
            }
            this.bulletPool.removeBullet(bi);
          }
        }
      } else {
        // 敌方子弹 -> 击打主角
        if (Vec3.distance(bPos, hPos) <= 24) {
          const dead = this.hero.takeDmg(b.data.dmg);
          // 主角被击中：播放受击音效、爆出血红火花、红色扣血飘字并微晃镜头
          SoundMgr.inst.playHurt();
          this.bulletPool.playHitSparks(bPos, b.data.dir, new Color(255, 60, 60));
          this.bulletPool.playDamageNumber(hPos, b.data.dmg, true);
          this.touchPad.updateHp(this.hero.hp, this.hero.maxHp, this.hero.shield);
          this.shakeWorld(5);
          this.bulletPool.removeBullet(bi);

          if (dead) {
            this.handleDefeat();
          }
        }
      }
    }
  }

  // 框架生命周期接入：暂停时冻结更新
  onDisable() {
    this.pausedBeforeDisable = this.isPaused;
    this.keyState = {};
    this.currentMoveDir.set(0, 0, 0);
    this.isPaused = true;
  }

  // 框架生命周期接入：恢复时解除暂停
  onEnable() {
    if (!this.hasFinished) {
      this.isPaused = this.pausedBeforeDisable;
    }
  }

  // 玩法结束时通知框架
  finishGame(result: GameResult) {
    if (this.onFinish) {
      this.onFinish(result);
    }
  }

  onDestroy() {
    try {
      input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
      input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
      this.bulletPool?.clearAll();
    } catch (e) {
      // 容错防崩
    }
  }
}
