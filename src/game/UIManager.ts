import titleArtUrl from '../assets/images/abyss_title_backdrop_1794532361917.jpg';
import { getBiomeForFloor } from './data/biomes';
import { CLASSES, getClassById, META_UPGRADES } from './data/classes';
import { BOSSES, MONSTERS } from './data/monsters';
import { getRelicById, RELICS } from './data/relics';
import { getSkillById, SKILL_SYNERGIES, SKILLS } from './data/skills';
import { EQUIPMENT_SET_DEFS, EQUIPMENT_TEMPLATES, WEAPON_PROFILES } from './data/weapons';
import { FloorMap } from './DungeonGenerator';
import { Enemy } from './Enemy';
import { formatItemStats, InventorySystem } from './InventorySystem';
import { Player } from './Player';
import {
  DungeonRoom,
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  EquipmentItem,
  EquipSlot,
  GameSettings,
  GameState,
  LevelUpChoice,
  RARITY_COLORS,
  RARITY_LABELS,
  RoomProp,
  SaveData,
  ShopEntry,
} from './types';

export interface UIActions {
  onOpenSanctuary: () => void;
  onContinueRun: () => void;
  onStartNewRun: (classId: string) => void;
  onUnlockClass: (classId: string) => void;
  onBuyMetaUpgrade: (upgradeId: string) => void;
  onSelectLevelUpChoice: (index: number) => void;
  onResumeGame: () => void;
  onPauseGame: () => void;
  onReturnToTitle: () => void;
  onOpenInventory: () => void;
  onCloseModalToPlaying: () => void;
  onEquipItem: (uid: string) => void;
  onSellItem: (uid: string) => void;
  onDismantleItem: (uid: string) => void;
  onAssignSkillSlot: (skillId: string, slotIndex: number) => void;
  onUpgradeSkillWithStone: (skillId: string) => void;
  onBuyShopEntry: (entryId: string) => void;
  onUpgradeEquipped: (slot: EquipSlot) => void;
  onResolveEvent: (choiceIndex: number) => void;
  onRestHeal: () => void;
  onRestMaxHp: () => void;
  onUsePotion: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetSave: () => void;
  onOpenCodex: (fromState: GameState) => void;
  onPlayClick: () => void;
  onTriggerSkillSlot: (slotIndex: number) => void;
  onTriggerInteract: () => void;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  start: '입구',
  combat: '전투 방',
  elite: '정예 방',
  treasure: '보물 방',
  shop: '상점',
  rest: '휴식 성소',
  event: '이벤트 방',
  secret: '비밀 방',
  boss: '보스 방',
};

export interface EventPromptData {
  title: string;
  description: string;
  options: { label: string; effectDesc: string }[];
}

export class UIManager {
  private hudLayer = document.getElementById('hud-layer')!;
  private overlayLayer = document.getElementById('overlay-layer')!;
  private toastLayer = document.getElementById('toast-layer')!;
  private mobileLayer = document.getElementById('mobile-controls')!;

  private actions: UIActions;
  private selectedClassId = 'swordsman';
  private inventoryTab: 'gear' | 'skills' | 'relics' = 'gear';
  private codexTab: 'monsters' | 'bosses' | 'weapons' | 'relics' | 'skills' = 'monsters';
  private codexReturnState: GameState = 'TITLE';
  private titleSubModal: 'none' | 'settings' | 'records' = 'none';

  // Cached HUD element references for 60fps updates without DOM thrash
  private hudReady = false;
  private lastMinimapKey = '';

  constructor(actions: UIActions) {
    this.actions = actions;
  }

