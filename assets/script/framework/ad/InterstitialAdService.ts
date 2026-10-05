import { baseGameConfig } from '../../config/baseGameConfig';

// 抖音插屏原生实例接口
interface InterstitialAd {
  load?(): Promise<void>;
  show(): Promise<void>;
  onClose(cb: () => void): void;
  offClose?(cb: () => void): void;
  onError(cb: (err: unknown) => void): void;
  offError?(cb: (err: unknown) => void): void;
  destroy?(): void;
}

// 占位默认 ID
const DEF_ID = 'replace-with-your-ad-unit-id';

/**
 * 抖音插屏广告服务
 * 处理插屏的创建、展示与防连点
 */
class InterstitialAdService {
  private ad: InterstitialAd | null = null;
  private showing: Promise<boolean> | null = null;

  // 读取配置中的广告位 ID
  private getId(): string {
    const cfg = (baseGameConfig as Record<string, any>).adConfig;
    return (cfg?.interstitialAdUnitId ?? '').trim();
  }

  // 获取全局小游戏 tt 对象
  private getTT() {
    return (globalThis as Record<string, any>).tt;
  }

  // 检查环境与广告位配置
  isAvailable(): boolean {
    const tt = this.getTT();
    const id = this.getId();
    return !!(tt?.createInterstitialAd && id && id !== DEF_ID);
  }

  // 播放插屏广告
  show(tag = 'default'): Promise<boolean> {
    if (this.showing) return this.showing;
    if (!this.isAvailable()) return Promise.resolve(false);

    this.showing = new Promise<boolean>((resolve) => {
      try {
        if (!this.ad) {
          this.ad = this.getTT().createInterstitialAd({ adUnitId: this.getId() });
        }
        const ad = this.ad!;
        let done = false;

        // 统一收尾解绑
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          ad.offClose?.(onClose);
          ad.offError?.(onError);
          this.showing = null;
          resolve(ok);
        };

        const onClose = () => finish(true);
        const onError = (err: unknown) => {
          console.warn(`[插屏] ${tag} 异常:`, err);
          finish(false);
        };

        ad.onClose(onClose);
        ad.onError(onError);

        // 如果支持预加载先 load 再 show
        const play = () => ad.show().catch(onError);
        if (ad.load) {
          ad.load().then(play).catch(onError);
        } else {
          play();
        }
      } catch (err) {
        console.warn(`[插屏] ${tag} 失败:`, err);
        this.showing = null;
        resolve(false);
      }
    });

    return this.showing;
  }

  // 销毁广告实例释放内存
  destroy(): void {
    this.ad?.destroy?.();
    this.ad = null;
    this.showing = null;
  }
}

// 导出全局单例
export const interstitialAd = new InterstitialAdService();
