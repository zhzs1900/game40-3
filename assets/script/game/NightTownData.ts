import { AudioClip, AudioSource, director, Node, resources } from 'cc';
import { GameStorage } from '../framework/core/GameStorage';
import { baseGameConfig } from '../config/baseGameConfig';

// 花色定义：雷印、火印、风印、灵印
export type SuitType = 'spade' | 'heart' | 'club' | 'diamond';

// 单张符箓数据
export interface CardItem {
  id: number;          // 唯一编号
  suit: SuitType;      // 花色
  val: number;         // 点数 2-14 (11=J, 12=Q, 13=K, 14=A)
  isJoker?: boolean;   // 是否是万能王牌
}

// 组合牌型类别
export type ComboType = 
  | 'single'     // 单牌：普通放符
  | 'pair'       // 对子：双发并射
  | 'trips'      // 三条：三向散射
  | 'straight'   // 顺子：高速连射
  | 'flush'      // 同花：花色大招
  | 'fullhouse'  // 葫芦：重型爆破
  | 'quads';     // 四条：灯阵连击

// 牌型计算结果
export interface HandCombo {
  type: ComboType;
  cards: CardItem[];
  power: number;       // 伤害倍数
  mainSuit: SuitType;  // 主导花色能力
  name: string;        // 中文名称
}

// 符器类型
export type GunType = 'revolver' | 'lever' | 'shotgun' | 'bounce' | 'cannon';

// 符器具体配置
export interface GunConfig {
  type: GunType;
  name: string;
  desc: string;
  fireRate: number;    // 射速(秒)
  clipSize: number;    // 弹夹符箓栏上限
  dmgMul: number;      // 基础伤害倍率
  special: string;     // 特性描述
}

