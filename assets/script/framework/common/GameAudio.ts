import { AudioClip, AudioSource, Node, resources } from 'cc';
import { GameStorage } from '../core/GameStorage';

export class GameAudio {
  musicEnabled: boolean;
  effectsEnabled: boolean;
  private readonly music: AudioSource;
  private readonly effects: AudioSource[] = [];
  private interacted = false;
  private clickClip: AudioClip | null = null;

  constructor(private readonly root: Node, private readonly storage: GameStorage) {
    this.musicEnabled = storage.getBool('musicEnabled', true);
    this.effectsEnabled = storage.getBool('effectsEnabled', true);
    const musicNode = new Node('BackgroundMusic');
    root.addChild(musicNode);
    this.music = musicNode.addComponent(AudioSource);
    this.music.loop = true;
    this.music.volume = 0.55;
    resources.load('audio/bgm', AudioClip, (error, clip) => {
      if (error || !root.isValid) { return; }
      this.music.clip = clip;
      this.startMusic();
    });
    resources.load('audio/click', AudioClip, (error, clip) => {
      if (!error && root.isValid) { this.clickClip = clip; }
    });
  }

  click() {
    this.interacted = true;
    this.startMusic();
    if (this.effectsEnabled && this.clickClip) {
      let source = this.effects.find(effect => !effect.playing);
      if (!source) {
        const node = new Node('ClickEffect');
        this.root.addChild(node);
        source = node.addComponent(AudioSource);
        this.effects.push(source);
      }
      source.clip = this.clickClip;
      source.volume = 0.8;
      source.play();
    }
  }

  setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    this.storage.setBool('musicEnabled', enabled);
    if (enabled) { this.startMusic(); } else { this.music.pause(); }
  }

  setEffects(enabled: boolean) {
    this.effectsEnabled = enabled;
    this.storage.setBool('effectsEnabled', enabled);
    if (!enabled) { this.effects.forEach(source => source.stop()); }
  }

  private startMusic() {
    if (this.root.isValid && this.interacted && this.musicEnabled && this.music.clip && !this.music.playing) {
      this.music.play();
    }
  }
}