  public showToast(message: string, color = '#38bdf8'): void {
    const el = document.createElement('div');
    el.className =
      'animate-toast px-4 py-2 rounded-md text-xs font-semibold tracking-wide shadow-lg border bg-[#0b0f17]/95';
    el.style.borderColor = color;
    el.style.color = color;
    el.textContent = message;
    this.toastLayer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2400);
  }

  public renderMobileControls(visible: boolean): void {
    if (!visible) {
      this.mobileLayer.classList.add('hidden');
      this.mobileLayer.innerHTML = '';
      return;
    }
    if (!this.mobileLayer.classList.contains('hidden')) return;
    this.mobileLayer.classList.remove('hidden');
    this.mobileLayer.innerHTML = `
      <div id="mob-joy-zone" class="pointer-events-auto fixed bottom-6 left-6 w-32 h-32 rounded-full border border-slate-500/40 bg-slate-900/45 flex items-center justify-center touch-none">
        <div id="mob-joy-knob" class="w-12 h-12 rounded-full bg-sky-400/50 border border-sky-300/80"></div>
      </div>
      <div class="pointer-events-auto fixed bottom-5 right-5 grid grid-cols-3 gap-2 touch-none">
        <button data-mob="skill0" class="w-12 h-12 rounded-lg bg-slate-900/80 border border-amber-400/50 text-xs font-bold text-amber-200 active:scale-95">Q</button>
        <button data-mob="skill1" class="w-12 h-12 rounded-lg bg-slate-900/80 border border-sky-400/50 text-xs font-bold text-sky-200 active:scale-95">E</button>
        <button data-mob="skill2" class="w-12 h-12 rounded-lg bg-slate-900/80 border border-purple-400/50 text-xs font-bold text-purple-200 active:scale-95">R</button>
        <button data-mob="interact" class="w-12 h-12 rounded-lg bg-slate-900/80 border border-emerald-400/50 text-xs font-bold text-emerald-200 active:scale-95">F</button>
        <button data-mob="dodge" class="w-12 h-12 rounded-lg bg-slate-900/80 border border-cyan-400/60 text-xs font-bold text-cyan-200 active:scale-95">회피</button>
        <button data-mob="attack" class="w-14 h-14 -mt-1 rounded-xl bg-rose-600/85 border border-rose-300/80 text-xs font-bold text-white active:scale-95">공격</button>
      </div>
    `;
  }

  public updateHUD(
    visible: boolean,
    player: Player | null,
    room: DungeonRoom | null,
    floorMap: FloorMap | null,
    floor: number,
    inv: InventorySystem,
    save: SaveData,
    activeBoss: Enemy | null,
    nearbyProp: RoomProp | null
  ): void {
    if (!visible || !player || !room || !floorMap) {
      this.hudLayer.classList.add('hidden');
      return;
    }
    this.hudLayer.classList.remove('hidden');

    if (!this.hudReady) {
      this.buildHUDSkeleton();
      this.hudReady = true;
    }

    const biome = getBiomeForFloor(floor);
    const hpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
    const expPct = Math.max(0, Math.min(100, (player.exp / Math.max(1, player.expToNext)) * 100));

    (document.getElementById('hud-hp-fill') as HTMLElement).style.width = `${hpPct}%`;
    document.getElementById('hud-hp-text')!.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    (document.getElementById('hud-exp-fill') as HTMLElement).style.width = `${expPct}%`;
    document.getElementById('hud-level')!.textContent = `Lv.${player.level}`;
    document.getElementById('hud-floor')!.textContent = `B${floor}F · ${biome.name}`;
    document.getElementById('hud-room-type')!.textContent = `${ROOM_TYPE_LABELS[room.type] || '방'} ${room.cleared ? '· 정화됨' : '· 전투 중'}`;
    document.getElementById('hud-gold')!.textContent = `${player.gold.toLocaleString()} G`;
    document.getElementById('hud-crystals')!.textContent = `${save.abyssCrystals}`;
    document.getElementById('hud-potions')!.textContent = `${player.potions}`;

    // Boss bar
    const bossBox = document.getElementById('hud-boss-box')!;
    if (activeBoss && activeBoss.hp > 0) {
      bossBox.classList.remove('hidden');
      document.getElementById('hud-boss-name')!.textContent = `${activeBoss.name} · ${activeBoss.title}`;
      const bPct = Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100));
      (document.getElementById('hud-boss-fill') as HTMLElement).style.width = `${bPct}%`;
      document.getElementById('hud-boss-hp')!.textContent = `${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp}${activeBoss.phase2 ? ' [광폭화]' : ''}`;
    } else {
      bossBox.classList.add('hidden');
    }

    // Skill slots Q, E, R
    const keys = ['Q', 'E', 'R'];
    for (let i = 0; i < 3; i++) {
      const slotEl = document.getElementById(`hud-skill-${i}`)!;
      const sid = player.activeSkillSlots[i];
      const cd = player.skillCooldowns[i];
      if (!sid) {
        slotEl.innerHTML = `<span class="text-[10px] text-slate-500">${keys[i]}</span><span class="text-[10px] text-slate-600">비어있음</span>`;
        slotEl.style.borderColor = 'rgba(148,163,184,0.2)';
      } else {
        const def = getSkillById(sid);
        const owned = player.skills.find((s) => s.id === sid);
        const cdText = cd > 0 ? `${cd.toFixed(1)}s` : '준비';
        slotEl.style.borderColor = cd > 0 ? 'rgba(148,163,184,0.25)' : ELEMENT_COLORS[def.element];
        slotEl.innerHTML = `
          <div class="flex items-center justify-between w-full text-[10px] leading-none">
            <span class="font-bold text-slate-300">${keys[i]}</span>
            <span class="font-num text-slate-400">Lv.${owned?.level || 1}</span>
          </div>
          <div class="text-[11px] font-semibold truncate w-full text-center" style="color:${ELEMENT_COLORS[def.element]}">${def.name}</div>
          <div class="text-[10px] font-num ${cd > 0 ? 'text-rose-300' : 'text-emerald-300'}">${cdText}</div>
        `;
      }
    }

    // Dodge slot
    const dodgeEl = document.getElementById('hud-dodge')!;
    dodgeEl.textContent = player.dodgeCooldown > 0 ? `${player.dodgeCooldown.toFixed(1)}s` : '준비';
    dodgeEl.className = `text-[10px] font-num ${player.dodgeCooldown > 0 ? 'text-amber-300' : 'text-cyan-300'}`;

    // Interact prompt
    const promptEl = document.getElementById('hud-interact')!;
    if (nearbyProp) {
      promptEl.classList.remove('hidden');
      promptEl.textContent = nearbyProp.label;
    } else {
      promptEl.classList.add('hidden');
    }

    // Minimap (redraw only when room changes or clear status changes)
    const mmKey = `${floor}_${room.id}_${room.cleared}_${Array.from(floorMap.rooms.values()).filter((r) => r.visited).length}`;
    if (mmKey !== this.lastMinimapKey) {
      this.lastMinimapKey = mmKey;
      this.renderMinimap(floorMap, room.id);
    }

    // Silence unused warning
    void inv;
  }

  private buildHUDSkeleton(): void {
    this.hudLayer.innerHTML = `
      <!-- Top-Left Status -->
      <div class="fixed top-4 left-4 w-72 pixel-panel rounded-lg p-3 pointer-events-none">
        <div class="flex items-center justify-between mb-1.5">
          <span id="hud-level" class="text-xs font-bold text-amber-300 font-num">Lv.1</span>
          <span id="hud-floor" class="text-xs font-medium text-slate-300 truncate max-w-[185px]">B1F</span>
        </div>
        <div class="w-full h-3 bg-slate-900 rounded overflow-hidden border border-slate-700/70 mb-1 relative">
          <div id="hud-hp-fill" class="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-100" style="width:100%"></div>
          <span id="hud-hp-text" class="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-num text-white drop-shadow">100 / 100</span>
        </div>
        <div class="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
          <div id="hud-exp-fill" class="h-full bg-sky-400 transition-all duration-150" style="width:0%"></div>
        </div>
      </div>

      <!-- Top-Center Boss Bar -->
      <div id="hud-boss-box" class="hidden fixed top-4 left-1/2 -translate-x-1/2 w-[min(480px,80vw)] pixel-panel rounded-lg px-4 py-2.5 pointer-events-none">
        <div class="flex items-center justify-between text-xs mb-1">
          <span id="hud-boss-name" class="font-bold text-rose-300 truncate">보스</span>
          <span id="hud-boss-hp" class="font-num text-slate-300">1000 / 1000</span>
        </div>
        <div class="w-full h-2.5 bg-slate-950 rounded overflow-hidden border border-rose-500/40">
          <div id="hud-boss-fill" class="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-amber-400" style="width:100%"></div>
        </div>
      </div>

      <!-- Top-Right Minimap & Menu Buttons -->
      <div class="fixed top-4 right-4 flex flex-col items-end gap-2">
        <div class="pixel-panel rounded-lg p-2.5 pointer-events-none">
          <div id="hud-room-type" class="text-[11px] text-slate-300 font-medium mb-1.5 text-right">입구</div>
          <div id="hud-minimap" class="w-32 h-24 relative bg-[#070a11] rounded border border-slate-800 overflow-hidden"></div>
        </div>
        <div class="pointer-events-auto flex items-center gap-1.5">
          <button id="btn-hud-inv" class="px-2.5 py-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap">가방 [I]</button>
          <button id="btn-hud-pause" class="px-2.5 py-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap">메뉴 [ESC]</button>
        </div>
      </div>

      <!-- Interact Prompt -->
      <div id="hud-interact" class="hidden fixed bottom-28 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md bg-slate-950/90 border border-amber-400/70 text-amber-200 text-xs font-semibold shadow-lg pointer-events-auto cursor-pointer">
        상호작용 [F]
      </div>

      <!-- Bottom Skill & Resource Bar -->
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2 pointer-events-auto">
        <button id="hud-skill-0" class="w-20 h-14 pixel-panel rounded-lg p-1.5 flex flex-col items-center justify-between hover:brightness-110 cursor-pointer"></button>
        <button id="hud-skill-1" class="w-20 h-14 pixel-panel rounded-lg p-1.5 flex flex-col items-center justify-between hover:brightness-110 cursor-pointer"></button>
        <button id="hud-skill-2" class="w-20 h-14 pixel-panel rounded-lg p-1.5 flex flex-col items-center justify-between hover:brightness-110 cursor-pointer"></button>
        <div class="w-16 h-14 pixel-panel rounded-lg p-1.5 flex flex-col items-center justify-between pointer-events-none">
          <span class="text-[10px] font-bold text-slate-400">SHIFT</span>
          <span class="text-[11px] font-semibold text-cyan-300">회피</span>
          <span id="hud-dodge" class="text-[10px] font-num text-cyan-300">준비</span>
        </div>
        <button id="btn-hud-potion" class="w-16 h-14 pixel-panel rounded-lg p-1.5 flex flex-col items-center justify-between hover:border-rose-400/60 cursor-pointer">
          <span class="text-[10px] font-bold text-slate-400">H / 1</span>
          <span class="text-[11px] font-semibold text-rose-300">물약</span>
          <span id="hud-potions" class="text-[10px] font-num text-white">2</span>
        </button>
        <div class="hidden sm:flex h-14 pixel-panel rounded-lg px-3 flex-col justify-center gap-0.5 pointer-events-none">
          <div class="text-xs font-num text-amber-300 font-semibold" id="hud-gold">0 G</div>
          <div class="text-[11px] font-num text-sky-300">결정 <span id="hud-crystals">0</span></div>
        </div>
      </div>
    `;

    document.getElementById('btn-hud-inv')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onOpenInventory();
    });
    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onPauseGame();
    });
    document.getElementById('btn-hud-potion')?.addEventListener('click', () => {
      this.actions.onUsePotion();
    });
    document.getElementById('hud-interact')?.addEventListener('click', () => {
      this.actions.onTriggerInteract();
    });
    for (let i = 0; i < 3; i++) {
      document.getElementById(`hud-skill-${i}`)?.addEventListener('click', () => {
        this.actions.onTriggerSkillSlot(i);
      });
    }
  }

  private renderMinimap(floorMap: FloorMap, currentRoomId: string): void {
    const container = document.getElementById('hud-minimap');
    if (!container) return;
    const rooms = Array.from(floorMap.rooms.values());
    if (rooms.length === 0) return;

    const current = floorMap.rooms.get(currentRoomId);
    const cx = current ? current.gx : 0;
    const cy = current ? current.gy : 0;

    let html = '';
    for (const r of rooms) {
      // Show visited rooms + adjacent rooms to visited ones
      const isVisited = r.visited;
      const isAdj = rooms.some(
        (v) => v.visited && Math.abs(v.gx - r.gx) + Math.abs(v.gy - r.gy) === 1
      );
      if (!isVisited && !isAdj) continue;

      const px = 64 + (r.gx - cx) * 18 - 7;
      const py = 48 + (r.gy - cy) * 14 - 5;
      if (px < -16 || px > 136 || py < -12 || py > 100) continue;

      let bg = '#334155';
      if (r.id === currentRoomId) bg = '#38bdf8';
      else if (r.type === 'boss') bg = '#f43f5e';
      else if (r.type === 'shop') bg = '#facc15';
      else if (r.type === 'treasure' || r.type === 'secret') bg = '#f59e0b';
      else if (r.type === 'rest') bg = '#34d399';
      else if (r.type === 'event') bg = '#c084fc';
      else if (r.cleared) bg = '#64748b';

      const opacity = isVisited ? '1' : '0.42';
      const border = r.id === currentRoomId ? '1px solid #ffffff' : '1px solid rgba(0,0,0,0.6)';
      html += `<div style="position:absolute;left:${px}px;top:${py}px;width:14px;height:10px;background:${bg};opacity:${opacity};border:${border};border-radius:2px;"></div>`;
    }
    container.innerHTML = html;
  }

  public renderOverlay(
    state: GameState,
    save: SaveData,
    ctxData: {
      player?: Player | null;
      inv?: InventorySystem;
      levelChoices?: LevelUpChoice[];
      shopInventory?: ShopEntry[];
      eventPrompt?: EventPromptData | null;
      floor?: number;
      kills?: number;
      bossesKilled?: number;
      elapsedSec?: number;
    } = {}
  ): void {
    if (state === 'PLAYING') {
      this.overlayLayer.innerHTML = '';
      this.overlayLayer.classList.add('pointer-events-none');
      return;
    }

    this.overlayLayer.classList.remove('pointer-events-none');

    switch (state) {
      case 'TITLE':
        this.renderTitleScreen(save);
        break;
      case 'SANCTUARY':
        this.renderSanctuary(save);
        break;
      case 'LEVEL_UP':
        this.renderLevelUpModal(ctxData.levelChoices || [], ctxData.player || null);
        break;
      case 'INVENTORY':
        this.renderInventoryModal(ctxData.player!, ctxData.inv!, save);
        break;
      case 'SHOP':
        this.renderShopModal(ctxData.player!, ctxData.inv!, ctxData.shopInventory || []);
        break;
      case 'BLACKSMITH':
        this.renderBlacksmithModal(ctxData.player!, ctxData.inv!, save);
        break;
      case 'EVENT':
        this.renderEventModal(ctxData.eventPrompt || null);
        break;
      case 'REST':
        this.renderRestModal(ctxData.player!);
        break;
      case 'CODEX':
        this.renderCodexModal(save);
        break;
      case 'PAUSED':
        this.renderPauseModal(save);
        break;
      case 'GAME_OVER':
      case 'VICTORY':
        this.renderEndModal(state === 'VICTORY', ctxData);
        break;
    }
  }

  private renderTitleScreen(save: SaveData): void {
    const hasContinue = Boolean(save.activeRun);
    this.overlayLayer.innerHTML = `
      <div class="relative w-full h-full flex flex-col justify-between overflow-hidden bg-[#07090e]">
        <img src="${titleArtUrl}" alt="ABYSS 지하 심연 배경 아트워크" referrerpolicy="no-referrer" class="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div class="absolute inset-0 bg-gradient-to-r from-[#07090e]/95 via-[#07090e]/65 to-[#07090e]/30"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-[#07090e]/60"></div>

        <div class="relative z-10 flex flex-col justify-center h-full max-w-2xl px-8 sm:px-16">
          <div class="mb-8">
            <svg viewBox="0 0 420 96" class="w-72 sm:w-96 h-auto mb-3 drop-shadow-[0_4px_24px_rgba(56,189,248,0.35)]" aria-label="ABYSS : THE ENDLESS DESCENT">
              <defs>
                <linearGradient id="abyssGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#f8fafc" />
                  <stop offset="55%" stop-color="#7dd3fc" />
                  <stop offset="100%" stop-color="#38bdf8" />
                </linearGradient>
              </defs>
              <text x="0" y="58" fill="url(#abyssGrad)" font-family="Cinzel, Georgia, serif" font-size="60" font-weight="700" letter-spacing="10">ABYSS</text>
              <line x1="2" y1="70" x2="260" y2="70" stroke="#f59e0b" stroke-width="2" />
              <text x="2" y="90" fill="#cbd5e1" font-family="Cinzel, Georgia, serif" font-size="14" letter-spacing="5">THE ENDLESS DESCENT</text>
            </svg>
            <p class="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
              일곱 왕국의 중심에서 열린 끝없는 균열. 무기와 원소 스킬, 고대의 유물을 조합해 심연의 진실에 도달하십시오.
            </p>
          </div>

          <div class="flex flex-col gap-3 w-full max-w-xs">
            <button id="btn-title-new" class="w-full py-3.5 px-6 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-base tracking-wide transition-colors cursor-pointer shadow-[0_0_24px_rgba(56,189,248,0.35)]">
              새로운 탐험 시작
            </button>
            ${
              hasContinue
                ? `<button id="btn-title-continue" class="w-full py-3 px-6 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-semibold text-sm transition-colors cursor-pointer">
                    이어하기 (B${save.activeRun!.floor}F · Lv.${save.activeRun!.level})
                  </button>`
                : ''
            }
            <div class="grid grid-cols-3 gap-2 pt-1">
              <button id="btn-title-codex" class="py-2.5 px-3 rounded-lg bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap">도감</button>
              <button id="btn-title-records" class="py-2.5 px-3 rounded-lg bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap">게임 기록</button>
              <button id="btn-title-settings" class="py-2.5 px-3 rounded-lg bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap">설정</button>
            </div>
          </div>

          <div class="mt-8 text-xs text-slate-400 tracking-wide">
            WASD 이동 · Space 공격 · Shift 회피 · Q/E/R 스킬 · F 상호작용 · I 가방 · Esc 일시정지
          </div>
        </div>

        ${this.titleSubModal === 'settings' ? this.buildSettingsSubModal(save) : ''}
        ${this.titleSubModal === 'records' ? this.buildRecordsSubModal(save) : ''}
      </div>
    `;

    document.getElementById('btn-title-new')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'none';
      this.actions.onOpenSanctuary();
    });
    document.getElementById('btn-title-continue')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'none';
      this.actions.onContinueRun();
    });
    document.getElementById('btn-title-codex')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'none';
      this.actions.onOpenCodex('TITLE');
    });
    document.getElementById('btn-title-records')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'records';
      this.renderTitleScreen(save);
    });
    document.getElementById('btn-title-settings')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'settings';
      this.renderTitleScreen(save);
    });
    this.wireSubModalEvents(save);
  }

  private buildSettingsSubModal(save: SaveData): string {
    const s = save.settings;
    return `
      <div class="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-xl max-w-md w-full p-6 animate-modal-in">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-bold text-white">게임 설정</h2>
            <button id="btn-sub-close" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer">닫기</button>
          </div>
          <div class="space-y-4 text-sm">
            <label class="flex items-center justify-between">
              <span class="text-slate-300">사운드 음소거</span>
              <input id="set-mute" type="checkbox" ${s.muted ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
            <label class="block">
              <div class="flex justify-between text-xs text-slate-400 mb-1"><span>전체 음량</span><span class="font-num">${Math.round(s.masterVolume * 100)}%</span></div>
              <input id="set-master" type="range" min="0" max="100" value="${Math.round(s.masterVolume * 100)}" class="w-full accent-sky-400" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-slate-300">화면 흔들림 효과</span>
              <input id="set-shake" type="checkbox" ${s.screenShake ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-slate-300">피해량 수치 표시</span>
              <input id="set-dmg" type="checkbox" ${s.damageNumbers ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
            <div class="flex items-center justify-between">
              <span class="text-slate-300">모바일 가상 패드</span>
              <select id="set-mob" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                <option value="auto" ${s.mobileControlsMode === 'auto' ? 'selected' : ''}>자동 감지</option>
                <option value="on" ${s.mobileControlsMode === 'on' ? 'selected' : ''}>항상 켜기</option>
                <option value="off" ${s.mobileControlsMode === 'off' ? 'selected' : ''}>끄기</option>
              </select>
            </div>
            <div class="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span class="text-xs text-slate-500">저장 데이터 초기화</span>
              <button id="btn-reset-save" class="px-3 py-1.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-xs text-rose-200 cursor-pointer">초기화</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private buildRecordsSubModal(save: SaveData): string {
    const rows = save.records.length
      ? save.records
          .map(
            (r) => `
          <div class="flex items-center justify-between py-2.5 border-b border-slate-800/80 text-xs">
            <div>
              <div class="font-semibold ${r.victory ? 'text-amber-300' : 'text-slate-200'}">${r.className} · ${r.victory ? '심연 정복' : `${r.floor}층 도달`}</div>
              <div class="text-slate-400">${r.biomeName} · ${r.date}</div>
            </div>
            <div class="text-right font-num text-slate-300">
              <div>Lv.${r.level} · 처치 ${r.kills}</div>
              <div class="text-slate-500">${Math.floor(r.durationSec / 60)}분 ${r.durationSec % 60}초</div>
            </div>
          </div>`
          )
          .join('')
      : `<div class="py-10 text-center text-sm text-slate-500">아직 기록된 탐험이 없습니다.</div>`;

    return `
      <div class="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-xl max-w-lg w-full p-6 animate-modal-in">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">탐험 기록</h2>
            <button id="btn-sub-close" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer">닫기</button>
          </div>
          <div class="max-h-80 overflow-y-auto abyss-scroll pr-1">${rows}</div>
        </div>
      </div>
    `;
  }

  private wireSubModalEvents(save: SaveData): void {
    document.getElementById('btn-sub-close')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.titleSubModal = 'none';
      this.renderTitleScreen(save);
    });
    document.getElementById('set-mute')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ muted: (e.target as HTMLInputElement).checked });
    });
    document.getElementById('set-master')?.addEventListener('input', (e) => {
      this.actions.onUpdateSettings({ masterVolume: Number((e.target as HTMLInputElement).value) / 100 });
    });
    document.getElementById('set-shake')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ screenShake: (e.target as HTMLInputElement).checked });
    });
    document.getElementById('set-dmg')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ damageNumbers: (e.target as HTMLInputElement).checked });
    });
    document.getElementById('set-mob')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({
        mobileControlsMode: (e.target as HTMLSelectElement).value as GameSettings['mobileControlsMode'],
      });
    });
    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      this.actions.onResetSave();
      this.titleSubModal = 'none';
      this.renderTitleScreen(save);
    });
  }

  private renderSanctuary(save: SaveData): void {
    if (!save.unlockedClasses.includes(this.selectedClassId)) {
      this.selectedClassId = 'swordsman';
    }
    const sel = getClassById(this.selectedClassId);
    const starterSkill = getSkillById(sel.starterSkillId);
    const ultSkill = getSkillById(sel.ultimateSkillId);

    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-[#070a11]/95 flex flex-col p-4 sm:p-8 overflow-y-auto abyss-scroll">
        <div class="max-w-6xl w-full mx-auto flex flex-col gap-6">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 class="text-2xl font-bold font-display text-white">심연의 성소 · 탐험 준비</h1>
              <p class="text-xs text-slate-400 mt-1">직업을 선택하고 심연의 결정으로 영구 능력을 강화하세요.</p>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-sm font-num text-sky-300 font-semibold">심연의 결정: ${save.abyssCrystals}</div>
              <div class="text-sm font-num text-rose-300 font-semibold">고대 파편: ${save.ancientShards}</div>
              <button id="btn-sanc-back" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer">메인으로</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Class Roster -->
            <div class="lg:col-span-7 flex flex-col gap-4">
              <h2 class="text-sm font-semibold text-slate-300">직업 선택 (${save.unlockedClasses.length} / ${CLASSES.length} 해금)</h2>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${CLASSES.map((c) => {
                  const unlocked = save.unlockedClasses.includes(c.id);
                  const active = this.selectedClassId === c.id;
                  return `
                    <button data-class="${c.id}" class="pixel-card rounded-lg p-3 text-left cursor-pointer ${
                      active ? 'ring-2 ring-sky-400 border-sky-400' : ''
                    } ${!unlocked ? 'opacity-75' : ''}">
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-sm" style="color:${c.primaryColor}">${c.name}</span>
                        <span class="text-[10px] font-num ${unlocked ? 'text-emerald-400' : 'text-amber-300'}">${unlocked ? '해금됨' : `${c.unlockCost} 결정`}</span>
                      </div>
                      <div class="text-[11px] text-slate-400 truncate">${c.title}</div>
                    </button>
                  `;
                }).join('')}
              </div>

              <!-- Selected Class Detail -->
              <div class="pixel-panel rounded-xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <span class="text-xl font-bold" style="color:${sel.primaryColor}">${sel.name}</span>
                      <span class="text-xs text-slate-400 ml-2">${sel.title}</span>
                    </div>
                    <span class="text-xs font-num text-slate-300">HP ${sel.baseHp} · ATK ${sel.baseAttack} · CRIT ${Math.round(sel.baseCrit * 100)}%</span>
                  </div>
                  <p class="text-sm text-slate-300 leading-relaxed mb-4">${sel.description}</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                      <div class="text-slate-400 mb-1">기본 스킬 [Q]</div>
                      <div class="font-bold text-sky-300">${starterSkill.name}</div>
                      <div class="text-slate-400 mt-0.5">${starterSkill.description}</div>
                    </div>
                    <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                      <div class="text-slate-400 mb-1">궁극기 [R]</div>
                      <div class="font-bold text-amber-300">${ultSkill.name}</div>
                      <div class="text-slate-400 mt-0.5">${ultSkill.description}</div>
                    </div>
                  </div>
                </div>
                <div class="flex justify-end pt-2">
                  <button id="btn-start-descent" class="px-8 py-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm tracking-wide cursor-pointer shadow-lg">
                    심연으로 내려가기
                  </button>
                </div>
              </div>
            </div>

            <!-- Permanent Meta Upgrades -->
            <div class="lg:col-span-5 flex flex-col gap-3">
              <h2 class="text-sm font-semibold text-slate-300">영구 능력치 강화 (사망 후에도 유지)</h2>
              <div class="space-y-2.5">
                ${META_UPGRADES.map((u) => {
                  const lv = save.metaUpgrades[u.id] || 0;
                  const maxed = lv >= u.maxLevel;
                  const cost = u.baseCost + lv * u.costStep;
                  const canAfford = !maxed && save.abyssCrystals >= cost;
                  return `
                    <div class="pixel-card rounded-lg p-3.5 flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-sm text-white">${u.name}</span>
                          <span class="text-xs font-num text-sky-300">Lv.${lv}/${u.maxLevel} (+${lv * u.perLevelValue}${u.unit})</span>
                        </div>
                        <div class="text-xs text-slate-400 mt-0.5">${u.description}</div>
                      </div>
                      <button data-meta="${u.id}" ${!canAfford ? 'disabled' : ''} class="px-3 py-2 rounded-md text-xs font-bold font-num whitespace-nowrap cursor-pointer ${
                        maxed
                          ? 'bg-slate-800 text-slate-500 cursor-default'
                          : canAfford
                          ? 'bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-200'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                      }">
                        ${maxed ? '최대' : `${cost} 결정`}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-sanc-back')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onReturnToTitle();
    });
    document.getElementById('btn-start-descent')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onStartNewRun(this.selectedClassId);
    });
    document.querySelectorAll('[data-class]').forEach((el) => {
      el.addEventListener('click', () => {
        const cid = el.getAttribute('data-class')!;
        this.actions.onPlayClick();
        if (save.unlockedClasses.includes(cid)) {
          this.selectedClassId = cid;
          this.renderSanctuary(save);
        } else {
          this.actions.onUnlockClass(cid);
          if (save.unlockedClasses.includes(cid)) {
            this.selectedClassId = cid;
          }
          this.renderSanctuary(save);
        }
      });
    });
    document.querySelectorAll('[data-meta]').forEach((el) => {
      el.addEventListener('click', () => {
        const uid = el.getAttribute('data-meta')!;
        this.actions.onBuyMetaUpgrade(uid);
        this.renderSanctuary(save);
      });
    });
  }

  private renderLevelUpModal(choices: LevelUpChoice[], player: Player | null): void {
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-4xl w-full p-6 sm:p-8 animate-modal-in">
          <div class="text-center mb-6">
            <div class="text-xs font-bold tracking-widest text-amber-400 mb-1">LEVEL UP · Lv.${player?.level || 2}</div>
            <h2 class="text-2xl font-bold font-display text-white">성장의 축복을 선택하세요</h2>
            <p class="text-xs text-slate-400 mt-1">카드를 클릭하거나 숫자 키(1, 2, 3)를 눌러 즉시 적용합니다.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${choices
              .map(
                (c, idx) => `
              <button data-lvchoice="${idx}" class="pixel-card rounded-xl p-5 text-left flex flex-col justify-between gap-4 cursor-pointer hover:-translate-y-1">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold" style="color:${c.color}">${c.subtitle}</span>
                    <span class="text-xs font-num text-slate-500">[${idx + 1}]</span>
                  </div>
                  <h3 class="text-base font-bold text-white mb-2">${c.title}</h3>
                  <p class="text-xs text-slate-300 leading-relaxed">${c.description}</p>
                </div>
                <div class="text-xs font-semibold text-sky-300 pt-2 border-t border-slate-800">선택하기</div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-lvchoice]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-lvchoice'));
        this.actions.onPlayClick();
        this.actions.onSelectLevelUpChoice(idx);
      });
    });
  }

  private renderInventoryModal(player: Player, inv: InventorySystem, save: SaveData): void {
    const stats = player.getComputedStats(inv, save);
    const activeSynergies = inv.getActiveSynergies(player.skills);
    const activeSets = inv.getActiveSetBonuses();

    let tabBody = '';
    if (this.inventoryTab === 'gear') {
      const slotLabels: Record<EquipSlot, string> = {
        weapon: '무기',
        armor: '방어구',
        ring: '반지',
        necklace: '목걸이',
      };
      const equippedHtml = (['weapon', 'armor', 'ring', 'necklace'] as EquipSlot[])
        .map((slot) => {
          const item = inv.equipped[slot];
          if (!item) {
            return `<div class="pixel-card rounded-lg p-3 text-xs text-slate-500">${slotLabels[slot]}: 장착 없음</div>`;
          }
          return this.renderItemCard(item, 'equipped');
        })
        .join('');

      const bagHtml =
        inv.bag.length > 0
          ? inv.bag.map((item) => this.renderItemCard(item, 'bag')).join('')
          : `<div class="col-span-full py-10 text-center text-xs text-slate-500">가방이 비어 있습니다. 몬스터를 처치하거나 보물 상자를 여세요.</div>`;

      tabBody = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div class="lg:col-span-4 space-y-3">
            <div class="pixel-card rounded-lg p-3.5 text-xs space-y-1.5">
              <div class="font-bold text-white mb-1">${player.classDef.name} 종합 능력치</div>
              <div class="flex justify-between"><span class="text-slate-400">체력</span><span class="font-num text-rose-300">${Math.ceil(player.hp)} / ${stats.maxHp}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">공격력</span><span class="font-num text-white">${stats.attack}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">방어력</span><span class="font-num text-white">${stats.defense}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">치명타 확률 / 피해</span><span class="font-num text-amber-300">${Math.round(stats.critChance * 100)}% / ${Math.round(stats.critDamage * 100)}%</span></div>
              <div class="flex justify-between"><span class="text-slate-400">스킬 피해 / 쿨감</span><span class="font-num text-purple-300">${Math.round(stats.skillDamageMult * 100)}% / ${Math.round(stats.cooldownReduction * 100)}%</span></div>
              <div class="flex justify-between"><span class="text-slate-400">이동 / 공격 속도</span><span class="font-num text-sky-300">${stats.speed} / ${Math.round(stats.attackSpeedMult * 100)}%</span></div>
            </div>
            <div class="space-y-2">
              <div class="text-xs font-semibold text-slate-300">장착 중인 장비</div>
              ${equippedHtml}
            </div>
            ${
              activeSets.length > 0
                ? `<div class="pixel-card rounded-lg p-3 text-xs space-y-1">
                    <div class="font-bold text-amber-300">발동 중인 세트 효과</div>
                    ${activeSets
                      .map((s) => {
                        const def = EQUIPMENT_SET_DEFS[s.setId];
                        return `<div><span class="text-white font-semibold">${s.name} (${s.count}부위)</span><div class="text-emerald-300">${def.bonus2}</div>${s.bonus4 ? `<div class="text-amber-300">${def.bonus4}</div>` : ''}</div>`;
                      })
                      .join('')}
                  </div>`
                : ''
            }
          </div>
          <div class="lg:col-span-8">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-300">보관함 (${inv.bag.length} / ${inv.maxBagSize})</span>
              <span class="text-xs font-num text-amber-300">보유 골드: ${player.gold} G</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto abyss-scroll pr-1">
              ${bagHtml}
            </div>
          </div>
        </div>
      `;
    } else if (this.inventoryTab === 'skills') {
      tabBody = `
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="text-slate-300">스킬을 클릭해 Q / E / R 슬롯에 배치하거나 강화석으로 강화할 수 있습니다.</span>
            <span class="font-num text-purple-300 font-bold">보유 스킬 강화석: ${player.skillStones}개</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto abyss-scroll pr-1">
            ${player.skills
              .map((owned) => {
                const def = getSkillById(owned.id);
                const slotIdx = player.activeSkillSlots.indexOf(owned.id);
                const slotNames = ['Q', 'E', 'R'];
                return `
                  <div class="pixel-card rounded-lg p-3.5 text-xs space-y-2">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="font-bold text-sm" style="color:${ELEMENT_COLORS[def.element]}">${def.name}</span>
                        <span class="ml-1.5 text-slate-400">${ELEMENT_LABELS[def.element]} · Lv.${owned.level}/5</span>
                      </div>
                      ${slotIdx >= 0 ? `<span class="font-bold text-amber-300">슬롯 [${slotNames[slotIdx]}]</span>` : ''}
                    </div>
                    <div class="text-slate-300">${def.levelDescriptions[owned.level - 1]}</div>
                    <div class="flex flex-wrap items-center gap-1.5 pt-1">
                      ${[0, 1, 2]
                        .map(
                          (sIdx) => `
                        <button data-assign="${owned.id}:${sIdx}" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold ${
                            slotIdx === sIdx ? 'text-amber-300 border border-amber-400/50' : 'text-slate-300'
                          } cursor-pointer">${slotNames[sIdx]} 배치</button>
                      `
                        )
                        .join('')}
                      ${
                        owned.level < 5 && player.skillStones > 0
                          ? `<button data-stone="${owned.id}" class="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/60 text-purple-200 font-semibold cursor-pointer">강화석 사용</button>`
                          : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="border-t border-slate-800 pt-3">
            <div class="text-xs font-semibold text-slate-300 mb-2">스킬 조합 시너지</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              ${SKILL_SYNERGIES.map((syn) => {
                const isOn = activeSynergies.includes(syn.id);
                const reqNames = syn.reqSkills.map((id) => getSkillById(id).name).join(' + ');
                return `
                  <div class="p-2.5 rounded border ${isOn ? 'border-amber-400/70 bg-amber-500/10' : 'border-slate-800 bg-slate-900/50 opacity-65'}">
                    <div class="flex justify-between font-bold" style="color:${syn.color}">
                      <span>${syn.name}</span>
                      <span>${isOn ? '발동 중' : `조건: ${reqNames}`}</span>
                    </div>
                    <div class="text-slate-300 mt-1">${syn.description}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      tabBody = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto abyss-scroll pr-1">
          ${
            inv.relics.length > 0
              ? inv.relics
                  .map((rid) => {
                    const r = getRelicById(rid);
                    return `
                      <div class="pixel-card rounded-lg p-3.5 text-xs">
                        <div class="flex items-center justify-between mb-1">
                          <span class="font-bold text-sm" style="color:${r.color}">${r.name}</span>
                          <span style="color:${RARITY_COLORS[r.rarity]}">${RARITY_LABELS[r.rarity]}</span>
                        </div>
                        <p class="text-slate-300 leading-relaxed">${r.description}</p>
                      </div>
                    `;
                  })
                  .join('')
              : `<div class="col-span-full py-12 text-center text-xs text-slate-500">아직 획득한 유물이 없습니다. 정예 몬스터, 보스, 상점, 이벤트 방에서 획득할 수 있습니다.</div>`
          }
        </div>
      `;
    }

    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-5xl w-full p-5 sm:p-6 animate-modal-in">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
            <div class="flex items-center gap-2">
              <button data-invtab="gear" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${this.inventoryTab === 'gear' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">장비 & 가방</button>
              <button data-invtab="skills" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${this.inventoryTab === 'skills' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">스킬 & 조합</button>
              <button data-invtab="relics" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${this.inventoryTab === 'relics' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">유물 (${inv.relics.length})</button>
            </div>
            <button id="btn-inv-close" class="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer">닫기 [I / ESC]</button>
          </div>
          ${tabBody}
        </div>
      </div>
    `;

    document.getElementById('btn-inv-close')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onCloseModalToPlaying();
    });
    document.querySelectorAll('[data-invtab]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onPlayClick();
        this.inventoryTab = el.getAttribute('data-invtab') as 'gear' | 'skills' | 'relics';
        this.renderInventoryModal(player, inv, save);
      });
    });
    document.querySelectorAll('[data-equip]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onEquipItem(el.getAttribute('data-equip')!);
        this.renderInventoryModal(player, inv, save);
      });
    });
    document.querySelectorAll('[data-sell]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onSellItem(el.getAttribute('data-sell')!);
        this.renderInventoryModal(player, inv, save);
      });
    });
    document.querySelectorAll('[data-dismantle]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onDismantleItem(el.getAttribute('data-dismantle')!);
        this.renderInventoryModal(player, inv, save);
      });
    });
    document.querySelectorAll('[data-assign]').forEach((el) => {
      el.addEventListener('click', () => {
        const [sid, sIdx] = el.getAttribute('data-assign')!.split(':');
        this.actions.onAssignSkillSlot(sid, Number(sIdx));
        this.renderInventoryModal(player, inv, save);
      });
    });
    document.querySelectorAll('[data-stone]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onUpgradeSkillWithStone(el.getAttribute('data-stone')!);
        this.renderInventoryModal(player, inv, save);
      });
    });
  }

  private renderItemCard(item: EquipmentItem, location: 'equipped' | 'bag'): string {
    const col = RARITY_COLORS[item.rarity];
    const stats = formatItemStats(item);
    const kindLabel = item.weaponKind ? WEAPON_PROFILES[item.weaponKind].label : item.slot;
    const upgLabel = item.upgradeLevel > 0 ? ` +${item.upgradeLevel}` : '';
    return `
      <div class="pixel-card rounded-lg p-3 text-xs flex flex-col justify-between gap-2" style="border-color:${col}44">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold truncate" style="color:${col}">${item.name}${upgLabel}</span>
            <span class="text-[11px] shrink-0" style="color:${col}">${RARITY_LABELS[item.rarity]} · ${kindLabel}</span>
          </div>
          <div class="mt-1.5 space-y-0.5 text-slate-300 font-num">
            ${stats.map((s) => `<div>${s}</div>`).join('')}
          </div>
          ${item.specialEffectDesc ? `<div class="mt-1.5 text-[11px] text-amber-300">${item.specialEffectDesc}</div>` : ''}
        </div>
        ${
          location === 'bag'
            ? `<div class="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                <button data-equip="${item.uid}" class="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-semibold cursor-pointer">장착</button>
                <button data-sell="${item.uid}" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer">판매 +${Math.max(8, Math.round(item.price * 0.45))}G</button>
                <button data-dismantle="${item.uid}" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 cursor-pointer">분해</button>
              </div>`
            : ''
        }
      </div>
    `;
  }

  private renderShopModal(player: Player, inv: InventorySystem, stock: ShopEntry[]): void {
    const discount = inv.hasRelicTag('shop_discount') ? 0.8 : 1;
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-3xl w-full p-6 animate-modal-in">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h2 class="text-lg font-bold text-amber-300">심연의 상점</h2>
              <p class="text-xs text-slate-400">골드를 사용해 물약, 스킬 강화석, 희귀 장비와 유물을 구매하세요.</p>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-sm font-bold font-num text-amber-300">${player.gold} G</span>
              <button id="btn-shop-close" class="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer">닫기 [ESC]</button>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto abyss-scroll">
            ${stock
              .map((entry) => {
                const finalPrice = Math.round(entry.price * discount);
                const canBuy = !entry.sold && player.gold >= finalPrice;
                return `
                  <div class="pixel-card rounded-lg p-4 text-xs flex flex-col justify-between gap-3 ${entry.sold ? 'opacity-45' : ''}">
                    <div>
                      <div class="font-bold text-sm text-white mb-1">${entry.name}</div>
                      <p class="text-slate-300 leading-relaxed">${entry.desc}</p>
                      ${entry.item ? `<div class="mt-2 text-[11px] text-sky-300 font-num">${formatItemStats(entry.item).join(' · ')}</div>` : ''}
                    </div>
                    <button data-shop="${entry.id}" ${!canBuy ? 'disabled' : ''} class="w-full py-2 rounded font-bold font-num cursor-pointer ${
                      entry.sold
                        ? 'bg-slate-800 text-slate-500'
                        : canBuy
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                    }">
                      ${entry.sold ? '품절' : `${finalPrice} G 구매`}
                    </button>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-shop-close')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onCloseModalToPlaying();
    });
    document.querySelectorAll('[data-shop]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onBuyShopEntry(el.getAttribute('data-shop')!);
        this.renderShopModal(player, inv, stock);
      });
    });
  }

  private renderBlacksmithModal(player: Player, inv: InventorySystem, save: SaveData): void {
    const slots: { slot: EquipSlot; label: string }[] = [
      { slot: 'weapon', label: '무기' },
      { slot: 'armor', label: '방어구' },
      { slot: 'ring', label: '반지' },
      { slot: 'necklace', label: '목걸이' },
    ];
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-2xl w-full p-6 animate-modal-in">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h2 class="text-lg font-bold text-orange-300">심연의 대장간</h2>
              <p class="text-xs text-slate-400">골드와 심연의 결정을 사용해 장착 장비를 강화합니다 (+14% 능력치/강화).</p>
            </div>
            <button id="btn-bs-close" class="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer">닫기</button>
          </div>
          <div class="flex gap-4 text-xs font-num mb-4">
            <span class="text-amber-300">골드: ${player.gold} G</span>
            <span class="text-sky-300">심연의 결정: ${save.abyssCrystals}</span>
            <span class="text-rose-300">고대 파편: ${save.ancientShards}</span>
          </div>
          <div class="space-y-3">
            ${slots
              .map(({ slot, label }) => {
                const item = inv.equipped[slot];
                if (!item) {
                  return `<div class="pixel-card rounded-lg p-3.5 text-xs text-slate-500">${label}: 장착된 장비가 없습니다.</div>`;
                }
                const cost = inv.getUpgradeCost(item);
                const maxed = item.upgradeLevel >= 10;
                const can =
                  !maxed &&
                  player.gold >= cost.gold &&
                  save.abyssCrystals >= cost.crystals &&
                  save.ancientShards >= cost.shards;
                return `
                  <div class="pixel-card rounded-lg p-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div class="font-bold text-sm" style="color:${RARITY_COLORS[item.rarity]}">${item.name} +${item.upgradeLevel}</div>
                      <div class="text-slate-300 mt-1 font-num">${formatItemStats(item).join(' · ')}</div>
                    </div>
                    <button data-bs="${slot}" ${!can ? 'disabled' : ''} class="px-3.5 py-2 rounded-lg font-bold font-num whitespace-nowrap cursor-pointer ${
                      maxed
                        ? 'bg-slate-800 text-slate-500'
                        : can
                        ? 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                        : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                    }">
                      ${maxed ? '최대 강화' : `강화 (${cost.gold}G / ${cost.crystals}결정${cost.shards > 0 ? ` / ${cost.shards}파편` : ''})`}
                    </button>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-bs-close')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onCloseModalToPlaying();
    });
    document.querySelectorAll('[data-bs]').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = el.getAttribute('data-bs') as EquipSlot;
        this.actions.onUpgradeEquipped(slot);
        this.renderBlacksmithModal(player, inv, save);
      });
    });
  }

  private renderEventModal(ev: EventPromptData | null): void {
    if (!ev) return;
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-lg w-full p-6 animate-modal-in">
          <div class="text-xs font-bold text-purple-400 mb-1">심연의 기이한 조우</div>
          <h2 class="text-xl font-bold text-white mb-3">${ev.title}</h2>
          <p class="text-sm text-slate-300 leading-relaxed mb-5">${ev.description}</p>
          <div class="space-y-2.5">
            ${ev.options
              .map(
                (opt, i) => `
              <button data-evopt="${i}" class="w-full pixel-card rounded-lg p-3.5 text-left cursor-pointer">
                <div class="font-bold text-sm text-white">${opt.label}</div>
                <div class="text-xs text-slate-400 mt-0.5">${opt.effectDesc}</div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-evopt]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onPlayClick();
        this.actions.onResolveEvent(Number(el.getAttribute('data-evopt')));
      });
    });
  }

  private renderRestModal(player: Player): void {
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-md w-full p-6 animate-modal-in">
          <h2 class="text-xl font-bold text-emerald-300 mb-2">고대의 회복 성소</h2>
          <p class="text-sm text-slate-300 mb-5">따스한 빛이 감도는 성소입니다. 현재 체력 ${Math.ceil(player.hp)} / ${player.maxHp}</p>
          <div class="space-y-3">
            <button id="btn-rest-heal" class="w-full pixel-card rounded-lg p-4 text-left cursor-pointer">
              <div class="font-bold text-sm text-emerald-300">성소의 샘물 마시기</div>
              <div class="text-xs text-slate-400 mt-0.5">최대 체력의 50%를 회복하고 물약 1개를 보충합니다.</div>
            </button>
            <button id="btn-rest-max" class="w-full pixel-card rounded-lg p-4 text-left cursor-pointer">
              <div class="font-bold text-sm text-amber-300">전투 축복 기도</div>
              <div class="text-xs text-slate-400 mt-0.5">최대 체력 +20 및 공격력 +8%를 영구히 얻습니다(이번 탐험).</div>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-rest-heal')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onRestHeal();
    });
    document.getElementById('btn-rest-max')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onRestMaxHp();
    });
  }

  private renderCodexModal(save: SaveData): void {
    let gridHtml = '';
    if (this.codexTab === 'monsters') {
      gridHtml = MONSTERS.map((m) => {
        const seen = save.codex.monstersSeen.includes(m.id);
        return `
          <div class="pixel-card rounded-lg p-3 text-xs ${seen ? '' : 'opacity-45'}">
            <div class="font-bold text-sm" style="color:${seen ? m.primaryColor : '#64748b'}">${seen ? m.name : '??? (미발견)'}</div>
            <div class="text-slate-400 mt-1">${seen ? m.description : '심연을 탐험하여 조우하세요.'}</div>
            ${seen ? `<div class="mt-1.5 font-num text-[11px] text-slate-300">기본 HP ${m.hp} · 공격 ${m.attack}</div>` : ''}
          </div>`;
      }).join('');
    } else if (this.codexTab === 'bosses') {
      gridHtml = BOSSES.map((b) => {
        const seen = save.codex.bossesDefeated.includes(b.id);
        return `
          <div class="pixel-card rounded-lg p-3 text-xs ${seen ? '' : 'opacity-50'}">
            <div class="font-bold text-sm" style="color:${b.primaryColor}">${b.name}</div>
            <div class="text-[11px] text-amber-300">${b.title} ${seen ? '· 토벌 완료' : '· 미토벌'}</div>
            <div class="text-slate-300 mt-1">${b.description}</div>
          </div>`;
      }).join('');
    } else if (this.codexTab === 'weapons') {
      gridHtml = EQUIPMENT_TEMPLATES.filter((t) => t.slot === 'weapon')
        .map((w) => {
          const found = save.codex.weaponsFound.includes(w.id);
          const prof = WEAPON_PROFILES[w.weaponKind!];
          return `
            <div class="pixel-card rounded-lg p-3 text-xs ${found ? '' : 'opacity-50'}">
              <div class="font-bold text-sm text-white">${w.name}</div>
              <div class="text-sky-300">${prof.label} · ${RARITY_LABELS[w.minRarity]} 이상</div>
              <div class="text-slate-400 mt-1">${w.specialEffectDesc || prof.description}</div>
            </div>`;
        })
        .join('');
    } else if (this.codexTab === 'relics') {
      gridHtml = RELICS.map((r) => {
        const found = save.codex.relicsFound.includes(r.id);
        return `
          <div class="pixel-card rounded-lg p-3 text-xs ${found ? '' : 'opacity-50'}">
            <div class="font-bold text-sm" style="color:${r.color}">${found ? r.name : '???'}</div>
            <div class="text-slate-400 mt-1">${found ? r.description : '탐험 중 발견 시 도감에 등록됩니다.'}</div>
          </div>`;
      }).join('');
    } else {
      gridHtml = SKILLS.map((s) => `
        <div class="pixel-card rounded-lg p-3 text-xs">
          <div class="font-bold text-sm" style="color:${ELEMENT_COLORS[s.element]}">${s.name}</div>
          <div class="text-[11px] text-slate-400">${ELEMENT_LABELS[s.element]} · 쿨타임 ${s.cooldown}s</div>
          <div class="text-slate-300 mt-1">${s.description}</div>
        </div>
      `).join('');
    }

    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-[#070a11]/95 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-5xl w-full p-6 animate-modal-in">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
            <h2 class="text-xl font-bold font-display text-white">심연 도감</h2>
            <button id="btn-codex-close" class="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer">돌아가기</button>
          </div>
          <div class="flex flex-wrap gap-2 mb-4">
            <button data-cdx="monsters" class="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${this.codexTab === 'monsters' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">몬스터 (${save.codex.monstersSeen.length}/${MONSTERS.length})</button>
            <button data-cdx="bosses" class="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${this.codexTab === 'bosses' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">보스 (${save.codex.bossesDefeated.length}/${BOSSES.length})</button>
            <button data-cdx="weapons" class="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${this.codexTab === 'weapons' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">무기</button>
            <button data-cdx="relics" class="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${this.codexTab === 'relics' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">유물 (${save.codex.relicsFound.length}/${RELICS.length})</button>
            <button data-cdx="skills" class="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${this.codexTab === 'skills' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">스킬 (${SKILLS.length})</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto abyss-scroll pr-1">
            ${gridHtml}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-codex-close')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      if (this.codexReturnState === 'PAUSED') {
        this.actions.onPauseGame();
      } else {
        this.actions.onReturnToTitle();
      }
    });
    document.querySelectorAll('[data-cdx]').forEach((el) => {
      el.addEventListener('click', () => {
        this.actions.onPlayClick();
        this.codexTab = el.getAttribute('data-cdx') as typeof this.codexTab;
        this.renderCodexModal(save);
      });
    });
  }

  public setCodexReturnState(s: GameState): void {
    this.codexReturnState = s;
  }

  private renderPauseModal(save: SaveData): void {
    const s = save.settings;
    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/75 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-sm w-full p-6 animate-modal-in">
          <h2 class="text-xl font-bold font-display text-white text-center mb-5">일시정지</h2>
          <div class="space-y-3 mb-5 text-xs">
            <label class="flex items-center justify-between">
              <span class="text-slate-300">사운드 음소거</span>
              <input id="p-mute" type="checkbox" ${s.muted ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-slate-300">화면 흔들림</span>
              <input id="p-shake" type="checkbox" ${s.screenShake ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-slate-300">피해량 표시</span>
              <input id="p-dmg" type="checkbox" ${s.damageNumbers ? 'checked' : ''} class="w-4 h-4 accent-sky-400" />
            </label>
          </div>
          <div class="flex flex-col gap-2.5">
            <button id="btn-p-resume" class="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer">계속하기 [ESC]</button>
            <button id="btn-p-codex" class="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer">도감 보기</button>
            <button id="btn-p-title" class="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 text-rose-300 font-medium text-sm cursor-pointer">저장 후 메인으로</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-p-resume')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onResumeGame();
    });
    document.getElementById('btn-p-codex')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onOpenCodex('PAUSED');
    });
    document.getElementById('btn-p-title')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onReturnToTitle();
    });
    document.getElementById('p-mute')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ muted: (e.target as HTMLInputElement).checked });
    });
    document.getElementById('p-shake')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ screenShake: (e.target as HTMLInputElement).checked });
    });
    document.getElementById('p-dmg')?.addEventListener('change', (e) => {
      this.actions.onUpdateSettings({ damageNumbers: (e.target as HTMLInputElement).checked });
    });
  }

  private renderEndModal(
    victory: boolean,
    ctxData: {
      player?: Player | null;
      floor?: number;
      kills?: number;
      bossesKilled?: number;
      elapsedSec?: number;
    }
  ): void {
    const floor = ctxData.floor || 1;
    const biome = getBiomeForFloor(floor);
    const sec = Math.floor(ctxData.elapsedSec || 0);

    this.overlayLayer.innerHTML = `
      <div class="w-full h-full bg-black/80 flex items-center justify-center p-4">
        <div class="pixel-panel rounded-2xl max-w-md w-full p-7 text-center animate-modal-in">
          <div class="text-xs font-bold tracking-widest ${victory ? 'text-amber-400' : 'text-rose-400'} mb-1">
            ${victory ? 'THE ABYSS CONQUERED' : 'EXPEDITION ENDED'}
          </div>
          <h2 class="text-2xl font-bold font-display text-white mb-2">
            ${victory ? '심연의 진실에 도달했습니다' : '심연 속에서 쓰러졌습니다'}
          </h2>
          <p class="text-xs text-slate-400 mb-6">
            ${victory ? '고대의 존재를 물리치고 일곱 왕국을 구원했습니다.' : '하지만 심연의 결정과 기억은 성소에 영구히 보존됩니다.'}
          </p>

          <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2 mb-6 font-num">
            <div class="flex justify-between"><span class="text-slate-400">도달 심층</span><span class="text-white font-bold">B${floor}F · ${biome.name}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">달성 레벨</span><span class="text-amber-300 font-bold">Lv.${ctxData.player?.level || 1}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">처치 몬스터 / 보스</span><span class="text-white">${ctxData.kills || 0} / ${ctxData.bossesKilled || 0}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">탐험 시간</span><span class="text-slate-300">${Math.floor(sec / 60)}분 ${sec % 60}초</span></div>
          </div>

          <div class="flex flex-col gap-2.5">
            <button id="btn-end-sanctuary" class="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer">
              성소로 귀환 (영구 강화 & 재도전)
            </button>
            <button id="btn-end-title" class="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs cursor-pointer">
              메인 화면으로
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-end-sanctuary')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onOpenSanctuary();
    });
    document.getElementById('btn-end-title')?.addEventListener('click', () => {
      this.actions.onPlayClick();
      this.actions.onReturnToTitle();
    });
  }
}
