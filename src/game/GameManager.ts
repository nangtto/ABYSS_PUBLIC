import { AudioManager } from './AudioManager';
import { Camera } from './Camera';
import { CombatSystem } from './CombatSystem';
import { getBiomeForFloor, isBossFloor } from './data/biomes';
import { getClassById, META_UPGRADES } from './data/classes';
import { getBossById } from './data/monsters';
import { getRelicById, RELICS } from './data/relics';
import { getSkillById } from './data/skills';
import { createItemFromTemplate, generateRandomEquipment, WEAPON_PROFILES } from './data/weapons';
import { DungeonGenerator, FloorMap } from './DungeonGenerator';
import { Enemy, EnemyAttackEvent } from './Enemy';
import { InventorySystem } from './InventorySystem';
import { PixelRenderer } from './PixelRenderer';
import { Player } from './Player';
import { SaveManager } from './SaveManager';
import { SkillSystem } from './SkillSystem';
import {
  Direction,
  DungeonRoom,
  EquipSlot,
  GameSettings,
  GameState,
  GroundDrop,
  LevelUpChoice,
  RARITY_COLORS,
  RoomProp,
  SerializedRun,
} from './types';
import { EventPromptData, UIManager } from './UIManager';

const RANDOM_EVENTS: {
  title: string;
  description: string;
  options: { label: string; effectDesc: string; kind: 'blood_gear' | 'wisdom' | 'gamble' | 'heal' }[];
}[] = [
  {
    title: '피의 제단',
    description: '붉게 빛나는 고대의 제단이 당신의 생명력을 요구합니다. 대가를 치르면 강력한 힘을 얻을 수 있습니다.',
    options: [
      {
        label: '피의 서약 맺기',
        effectDesc: '현재 체력 25%를 소모하고 영웅 등급 이상 장비와 공격력 +10%를 획득합니다.',
        kind: 'blood_gear',
      },
      {
        label: '제단에서 기도하기',
        effectDesc: '체력을 25% 회복하고 골드 35G를 얻습니다.',
        kind: 'heal',
      },
    ],
  },
  {
    title: '지혜의 석판',
    description: '잊혀진 왕국의 마법사가 남긴 룬 문자가 공중에 떠올랐습니다.',
    options: [
      {
        label: '룬의 지식 흡수',
        effectDesc: '경험치 대량 획득 및 스킬 강화석 1개를 얻습니다.',
        kind: 'wisdom',
      },
      {
        label: '운명의 주사위 굴리기',
        effectDesc: '50% 확률로 희귀 유물 획득, 실패 시 골드 50G 획득.',
        kind: 'gamble',
      },
    ],
  },
];

