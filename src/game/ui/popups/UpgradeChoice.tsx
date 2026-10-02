import { useEffect, useState } from 'react';
import { world } from '../../state/world.ts';
import { UPGRADES, type Upgrade } from '../../data/upgrades.ts';
import { pickWeightedWithoutReplacement } from '../../systems/weightedRandom.ts';
import './UpgradeChoice.css';

const POLL_INTERVAL_MS = 100;
const CHOICE_COUNT = 3;

export function UpgradeChoice() {
    const [pending, setPending] = useState(world.pendingUpgradeChoices);
    const [choices, setChoices] = useState<Upgrade[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setPending(world.pendingUpgradeChoices);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => {
        if (pending > 0 && choices.length === 0) {
            setChoices(pickWeightedWithoutReplacement(UPGRADES, (u) => u.weight, CHOICE_COUNT));
        }
    }, [pending, choices.length]);
    if (pending === 0 || choices.length === 0) return null;
    const handlePick = (upgrade: Upgrade) => {
        upgrade.apply();
        world.pendingUpgradeChoices -= 1;
        setChoices([]);
    };

    return (
        <div className="upgrade-choice" data-ui>
            <div className="upgrade-choice-title">Level Up!</div>
            <div className="upgrade-choice-options">
                {choices.map((upgrade) => (
                    <button key={upgrade.id} className="upgrade-choice-card" onClick={() => handlePick(upgrade)}>
                        <div className="upgrade-choice-category">{upgrade.category}</div>
                        <div className="upgrade-choice-name">{upgrade.name}</div>
                        <div className="upgrade-choice-desc">{upgrade.description}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}