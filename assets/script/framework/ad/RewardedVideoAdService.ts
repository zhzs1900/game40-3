import { baseGameConfig } from '../../config/baseGameConfig';

// 广告关闭时的结果数据
type RewardedAdCloseResult = { isEnded?: boolean }; // isEnded 为 true 表示完整看完了视频

// 抖音平台激励视频广告实例接口
type RewardedVideoAdInstance = {
  load(): Promise<void>;
  show(): Promise<void>;
  onLoad(callback: () => void): void;
  onError(callback: (error: unknown) => void): void;
  offError?(callback: (error: unknown) => void): void;
  onClose(callback: (result?: RewardedAdCloseResult) => void): void;
  offClose?(callback: (result?: RewardedAdCloseResult) => void): void;
};

// 抖音全局环境 API
type TTApi = {
  createRewardedVideoAd?: (options: { adUnitId: string }) => RewardedVideoAdInstance;
  showToast?: (options: { title: string; icon?: 'none' | 'success' | 'error' }) => void;
  showLoading?: (options: { title: string }) => void;
  hideLoading?: () => void;
};

// 默认占位广告位 ID
const PLACEHOLDER = 'replace-with-your-ad-unit-id';

// 获取全局的 tt 原生对象
const getTT = (): TTApi | null => (globalThis as { tt?: TTApi }).tt ?? null;

// 激励视频广告核心服务类，负责自动预加载与播放管理
class RewardedVideoAdService {
  // 缓存创建好的激励视频广告实例
  private ad: RewardedVideoAdInstance | null = null;
  // 当前是否已经加载完成可随时播放
  private loaded = false;
  // 记录正在播放中的 Promise，防止连点导致重复拉起
  private currentShowPromise: Promise<boolean> | null = null;

  // 初始化激励视频广告实例并开始预加载
  init(): void {
    const tt = getTT();
    // 没有广告 API、没配有效 ID 或者已经创建过了就不重复创建
    if (!tt?.createRewardedVideoAd || !this.hasValidAdUnitId() || this.ad) { return; }
    try {
      this.ad = tt.createRewardedVideoAd({ adUnitId: baseGameConfig.adConfig.rewardedVideoAdUnitId });
      // 监听加载成功事件
      this.ad.onLoad(() => { this.loaded = true; });
      // 立即触发一次预加载，提升后续打开速度
      this.preload();
    } catch (error) {
      this.ad = null;
      console.warn('[RewardedAd] 创建广告实例失败。', error);
    }
  }

  // 播放激励视频广告（统一对外入口）
  // 用户完整看完返回 true，中途关闭或失败返回 false
  async show(placement: string): Promise<boolean> {
    // 防止并发重复拉起
    if (this.currentShowPromise) { return this.currentShowPromise; }

    const promise = this.showInternal(placement);
    this.currentShowPromise = promise;
    try { 
      return await promise; 
    } finally {
      if (this.currentShowPromise === promise) { 
        this.currentShowPromise = null; 
      }
    }
  }

  // 内部具体的广告拉起与结果等待流程
  private async showInternal(placement: string): Promise<boolean> {
    const tt = getTT();

    // 网页预览或无原生广告环境时，由调试兜底配置决定是否放行
    if (!tt?.createRewardedVideoAd) {
      const fallback = baseGameConfig.adConfig.rewardedAdDebugFallbackEnabled;
      console.info(`[RewardedAd] ${placement}: 当前环境无广告 API，调试兜底=${fallback}。`);
      if (!fallback) { this.notify('当前环境不支持激励广告'); }
      return fallback;
    }

    // 没填真实广告位 ID 时根据配置决定是否兜底放行
    if (!this.hasValidAdUnitId()) {
      if (baseGameConfig.adConfig.rewardedAdDebugFallbackEnabled) { return true; }
      this.notify('请先配置激励广告位 ID');
      return false;
    }

    this.init();
    if (!this.ad) { 
      return baseGameConfig.adConfig.rewardedAdDebugFallbackEnabled; 
    }

    // 显示转圈加载提示
    tt.showLoading?.({ title: '广告加载中...' });
    try {
      // 确保广告已经加载完毕
      await this.ensureLoaded();
      tt.hideLoading?.();
      
      // 播放广告并等待用户关闭
      const granted = await this.showAndWait();
      this.loaded = false;
      // 播放完毕后预加载下一条广告，减少下次等待时间
      this.preload();
      return granted;
    } catch (error) {
      tt.hideLoading?.();
      this.loaded = false;
      this.preload();
      console.warn(`[RewardedAd] ${placement}: 展示失败。`, error);
      // 失败时若开启了调试兜底则放行发奖
      return baseGameConfig.adConfig.rewardedAdDebugFallbackEnabled;
    } finally {
      // 广告正常关闭（包括中途退出）和异常退出都清理原生加载提示。
      try {
        tt.hideLoading?.();
      } catch (error) {
        console.warn('[RewardedAd] 清理加载提示失败。', error);
      }
    }
  }

  // 调起原生广告界面，并监听关闭与报错事件
  private showAndWait(): Promise<boolean> {
    const ad = this.ad!;
    return new Promise((resolve, reject) => {
      let settled = false;

      // 移除事件监听，防止内存泄漏和多次回调
      const cleanup = () => {
        ad.offClose?.(onClose);
        ad.offError?.(onError);
      };

      // 玩家关闭广告
      const onClose = (result?: RewardedAdCloseResult) => {
        if (settled) { return; }
        settled = true;
        cleanup();
        // isEnded 为 true 或某些低版本没有该字段时默认发奖
        resolve(result === undefined || result.isEnded === true);
      };

      // 广告播放中途报错
      const onError = (error: unknown) => {
        if (settled) { return; }
        settled = true;
        cleanup();
        reject(error);
      };

      ad.onClose(onClose);
      ad.onError(onError);
      void this.tryShow().catch(onError);
    });
  }

  // 确保广告处于就绪状态，如果未加载则等待 load 完成
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded && this.ad) { 
      await this.ad.load(); 
      this.loaded = true; 
    }
  }

  // 尝试展示广告；如果直接 show 报错，尝试重新 load 后再次 show 进行二次重试
  private async tryShow(): Promise<void> {
    if (!this.ad) { return; }
    try { 
      await this.ad.show(); 
    } catch {
      await this.ad.load();
      this.loaded = true;
      await this.ad.show();
    }
  }

  // 后台静默预加载下一条广告
  private preload(): void {
    if (!this.ad) { return; }
    void this.ad.load().then(() => { 
      this.loaded = true; 
    }).catch((error) => {
      this.loaded = false;
      console.warn('[RewardedAd] 预加载失败。', error);
    });
  }

  // 校验是否配置了有效的广告位 ID
  private hasValidAdUnitId(): boolean {
    const id = baseGameConfig.adConfig.rewardedVideoAdUnitId.trim();
    return !!id && id !== PLACEHOLDER;
  }

  // 封装统一的轻量气泡提示
  private notify(title: string): void {
    getTT()?.showToast?.({ title, icon: 'none' });
    console.info(`[RewardedAd] ${title}`);
  }
}

// 导出单例，全局统一调用
export const rewardedVideoAd = new RewardedVideoAdService();
