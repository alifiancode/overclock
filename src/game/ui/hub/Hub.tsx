import { useState } from 'react';
import { world, trySpendCurrency, saveMeta } from '../../state/world.ts';
import { PERMANENT_UPGRADES, costForUpgrade, type PermanentUpgrade, BOT_MODULE_UNLOCKS, type BotModuleUnlock } from '../../data/permanentUpgrades.ts'
import './Hub.css';

type HubProps = {
    onBack: () => void;
};

export function Hub({ onBack }: HubProps) {
    const [, setTick] = useState(0);
    const rerender = () => setTick((t) => t + 1);

    const handleBuy = (upgrade: PermanentUpgrade) => {
        if (trySpendCurrency(costForUpgrade(upgrade))) {
            upgrade.purchase();
            saveMeta();
            rerender();
        }
    };

    const handleUnlock = (unlock: BotModuleUnlock) => {
        if (trySpendCurrency(unlock.cost)) {
            world.meta.unlockedBotModules.push(unlock.module);
            saveMeta();
            rerender();
        }
    };

    return (
        <div className="hub" data-ui>
            <div className="hub-title">HUB</div>
            <div className="hub-currency">Currency: {world.currency}</div>
            <div className="hub-body">
                <section className="hub-section">
                    <h2 className="hub-section-title">Stat Upgrades</h2>
                    <div className="hub-upgrades">
                        {PERMANENT_UPGRADES.map((upgrade) => {
                            const cost = costForUpgrade(upgrade);
                            const affordable = world.currency >= cost;
                            return (
                                <div key={upgrade.id} className="hub-upgrade-card">
                                    <div className="hub-upgrade-name">{upgrade.name}</div>
                                    <div className="hub-upgrade-desc">{upgrade.description}</div>
                                    <div className="hub-upgrade-level">Level {upgrade.getLevel()}</div>
                                    <button className="hub-upgrade-buy" disabled={!affordable} onClick={() => handleBuy(upgrade)}>
                                        Buy - {cost}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
                <section className="hub-section">
                    <h2 className="hub-section-title">Bot Modules</h2>
                    <div className="hub-upgrades">
                        {BOT_MODULE_UNLOCKS.map((unlock) => {
                            const unlocked = world.meta.unlockedBotModules.includes(unlock.module);
                            const affordable = world.currency >= unlock.cost;
                            return (
                                <div key={unlock.module} className="hub-upgrade-card">
                                    <div className="hub-upgrade-name">{unlock.name}</div>
                                    <div className="hub-upgrade-desc">{unlock.description}</div>
                                    <button className="hub-upgrade-buy" disabled={unlocked || !affordable} onClick={() => handleUnlock(unlock)}>
                                        {unlocked ? 'Unlocked' : `Unlock - ${unlock.cost}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
            <button className="hub-back" onClick={onBack}>Back</button>
        </div>
    );
}