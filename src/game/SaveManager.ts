import { GameSettings, SaveData, SerializedRun } from './types';

const STORAGE_KEY = 'abyss_endless_descent_save_v1';
const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.85,
  bgmVolume: 0.45,
  muted: false,
  screenShake: true,
  damageNumbers: true,
  mobileControlsMode: 'auto',
};

export function createInitialSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    abyssCrystals: 0,
    ancientShards: 0,
    unlockedClasses: ['swordsman', 'mage', 'assassin'],
    unlockedWeapons: [],
    metaUpgrades: {},
    codex: {
      monstersSeen: [],
      bossesDefeated: [],
      weaponsFound: [],
      relicsFound: [],
      skillsUsed: [],
    },
    records: [],
    settings: { ...DEFAULT_SETTINGS },
    activeRun: null,
  };
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialSaveData();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || typeof parsed !== 'object') {
        return createInitialSaveData();
      }
      const base = createInitialSaveData();
      return {
        version: SAVE_VERSION,
        abyssCrystals: typeof parsed.abyssCrystals === 'number' && parsed.abyssCrystals >= 0 ? parsed.abyssCrystals : 0,
        ancientShards: typeof parsed.ancientShards === 'number' && parsed.ancientShards >= 0 ? parsed.ancientShards : 0,
        unlockedClasses: Array.isArray(parsed.unlockedClasses) && parsed.unlockedClasses.length > 0
          ? Array.from(new Set(['swordsman', 'mage', 'assassin', ...parsed.unlockedClasses]))
          : base.unlockedClasses,
        unlockedWeapons: Array.isArray(parsed.unlockedWeapons) ? parsed.unlockedWeapons : [],
        metaUpgrades: parsed.metaUpgrades && typeof parsed.metaUpgrades === 'object' ? parsed.metaUpgrades : {},
        codex: {
          monstersSeen: Array.isArray(parsed.codex?.monstersSeen) ? parsed.codex!.monstersSeen : [],
          bossesDefeated: Array.isArray(parsed.codex?.bossesDefeated) ? parsed.codex!.bossesDefeated : [],
          weaponsFound: Array.isArray(parsed.codex?.weaponsFound) ? parsed.codex!.weaponsFound : [],
          relicsFound: Array.isArray(parsed.codex?.relicsFound) ? parsed.codex!.relicsFound : [],
          skillsUsed: Array.isArray(parsed.codex?.skillsUsed) ? parsed.codex!.skillsUsed : [],
        },
        records: Array.isArray(parsed.records) ? parsed.records.slice(0, 30) : [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
        },
        activeRun: parsed.activeRun && typeof parsed.activeRun === 'object' && parsed.activeRun.classId
          ? parsed.activeRun
          : null,
      };
    } catch {
      return createInitialSaveData();
    }
  }

  public getData(): SaveData {
    return this.data;
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }

  public saveActiveRun(run: SerializedRun | null): void {
    this.data.activeRun = run;
    this.save();
  }

  public addMetaCurrency(crystals: number, shards = 0): void {
    this.data.abyssCrystals = Math.max(0, this.data.abyssCrystals + Math.floor(crystals));
    this.data.ancientShards = Math.max(0, this.data.ancientShards + Math.floor(shards));
    this.save();
  }

  public recordMonsterSeen(id: string): void {
    if (!this.data.codex.monstersSeen.includes(id)) {
      this.data.codex.monstersSeen.push(id);
      this.save();
    }
  }

  public recordBossDefeated(id: string): void {
    if (!this.data.codex.bossesDefeated.includes(id)) {
      this.data.codex.bossesDefeated.push(id);
      this.save();
    }
  }

  public recordWeaponFound(templateId: string): void {
    if (!this.data.codex.weaponsFound.includes(templateId)) {
      this.data.codex.weaponsFound.push(templateId);
      this.save();
    }
  }

  public recordRelicFound(relicId: string): void {
    if (!this.data.codex.relicsFound.includes(relicId)) {
      this.data.codex.relicsFound.push(relicId);
      this.save();
    }
  }

  public recordSkillUsed(skillId: string): void {
    if (!this.data.codex.skillsUsed.includes(skillId)) {
      this.data.codex.skillsUsed.push(skillId);
      this.save();
    }
  }

  public resetAll(): void {
    this.data = createInitialSaveData();
    this.save();
  }
}