// 5把特色武器
export const GunList: Record<GunType, GunConfig> = {
  revolver: {
    type: 'revolver',
    name: '铜铃符灯',
    desc: '轻巧拔枪快，单牌暴击率超高',
    fireRate: 0.28,
    clipSize: 5,
    dmgMul: 1.0,
    special: '强化单牌暴击',
  },
  lever: {
    type: 'lever',
    name: '雷纹长符',
    desc: '杠杆式快连发，顺子伤害极强',
    fireRate: 0.35,
    clipSize: 5,
    dmgMul: 1.2,
    special: '强化顺子与贯穿',
  },
  shotgun: {
    type: 'shotgun',
    name: '双叠火符',
    desc: '近身双发对子爆发毁灭伤害',
    fireRate: 0.5,
    clipSize: 4,
    dmgMul: 1.35,
    special: '强化近身对子',
  },
  bounce: {
    type: 'bounce',
    name: '回风灵符',
    desc: '特制铅弹，风印跳弹次数翻倍',
    fireRate: 0.3,
    clipSize: 5,
    dmgMul: 1.1,
    special: '强化风印弹射',
  },
  cannon: {
    type: 'cannon',
    name: '镇煞法印',
    desc: '改造的重炮，灵印牌型全场轰炸',
    fireRate: 0.65,
    clipSize: 5,
    dmgMul: 1.5,
    special: '强化灵印爆炸',
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
  { id: 'bounce_plus', name: '回风续符', desc: '风印回旋次数额外+1', icon: '风' },
  { id: 'vampire', name: '火印养息', desc: '火印命中额外回复1点生命', icon: '火' },
  { id: 'straight_spd', name: '疾书连符', desc: '连书符阵释放速度提升', icon: '雷' },
  { id: 'blast_range', name: '灵印扩阵', desc: '灵印符阵范围扩大50%', icon: '灵' },
  { id: 'pierce_dmg', name: '雷印贯邪', desc: '雷印额外贯穿一个目标', icon: '雷' },
  { id: 'hand_expand', name: '符囊扩容', desc: '符箓栏上限增加到6张', icon: '符' },
  { id: 'roll_cool', name: '踏罡轻身', desc: '闪避冷却缩短至0.65秒', icon: '步' },
  { id: 'crit_master', name: '朱砂点睛', desc: '会心伤害倍率增加0.4', icon: '朱' },
  { id: 'gun_power', name: '灵息灌注', desc: '基础驱邪伤害增加20%', icon: '息' },
  { id: 'shield_heart', name: '护身灯衣', desc: '获得20点临时护身值', icon: '护' },
  { id: 'gun_shotgun', name: '双叠火符', desc: '双印并发时爆发更强', icon: '火' },
  { id: 'gun_lever', name: '雷纹长符', desc: '连书符阵更远更快', icon: '雷' },
  { id: 'gun_bounce', name: '回风灵符', desc: '风印飞符强化回旋', icon: '风' },
  { id: 'gun_cannon', name: '镇煞法印', desc: '灵印与合契符阵强化', icon: '灵' },
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
  { level: 1, name: '青石巷口', intro: '灯火初灭，兽祟从旧宅阴影中扑出', bgTheme: 'stone_lane', bossName: '镇门灵·残面', bossHp: 650, waveCount: 3, enemyCount: 12, maxEnemies: 5, spawnInterval: 0.75 },
  { level: 2, name: '纸伞长街', intro: '雨痕未干，执灯游魂沿檐下徘徊', bgTheme: 'umbrella_street', bossName: '镇门灵·锁灯', bossHp: 950, waveCount: 3, enemyCount: 14, maxEnemies: 6, spawnInterval: 0.70 },
  { level: 3, name: '古井后巷', intro: '井口邪气翻涌，爆符傀儡藏在符封木柜间', bgTheme: 'old_well', bossName: '镇门灵·井魇', bossHp: 1250, waveCount: 4, enemyCount: 12, maxEnemies: 6, spawnInterval: 0.65 },
  { level: 4, name: '风灯石桥', intro: '桥上夜风卷符，骑兽夜叉踏灯而来', bgTheme: 'lantern_bridge', bossName: '镇门灵·桥煞', bossHp: 1600, waveCount: 4, enemyCount: 14, maxEnemies: 7, spawnInterval: 0.60 },
  { level: 5, name: '香火祠前', intro: '残香未熄，纸伞妖与游魂守住祠门', bgTheme: 'shrine_yard', bossName: '镇门灵·祠印', bossHp: 2000, waveCount: 4, enemyCount: 16, maxEnemies: 7, spawnInterval: 0.56 },
  { level: 6, name: '封符仓院', intro: '木柜符封破裂，邪气沿地砖纹路蔓延', bgTheme: 'seal_store', bossName: '镇门灵·断符', bossHp: 2450, waveCount: 4, enemyCount: 18, maxEnemies: 8, spawnInterval: 0.52 },
  { level: 7, name: '百灯戏台', intro: '空台灯影摇晃，群祟借戏面现形', bgTheme: 'opera_stage', bossName: '镇门灵·戏面', bossHp: 2950, waveCount: 4, enemyCount: 20, maxEnemies: 9, spawnInterval: 0.48 },
  { level: 8, name: '镇门夜关', intro: '古镇尽头符封崩裂，镇门灵显露真身', bgTheme: 'town_gate', bossName: '镇门灵·开面', bossHp: 3500, waveCount: 4, enemyCount: 22, maxEnemies: 10, spawnInterval: 0.45 },
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

  // 加灵火并立即存
  static addGold(val: number): number {
    const d = this.load();
    d.coins = Math.max(0, d.coins + val);
    this.save(d);
    return d.coins;
  }
}

// 古镇夜巡枪战音效管理器
// 纯基于 Cocos 原生 AudioSource 与 resources.load 资源加载机制
// 杜绝使用浏览器特有的 Web Audio / AudioContext，完美支持抖音小游戏、微信小游戏与原生端
export class LanternSound {
  private static instance: LanternSound | null = null;
  private audioNode: Node | null = null;
  private audioSource: AudioSource | null = null;
  private clipMap: Map<string, AudioClip> = new Map();
  private storage: GameStorage = new GameStorage(baseGameConfig.storageKeyPrefix);

  // 单例获取
  static get inst(): LanternSound {
    if (!this.instance) {
      this.instance = new LanternSound();
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

    // 预先批量异步载入所有古镇夜巡枪战音频剪辑
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

  // 巡夜师拔枪放符
  playShoot(volume: number = 0.8) {
    this.play('shoot', volume);
  }

  // 符箓飞出与理符
  playCard(volume: number = 0.75) {
    this.play('card', volume);
  }

  // 按钮与筹码点击
  playClick(volume: number = 0.85) {
    this.play('click', volume);
  }

  // 飞符命中肉体或护甲
  playHit(volume: number = 0.7) {
    this.play('hit', volume);
  }

  // 灵印重型爆破
  playExplosion(volume: number = 0.9) {
    this.play('explosion', volume);
  }

  // 风印跳弹火星呼啸
  playBounce(volume: number = 0.8) {
    this.play('bounce', volume);
  }

  // 闪避闪避沙尘
  playRoll(volume: number = 0.75) {
    this.play('roll', volume);
  }

  // 灵息银元掉落
  playCoin(volume: number = 0.85) {
    this.play('coin', volume);
  }

  // 巡夜灯阵大招激活
  playKata(volume: number = 0.95) {
    this.play('kata', volume);
  }

  // 关卡通关胜利
  playWin(volume: number = 1.0) {
    this.play('win', volume);
  }

  // 巡夜师受击扣血
  playHurt(volume: number = 0.8) {
    this.play('hurt', volume);
  }
}
