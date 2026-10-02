import { useEffect, useState } from 'react';
import { world } from '../../state/world.ts';
import { xpToNextLevel } from '../../systems/leveling.ts';
import { WEAPONS } from '../../data/weapons.ts';
import './Hud.css';

const POLL_INTERVAL_MS = 100;

export function Hud() {
    const [health, setHealth] = useState(world.player.health);
    const [alive, setAlive] = useState(world.player.alive);
    const [level, setLevel] = useState(world.player.level);
    const [xp, setXp] = useState(world.player.xp);
    const [ammo, setAmmo] = useState(world.player.ammo[world.player.equippedWeapon]);
    const [weaponId, setWeaponId] = useState(world.player.equippedWeapon);
    const [reloading, setReloading] = useState(world.player.isReloading);
    const [ownedCount, setOwnedCount] = useState(world.player.ownedWeapons.length);

    useEffect(() => {
        const interval = setInterval(() => {
            setHealth(world.player.health);
            setAlive(world.player.alive);
            setLevel(world.player.level);
            setXp(world.player.xp);
            setAmmo({ ...world.player.ammo[world.player.equippedWeapon] });
            setWeaponId(world.player.equippedWeapon);
            setReloading(world.player.isReloading);
            setOwnedCount(world.player.ownedWeapons.length);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const xpPercent = Math.min(100, (xp / xpToNextLevel(level)) * 100);

    return (
        <div className="hud" data-ui>
            <div className="hud-health">HP: {Math.ceil(health)} / {world.player.maxHealth}</div>
            <div className="hud-level">Level {level}</div>
            <div className="hud-xp-bar">
                <div className="hud-xp-fill" style={{ width: `${xpPercent}%` }}></div>
            </div>
            <div className="hud-ammo">
                {WEAPONS[weaponId].name}: {reloading ? 'Reloading…' : `${ammo.current} / ${ammo.reserve}`}
                {ownedCount > 1 && <span className="hud-ammo-hint"> (Q to switch)</span>}
            </div>
            {!alive && <div className="hud-death">You Died</div>}
        </div>
    );
}