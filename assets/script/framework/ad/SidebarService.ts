// 抖音侧边栏启动参数结构
export interface SidebarLaunchInfo {
  scene?: string | number; // 启动场景值（例如 '021036' 代表侧边栏）
  launch_from?: string;    // 来源页面（如 'homepage'）
  location?: string;       // 具体点击位置（如 'sidebar_card'）
}

// 抖音小游戏侧边栏原生 API 接口定义
interface SidebarApi {
  onShow(callback: (info: SidebarLaunchInfo) => void): void;
  checkScene(options: {
    scene: 'sidebar';
    success: (result: { isExist?: boolean }) => void;
    fail?: (error: unknown) => void;
  }): void;
  navigateToScene(options: {
    scene: 'sidebar';
    success?: () => void;
    fail?: (error: unknown) => void;
  }): void;
}

// 状态变动时的监听回调类型
type StateListener = () => void;

/** 
 * 抖音首页侧边栏能力封装类
 * 负责检测是否支持侧边栏、判断玩家是否从侧边栏进入、以及跳转到侧边栏
 */
class SidebarService {
  // 当前环境/客户端是否支持侧边栏
  private supported = false;
  // 记录最近一次启动时的场景参数
  private latestLaunch: SidebarLaunchInfo | null = null;
  // 状态变化回调监听列表
  private listeners: StateListener[] = [];

  constructor() {
    const tt = this.getApi();
    if (!tt) { return; }

    // 尽早监听 onShow，获取冷启动或热启动传过来的场景参数
    tt.onShow((info) => {
      this.latestLaunch = info || null;
      this.emit();
    });

    // 检查当前设备/客户端是否支持侧边栏卡片展示
    tt.checkScene({
      scene: 'sidebar',
      success: (result) => {
        this.supported = result.isExist === true;
        this.emit();
      },
      fail: (error) => console.warn('[Sidebar] 检查侧边栏能力失败。', error),
    });
  }

  /**
   * 当前设备是否支持侧边栏功能
   */
  isSupported(): boolean { return this.supported; }

  /**
   * 判断玩家当前这次是不是从侧边栏点进来的
   * 判定依据：场景值为 021036，或者来源是首页侧边栏卡片
   */
  isLaunchedFromSidebar(): boolean {
    const info = this.latestLaunch;
    return !!info && (
      `${info.scene ?? ''}` === '021036'
      || (info.launch_from === 'homepage' && info.location === 'sidebar_card')
    );
  }

  /**
   * 调起原生界面，引导玩家跳转到抖音首页侧边栏
   */
  navigate(): Promise<boolean> {
    const tt = this.getApi();
    if (!tt || typeof tt.navigateToScene !== 'function') { return Promise.resolve(false); }
    return new Promise((resolve) => {
      tt.navigateToScene({
        scene: 'sidebar',
        success: () => resolve(true),
        fail: (error) => {
          console.warn('[Sidebar] 跳转首页侧边栏失败。', error);
          resolve(false);
        },
      });
    });
  }

  /**
   * 注册侧边栏状态变化监听（比如判断支持情况发生变化或重新切后台进入）
   */
  onChange(listener: StateListener): void {
    if (this.listeners.indexOf(listener) < 0) { this.listeners.push(listener); }
  }

  /**
   * 移除状态变化监听
   */
  offChange(listener: StateListener): void {
    this.listeners = this.listeners.filter((item) => item !== listener);
  }

  /**
   * 广播通知所有已注册的监听器
   */
  private emit(): void { this.listeners.slice().forEach((listener) => listener()); }

  /**
   * 获取抖音平台的原生 API 对象
   */
  private getApi(): SidebarApi | null {
    const tt = (globalThis as unknown as { tt?: Partial<SidebarApi> }).tt;
    return tt && typeof tt.onShow === 'function' && typeof tt.checkScene === 'function'
      ? tt as SidebarApi
      : null;
  }
}

// 导出单例，方便各页面直接引用
export const sidebarService = new SidebarService();
