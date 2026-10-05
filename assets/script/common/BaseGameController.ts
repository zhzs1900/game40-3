import { _decorator, Component } from 'cc';
import { rewardedVideoAd } from '../framework/ad/RewardedVideoAdService';
import { baseGameConfig } from '../config/baseGameConfig';
import { GameStorage } from '../framework/core/GameStorage';
import { sidebarService } from '../framework/ad/SidebarService';
import { openAbilityService } from '../framework/ad/OpenAbilityService';

const { ccclass } = _decorator;

// 游戏全局基础状态枚举，覆盖常规小游戏的主流程
export enum BaseGameState {
  Boot = 'boot',                   // 初始启动/加载中
  Cover = 'cover',                 // 封面页（比如首屏过渡）
  Playing = 'playing',             // 游戏中/核心玩法进行中
  Paused = 'paused',               // 游戏暂停
  GameOver = 'game-over',           // 游戏失败结算
  Victory = 'victory',             // 游戏胜利结算
}

/**
 * 游戏通用控制器基类
 * 负责把各种底层服务（存储、广告）串起来，顺便管一下游戏状态机
 */
@ccclass('BaseGameController')
export abstract class BaseGameController extends Component {
  // 本地存储实例，带项目配置的统一前缀，避免不同游戏 key 冲突
  protected readonly storage = new GameStorage(baseGameConfig.storageKeyPrefix);
  
  // 侧边栏服务入口（快捷跳转）
  protected readonly sidebar = sidebarService;
  
  // 平台开放能力（如添加桌面、录屏分享等）
  protected readonly openAbilities = openAbilityService;
  
  // 当前所处的游戏状态，默认是 Boot
  protected state: BaseGameState = BaseGameState.Boot;
  
  // 组件挂载时先初始化基础公共服务，再进入自定义启动逻辑
  start() {
    // 提前初始化激励广告，避免后续调用时 SDK 还没准备好
    rewardedVideoAd.init();
    this.bootstrap();
  }

  // 帧循环处理
  update(dt: number) {
    // 不管处于什么状态，每帧都会跑的逻辑（比如公共倒计时、粒子刷新等）
    this.onUpdateAlways(dt);

    // 只有在真正玩游戏的状态下才更新关卡与操作逻辑
    if (this.state === BaseGameState.Playing) {
      this.onUpdatePlaying(dt);
    }
  }

  // 默认启动流程，默认直接切到封面状态，子类如有分包/资源预载需求可以重写这里
  protected bootstrap() {
    this.setState(BaseGameState.Cover);
  }

  // 获取当前状态
  protected getState() {
    return this.state;
  }

  // 状态机切换核心方法
  protected setState(nextState: BaseGameState) {
    // 状态相同就不折腾了，避免重复触发回调
    if (nextState === this.state) {
      return;
    }

    const previous = this.state;
    // 先通知离开旧状态
    this.onLeaveState(previous, nextState);
    this.state = nextState;
    // 再通知进入新状态
    this.onEnterState(previous, nextState);
  }

  // ---- 下面是留给具体业务子类重写的生命周期钩子 ----

  // 状态切入时的钩子
  protected onEnterState(_previous: BaseGameState, _next: BaseGameState) {}

  // 状态切出时的钩子
  protected onLeaveState(_previous: BaseGameState, _next: BaseGameState) {}

  // 每帧必然执行的钩子
  protected onUpdateAlways(_dt: number) {}

  // 仅在 Playing 状态下每帧执行的钩子
  protected onUpdatePlaying(_dt: number) {}
}
