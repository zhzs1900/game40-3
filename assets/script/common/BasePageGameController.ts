import { Node, UITransform, view } from 'cc';
import { BaseGameController } from './BaseGameController';

/**
 * 通用单页 UI 控制器。
 * 管理页面根节点；各页面自身的清理由对应页面组件处理。
 */
export abstract class BasePageGameController extends BaseGameController {
  private pageRoot: Node | null = null;

  onDestroy() {
    this.pageRoot?.destroy();
  }

  /** 创建并切换全屏页面；玩法页、结算页等均可复用。 */
  protected createPage(name: string) {
    this.pageRoot?.destroy();

    const size = view.getVisibleSize();
    const root = new Node(name);
    root.addComponent(UITransform).setContentSize(size.width, size.height);
    this.node.addChild(root);

    this.pageRoot = root;
    return root;
  }
}
