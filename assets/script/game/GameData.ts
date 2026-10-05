import { AudioClip, AudioSource, director, Node, resources } from 'cc';
import { GameStorage } from '../framework/core/GameStorage';
import { baseGameConfig } from '../config/baseGameConfig';

// 花色定义：黑桃、红桃、梅花、方块
export type SuitType = 'spade' | 'heart' | 'club' | 'diamond';

// 单张扑克牌数据
export interface CardItem {
  id: number;          // 唯一编号
  suit: SuitType;      // 花色
  val: number;         // 点数 2-14 (11=J, 12=Q, 13=K, 14=A)
  isJoker?: boolean;   // 是否是万能王牌
}

// 组合牌型类别
export type ComboType = 
  | 'single'     // 单牌：普通射击
  | 'pair'       // 对子：双发并射
  | 'trips'      // 三条：三向散射
  | 'straight'   // 顺子：高速连射
  | 'flush'      // 同花：花色大招
  | 'fullhouse'  // 葫芦：重型爆破
  | 'quads';     // 四条：枪斗连击

// 牌型计算结果
export interface HandCombo {
  type: ComboType;
  cards: CardItem[];
  power: number;       // 伤害倍数
  mainSuit: SuitType;  // 主导花色能力
  name: string;        // 中文名称
}

// 枪械类型
export type GunType = 'revolver' | 'lever' | 'shotgun' | 'bounce' | 'cannon';

// 枪械具体配置
export interface GunConfig {
  type: GunType;
  name: string;
  desc: string;
  fireRate: number;    // 射速(秒)
  clipSize: number;    // 弹夹手牌上限
  dmgMul: number;      // 基础伤害倍率
  special: string;     // 特性描述
}

// 5把特色武器
export const GunList: Record<GunType, GunConfig> = {
  revolver: {
    type: 'revolver',
    name: '牛仔左轮',
    desc: '轻巧拔枪快，单牌暴击率超高',
    fireRate: 0.28,
    clipSize: 5,
    dmgMul: 1.0,
    special: '强化单牌暴击',
  },
  lever: {
    type: 'lever',
    name: '温彻斯特',
    desc: '杠杆式快连发，顺子伤害极强',
    fireRate: 0.35,
    clipSize: 5,
    dmgMul: 1.2,
    special: '强化顺子与贯穿',
  },
  shotgun: {
    type: 'shotgun',
    name: '双管猎枪',
    desc: '近身双发对子爆发毁灭伤害',
    fireRate: 0.5,
    clipSize: 4,
    dmgMul: 1.35,
    special: '强化近身对子',
  },
  bounce: {
    type: 'bounce',
    name: '跳弹左轮',
    desc: '特制铅弹，梅花跳弹次数翻倍',
    fireRate: 0.3,
    clipSize: 5,
    dmgMul: 1.1,
    special: '强化梅花弹射',
  },
  cannon: {
    type: 'cannon',
    name: '炸药发射筒',
    desc: '改造的重炮，方块牌型全场轰炸',
    fireRate: 0.65,
    clipSize: 5,
    dmgMul: 1.5,
    special: '强化方块爆炸',
  }
};