export class GameManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private saveManager = new SaveManager();
  private audio: AudioManager;
  private renderer = new PixelRenderer();
  private camera = new Camera();
  private dungeonGen = new DungeonGenerator();
  private combat = new CombatSystem();
  private inventory = new InventorySystem();
  private skillSystem = new SkillSystem();
  private ui: UIManager;

  private state: GameState = 'TITLE';
  private player: Player | null = null;
  private floorMap: FloorMap | null = null;
  private currentRoom: DungeonRoom | null = null;
  private floor = 1;
  private enemies: Enemy[] = [];
  private drops: GroundDrop[] = [];
  private kills = 0;
  private bossesKilled = 0;
  private elapsedSec = 0;
  private autoSaveTimer = 0;
  private hazardTickTimer = 0;
  private levelChoices: LevelUpChoice[] = [];
  private activeEventData: (typeof RANDOM_EVENTS)[number] | null = null;
  private activeEventProp: RoomProp | null = null;

  // Input state
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseWorldX = 0;
  private mouseWorldY = 0;
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private useMouseAim = false;
  private joyVecX = 0;
  private joyVecY = 0;
  private joyTouchId: number | null = null;

  private lastFrameTime = performance.now();
  private viewW = window.innerWidth;
  private viewH = window.innerHeight;
  private isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    const save = this.saveManager.getData();
    this.audio = new AudioManager(save.settings);
    this.camera.setShakeEnabled(save.settings.screenShake);

    this.ui = new UIManager({
      onOpenSanctuary: () => this.setState('SANCTUARY'),
      onContinueRun: () => this.continueSavedRun(),
      onStartNewRun: (cid) => this.startNewRun(cid),
      onUnlockClass: (cid) => this.unlockClass(cid),
      onBuyMetaUpgrade: (uid) => this.buyMetaUpgrade(uid),
      onSelectLevelUpChoice: (idx) => this.chooseLevelUp(idx),
      onResumeGame: () => this.setState('PLAYING'),
      onPauseGame: () => this.setState('PAUSED'),
      onReturnToTitle: () => {
        if (this.player && this.state !== 'GAME_OVER' && this.state !== 'VICTORY') {
          this.saveCurrentRun();
        }
        this.audio.stopBiomeDrone();
        this.setState('TITLE');
      },
      onOpenInventory: () => {
        if (this.state === 'PLAYING') this.setState('INVENTORY');
        else if (this.state === 'INVENTORY') this.setState('PLAYING');
      },
      onCloseModalToPlaying: () => this.setState('PLAYING'),
      onEquipItem: (uid) => this.handleEquipItem(uid),
      onSellItem: (uid) => this.handleSellItem(uid),
      onDismantleItem: (uid) => this.handleDismantleItem(uid),
      onAssignSkillSlot: (sid, sIdx) => this.handleAssignSkill(sid, sIdx),
      onUpgradeSkillWithStone: (sid) => this.handleUpgradeSkillStone(sid),
      onBuyShopEntry: (eid) => this.handleBuyShop(eid),
      onUpgradeEquipped: (slot) => this.handleUpgradeEquipped(slot),
      onResolveEvent: (idx) => this.handleResolveEvent(idx),
      onRestHeal: () => this.handleRestHeal(),
      onRestMaxHp: () => this.handleRestMaxHp(),
      onUsePotion: () => this.usePotion(),
      onUpdateSettings: (partial) => this.updateSettings(partial),
      onResetSave: () => {
        this.saveManager.resetAll();
        this.ui.showToast('저장 데이터가 초기화되었습니다.', '#fb7185');
      },
      onOpenCodex: (from) => {
        this.ui.setCodexReturnState(from);
        this.setState('CODEX');
      },
      onPlayClick: () => this.audio.playClick(),
      onTriggerSkillSlot: (idx) => this.triggerSkill(idx),
      onTriggerInteract: () => this.tryInteract(),
    });

    this.bindInputs();
    this.resizeCanvas();
    this.setState('TITLE');
    requestAnimationFrame((t) => this.loop(t));
  }

  private resizeCanvas(): void {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = this.viewW;
    this.canvas.height = this.viewH;
    this.ctx.imageSmoothingEnabled = false;
  }

  private bindInputs(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    window.addEventListener('blur', () => {
      this.heldKeys.clear();
      this.justPressed.clear();
      this.joyVecX = 0;
      this.joyVecY = 0;
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      if (!this.heldKeys.has(code)) {
        this.justPressed.add(code);
      }
      this.heldKeys.add(code);

      if (this.state === 'TITLE') {
        if (code === 'Enter' || code === 'Space') {
          this.audio.playClick();
          this.setState('SANCTUARY');
        }
        return;
      }

      if (this.state === 'LEVEL_UP') {
        if (code === 'Digit1') this.chooseLevelUp(0);
        else if (code === 'Digit2') this.chooseLevelUp(1);
        else if (code === 'Digit3') this.chooseLevelUp(2);
        return;
      }

      if (code === 'Escape') {
        if (this.state === 'PLAYING') {
          this.setState('PAUSED');
        } else if (
          this.state === 'PAUSED' ||
          this.state === 'INVENTORY' ||
          this.state === 'SHOP' ||
          this.state === 'BLACKSMITH' ||
          this.state === 'REST'
        ) {
          this.setState('PLAYING');
        }
        return;
      }

      if (code === 'KeyI') {
        if (this.state === 'PLAYING') this.setState('INVENTORY');
        else if (this.state === 'INVENTORY') this.setState('PLAYING');
        return;
      }

      if (this.state === 'PLAYING') {
        if (code === 'Space') this.justPressed.add('ATTACK');
        if (code === 'ShiftLeft' || code === 'ShiftRight') this.justPressed.add('DODGE');
        if (code === 'KeyQ') this.triggerSkill(0);
        if (code === 'KeyE') this.triggerSkill(1);
        if (code === 'KeyR') this.triggerSkill(2);
        if (code === 'KeyF') this.tryInteract();
        if (code === 'KeyH' || code === 'Digit1') this.usePotion();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.heldKeys.delete(e.code);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;
      this.useMouseAim = true;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING') return;
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;
      this.useMouseAim = true;
      if (e.button === 0) this.justPressed.add('ATTACK');
      if (e.button === 2) this.justPressed.add('DODGE');
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mobile touch bindings
    const mobileRoot = document.getElementById('mobile-controls')!;
    mobileRoot.addEventListener('touchstart', (e) => this.handleMobileTouch(e, 'start'), { passive: false });
    mobileRoot.addEventListener('touchmove', (e) => this.handleMobileTouch(e, 'move'), { passive: false });
    mobileRoot.addEventListener('touchend', (e) => this.handleMobileTouch(e, 'end'), { passive: false });
  }

  private handleMobileTouch(e: TouchEvent, phase: 'start' | 'move' | 'end'): void {
    if (this.state !== 'PLAYING') return;
    const joyZone = document.getElementById('mob-joy-zone');
    const joyKnob = document.getElementById('mob-joy-knob');

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const target = (t.target as HTMLElement)?.closest('[data-mob]') as HTMLElement | null;

      if (phase === 'start' && target) {
        e.preventDefault();
        const act = target.getAttribute('data-mob');
        if (act === 'attack') this.justPressed.add('ATTACK');
        else if (act === 'dodge') this.justPressed.add('DODGE');
        else if (act === 'interact') this.tryInteract();
        else if (act === 'skill0') this.triggerSkill(0);
        else if (act === 'skill1') this.triggerSkill(1);
        else if (act === 'skill2') this.triggerSkill(2);
        continue;
      }

      if (joyZone && (phase === 'start' && t.clientX < this.viewW * 0.45 && this.joyTouchId === null)) {
        this.joyTouchId = t.identifier;
      }

      if (joyZone && t.identifier === this.joyTouchId) {
        e.preventDefault();
        if (phase === 'end') {
          this.joyTouchId = null;
          this.joyVecX = 0;
          this.joyVecY = 0;
          if (joyKnob) joyKnob.style.transform = 'translate(0px, 0px)';
        } else {
          const rect = joyZone.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = t.clientX - cx;
          const dy = t.clientY - cy;
          const maxR = rect.width * 0.38;
          const dist = Math.hypot(dx, dy) || 1;
          const clamped = Math.min(maxR, dist);
          this.joyVecX = (dx / dist) * (clamped / maxR);
          this.joyVecY = (dy / dist) * (clamped / maxR);
          if (joyKnob) {
            joyKnob.style.transform = `translate(${(dx / dist) * clamped}px, ${(dy / dist) * clamped}px)`;
          }
        }
      }
    }
  }

  private setState(next: GameState): void {
    this.state = next;
    this.heldKeys.clear();
    this.justPressed.clear();
    this.joyVecX = 0;
    this.joyVecY = 0;

    const save = this.saveManager.getData();
    const showMob =
      next === 'PLAYING' &&
      (save.settings.mobileControlsMode === 'on' ||
        (save.settings.mobileControlsMode === 'auto' && this.isTouchDevice));
    this.ui.renderMobileControls(showMob);

    let eventPrompt: EventPromptData | null = null;
    if (next === 'EVENT' && this.activeEventData) {
      eventPrompt = {
        title: this.activeEventData.title,
        description: this.activeEventData.description,
        options: this.activeEventData.options.map((o) => ({ label: o.label, effectDesc: o.effectDesc })),
      };
    }

    this.ui.renderOverlay(next, save, {
      player: this.player,
      inv: this.inventory,
      levelChoices: this.levelChoices,
      shopInventory: this.currentRoom?.shopInventory,
      eventPrompt,
      floor: this.floor,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      elapsedSec: this.elapsedSec,
    });
  }

  private updateSettings(partial: Partial<GameSettings>): void {
    const save = this.saveManager.getData();
    save.settings = { ...save.settings, ...partial };
    this.saveManager.save();
    this.audio.updateSettings(save.settings);
    this.camera.setShakeEnabled(save.settings.screenShake);
  }

  private unlockClass(classId: string): void {
    const cls = getClassById(classId);
    const save = this.saveManager.getData();
    if (save.unlockedClasses.includes(classId)) return;
    const cost = cls.unlockCost || 50;
    if (save.abyssCrystals < cost) {
      this.ui.showToast(`심연의 결정이 부족합니다 (${cost}개 필요)`, '#fb7185');
      return;
    }
    save.abyssCrystals -= cost;
    save.unlockedClasses.push(classId);
    this.saveManager.save();
    this.audio.playPickup(true);
    this.ui.showToast(`${cls.name} 직업이 해금되었습니다!`, cls.primaryColor);
  }

  private buyMetaUpgrade(upgradeId: string): void {
    const def = META_UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return;
    const save = this.saveManager.getData();
    const lv = save.metaUpgrades[upgradeId] || 0;
    if (lv >= def.maxLevel) return;
    const cost = def.baseCost + lv * def.costStep;
    if (save.abyssCrystals < cost) return;
    save.abyssCrystals -= cost;
    save.metaUpgrades[upgradeId] = lv + 1;
    this.saveManager.save();
    this.audio.playLevelUp();
    this.ui.showToast(`${def.name} Lv.${lv + 1} 강화 완료!`, '#38bdf8');
  }

  private startNewRun(classId: string): void {
    const save = this.saveManager.getData();
    this.inventory.reset();
    this.player = new Player(classId);

    const goldMetaLv = save.metaUpgrades['meta_gold'] || 0;
    const potMetaLv = save.metaUpgrades['meta_potion'] || 0;
    this.player.gold = goldMetaLv * 30;
    this.player.potions = 2 + Math.floor(potMetaLv / 2);

    const starterWpn = createItemFromTemplate(this.player.classDef.starterWeaponTemplate, 1, 'common');
    this.inventory.equipped.weapon = starterWpn;
    this.saveManager.recordWeaponFound(starterWpn.templateId);

    this.player.skills = [
      { id: this.player.classDef.starterSkillId, level: 1 },
      { id: this.player.classDef.ultimateSkillId, level: 1 },
    ];
    this.player.activeSkillSlots = [
      this.player.classDef.starterSkillId,
      null,
      this.player.classDef.ultimateSkillId,
    ];
    this.player.syncMaxHp(this.inventory, save);
    this.player.hp = this.player.maxHp;

    this.floor = 1;
    this.kills = 0;
    this.bossesKilled = 0;
    this.elapsedSec = 0;

    this.loadFloor(1);
    this.saveCurrentRun();
    this.setState('PLAYING');
    this.ui.showToast(`B1F · ${getBiomeForFloor(1).name}`, '#38bdf8');
  }

  private continueSavedRun(): void {
    const save = this.saveManager.getData();
    const run = save.activeRun;
    if (!run) return;

    this.inventory.reset();
    this.inventory.equipped = run.equipped;
    this.inventory.bag = run.inventory;
    this.inventory.relics = run.relics;

    this.player = new Player(run.classId);
    this.player.level = run.level;
    this.player.exp = run.exp;
    this.player.expToNext = run.expToNext;
    this.player.gold = run.gold;
    this.player.potions = run.potions;
    this.player.skillStones = run.skillStones;
    this.player.revivesLeft = run.revivesLeft;
    this.player.skills = run.skills;
    this.player.activeSkillSlots = run.activeSkillSlots;
    this.player.bonusStats = run.bonusStats || {};
    this.player.syncMaxHp(this.inventory, save);
    this.player.hp = Math.min(this.player.maxHp, Math.max(1, run.hp));

    this.floor = run.floor;
    this.kills = run.kills;
    this.bossesKilled = run.bossesKilled;
    this.elapsedSec = run.elapsedSec;

    this.loadFloor(this.floor);
    this.setState('PLAYING');
    this.ui.showToast(`탐험을 이어서 진행합니다 (B${this.floor}F)`, '#facc15');
  }

  private saveCurrentRun(): void {
    if (!this.player) return;
    const serialized: SerializedRun = {
      classId: this.player.classDef.id,
      floor: this.floor,
      level: this.player.level,
      exp: this.player.exp,
      expToNext: this.player.expToNext,
      hp: Math.ceil(this.player.hp),
      maxHp: this.player.maxHp,
      gold: this.player.gold,
      potions: this.player.potions,
      skillStones: this.player.skillStones,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      elapsedSec: Math.floor(this.elapsedSec),
      revivesLeft: this.player.revivesLeft,
      equipped: this.inventory.equipped,
      inventory: this.inventory.bag,
      skills: this.player.skills,
      activeSkillSlots: this.player.activeSkillSlots,
      relics: this.inventory.relics,
      bonusStats: this.player.bonusStats,
    };
    this.saveManager.saveActiveRun(serialized);
  }

  private loadFloor(floor: number): void {
    this.floor = floor;
    const save = this.saveManager.getData();
    const luckBonus = (save.metaUpgrades['meta_rarity'] || 0) * 8;
    this.floorMap = this.dungeonGen.generateFloor(floor, luckBonus);
    const startRoom = this.floorMap.rooms.get(this.floorMap.startRoomId)!;

    // Phoenix ash relic heal on floor transition
    if (floor > 1 && this.player && this.inventory.hasRelicTag('floor_heal')) {
      const heal = Math.round(this.player.maxHp * 0.2);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.ui.showToast(`불사조의 잿가루: 체력 +${heal}`, '#f97316');
    }

    this.enterRoom(startRoom, null);
    const biome = getBiomeForFloor(floor);
    this.audio.startBiomeDrone(biome.droneFreq);
  }

  private enterRoom(room: DungeonRoom, fromDir: Direction | null): void {
    this.currentRoom = room;
    room.visited = true;
    this.combat.clearRoomEffects();
    this.drops = [];
    this.enemies = [];

    if (this.player) {
      const margin = 62;
      if (!fromDir) {
        this.player.x = room.width / 2;
        this.player.y = room.height / 2;
      } else if (fromDir === 'up') {
        this.player.x = room.width / 2;
        this.player.y = room.height - margin;
      } else if (fromDir === 'down') {
        this.player.x = room.width / 2;
        this.player.y = margin;
      } else if (fromDir === 'left') {
        this.player.x = room.width - margin;
        this.player.y = room.height / 2;
      } else if (fromDir === 'right') {
        this.player.x = margin;
        this.player.y = room.height / 2;
      }

      this.camera.update(0.016, this.player.x, this.player.y, this.viewW, this.viewH, room.width, room.height, true);
    }

    if (!room.cleared) {
      this.spawnRoomEnemies(room);
    }
  }

  private spawnRoomEnemies(room: DungeonRoom): void {
    const biome = getBiomeForFloor(this.floor);
    const save = this.saveManager.getData();

    if (room.type === 'boss') {
      const boss = new Enemy(biome.bossId, room.width / 2, room.height * 0.35, this.floor, true, false);
      this.enemies.push(boss);
      this.audio.playBossIntro();
      this.camera.shake(9, 0.4);
      this.ui.showToast(`보스 출현: ${boss.name}`, '#f43f5e');
      return;
    }

    const baseCount = room.type === 'elite' ? 3 : Math.min(7, 3 + Math.floor(this.floor / 3));
    for (let i = 0; i < baseCount; i++) {
      const mobId = biome.monsterPool[Math.floor(Math.random() * biome.monsterPool.length)];
      const isElite = (room.type === 'elite' && i === 0) || (this.floor >= 4 && Math.random() < 0.12);
      const ex = 110 + Math.random() * (room.width - 220);
      const ey = 110 + Math.random() * (room.height - 220);
      // Avoid spawning directly on top of player
      const safeX = this.player && Math.hypot(ex - this.player.x, ey - this.player.y) < 130 ? room.width - ex : ex;
      const safeY = this.player && Math.hypot(safeX - this.player.x, ey - this.player.y) < 130 ? room.height - ey : ey;
      this.enemies.push(new Enemy(mobId, safeX, safeY, this.floor, false, isElite));
      this.saveManager.recordMonsterSeen(mobId);
    }
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    if (this.state === 'PLAYING' && this.player && this.currentRoom && this.floorMap) {
      this.updatePlaying(dt);
    }

    this.renderCanvas(now / 1000);
    requestAnimationFrame((t) => this.loop(t));
  }

  private updatePlaying(dt: number): void {
    const player = this.player!;
    const room = this.currentRoom!;
    const save = this.saveManager.getData();

    if (this.combat.hitstopTimer > 0) {
      this.combat.hitstopTimer = Math.max(0, this.combat.hitstopTimer - dt);
      this.camera.update(dt, player.x, player.y, this.viewW, this.viewH, room.width, room.height);
      return;
    }

    this.elapsedSec += dt;
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 12) {
      this.autoSaveTimer = 0;
      this.saveCurrentRun();
    }

    // Gather directional input
    let moveX = this.joyVecX;
    let moveY = this.joyVecY;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveY -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveY += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveX += 1;

    // Aim with mouse if moved recently
    const { ox, oy } = this.camera.getOffset();
    this.mouseWorldX = this.mouseScreenX - ox;
    this.mouseWorldY = this.mouseScreenY - oy;
    if (this.useMouseAim && Math.hypot(moveX, moveY) < 0.05) {
      player.facingAngle = Math.atan2(this.mouseWorldY - player.y, this.mouseWorldX - player.x);
    }

    // Dodge
    if (this.justPressed.has('DODGE')) {
      this.justPressed.delete('DODGE');
      if (player.tryDodge(moveX, moveY, this.inventory, save)) {
        this.audio.playDodge();
        this.combat.addAfterimage(player.x, player.y, player.classDef.primaryColor);
        this.combat.spawnBurst(player.x, player.y, '#67e8f9', 8, 120, 3, 0.25);
      }
    }

    // Dodge afterimages while dashing
    if (player.dodgeTimer > 0 && Math.random() < 0.55) {
      this.combat.addAfterimage(player.x, player.y, player.classDef.primaryColor);
    }

    // Basic attack (allow holding Space or clicking)
    if (this.justPressed.has('ATTACK') || this.heldKeys.has('Space')) {
      this.justPressed.delete('ATTACK');
      if (this.useMouseAim) {
        player.facingAngle = Math.atan2(this.mouseWorldY - player.y, this.mouseWorldX - player.x);
      }
      this.performBasicAttack();
    }

    player.update(dt, moveX, moveY, room, this.inventory, save);

    // Room transition via open doors
    if (room.cleared) {
      const wt = 24;
      const doorHalf = 48;
      if (room.doors.up && player.y < wt && Math.abs(player.x - room.width / 2) < doorHalf) {
        this.enterRoom(this.floorMap!.rooms.get(room.doors.up)!, 'up');
        return;
      }
      if (room.doors.down && player.y > room.height - wt && Math.abs(player.x - room.width / 2) < doorHalf) {
        this.enterRoom(this.floorMap!.rooms.get(room.doors.down)!, 'down');
        return;
      }
      if (room.doors.left && player.x < wt && Math.abs(player.y - room.height / 2) < doorHalf) {
        this.enterRoom(this.floorMap!.rooms.get(room.doors.left)!, 'left');
        return;
      }
      if (room.doors.right && player.x > room.width - wt && Math.abs(player.y - room.height / 2) < doorHalf) {
        this.enterRoom(this.floorMap!.rooms.get(room.doors.right)!, 'right');
        return;
      }
    }

    // Environmental hazards tick
    this.hazardTickTimer += dt;
    if (this.hazardTickTimer >= 0.5) {
      this.hazardTickTimer = 0;
      for (const h of room.hazards) {
        if (Math.hypot(player.x - h.x, player.y - h.y) <= h.radius) {
          if (h.kind === 'lava' || h.kind === 'poison' || h.kind === 'curse' || h.kind === 'abyss') {
            this.damagePlayer(Math.max(3, Math.round(4 + this.floor * 1.1)));
          }
        }
      }
    }

    // Update telegraphs
    for (let i = this.combat.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.combat.telegraphs[i];
      tg.timer -= dt;
      if (tg.timer <= 0) {
        if (tg.damage > 0 && Math.hypot(player.x - tg.x, player.y - tg.y) <= tg.radius + player.radius * 0.7) {
          this.damagePlayer(tg.damage);
        }
        if (tg.kind === 'circle' || tg.kind === 'ring') {
          this.combat.addRing(tg.x, tg.y, tg.radius, tg.color, 0.25);
          this.combat.spawnBurst(tg.x, tg.y, tg.color, 12, 160);
        }
        this.combat.telegraphs.splice(i, 1);
      }
    }

    // Update enemies
    const enemyEvents: EnemyAttackEvent[] = [];
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.update(dt, player.x, player.y, room, this.combat.telegraphs, enemyEvents);
    }

    for (const ev of enemyEvents) {
      if (ev.type === 'melee_hit') {
        if (Math.hypot(player.x - ev.x, player.y - ev.y) <= (ev.radius || 46)) {
          this.damagePlayer(ev.damage);
        }
      } else if (ev.type === 'nova') {
        this.combat.addRing(ev.x, ev.y, ev.radius || 120, ev.color || '#f97316', 0.3);
        this.combat.spawnBurst(ev.x, ev.y, ev.color || '#f97316', 16, 180);
        if (Math.hypot(player.x - ev.x, player.y - ev.y) <= (ev.radius || 120)) {
          this.damagePlayer(ev.damage);
        }
      } else if (ev.type === 'projectile') {
        const count = ev.count || 1;
        const spread = ev.spread || 0;
        const baseAng = ev.angle || 0;
        for (let i = 0; i < count; i++) {
          const ang =
            count === 1
              ? baseAng
              : spread >= Math.PI * 1.9
              ? baseAng + (Math.PI * 2 * i) / count
              : baseAng + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
          this.combat.projectiles.push({
            id: `ep_${Date.now()}_${Math.random()}`,
            fromPlayer: false,
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * (ev.speed || 250),
            vy: Math.sin(ang) * (ev.speed || 250),
            radius: 6,
            damage: ev.damage,
            life: 2.2,
            pierce: 1,
            hitIds: new Set(),
            color: ev.color || '#f43f5e',
          });
        }
      } else if (ev.type === 'summon' && this.enemies.length < 12) {
        const mob = new Enemy(ev.summonId || 'bat_swarm', ev.x, ev.y, this.floor, false, false);
        this.enemies.push(mob);
        this.combat.spawnBurst(ev.x, ev.y, '#c084fc', 10, 120);
      }
    }

    // Update projectiles & check hits
    this.combat.updateVisualEffects(dt, room, this.enemies);
    this.checkProjectileCollisions();

    // Pick up drops
    this.updateDrops(dt);

    // Check room clear condition
    if (!room.cleared && this.enemies.every((e) => e.hp <= 0)) {
      this.onRoomCleared(room);
    }

    // Camera follow
    this.camera.update(dt, player.x, player.y, this.viewW, this.viewH, room.width, room.height);

    // Update HUD
    const activeBoss = this.enemies.find((e) => e.isBoss && e.hp > 0) || null;
    const nearbyProp = this.findNearbyProp();
    this.ui.updateHUD(true, player, room, this.floorMap!, this.floor, this.inventory, save, activeBoss, nearbyProp);
  }

  private performBasicAttack(): void {
    const player = this.player!;
    const save = this.saveManager.getData();
    if (!player.startBasicAttack(this.inventory, save)) return;

    const kind = player.getWeaponKind(this.inventory);
    const prof = WEAPON_PROFILES[kind];
    const stats = player.getComputedStats(this.inventory, save);
    const baseDmg = Math.round(stats.attack * prof.damageMult);

    if (kind === 'staff' || kind === 'bow' || kind === 'crossbow') {
      this.audio.playAttack(kind === 'staff' ? 'magic' : 'bow');
      this.combat.projectiles.push({
        id: `pp_${Date.now()}_${Math.random()}`,
        fromPlayer: true,
        x: player.x + Math.cos(player.facingAngle) * 16,
        y: player.y + Math.sin(player.facingAngle) * 16,
        vx: Math.cos(player.facingAngle) * (prof.projectileSpeed || 520),
        vy: Math.sin(player.facingAngle) * (prof.projectileSpeed || 520),
        radius: kind === 'staff' ? 8 : 6,
        damage: baseDmg,
        life: prof.range / (prof.projectileSpeed || 520),
        pierce: kind === 'crossbow' || kind === 'staff' ? 2 : 1,
        hitIds: new Set(),
        color: prof.color,
      });

      // Tempest bow special effect
      if (this.inventory.equipped.weapon?.specialEffectId === 'split_arrow' && Math.random() < 0.3) {
        this.combat.projectiles.push({
          id: `pp_split_${Date.now()}_${Math.random()}`,
          fromPlayer: true,
          x: player.x,
          y: player.y,
          vx: Math.cos(player.facingAngle + 0.16) * 560,
          vy: Math.sin(player.facingAngle + 0.16) * 560,
          radius: 5,
          damage: Math.round(baseDmg * 0.7),
          life: 0.9,
          pierce: 1,
          hitIds: new Set(),
          color: '#34d399',
          homing: true,
        });
      }
      return;
    }

    // Melee weapons
    this.audio.playAttack(kind === 'greatsword' || kind === 'axe' ? 'heavy' : 'slash');
    const arcRad = (prof.arcDeg * Math.PI) / 180;
    this.combat.addSlash(player.x, player.y, player.facingAngle, arcRad, prof.range * 0.85, prof.color);

    // Spellblade releases short sword wave too
    if (kind === 'spellblade') {
      this.combat.projectiles.push({
        id: `pp_wave_${Date.now()}_${Math.random()}`,
        fromPlayer: true,
        x: player.x + Math.cos(player.facingAngle) * 18,
        y: player.y + Math.sin(player.facingAngle) * 18,
        vx: Math.cos(player.facingAngle) * 430,
        vy: Math.sin(player.facingAngle) * 430,
        radius: 16,
        damage: Math.round(baseDmg * 0.75),
        life: 0.55,
        pierce: 3,
        hitIds: new Set(),
        color: '#e879f9',
        isSwordWave: true,
      });
    }

    let hitAny = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= prof.range + e.radius) {
        const angToEnemy = Math.atan2(dy, dx);
        let diff = angToEnemy - player.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= arcRad / 2 + 0.25 || dist < 34) {
          hitAny = true;
          this.damageEnemy(e, baseDmg, false, prof.color);
          const kAng = Math.atan2(dy, dx);
          e.vx += Math.cos(kAng) * prof.knockback;
          e.vy += Math.sin(kAng) * prof.knockback;
        }
      }
    }

    if (hitAny && (kind === 'greatsword' || kind === 'axe')) {
      this.camera.shake(4, 0.12);
    }
  }

  private triggerSkill(slotIndex: number): void {
    if (this.state !== 'PLAYING' || !this.player || !this.currentRoom) return;
    const save = this.saveManager.getData();
    const res = this.skillSystem.castSkill(
      slotIndex,
      this.player,
      this.enemies,
      this.combat,
      this.inventory,
      save,
      (enemy, dmg, isSkill, col, freeze, burn) => this.damageEnemy(enemy, dmg, isSkill, col, freeze, burn)
    );
    if (res.used) {
      this.audio.playSkill();
      this.camera.shake(4.5, 0.14);
      if (res.healedHp > 0) {
        this.combat.spawnFloatingText(this.player.x, this.player.y - 12, `+${res.healedHp}`, '#34d399');
      }
      if (res.dashDistance) {
        const room = this.currentRoom;
        this.player.x = Math.max(48, Math.min(room.width - 48, this.player.x + res.dashDistance.dx));
        this.player.y = Math.max(48, Math.min(room.height - 48, this.player.y + res.dashDistance.dy));
      }
    }
  }

  private checkProjectileCollisions(): void {
    const player = this.player!;
    for (let i = this.combat.projectiles.length - 1; i >= 0; i--) {
      const pr = this.combat.projectiles[i];
      if (pr.fromPlayer) {
        let removed = false;
        for (const e of this.enemies) {
          if (e.hp <= 0 || pr.hitIds.has(e.uid)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) <= e.radius + pr.radius) {
            pr.hitIds.add(e.uid);
            this.damageEnemy(e, pr.damage, !pr.isSwordWave, pr.color, pr.slowEnemy ? 0.8 : 0);
            if (pr.explodeRadius) {
              this.combat.addRing(pr.x, pr.y, pr.explodeRadius, pr.color, 0.25);
              for (const other of this.enemies) {
                if (other.hp > 0 && other.uid !== e.uid && Math.hypot(other.x - pr.x, other.y - pr.y) <= pr.explodeRadius + other.radius) {
                  this.damageEnemy(other, Math.round(pr.damage * 0.65), true, pr.color);
                }
              }
            }
            pr.pierce -= 1;
            if (pr.pierce <= 0) {
              this.combat.projectiles.splice(i, 1);
              removed = true;
              break;
            }
          }
        }
        if (removed) continue;
      } else {
        if (Math.hypot(player.x - pr.x, player.y - pr.y) <= player.radius + pr.radius) {
          this.damagePlayer(pr.damage);
          this.combat.projectiles.splice(i, 1);
        }
      }
    }
  }

  private damageEnemy(
    enemy: Enemy,
    rawDamage: number,
    isSkill: boolean,
    color = '#ffffff',
    freezeSec = 0,
    burnDps = 0
  ): void {
    if (enemy.hp <= 0 || !this.player) return;
    const player = this.player;
    const save = this.saveManager.getData();
    const stats = player.getComputedStats(this.inventory, save);

    let dmg = rawDamage;
    if (this.inventory.hasRelicTag('execute_bonus') && enemy.hp <= enemy.maxHp * 0.35) {
      dmg = Math.round(dmg * 1.35);
    }

    const isCrit = Math.random() < stats.critChance;
    if (isCrit) {
      dmg = Math.round(dmg * stats.critDamage);
    }

    const dealt = enemy.applyDamage(dmg);
    if (freezeSec > 0) enemy.freezeTimer = Math.max(enemy.freezeTimer, freezeSec);
    if (burnDps > 0) {
      enemy.burnTimer = 3.0;
      enemy.burnDps = Math.max(enemy.burnDps, burnDps);
    }
    if (this.inventory.hasRelicTag('frost_hit')) {
      enemy.slowTimer = Math.max(enemy.slowTimer, 1.5);
    }

    // Lifesteal
    if (stats.lifesteal > 0) {
      const heal = Math.max(1, Math.round(dealt * stats.lifesteal));
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }

    this.audio.playHit(isCrit);
    this.combat.spawnBurst(enemy.x, enemy.y, isCrit ? '#facc15' : color, isCrit ? 12 : 6, 150);
    this.combat.spawnFloatingText(
      enemy.x,
      enemy.y - enemy.radius,
      isCrit ? `${dealt}!` : `${dealt}`,
      isCrit ? '#facc15' : isSkill ? '#e0f2fe' : '#ffffff',
      isCrit
    );

    if (isCrit || enemy.isBoss) {
      this.combat.triggerHitstop(enemy.isBoss && isCrit ? 0.045 : 0.03);
      if (isCrit) this.camera.shake(3.5, 0.1);
    }

    if (enemy.hp <= 0) {
      this.onEnemyKilled(enemy);
    }
  }

  private damagePlayer(rawDamage: number): void {
    if (!this.player || this.player.invulnTimer > 0 || this.player.hp <= 0) return;
    const player = this.player;
    const save = this.saveManager.getData();
    const stats = player.getComputedStats(this.inventory, save);

    const mitigated = Math.max(2, Math.round(rawDamage - stats.defense * 0.55));
    player.hp = Math.max(0, player.hp - mitigated);
    player.invulnTimer = 0.55;
    player.hitFlash = 0.18;

    this.audio.playPlayerHurt();
    this.camera.shake(6, 0.2);
    this.combat.spawnBurst(player.x, player.y, '#ef4444', 10, 140);
    this.combat.spawnFloatingText(player.x, player.y - 16, `-${mitigated}`, '#fb7185', true);

    if (player.hp <= 0) {
      if (player.revivesLeft > 0) {
        player.revivesLeft -= 1;
        player.hp = Math.round(player.maxHp * 0.5);
        player.invulnTimer = 1.8;
        this.combat.addRing(player.x, player.y, 160, '#facc15', 0.45);
        this.ui.showToast('불멸의 계약 발동! 부활했습니다!', '#facc15');
        return;
      }
      this.onPlayerDeath(false);
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    if (!this.player) return;
    const player = this.player;
    const save = this.saveManager.getData();
    const stats = player.getComputedStats(this.inventory, save);

    this.kills += 1;
    this.audio.playEnemyDeath();
    this.combat.spawnBurst(enemy.x, enemy.y, enemy.primaryColor, enemy.isBoss ? 36 : 14, 210, 5);

    if (this.inventory.hasRelicTag('kill_heal')) {
      player.hp = Math.min(player.maxHp, player.hp + 3);
    }

    // Abyss sword explosion affix
    if (this.inventory.equipped.weapon?.specialEffectId === 'kill_explosion' && Math.random() < 0.25) {
      this.combat.addRing(enemy.x, enemy.y, 90, '#c084fc', 0.25);
      for (const other of this.enemies) {
        if (other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 90) {
          this.damageEnemy(other, Math.round(stats.attack * 1.4), true, '#c084fc');
        }
      }
    }

    // EXP & Level Up
    const gainedExp = Math.round(enemy.expValue * stats.expGainMult);
    player.exp += gainedExp;

    // Drops
    const goldAmt = Math.max(1, Math.round(enemy.goldValue * stats.goldGainMult));
    this.spawnDrop(enemy.x, enemy.y, 'gold', goldAmt);

    if (enemy.isBoss) {
      this.bossesKilled += 1;
      this.saveManager.recordBossDefeated(enemy.defId);
      const crystals = 12 + this.floor * 3;
      this.saveManager.addMetaCurrency(crystals, 2);
      this.spawnDrop(enemy.x - 24, enemy.y, 'crystal', 5);
      this.spawnDrop(enemy.x + 24, enemy.y, 'item', 1, 'epic');
      this.spawnDrop(enemy.x, enemy.y + 24, 'relic', 1, 'rare');
      player.victoryTimer = 1.4;
      this.ui.showToast(`보스 토벌! 심연의 결정 +${crystals}`, '#facc15');

      // Final boss check (floor 30)
      if (this.floor >= 30) {
        this.onPlayerDeath(true);
        return;
      }
    } else if (enemy.isElite) {
      this.spawnDrop(enemy.x, enemy.y, 'crystal', 3);
      if (Math.random() < 0.75) this.spawnDrop(enemy.x + 14, enemy.y, 'item', 1, 'rare');
      if (Math.random() < 0.4) this.spawnDrop(enemy.x - 14, enemy.y, 'skill_stone', 1);
    } else {
      if (Math.random() < 0.14) this.spawnDrop(enemy.x, enemy.y, 'potion', 1);
      if (Math.random() < 0.12) this.spawnDrop(enemy.x, enemy.y, 'crystal', 1);
      const luckBonus = (save.metaUpgrades['meta_rarity'] || 0) * 8;
      if (Math.random() < 0.15 * (1 + luckBonus / 100)) {
        this.spawnDrop(enemy.x, enemy.y, 'item', 1);
      }
      if (Math.random() < 0.04) {
        this.spawnDrop(enemy.x, enemy.y, 'skill_stone', 1);
      }
    }

    // Check Level Up AFTER processing drops so nothing is lost
    if (player.exp >= player.expToNext) {
      player.exp -= player.expToNext;
      player.level += 1;
      player.expToNext = Math.round(player.expToNext * 1.28 + 20);
      player.syncMaxHp(this.inventory, save);
      player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.2));
      this.audio.playLevelUp();
      this.combat.addRing(player.x, player.y, 130, '#facc15', 0.4);
      this.levelChoices = this.skillSystem.generateLevelUpChoices(player, this.inventory);
      this.setState('LEVEL_UP');
    }
  }

  private spawnDrop(
    x: number,
    y: number,
    kind: GroundDrop['kind'],
    amount = 1,
    minRarity?: GroundDrop['rarity']
  ): void {
    const save = this.saveManager.getData();
    const luck = (save.metaUpgrades['meta_rarity'] || 0) * 8;

    if (kind === 'item') {
      const item = generateRandomEquipment(this.floor, undefined, luck, minRarity);
      this.drops.push({
        id: `dr_${Date.now()}_${Math.random()}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: (Math.random() - 0.5) * 90,
        kind: 'item',
        item,
        rarity: item.rarity,
        age: 0,
      });
    } else if (kind === 'relic') {
      const unowned = RELICS.filter((r) => !this.inventory.relics.includes(r.id));
      const pool = unowned.length > 0 ? unowned : RELICS;
      const r = pool[Math.floor(Math.random() * pool.length)];
      this.drops.push({
        id: `dr_${Date.now()}_${Math.random()}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: (Math.random() - 0.5) * 90,
        kind: 'relic',
        relicId: r.id,
        rarity: r.rarity,
        age: 0,
      });
    } else {
      this.drops.push({
        id: `dr_${Date.now()}_${Math.random()}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        kind,
        amount,
        rarity: kind === 'crystal' || kind === 'skill_stone' ? 'rare' : 'common',
        age: 0,
      });
    }
  }

  private updateDrops(dt: number): void {
    const player = this.player!;
    const save = this.saveManager.getData();

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= Math.exp(-6 * dt);
      d.vy *= Math.exp(-6 * dt);

      const dist = Math.hypot(player.x - d.x, player.y - d.y);
      if (dist < 110 && d.age > 0.2) {
        const pull = 280 * dt;
        d.x += ((player.x - d.x) / Math.max(1, dist)) * pull;
        d.y += ((player.y - d.y) / Math.max(1, dist)) * pull;
      }

      if (dist < 28 && d.age > 0.15) {
        if (d.kind === 'gold') {
          player.gold += d.amount || 1;
          this.audio.playPickup(false);
          this.combat.spawnFloatingText(player.x, player.y - 20, `+${d.amount}G`, '#facc15');
        } else if (d.kind === 'potion') {
          player.potions += 1;
          this.audio.playPickup(false);
          this.ui.showToast('회복 물약 획득!', '#fb7185');
        } else if (d.kind === 'crystal') {
          this.saveManager.addMetaCurrency(d.amount || 1);
          this.audio.playPickup(true);
          this.ui.showToast(`심연의 결정 +${d.amount || 1}`, '#38bdf8');
        } else if (d.kind === 'shard') {
          this.saveManager.addMetaCurrency(0, d.amount || 1);
          this.audio.playPickup(true);
          this.ui.showToast(`고대 파편 +${d.amount || 1}`, '#f43f5e');
        } else if (d.kind === 'skill_stone') {
          player.skillStones += 1;
          this.audio.playPickup(true);
          this.ui.showToast('스킬 강화석 획득!', '#c084fc');
        } else if (d.kind === 'relic' && d.relicId) {
          const r = getRelicById(d.relicId);
          this.inventory.addRelic(d.relicId);
          this.saveManager.recordRelicFound(d.relicId);
          if (d.relicId === 'rel_immortal_pact') player.revivesLeft += 1;
          player.syncMaxHp(this.inventory, save);
          this.audio.playPickup(true);
          this.ui.showToast(`유물 획득: ${r.name}`, r.color);
        } else if (d.kind === 'item' && d.item) {
          if (this.inventory.addItem(d.item)) {
            this.saveManager.recordWeaponFound(d.item.templateId);
            this.audio.playPickup(d.rarity !== 'common');
            this.ui.showToast(`장비 획득: ${d.item.name}`, RARITY_COLORS[d.item.rarity]);
          } else {
            this.ui.showToast('가방이 가득 찼습니다! [I]를 눌러 정리하세요.', '#fb7185');
            continue;
          }
        }
        this.drops.splice(i, 1);
      }
    }
  }

  private onRoomCleared(room: DungeonRoom): void {
    room.cleared = true;
    this.audio.playPickup(true);

    // Spawn descend portal in boss room, or in farthest elite room on non-boss floors
    const isEndRoom =
      room.type === 'boss' || (!isBossFloor(this.floor) && room.id === this.findFarthestRoomId());
    if (isEndRoom && !room.props.some((p) => p.kind === 'portal')) {
      room.props.push({
        id: 'prop_portal',
        kind: 'portal',
        x: room.width / 2,
        y: room.height / 2,
        used: false,
        label: `B${this.floor + 1}F 심연으로 내려가기 [F]`,
      });
      this.ui.showToast('방 정화 완료! 다음 층으로 향하는 포탈이 열렸습니다.', '#38bdf8');
    } else {
      this.ui.showToast('방 정화 완료! 문이 열렸습니다.', '#34d399');
    }
    this.saveCurrentRun();
  }

  private findFarthestRoomId(): string {
    if (!this.floorMap) return '0,0';
    let bestId = '0,0';
    let bestDist = -1;
    for (const r of this.floorMap.rooms.values()) {
      const d = Math.abs(r.gx) + Math.abs(r.gy);
      if (d > bestDist) {
        bestDist = d;
        bestId = r.id;
      }
    }
    return bestId;
  }

  private findNearbyProp(): RoomProp | null {
    if (!this.player || !this.currentRoom) return null;
    for (const p of this.currentRoom.props) {
      if (p.used && (p.kind === 'chest' || p.kind === 'secret_chest' || p.kind === 'shrine' || p.kind === 'event_altar')) {
        continue;
      }
      if (Math.hypot(this.player.x - p.x, this.player.y - p.y) <= 58) {
        return p;
      }
    }
    return null;
  }

  private tryInteract(): void {
    const prop = this.findNearbyProp();
    if (!prop || !this.player || !this.currentRoom) return;
    this.audio.playClick();

    if (prop.kind === 'portal') {
      this.loadFloor(this.floor + 1);
      this.saveCurrentRun();
      this.ui.showToast(`B${this.floor}F · ${getBiomeForFloor(this.floor).name}`, '#38bdf8');
    } else if (prop.kind === 'chest' || prop.kind === 'secret_chest') {
      prop.used = true;
      const minRar = prop.kind === 'secret_chest' ? 'epic' : 'rare';
      this.spawnDrop(prop.x - 16, prop.y + 18, 'item', 1, minRar);
      this.spawnDrop(prop.x + 18, prop.y + 18, 'gold', 35 + this.floor * 8);
      if (prop.kind === 'secret_chest') {
        this.spawnDrop(prop.x, prop.y + 24, 'relic', 1, 'rare');
      }
      this.combat.spawnBurst(prop.x, prop.y, '#facc15', 16, 150);
    } else if (prop.kind === 'shopkeeper') {
      this.setState('SHOP');
    } else if (prop.kind === 'anvil') {
      this.setState('BLACKSMITH');
    } else if (prop.kind === 'shrine') {
      prop.used = true;
      this.setState('REST');
    } else if (prop.kind === 'event_altar') {
      this.activeEventProp = prop;
      this.activeEventData = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      this.setState('EVENT');
    }
  }

  private chooseLevelUp(index: number): void {
    if (this.state !== 'LEVEL_UP' || !this.player) return;
    const choice = this.levelChoices[index];
    if (!choice) return;
    const save = this.saveManager.getData();
    this.skillSystem.applyChoice(choice, this.player, this.inventory, save);
    this.saveCurrentRun();
    this.ui.showToast(`${choice.title} 적용됨!`, choice.color);
    this.setState('PLAYING');
  }

  private usePotion(): void {
    if (this.state !== 'PLAYING' || !this.player) return;
    if (this.player.potions <= 0) {
      this.ui.showToast('남은 물약이 없습니다.', '#94a3b8');
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.ui.showToast('이미 체력이 가득 찼습니다.', '#94a3b8');
      return;
    }
    const save = this.saveManager.getData();
    const potLv = save.metaUpgrades['meta_potion'] || 0;
    const healPct = 0.4 + potLv * 0.06;
    const heal = Math.round(this.player.maxHp * healPct);
    this.player.potions -= 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.audio.playPickup(false);
    this.combat.spawnBurst(this.player.x, this.player.y, '#34d399', 12, 130);
    this.combat.spawnFloatingText(this.player.x, this.player.y - 16, `+${heal}`, '#34d399');
  }

  private handleEquipItem(uid: string): void {
    if (!this.player) return;
    const item = this.inventory.equipFromBag(uid);
    if (item) {
      this.audio.playClick();
      this.player.syncMaxHp(this.inventory, this.saveManager.getData());
      this.ui.showToast(`${item.name} 장착!`, RARITY_COLORS[item.rarity]);
    }
  }

  private handleSellItem(uid: string): void {
    if (!this.player) return;
    const gold = this.inventory.sellFromBag(uid);
    if (gold > 0) {
      this.player.gold += gold;
      this.audio.playPickup(false);
      this.ui.showToast(`장비 판매 +${gold}G`, '#facc15');
    }
  }

  private handleDismantleItem(uid: string): void {
    const res = this.inventory.dismantleFromBag(uid);
    if (res.crystals > 0) {
      this.saveManager.addMetaCurrency(res.crystals, res.shards);
      this.audio.playPickup(true);
      this.ui.showToast(`장비 분해: 결정 +${res.crystals}${res.shards ? `, 파편 +${res.shards}` : ''}`, '#38bdf8');
    }
  }

  private handleAssignSkill(skillId: string, slotIndex: number): void {
    if (!this.player) return;
    const prevIdx = this.player.activeSkillSlots.indexOf(skillId);
    if (prevIdx !== -1) {
      this.player.activeSkillSlots[prevIdx] = this.player.activeSkillSlots[slotIndex];
    }
    this.player.activeSkillSlots[slotIndex] = skillId;
    this.audio.playClick();
  }

  private handleUpgradeSkillStone(skillId: string): void {
    if (!this.player || this.player.skillStones <= 0) return;
    const owned = this.player.skills.find((s) => s.id === skillId);
    if (!owned || owned.level >= 5) return;
    this.player.skillStones -= 1;
    owned.level += 1;
    this.audio.playLevelUp();
    this.ui.showToast(`${getSkillById(skillId).name} Lv.${owned.level} 강화!`, '#c084fc');
  }

  private handleBuyShop(entryId: string): void {
    if (!this.player || !this.currentRoom?.shopInventory) return;
    const entry = this.currentRoom.shopInventory.find((e) => e.id === entryId);
    if (!entry || entry.sold) return;
    const discount = this.inventory.hasRelicTag('shop_discount') ? 0.8 : 1;
    const price = Math.round(entry.price * discount);
    if (this.player.gold < price) return;

    const save = this.saveManager.getData();
    if (entry.kind === 'item' && entry.item) {
      if (!this.inventory.addItem(entry.item)) {
        this.ui.showToast('가방이 가득 찼습니다!', '#fb7185');
        return;
      }
      this.saveManager.recordWeaponFound(entry.item.templateId);
    } else if (entry.kind === 'potion') {
      this.player.potions += 1;
    } else if (entry.kind === 'skill_stone') {
      this.player.skillStones += 1;
    } else if (entry.kind === 'relic' && entry.relicId) {
      this.inventory.addRelic(entry.relicId);
      this.saveManager.recordRelicFound(entry.relicId);
      if (entry.relicId === 'rel_immortal_pact') this.player.revivesLeft += 1;
      this.player.syncMaxHp(this.inventory, save);
    }

    this.player.gold -= price;
    entry.sold = true;
    this.audio.playPickup(true);
    this.ui.showToast(`${entry.name} 구매 완료!`, '#facc15');
  }

  private handleUpgradeEquipped(slot: EquipSlot): void {
    if (!this.player) return;
    const item = this.inventory.equipped[slot];
    if (!item) return;
    const save = this.saveManager.getData();
    const cost = this.inventory.getUpgradeCost(item);
    if (
      item.upgradeLevel >= 10 ||
      this.player.gold < cost.gold ||
      save.abyssCrystals < cost.crystals ||
      save.ancientShards < cost.shards
    ) {
      return;
    }
    this.player.gold -= cost.gold;
    save.abyssCrystals -= cost.crystals;
    save.ancientShards -= cost.shards;
    this.inventory.upgradeItem(item);
    this.saveManager.save();
    this.player.syncMaxHp(this.inventory, save);
    this.audio.playLevelUp();
    this.ui.showToast(`${item.name} +${item.upgradeLevel} 강화 성공!`, '#fb923c');
  }

  private handleResolveEvent(choiceIndex: number): void {
    if (!this.player || !this.activeEventData) return;
    const opt = this.activeEventData.options[choiceIndex];
    if (!opt) return;

    if (this.activeEventProp) this.activeEventProp.used = true;
    const save = this.saveManager.getData();

    if (opt.kind === 'blood_gear') {
      this.player.hp = Math.max(10, Math.round(this.player.hp * 0.75));
      this.player.bonusStats.attackPct = (this.player.bonusStats.attackPct || 0) + 10;
      const item = generateRandomEquipment(this.floor, undefined, 25, 'epic');
      this.inventory.addItem(item);
      this.ui.showToast(`피의 서약: ${item.name} 획득!`, RARITY_COLORS[item.rarity]);
    } else if (opt.kind === 'heal') {
      const heal = Math.round(this.player.maxHp * 0.25);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.player.gold += 35;
      this.ui.showToast(`체력 +${heal}, 골드 +35G`, '#34d399');
    } else if (opt.kind === 'wisdom') {
      this.player.skillStones += 1;
      this.player.exp += Math.round(this.player.expToNext * 0.6);
      this.ui.showToast('지식의 석판: 스킬 강화석 +1 & 경험치 획득!', '#c084fc');
    } else if (opt.kind === 'gamble') {
      if (Math.random() < 0.5) {
        const r = RELICS[Math.floor(Math.random() * RELICS.length)];
        this.inventory.addRelic(r.id);
        this.saveManager.recordRelicFound(r.id);
        this.player.syncMaxHp(this.inventory, save);
        this.ui.showToast(`행운의 유물: ${r.name} 획득!`, r.color);
      } else {
        this.player.gold += 50;
        this.ui.showToast('골드 +50G 획득!', '#facc15');
      }
    }

    this.activeEventData = null;
    this.activeEventProp = null;
    this.setState('PLAYING');
  }

  private handleRestHeal(): void {
    if (!this.player) return;
    const heal = Math.round(this.player.maxHp * 0.5);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.player.potions += 1;
    this.audio.playPickup(true);
    this.ui.showToast(`체력 +${heal} 회복 · 물약 +1`, '#34d399');
    this.setState('PLAYING');
  }

  private handleRestMaxHp(): void {
    if (!this.player) return;
    this.player.bonusStats.maxHp = (this.player.bonusStats.maxHp || 0) + 20;
    this.player.bonusStats.attackPct = (this.player.bonusStats.attackPct || 0) + 8;
    this.player.syncMaxHp(this.inventory, this.saveManager.getData());
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    this.audio.playLevelUp();
    this.ui.showToast('전투 축복: 최대 체력 +20, 공격력 +8%', '#facc15');
    this.setState('PLAYING');
  }

  private onPlayerDeath(victory: boolean): void {
    if (!this.player) return;
    this.audio.stopBiomeDrone();
    const save = this.saveManager.getData();
    const biome = getBiomeForFloor(this.floor);
    const rewardCrystals = Math.max(5, Math.floor(this.floor * 3 + this.kills * 0.25));
    save.abyssCrystals += rewardCrystals;
    save.records.unshift({
      date: new Date().toLocaleDateString('ko-KR'),
      classId: this.player.classDef.id,
      className: this.player.classDef.name,
      floor: this.floor,
      biomeName: biome.name,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      level: this.player.level,
      victory,
      durationSec: Math.floor(this.elapsedSec),
    });
    save.records = save.records.slice(0, 30);
    this.saveManager.saveActiveRun(null);
    this.ui.showToast(`심연의 결정 +${rewardCrystals}개 획득!`, '#38bdf8');
    this.setState(victory ? 'VICTORY' : 'GAME_OVER');
  }

  private renderCanvas(time: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.player || !this.currentRoom || this.state === 'TITLE' || this.state === 'SANCTUARY') {
      return;
    }

    const room = this.currentRoom;
    const biome = getBiomeForFloor(this.floor);
    const save = this.saveManager.getData();
    const { ox, oy } = this.camera.getOffset();

    ctx.save();
    ctx.translate(ox, oy);

    this.renderer.drawRoom(ctx, room, biome, time);

    for (const d of this.drops) {
      this.renderer.drawDrop(ctx, d, time);
    }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      this.renderer.drawEnemySprite(
        ctx,
        e.defId,
        e.spriteShape,
        e.x,
        e.y,
        e.radius,
        e.primaryColor,
        e.secondaryColor,
        e.eyeColor,
        e.flipX,
        e.hitFlash,
        e.isBoss,
        time
      );

      // Enemy overhead HP bar (non-boss)
      if (!e.isBoss && e.hp < e.maxHp) {
        const bw = e.radius * 2 + 6;
        const bx = e.x - bw / 2;
        const by = e.y - e.radius - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = e.isElite ? '#f59e0b' : '#ef4444';
        ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 5);
      }

      if (e.isElite) {
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#facc15';
        ctx.fillText('★ 정예', e.x, e.y - e.radius - 18);
      }
    }

    this.renderer.drawPlayer(
      ctx,
      this.player.x,
      this.player.y,
      this.player.facingAngle,
      this.player.classDef,
      this.player.getWeaponKind(this.inventory),
      this.player.animState,
      this.player.animTimer,
      this.player.getAttackAnimProgress(),
      this.player.invulnTimer > 0,
      this.player.hitFlash
    );

    this.combat.render(ctx, save.settings.damageNumbers);

    // Subtle biome ambient mist
    ctx.fillStyle = biome.ambientMistColor;
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.restore();
  }
}

// Keep unused import reference clean if needed
void getBossById;
