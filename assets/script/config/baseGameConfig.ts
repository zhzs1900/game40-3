/**
 * 基础游戏全局配置
 * 包含存储前缀、音频以及广告配置等关键参数
 */
export const baseGameConfig = {
  /** 游戏标题，配了之后封面就会展示，留空或不填则不显示 */
  gameTitle: '符灯夜行',
  /** 封面是否显示健康游戏忠告，默认 false 不显示 */
  showAdvice: true,
  /** 基础框架的调试入口及关卡总数。 */
  debug: false,
  /** 封面设置中“秘籍”的 DEBUG 入口密码，只使用数字 0–9。 */
  debugPassword: '08',
  totalLevels: 8,
  /** 本地存储的键名前缀 */
  storageKeyPrefix: 'save_game',


  /** 广告及抖音运营能力配置。 */
  adConfig: {
    /** 激励视频广告位 ID。 */
    rewardedVideoAdUnitId: '9f6d1j81okc5m2cmi1',
    /** 无广告 API、广告位未配置或广告展示异常时，是否直接放行激励奖励。 */
    rewardedAdDebugFallbackEnabled: true,
    /** 是否开启消息订阅。默认关闭；关闭后隐藏入口，并禁用订阅及其奖励。 */
    subscribeMessageEnabled: false,
    /** 订阅消息模板 ID，一次最多使用三个同类型模板。 */
    subscribeMessageTemplateIds: ['123'] as string[],
  },
} as const;
