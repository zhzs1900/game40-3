// 扑克牌弹匣系统
// 负责发牌、洗牌、手牌组合检测与保底机制

import { CardItem, ComboType, HandCombo, SuitType } from './GameData';

export class CardDeck {
  private stock: CardItem[] = [];      // 摸牌堆
  private discard: CardItem[] = [];    // 弃牌堆
  private hand: CardItem[] = [];       // 当前手牌
  private nextId = 1;
  private badLuckCount = 0;            // 连续单牌计数，用来触发抽牌保底

  constructor() {
    this.resetDeck();
  }

  // 重置并洗一副新扑克牌
  resetDeck() {
    this.stock = [];
    this.discard = [];
    this.hand = [];
    this.nextId = 1;
    this.badLuckCount = 0;

    const suits: SuitType[] = ['spade', 'heart', 'club', 'diamond'];
    for (const suit of suits) {
      for (let v = 2; v <= 14; v++) {
        this.stock.push({
          id: this.nextId++,
          suit,
          val: v,
        });
      }
    }
    this.shuffle(this.stock);
  }

  // 经典的洗牌洗一下
  private shuffle(list: CardItem[]) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
  }

  // 获得当前手牌列表
  getHand(): CardItem[] {
    return this.hand;
  }

  // 获得牌堆剩余张数
  getStockCount(): number {
    return this.stock.length;
  }

  // 给手牌塞入一张特殊的万能Joker牌（广告奖励或特殊事件）
  insertJoker() {
    const joker: CardItem = {
      id: this.nextId++,
      suit: 'spade',
      val: 14,
      isJoker: true,
    };
    this.hand.push(joker);
  }

  // 补满手牌，最大容量通常为5
  fillHand(maxCount: number = 5): CardItem[] {
    const need = maxCount - this.hand.length;
    if (need <= 0) return [];

    const newCards: CardItem[] = [];
    for (let i = 0; i < need; i++) {
      // 牌堆不够了就把弃牌堆洗回来
      if (this.stock.length === 0) {
        if (this.discard.length === 0) {
          // 连弃牌堆都没了，那就现场印一套牌补充进去
          this.makeExtraCards();
        }
        this.stock = this.discard;
        this.discard = [];
        this.shuffle(this.stock);
      }

      // 看看需不需要抽牌保底，防止脸黑一直摸杂牌
      let picked: CardItem;
      if (this.badLuckCount >= 3 && this.hand.length > 0 && Math.random() < 0.65) {
        picked = this.drawLuckyCard();
        this.badLuckCount = 0; // 触发保底后清零
      } else {
        picked = this.stock.pop()!;
      }

      this.hand.push(picked);
      newCards.push(picked);
    }
    return newCards;
  }

  // 紧急印牌补仓，保证游戏永远不会断牌
  private makeExtraCards() {
    const suits: SuitType[] = ['spade', 'heart', 'club', 'diamond'];
    for (const suit of suits) {
      for (let v = 2; v <= 14; v++) {
        this.discard.push({
          id: this.nextId++,
          suit,
          val: v,
        });
      }
    }
  }

  // 保底抽牌：优先找一张能跟手里凑成对子、同花或顺子的牌
  private drawLuckyCard(): CardItem {
    if (this.hand.length === 0 || this.stock.length === 0) {
      return this.stock.pop()!;
    }

    // 找对子目标
    const handVal = this.hand[0].val;
    const matchIdx = this.stock.findIndex(c => c.val === handVal);
    if (matchIdx >= 0) {
      const card = this.stock.splice(matchIdx, 1)[0];
      return card;
    }

    // 找不到就正常摸一张
    return this.stock.pop()!;
  }

  // 记录出牌情况，如果是单牌就累计脸黑次数
  recordPlay(type: ComboType) {
    if (type === 'single') {
      this.badLuckCount++;
    } else {
      this.badLuckCount = Math.max(0, this.badLuckCount - 1);
    }
  }

  // 消耗打出的牌，把它们放进弃牌堆
  discardCards(used: CardItem[]) {
    const usedIds = new Set(used.map(c => c.id));
    this.hand = this.hand.filter(c => !usedIds.has(c.id));
    this.discard.push(...used);
  }

  // 快速弃掉单张牌并换一张（快抽功能）
  swapOne(cardId: number): CardItem | null {
    const idx = this.hand.findIndex(c => c.id === cardId);
    if (idx < 0) return null;
    const old = this.hand.splice(idx, 1)[0];
    this.discard.push(old);
    const added = this.fillHand(this.hand.length + 1);
    return added[0] || null;
  }

  // 分析一组选定手牌（或全部手牌），找出最强牌型
  evaluateCombo(cards: CardItem[]): HandCombo {
    if (!cards || cards.length === 0) return this.evaluateExactCombo([]);
    let best = this.evaluateExactCombo([cards[0]]);
    for (let mask = 1; mask < (1 << cards.length); mask++) {
      const subset = cards.filter((_, i) => (mask & (1 << i)) !== 0);
      if (subset.length > 5) continue;
      const combo = this.evaluateExactCombo(subset);
      if (combo.power > best.power || (combo.power === best.power && combo.cards.length < best.cards.length)) {
        best = combo;
      }
    }
    return best;
  }

  private evaluateExactCombo(cards: CardItem[]): HandCombo {
    if (!cards || cards.length === 0) {
      return {
        type: 'single',
        cards: [],
        power: 1,
        mainSuit: 'spade',
        name: '普通射击'
      };
    }

    // 1张牌直接算单牌
    if (cards.length === 1) {
      return {
        type: 'single',
        cards: [...cards],
        power: 1.0,
        mainSuit: cards[0].suit,
        name: `${this.getSuitName(cards[0].suit)}单枪`
      };
    }

    // 含有万能Joker时按最强优先处理
    const jokerCount = cards.filter(c => c.isJoker).length;

    // 统计点数频率
    const valMap: Record<number, number> = {};
    const suitMap: Record<string, number> = { spade: 0, heart: 0, club: 0, diamond: 0 };
    for (const c of cards) {
      if (c.isJoker) continue;
      valMap[c.val] = (valMap[c.val] || 0) + 1;
      suitMap[c.suit] = (suitMap[c.suit] || 0) + 1;
    }

    // 找最多的花色作为主导花色
    let maxSuit: SuitType = 'spade';
    let maxSuitCount = 0;
    for (const s of ['spade', 'heart', 'club', 'diamond'] as SuitType[]) {
      if (suitMap[s] > maxSuitCount) {
        maxSuitCount = suitMap[s];
        maxSuit = s;
      }
    }

    const counts = Object.keys(valMap).map(k => valMap[Number(k)]).sort((a, b) => b - a);

    // 四条判定
    if (cards.length === 4 && (counts[0] || 0) + jokerCount >= 4) {
      return {
        type: 'quads',
        cards: [...cards],
        power: 4.5,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}四条·枪斗`
      };
    }

    // 葫芦判定 (3 + 2)
    if (cards.length === 5 && counts.length === 2 && Math.max(0, 3 - counts[0]) + Math.max(0, 2 - counts[1]) <= jokerCount) {
      return {
        type: 'fullhouse',
        cards: [...cards],
        power: 3.5,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}葫芦·重爆`
      };
    }

    // 同花判定 (5张或以上同花色，或包含Joker且同色)
    if (cards.length === 5 && maxSuitCount + jokerCount >= 5) {
      return {
        type: 'flush',
        cards: [...cards],
        power: 3.0,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}同花·怒放`
      };
    }

    // 顺子判定 (5张连续点数)
    if (cards.length >= 5 && this.checkStraight(cards)) {
      return {
        type: 'straight',
        cards: [...cards],
        power: 2.8,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}顺子·疾射`
      };
    }

    // 三条判定
    if (cards.length === 3 && (counts[0] || 0) + jokerCount >= 3) {
      return {
        type: 'trips',
        cards: [...cards],
        power: 2.2,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}三条·散射`
      };
    }

    // 对子判定
    if (cards.length === 2 && (counts[0] || 0) + jokerCount >= 2) {
      return {
        type: 'pair',
        cards: [...cards],
        power: 1.6,
        mainSuit: maxSuit,
        name: `${this.getSuitName(maxSuit)}对子·双发`
      };
    }

    // 否则为散牌，默认取最大的单牌
    return {
      type: 'single',
      cards: [cards[0]],
      power: 1.0,
      mainSuit: cards[0].suit,
      name: `${this.getSuitName(cards[0].suit)}普射`
    };
  }

  // 顺子检测，包括A2345和10JQKA
  private checkStraight(cards: CardItem[]): boolean {
    const regular = cards.filter(c => !c.isJoker);
    const vals = new Set(regular.map(c => c.val));
    if (vals.size !== regular.length || cards.length !== 5) return false;
    for (let start = 1; start <= 10; start++) {
      const run = Array.from({ length: 5 }, (_, i) => start + i === 1 ? 14 : start + i);
      if (regular.every(c => run.indexOf(c.val) >= 0)) return true;
    }
    return false;
  }

  // 自动从当前全部手牌中挑选出最高牌型的卡牌组合
  pickBestCombo(): HandCombo {
    return this.evaluateCombo(this.hand);
  }

  private getSuitName(suit: SuitType): string {
    switch (suit) {
      case 'spade': return '黑桃';
      case 'heart': return '红桃';
      case 'club': return '梅花';
      case 'diamond': return '方块';
    }
  }
}
