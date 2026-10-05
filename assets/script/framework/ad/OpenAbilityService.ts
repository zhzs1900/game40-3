import { baseGameConfig } from '../../config/baseGameConfig';

// 添加桌面快捷方式回调结果
interface ShortcutResult { errMsg?: string; }

// 单个订阅模板的用户授权状态
interface SubscribeTemplateResult {
  status?: 'accept' | 'reject' | 'fail' | 'repeat'; // 接受/拒绝/失败/已订阅
  alwaysSubscribe?: boolean;                       // 是否勾选了总是保持以上选择
}

// 订阅消息接口返回数据
interface SubscribeResult {
  errMsg?: string;
  templateSettings?: Record<string, SubscribeTemplateResult>;
}

// 抖音小游戏开放能力原生 API
interface DouyinOpenAbilityApi {
  addShortcut(options: {
    success?: (result: ShortcutResult) => void;
    fail?: (error: ShortcutResult) => void;
  }): void;
  requestSubscribeMessage(options: {
    tmplIds: string[];
    success?: (result: SubscribeResult) => void;
    fail?: (error: ShortcutResult) => void;
  }): void;
  canIUse?(schema: string): boolean;
}

// 通用的操作结果返回格式
export interface OpenAbilityResult {
  succeeded: boolean; // 是否操作成功
  message: string;    // 提示文本（可直接用于 Toast 展示）
}

// 订阅消息专属的返回结果
export interface SubscribeAbilityResult extends OpenAbilityResult {
  acceptedTemplateIds: string[]; // 用户实际允许订阅的模板 ID 列表
}

/** 
 * 抖音小游戏开放能力适配类
 * 封装了“添加到桌面”和“长期/一次性订阅消息”能力
 */
class OpenAbilityService {
  /** 检查当前版本或设备是否支持“添加到桌面”功能 */
  canAddShortcut(): boolean {
    const api = this.getApi();
    return !!api?.addShortcut && (!api.canIUse || api.canIUse('addShortcut'));
  }

  /** 检查当前版本或设备是否支持“订阅消息”功能 */
  canSubscribeMessage(): boolean {
    if (!baseGameConfig.adConfig.subscribeMessageEnabled) { return false; }
    const api = this.getApi();
    return !!api?.requestSubscribeMessage
      && (!api.canIUse || api.canIUse('requestSubscribeMessage'));
  }

  /** 
   * 请求添加桌面快捷方式
   * 注意：抖音平台限制此方法必须由用户手势（如点击按钮）直接触发，中间不能有 await 异步等待！
   */
  addShortcut(): Promise<OpenAbilityResult> {
    const api = this.getApi();
    // 不支持或 API 不存在时直接返回失败
    if (!api?.addShortcut || !this.canAddShortcut()) {
      return Promise.resolve({ succeeded: false, message: '当前设备或抖音版本暂不支持添加桌面' });
    }

    return new Promise((resolve) => {
      api.addShortcut!({
        success: () => resolve({ succeeded: true, message: '已添加到桌面' }),
        fail: (error) => {
          console.warn('[OpenAbility] 添加桌面快捷方式失败。', error);
          resolve({ succeeded: false, message: '添加失败，请检查桌面快捷方式权限' });
        },
      });
    });
  }

  /** 
   * 调起订阅消息授权弹窗
   * 注意：同样必须直接在用户点击回调中同步调用；抖音单次最多允许传入 3 个有效模板 ID
   * @param templateIds 订阅模板 ID 列表，默认从 baseGameConfig 中读取
   */
  requestSubscribeMessage(templateIds = baseGameConfig.adConfig.subscribeMessageTemplateIds): Promise<SubscribeAbilityResult> {
    if (!baseGameConfig.adConfig.subscribeMessageEnabled) {
      return Promise.resolve({ succeeded: false, message: '消息订阅功能未开启', acceptedTemplateIds: [] });
    }
    const api = this.getApi();
    if (!api?.requestSubscribeMessage || !this.canSubscribeMessage()) {
      return Promise.resolve({
        succeeded: false,
        message: '当前抖音版本暂不支持消息订阅',
        acceptedTemplateIds: [],
      });
    }

    // 过滤出以 MSG 开头的合规模板 ID，且一次最多传前 3 个
    const ids = templateIds.map((id) => id.trim()).filter((id) => /^MSG/.test(id)).slice(0, 3);
    if (ids.length === 0) {
      return Promise.resolve({ succeeded: false, message: '请先配置订阅消息模板 ID', acceptedTemplateIds: [] });
    }

    return new Promise((resolve) => {
      api.requestSubscribeMessage!({
        tmplIds: ids,
        success: (result) => {
          const settings = result.templateSettings || {};
          // 找出用户点了“同意”或“保持允许”的模板
          const accepted = ids.filter((id) => {
            const status = settings[id]?.status;
            return status === 'accept' || status === 'repeat';
          });

          // 兼容老版本基础库：如果没有 templateSettings 字段，只要走到 success 就视为全部订阅成功
          const acceptedIds = Object.keys(settings).length === 0 ? ids : accepted;
          resolve({
            succeeded: acceptedIds.length > 0,
            message: acceptedIds.length > 0 ? `已订阅 ${acceptedIds.length} 项消息提醒` : '未开启消息提醒',
            acceptedTemplateIds: acceptedIds,
          });
        },
        fail: (error) => {
          console.warn('[OpenAbility] 请求订阅消息失败。', error);
          resolve({ succeeded: false, message: '订阅未完成，可稍后重试', acceptedTemplateIds: [] });
        },
      });
    });
  }

  /** 获取抖音原生全局环境对象 */
  private getApi(): Partial<DouyinOpenAbilityApi> | null {
    return (globalThis as unknown as { tt?: Partial<DouyinOpenAbilityApi> }).tt || null;
  }
}

// 导出单例方便全局直接使用
export const openAbilityService = new OpenAbilityService();
