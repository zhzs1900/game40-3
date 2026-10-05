import { BlockInputEvents, Button, Color, Graphics, Label, Layers, Node, Size, UIOpacity, UITransform } from 'cc';
import { UIHelper } from './UIHelper';

/** 使用原 React 素材，以 720 × 1280 为逻辑舞台。 */
export class GameUI {
  constructor(private readonly onClick: () => void) {}

  stage(parent: Node, size: Size) {
    const stage = this.node(parent, 'Stage', 720, 1280);
    const scale = Math.min(size.width / 720, size.height / 1280);
    stage.setScale(scale, scale, 1);
    return stage;
  }

  node(parent: Node, name: string, width: number, height: number, x = 0, y = 0) {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x, y);
    parent.addChild(node);
    return node;
  }

  image(parent: Node, path: string, width: number, height: number, x = 0, y = 0, contain = false) {
    const node = UIHelper.createImage(path, `ui/${path}`, width, height, contain);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    return node;
  }

  text(parent: Node, text: string, x: number, y: number, fontSize = 26, width = 600, color = new Color(241, 245, 249)) {
    const node = UIHelper.createText('Text', text, fontSize, color, true);
    node.layer = Layers.Enum.UI_2D;
    node.getComponent(UITransform)!.setContentSize(width, fontSize * 1.4 * text.split('\n').length);
    node.getComponent(Label)!.overflow = Label.Overflow.SHRINK;
    node.setPosition(x, y);
    parent.addChild(node);
    return node;
  }

  button(parent: Node, text: string, x: number, y: number, width: number, height: number,
    action: () => void, image = 'buttons/btn_gold', icon?: string, enabled = true, textY = 0) {
    const node = this.image(parent, image, width, height, x, y);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.95;
    button.interactable = enabled;
    if (!enabled) { node.addComponent(UIOpacity).opacity = 76; }
    if (text) {
      this.text(node, text, icon ? 24 : 0, textY, 26, width - (icon ? 100 : 24),
        image === 'buttons/btn_gold' ? new Color(69, 35, 10) : new Color(241, 245, 249));
    }
    if (icon) { this.image(node, icon, 42, 42, -width / 2 + 42, 0); }
    node.on(Button.EventType.CLICK, () => { this.onClick(); action(); });
    return node;
  }

  modal(stage: Node, title: string, height = 760) {
    const overlay = this.node(stage, 'ModalOverlay', 720, 1280);
    const graphics = overlay.addComponent(Graphics);
    graphics.fillColor = new Color(0, 0, 0, 205);
    graphics.rect(-360, -640, 720, 1280);
    graphics.fill();
    overlay.addComponent(BlockInputEvents);
    const body = this.image(overlay, 'panels/panel_common', 620, height);
    body.addComponent(BlockInputEvents);
    this.text(body, title, 0, height / 2 - 65, 34, 490, new Color(253, 230, 138));
    return { overlay, body, close: () => { overlay.active = false; overlay.destroy(); } };
  }
}