// 升级天赋项
export interface BuffOption {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

// 随机升级候选池
export const BuffPool: BuffOption[] = [
  { id: 'bounce_plus', name: '跳弹+1', desc: '梅花跳弹次数额外+1', icon: '♣' },
  { id: 'vampire', name: '红桃吸血', desc: '红桃命中额外回复1点生命', icon: '♥' },
  { id: 'straight_spd', name: '顺子加速', desc: '顺子连发速度大幅提升', icon: '♠' },
  { id: 'blast_range', name: '方块爆破', desc: '方块爆炸范围扩大50%', icon: '♦' },
  { id: 'pierce_dmg', name: '黑桃穿透', desc: '黑桃额外穿透一个目标', icon: '♠' },
  { id: 'hand_expand', name: '弹匣+1', desc: '手牌上限增加到6张', icon: '★' },
  { id: 'roll_cool', name: '快速翻滚', desc: '翻滚冷却缩短至0.65秒', icon: '⚡' },
  { id: 'crit_master', name: '暴击加成', desc: '暴击伤害倍率增加0.4', icon: '🎯' },
  { id: 'gun_power', name: '重装火药', desc: '基础伤害倍率增加20%', icon: '💥' },
  { id: 'shield_heart', name: '红桃护盾', desc: '获得20点临时战术护盾', icon: '🛡' },
  { id: 'gun_shotgun', name: '双管猎枪', desc: '装备双管，对子双倍散弹', icon: '🔫' },
  { id: 'gun_lever', name: '温彻斯特', desc: '装备步枪，顺子长程连轰', icon: '🔫' },
  { id: 'gun_bounce', name: '弹跳左轮', desc: '装备跳弹枪，全弹道弹射', icon: '🔫' },
  { id: 'gun_cannon', name: '炸药重炮', desc: '装备重型发射器，全炸裂', icon: '💣' },
];

// 关卡信息（共8个主要区域）
export interface AreaInfo {
  level: number;
  name: string;
  intro: string;
  bgTheme: string;
  bossName: string;
  bossHp: number;
  waveCount: number;
  enemyCount: number;  // 第一波数量；之后每波增加2名，事件波额外增加2名
  maxEnemies: number; // 同屏小怪上限
  spawnInterval: number;
}

export const StageList: AreaInfo[] = [
  { level: 1, name: '边境车站', intro: '黄沙弥漫的火车站台，劫匪盘踞', bgTheme: 'station', bossName: '车站恶霸·独眼查理', bossHp: 650, waveCount: 3, enemyCount: 12, maxEnemies: 5, spawnInterval: 0.75 },
  { level: 2, name: '荒漠酒馆街', intro: '危机四伏的西部街道，醉鬼与打手横行', bgTheme: 'saloon', bossName: '醉枪客·黑杰克', bossHp: 950, waveCount: 3, enemyCount: 14, maxEnemies: 6, spawnInterval: 0.70 },
  { level: 3, name: '废弃矿区', intro: '阴暗的矿洞铁轨，埋伏着疯癫的炸药矿工', bgTheme: 'mine', bossName: '矿区工头·铁臂汉克', bossHp: 1250, waveCount: 4, enemyCount: 12, maxEnemies: 6, spawnInterval: 0.65 },
  { level: 4, name: '峡谷铁路', intro: '绝壁铁轨之上，狂风呼啸的列车站斗', bgTheme: 'canyon', bossName: '铁道狂徒·烈焰乔', bossHp: 1600, waveCount: 4, enemyCount: 14, maxEnemies: 7, spawnInterval: 0.60 },
  { level: 5, name: '淘金小镇', intro: '罪恶滋生的黄金小镇，警匪混杂', bgTheme: 'goldtown', bossName: '贪婪警长·银星布奇', bossHp: 2000, waveCount: 4, enemyCount: 16, maxEnemies: 7, spawnInterval: 0.56 },
  { level: 6, name: '蒸汽工厂', intro: '黑烟滚滚的重型厂房，重装机械兵守卫', bgTheme: 'factory', bossName: '机械屠夫·麦克唐纳', bossHp: 2450, waveCount: 4, enemyCount: 18, maxEnemies: 8, spawnInterval: 0.52 },
  { level: 7, name: '亡命赌场', intro: '纸醉金迷的地下赌城，隐藏着致命机关', bgTheme: 'casino', bossName: '千手发牌官·鬼手', bossHp: 2950, waveCount: 4, enemyCount: 20, maxEnemies: 9, spawnInterval: 0.48 },
  { level: 8, name: '赏金王城', intro: '终局决战之地，直面掌控一切的黑牌赌王', bgTheme: 'palace', bossName: '黑牌赌王·卡特赖特', bossHp: 3500, waveCount: 4, enemyCount: 22, maxEnemies: 10, spawnInterval: 0.45 },
];

// 玩家持久化存档数据结构
export interface SaveData {
  coins: number;
  maxHpLevel: number;
  atkLevel: number;
  curGun: GunType;
  unlockedGuns: GunType[];
}

// 存档助手类
export class ProfileMgr {
  private static store: GameStorage | null = null;

  // 拿存储实例
  private static getStore(): GameStorage {
    if (!this.store) {
      this.store = new GameStorage(baseGameConfig.storageKeyPrefix);
    }
    return this.store;
  }

  // 读取玩家存档
  static load(): SaveData {
    const s = this.getStore();
    return s.getJSON<SaveData>('gun_hero_data', {
      coins: 0,
      maxHpLevel: 0,
      atkLevel: 0,
      curGun: 'revolver',
      unlockedGuns: ['revolver']
    });
  }

  // 存盘
  static save(data: SaveData) {
    const s = this.getStore();
    s.setJSON('gun_hero_data', data);
  }

