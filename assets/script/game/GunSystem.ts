// 枪械武器逻辑系统
// 负责5大武器特性计算、牌型能力乘区与子弹投射参数生成

import { Vec3 } from 'cc';
import { BulletData } from './BulletPool';
import { ComboType, GunConfig, GunList, GunType, HandCombo, SuitType } from './GameData';

export class GunSystem {
  public curGun: GunType = 'revolver';
  public extraBounce: number = 0;
  public extraPierce: number = 0;
  public vampireBonus: number = 0;
  public straightSpdUp: boolean = false;
  public blastRadiusMul: number = 1.0;
  public critChance: number = 0.1;
  public critDmgMul: number = 1.8;
  public globalDmgMul: number = 1.0;

  constructor(initialGun: GunType = 'revolver') {
    this.curGun = initialGun;
  }

  // 获得当前武器配置
  getConfig(): GunConfig {
    return GunList[this.curGun] || GunList.revolver;
  }

  // 计算打出一手牌时生成的所有子弹数据
  makeBullets(muzzlePos: Vec3, aimDir: Vec3, combo: HandCombo): { bullets: BulletData[]; delays: number[] } {
    const cfg = this.getConfig();
    const result: BulletData[] = [];
    const delays: number[] = [];

    // 基础伤害计算
    let baseDmg = 22 * cfg.dmgMul * combo.power * this.globalDmgMul;

    // 武器对牌型的专属强化加成
    if (this.curGun === 'revolver' && combo.type === 'single') {
      baseDmg *= 1.25; // 左轮强化单牌
    }
    if (this.curGun === 'lever' && combo.type === 'straight') {
      baseDmg *= 1.35; // 杠杆步枪强化顺子
    }
    if (this.curGun === 'shotgun' && combo.type === 'pair') {
      baseDmg *= 1.45; // 双管强化对子
    }
    if (this.curGun === 'bounce' && combo.mainSuit === 'club') {
      baseDmg *= 1.3; // 弹跳左轮强化梅花
    }
    if (this.curGun === 'cannon' && (combo.mainSuit === 'diamond' || combo.type === 'fullhouse')) {
      baseDmg *= 1.25; // 炸药筒强化方块与重爆
    }

    // 致命一击暴击判定
    if (Math.random() < this.critChance) {
      baseDmg *= this.critDmgMul;
    }

    // 花色特性基础值
    let pierceCount = (combo.mainSuit === 'spade' ? 2 : 0) + this.extraPierce;
    let bounceCount = (combo.mainSuit === 'club' ? 2 : 0) + this.extraBounce;
    let blastRadius = (combo.mainSuit === 'diamond' || combo.type === 'fullhouse' ? 70 : 0) * this.blastRadiusMul;
    let vampireAmount = combo.mainSuit === 'heart' ? 1 + this.vampireBonus : 0;

    // 弹跳左轮额外加成
    if (this.curGun === 'bounce') {
      bounceCount += 2;
    }
    // 杠杆步枪自带额外穿透
    if (this.curGun === 'lever') {
      pierceCount += 1;
    }
    // 炸药发射筒爆炸翻倍
    if (this.curGun === 'cannon') {
      blastRadius = Math.max(90, blastRadius * 1.6);
    }

    const rad = Math.atan2(aimDir.y, aimDir.x);
    const spd = 620;

    // 根据牌型构建子弹投射模式
    switch (combo.type) {
      case 'single': {
        // 单发精准弹
        result.push({
          pos: muzzlePos.clone(),
          dir: aimDir.clone(),
          spd,
          dmg: baseDmg,
          suit: combo.mainSuit,
          combo: combo.type,
          isHero: true,
          pierce: pierceCount,
          bounce: bounceCount,
          blastR: blastRadius,
          vampire: vampireAmount,
          lifeTime: 2.2,
        });
        delays.push(0);
        break;
      }
      case 'pair': {
        // 双发并射（双管猎枪则增加到4发）
        const shotCount = this.curGun === 'shotgun' ? 4 : 2;
        const spread = 0.12;
        for (let i = 0; i < shotCount; i++) {
          const curRad = rad + (i - (shotCount - 1) / 2) * spread;
          const dir = new Vec3(Math.cos(curRad), Math.sin(curRad), 0);
          result.push({
            pos: muzzlePos.clone(),
            dir,
            spd: spd * 1.05,
            dmg: baseDmg / (shotCount * 0.7),
            suit: combo.mainSuit,
            combo: combo.type,
            isHero: true,
            pierce: pierceCount,
            bounce: bounceCount,
            blastR: blastRadius,
            vampire: vampireAmount,
            lifeTime: 2.0,
          });
          delays.push(0);
        }
        break;
      }
      case 'trips': {
        // 三方向广角散射
        const angles = [-0.22, 0, 0.22];
        for (let i = 0; i < 3; i++) {
          const curRad = rad + angles[i];
          const dir = new Vec3(Math.cos(curRad), Math.sin(curRad), 0);
          result.push({
            pos: muzzlePos.clone(),
            dir,
            spd,
            dmg: baseDmg * 0.6,
            suit: combo.mainSuit,
            combo: combo.type,
            isHero: true,
            pierce: pierceCount,
            bounce: bounceCount,
            blastR: blastRadius,
            vampire: vampireAmount,
            lifeTime: 2.2,
          });
          delays.push(0);
        }
        break;
      }
      case 'straight': {
        // 顺子：短时间高速连续射击（机枪式倾泻）
        const bulletCount = this.curGun === 'lever' ? 7 : 5;
        const interval = this.straightSpdUp ? 0.05 : 0.08;
        for (let i = 0; i < bulletCount; i++) {
          // 微量准星抖动
          const jitter = (Math.random() - 0.5) * 0.06;
          const curRad = rad + jitter;
          const dir = new Vec3(Math.cos(curRad), Math.sin(curRad), 0);
          result.push({
            pos: muzzlePos.clone(),
            dir,
            spd: spd * 1.2,
            dmg: baseDmg * 0.45,
            suit: combo.mainSuit,
            combo: combo.type,
            isHero: true,
            pierce: pierceCount + 1,
            bounce: bounceCount,
            blastR: blastRadius,
            vampire: vampireAmount,
            lifeTime: 2.0,
          });
          delays.push(i * interval);
        }
        break;
      }
      case 'flush': {
        // 同花：释放对应花色的究极大招弹（极大弹头与强力倍增）
        result.push({
          pos: muzzlePos.clone(),
          dir: aimDir.clone(),
          spd: spd * 1.15,
          dmg: baseDmg * 1.2,
          suit: combo.mainSuit,
          combo: combo.type,
          isHero: true,
          pierce: pierceCount + 3,
          bounce: bounceCount + 3,
          blastR: Math.max(90, blastRadius * 1.5),
          vampire: combo.mainSuit === 'heart' ? vampireAmount + 2 : 0,
          lifeTime: 2.4,
        });
        delays.push(0);
        break;
      }
      case 'fullhouse': {
        // 葫芦：重型重爆冲击弹
        result.push({
          pos: muzzlePos.clone(),
          dir: aimDir.clone(),
          spd: spd * 0.85,
          dmg: baseDmg * 1.5,
          suit: combo.mainSuit,
          combo: combo.type,
          isHero: true,
          pierce: 1,
          bounce: 0,
          blastR: Math.max(120, blastRadius * 1.8),
          vampire: vampireAmount,
          lifeTime: 2.5,
        });
        delays.push(0);
        break;
      }
      case 'quads': {
        // 四条：爆发4颗高速穿甲破空弹
        for (let i = 0; i < 4; i++) {
          const curRad = rad + (i - 1.5) * 0.08;
          const dir = new Vec3(Math.cos(curRad), Math.sin(curRad), 0);
          result.push({
            pos: muzzlePos.clone(),
            dir,
            spd: spd * 1.35,
            dmg: baseDmg * 0.7,
            suit: combo.mainSuit,
            combo: combo.type,
            isHero: true,
            pierce: 4,
            bounce: 2,
            blastR: blastRadius,
            vampire: vampireAmount,
            lifeTime: 2.5,
          });
          delays.push(i * 0.04);
        }
        break;
      }
    }

    return { bullets: result, delays };
  }
}
