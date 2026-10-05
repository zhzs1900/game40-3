import { Color, Label, LabelOutline, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';

// Cocos UI 底层构建工具类
// 提供文本和图片节点装配，供 GameUI 调用
export class UIHelper {
  // 快捷创建一个居中对齐的文本节点
  static createText(
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    bold = false,
    outline?: { color: Color; width: number },
  ) {
    const node = new Node(name);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    // 按 1.28 倍字号计算行高，保证多行文本排版不局促
    label.lineHeight = Math.round(fontSize * 1.28);
    label.color = color;
    label.isBold = bold;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    // 如果传入了描边配置，挂载 LabelOutline 组件
    if (outline) {
      const edge = node.addComponent(LabelOutline);
      edge.color = outline.color;
      edge.width = outline.width;
    }
    return node;
  }

  // 异步加载 resources 目录下的 SpriteFrame 并创建图片节点
  static createImage(name: string, path: string, width: number, height: number, contain = false) {
    const node = new Node(name);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    // 异步加载图片资源，加载完成后检测节点是否仍然有效再赋值
    resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (!error && frame && node.isValid) {
        sprite.spriteFrame = frame;
        if (contain) {
          const original = frame.originalSize;
          const scale = Math.min(width / original.width, height / original.height);
          node.getComponent(UITransform)!.setContentSize(original.width * scale, original.height * scale);
        }
      } else if (error) {
        console.warn(`[UIHelper] Failed to load image: ${path}`, error);
      }
    });
    return node;
  }


}