  // 加金币并立即存
  static addGold(val: number): number {
    const d = this.load();
    d.coins = Math.max(0, d.coins + val);
    this.save(d);
    return d.coins;
  }
}

// 西部枪战音效管理器
// 纯基于 Cocos 原生 AudioSource 与 resources.load 资源加载机制
// 杜绝使用浏览器特有的 Web Audio / AudioContext，完美支持抖音小游戏、微信小游戏与原生端
export class SoundMgr {
  private static instance: SoundMgr | null = null;
  private audioNode: Node | null = null;
  private audioSource: AudioSource | null = null;
  private clipMap: Map<string, AudioClip> = new Map();
  private storage: GameStorage = new GameStorage(baseGameConfig.storageKeyPrefix);

  // 单例获取
  static get inst(): SoundMgr {
    if (!this.instance) {
      this.instance = new SoundMgr();
    }
    return this.instance;
  }

  // 保证音效播放节点始终有效（常驻场景根节点，换关不失效，自愈自动重建）
  private ensureAudioSource(preferredRoot?: Node): AudioSource | null {
    if (this.audioSource && this.audioSource.isValid && this.audioNode && this.audioNode.isValid) {
      return this.audioSource;
    }

    // 优先挂载在整个 Director 的 Scene 场景根节点下，避免随页面切换被销毁
    let parent = director.getScene() as Node | null;
    if (!parent && preferredRoot && preferredRoot.isValid) {
      parent = preferredRoot;
    }

    if (!parent) return null;

    try {
      this.audioNode = new Node('GameSoundRoot');
      parent.addChild(this.audioNode);
      this.audioSource = this.audioNode.addComponent(AudioSource);
      return this.audioSource;
    } catch (e) {
      return null;
    }
  }

  // 初始化音效节点挂载在场景中
  init(rootNode?: Node) {
    this.ensureAudioSource(rootNode);

    // 预先批量异步载入所有西部枪战音频剪辑
    const soundList = [
      'shoot',
      'card',
      'click',
      'hit',
      'explosion',
      'bounce',
      'roll',
      'coin',
      'kata',
      'win',
      'hurt'
    ];

    for (const name of soundList) {
      if (!this.clipMap.has(name)) {
        resources.load(`audio/${name}`, AudioClip, (err, clip) => {
          if (!err && clip) {
            this.clipMap.set(name, clip);
          }
        });
      }
    }
  }

  // 检查是否开启音效（与框架系统配置同步）
  private isEnabled(): boolean {
    return this.storage.getBool('effectsEnabled', true);
  }

  // 播放指定名称的静态音频剪辑
  private play(name: string, volume: number = 1.0) {
    if (!this.isEnabled()) return;

    const source = this.ensureAudioSource();
    if (!source || !source.isValid) return;

    const clip = this.clipMap.get(name);
    if (clip) {
      source.playOneShot(clip, volume);
    } else {
      // 若尚未加载完成，尝试现场即时加载播放
      resources.load(`audio/${name}`, AudioClip, (err, loadedClip) => {
        if (!err && loadedClip) {
          this.clipMap.set(name, loadedClip);
          const curSource = this.ensureAudioSource();
          if (curSource && curSource.isValid) {
            curSource.playOneShot(loadedClip, volume);
          }
        }
      });
    }
  }

  // 牛仔拔枪射击
  playShoot(volume: number = 0.8) {
    this.play('shoot', volume);
  }

  // 扑克牌飞出与洗牌
  playCard(volume: number = 0.75) {
    this.play('card', volume);
  }

  // 按钮与筹码点击
  playClick(volume: number = 0.85) {
    this.play('click', volume);
  }

  // 子弹命中肉体或护甲
  playHit(volume: number = 0.7) {
    this.play('hit', volume);
  }

  // 方块重型爆破
  playExplosion(volume: number = 0.9) {
    this.play('explosion', volume);
  }

  // 梅花跳弹火星呼啸
  playBounce(volume: number = 0.8) {
    this.play('bounce', volume);
  }

  // 翻滚闪避沙尘
  playRoll(volume: number = 0.75) {
    this.play('roll', volume);
  }

  // 赏金银元掉落
  playCoin(volume: number = 0.85) {
    this.play('coin', volume);
  }

  // 枪斗时刻大招激活
  playKata(volume: number = 0.95) {
    this.play('kata', volume);
  }

  // 关卡通关胜利
  playWin(volume: number = 1.0) {
    this.play('win', volume);
  }

  // 猎人受击扣血
  playHurt(volume: number = 0.8) {
    this.play('hurt', volume);
  }
}
