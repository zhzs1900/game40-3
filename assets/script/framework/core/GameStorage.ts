import { sys } from 'cc';

// 平台同步存储接口（如抖音小游戏 tt 上的同步读写接口）
interface SyncStorage {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, data: unknown): void;
  removeStorageSync?(key: string): void;
  getStorageInfoSync?(): { keys?: string[] };
}

/** 
 * 跨平台本地数据存储管理器
 * 特性：
 * 1. 支持命名空间前缀（例如 "mygame:score"），防止多个模块或游戏键名互相污染冲突
 * 2. 双层读写兜底：优先使用小游戏平台的原生同步存储，异常或在 Web/原生环境时自动回退到 Cocos 的 sys.localStorage
 * 3. 强类型读写：支持 string, number, boolean, JSON 对象
 */
export class GameStorage {
  constructor(private readonly prefix: string) {}

  /**
   * 读取字符串数据
   * @param key 存储键名
   * @param fallback 默认兜底值
   */
  getString(key: string, fallback = ''): string {
    const value = this.read(key);
    return typeof value === 'string' ? value : fallback;
  }

  /**
   * 写入字符串数据
   */
  setString(key: string, value: string): void { 
    this.write(key, value); 
  }

  /**
   * 读取数值数据
   * @param key 存储键名
   * @param fallback 默认兜底值
   */
  getNumber(key: string, fallback = 0): number {
    const raw = this.read(key);
    if (raw === null || raw === undefined || raw === '') { return fallback; }
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  /**
   * 写入数值数据
   */
  setNumber(key: string, value: number): void { 
    this.write(key, value); 
  }

  /**
   * 读取布尔值数据
   * 兼容原生 boolean 与 "true" / "false" 字符串
   * @param key 存储键名
   * @param fallback 默认兜底值
   */
  getBool(key: string, fallback = false): boolean {
    const value = this.read(key);
    if (typeof value === 'boolean') { return value; }
    if (value === 'true') { return true; }
    if (value === 'false') { return false; }
    return fallback;
  }

  /**
   * 写入布尔值数据
   */
  setBool(key: string, value: boolean): void { 
    this.write(key, value); 
  }

  /**
   * 读取并解析 JSON 对象数据
   * 如果解析失败或无数据，返回默认 fallback 对象
   */
  getJSON<T>(key: string, fallback: T): T {
    const value = this.read(key);
    if (value === null || value === undefined || value === '') { return fallback; }
    // 抖音原生 setStorageSync 可能会直接保留对象类型
    if (typeof value !== 'string') { return value as T; }
    try { 
      return JSON.parse(value) as T; 
    } catch { 
      return fallback; 
    }
  }

  /**
   * 写入 JSON 对象数据
   */
  setJSON(key: string, value: unknown): void { 
    this.write(key, value); 
  }

  /** 
   * 读取、更新并立即存盘的便捷函数
   * @param key 存储键名
   * @param fallback 默认值
   * @param update 修改回调函数
   */
  updateJSON<T>(key: string, fallback: T, update: (data: T) => T | void): T {
    const current = this.getJSON(key, fallback);
    const result = update(current) || current;
    this.setJSON(key, result);
    return result;
  }

  /**
   * 删除某个键的数据（双删：平台原生存储 + 本地 localStorage 同时清除）
   */
  remove(key: string): void {
    const fullKey = this.getFullKey(key);
    const platform = this.getPlatformStorage();
    if (platform?.removeStorageSync) {
      try { 
        platform.removeStorageSync(fullKey); 
      } catch (error) {
        console.warn(`删除平台存储失败：${fullKey}`, error);
      }
    }
    try { 
      sys.localStorage.removeItem(fullKey); 
    } catch (error) {
      console.warn(`删除本地存储失败：${fullKey}`, error);
    }
  }

  /**
   * 批量删除指定的多个 key
   */
  clear(keys: readonly string[]): void {
    for (const key of keys) { 
      this.remove(key); 
    }
  }

  /**
   * 枚举当前命名空间下的全部存档。
   * 用于调试页，不维护固定 key 列表，因此未来新增的存档项也会自动显示。
   */
  getAllEntries(): Record<string, unknown> {
    const fullPrefix = `${this.prefix}:`;
    const keys = new Set<string>();
    const platform = this.getPlatformStorage();
    try {
      platform?.getStorageInfoSync?.().keys?.forEach((key) => {
        if (key.startsWith(fullPrefix)) { keys.add(key); }
      });
    } catch (error) {
      console.warn('读取平台存档键列表失败。', error);
    }

    try {
      const local = sys.localStorage as unknown as { length: number; key: (index: number) => string | null };
      for (let index = 0; index < local.length; index += 1) {
        const key = local.key(index);
        if (key?.startsWith(fullPrefix)) { keys.add(key); }
      }
    } catch (error) {
      console.warn('读取本地存档键列表失败。', error);
    }

    const entries: Record<string, unknown> = {};
    [...keys].sort().forEach((fullKey) => {
      const key = fullKey.slice(fullPrefix.length);
      const value = this.read(key);
      entries[key] = this.parseStoredValue(value);
    });
    return entries;
  }

  /**
   * 底层读数据方法：优先尝试平台 API，失败或不存在时回退到 Cocos sys.localStorage
   */
  private read(key: string): unknown {
    const fullKey = this.getFullKey(key);
    const platform = this.getPlatformStorage();
    if (platform) {
      try {
        const value = platform.getStorageSync(fullKey);
        if (value !== '' && value !== null && value !== undefined) { 
          return value; 
        }
      } catch (error) {
        console.warn(`读取平台存储失败，改用本地存储：${fullKey}`, error);
      }
    }
    try { 
      return sys.localStorage.getItem(fullKey); 
    } catch (error) {
      console.warn(`读取本地存储失败：${fullKey}`, error);
      return null;
    }
  }

  /**
   * 底层写数据方法：优先写入平台 API，失败或在其他环境时写入 Cocos sys.localStorage
   */
  private write(key: string, value: unknown): void {
    const fullKey = this.getFullKey(key);
    const platform = this.getPlatformStorage();
    if (platform) {
      try {
        platform.setStorageSync(fullKey, value);
        return;
      } catch (error) {
        console.warn(`写入平台存储失败，改用本地存储：${fullKey}`, error);
      }
    }
    try {
      sys.localStorage.setItem(fullKey, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
      console.warn(`写入本地存储失败：${fullKey}`, error);
    }
  }

  /**
   * 获取抖音平台全局的同步存储原生 API
   */
  private getPlatformStorage(): SyncStorage | null {
    const tt = (globalThis as unknown as { tt?: Partial<SyncStorage> }).tt;
    return tt && typeof tt.getStorageSync === 'function' && typeof tt.setStorageSync === 'function'
      ? tt as SyncStorage
      : null;
  }

  private parseStoredValue(value: unknown): unknown {
    if (typeof value !== 'string') { return value; }
    try { return JSON.parse(value); } catch { return value; }
  }

  /**
   * 拼接带命名空间的完整存储键名（例如 "mygame:score"）
   */
  private getFullKey(key: string): string { 
    return `${this.prefix}:${key}`; 
  }
}
