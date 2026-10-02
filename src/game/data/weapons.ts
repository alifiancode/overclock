export type WeaponId = 'pistol' | 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'launcher';

export type WeaponKind = 'single' | 'spread' | 'splash';

export type WeaponDef = {
    id: WeaponId;
    name: string;
    damage: number;
    cooldown: number;
    range: number;
    magazineSize: number;
    reloadDuration: number;
    kind: WeaponKind;
    color: string;
    pellets?: number;
    splashRadius?: number;
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
    pistol: { id: 'pistol', name: 'Pistol', damage: 10, cooldown: 0.45, range: 6, magazineSize: 8, reloadDuration: 1.1, kind: 'single', color: '#f4d35e' },
    rifle: { id: 'rifle', name: 'Rifle', damage: 6, cooldown: 0.12, range: 8, magazineSize: 26, reloadDuration: 1.7, kind: 'single', color: '#f4a15e' },
    smg: { id: 'smg', name: 'SMG', damage: 4, cooldown: 0.075, range: 6.5, magazineSize: 40, reloadDuration: 1.6, kind: 'single', color: '#8fd3f4' },
    shotgun: {
        id: 'shotgun',
        name: 'Shotgun',
        damage: 5,
        cooldown: 0.75,
        range: 4.5,
        magazineSize: 6,
        reloadDuration: 2,
        kind: 'spread',
        color: '#f45e5e',
        pellets: 5,
    },
    sniper: { id: 'sniper', name: 'Sniper', damage: 55, cooldown: 1.35, range: 14, magazineSize: 4, reloadDuration: 2.3, kind: 'single', color: '#9ef45e' },
    launcher: {
        id: 'launcher',
        name: 'Launcher',
        damage: 34,
        cooldown: 1.6,
        range: 9,
        magazineSize: 3,
        reloadDuration: 2.6,
        kind: 'splash',
        color: '#e05ef4',
        splashRadius: 3.2,
    },
};

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'];
export const STARTING_WEAPON: WeaponId = 'pistol';
export const STARTING_RESERVE_AMMO: Record<WeaponId, number> = { pistol: 24, rifle: 0, smg: 0, shotgun: 0, sniper: 0, launcher: 0 };

export function buildInitialAmmo(): Record<WeaponId, { current: number; reserve: number }> {
    const ammo = {} as Record<WeaponId, { current: number; reserve: number }>;
    for (const id of WEAPON_ORDER) {
        ammo[id] = { current: id === STARTING_WEAPON ? WEAPONS[id].magazineSize : 0, reserve: STARTING_RESERVE_AMMO[id] };
    }
    return ammo;
}
