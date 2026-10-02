import { useState } from 'react';
import { world, resetRun, saveMeta } from '../../state/world.ts';
import './MainMenu.css';

type MainMenuProps = {
    onStart: () => void;
    onOpenHub: () => void;
};

export function MainMenu({ onStart, onOpenHub }: MainMenuProps) {
    const [dial, setDial] = useState(world.dangerDial);
    const [botModule, setBotModule] = useState(world.meta.selectedBotModule);
    const handleStart = () => {
        world.dangerDial = dial;
        world.meta.selectedBotModule = botModule;
        saveMeta();
        resetRun();
        onStart();
    };

    return (
        <div className="main-menu" data-ui>
            <div className="main-menu-title">OVERCLOCK</div>
            <div className="main-menu-currency">Currency: {world.currency}</div>
            <div className="main-menu-dial-label">Danger Dial: {dial}</div>
            <div className='main-menu-dial-row'>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={`main-menu-dial-button${n === dial ? ' active' : ''}`}
                    onClick={() => setDial(n)}>{n}</button>
                ))}
            </div>
            <div className="main-menu-dial-label">Bot Module</div>
            <div className="main-menu-dial-row">
                {world.meta.unlockedBotModules.map((mod) => (
                    <button key={mod} className={`main-menu-module-button${mod === botModule ? ' active' : ''}`} onClick={() => setBotModule(mod)}>{mod}</button>
                ))}
            </div>
            <button className="main-menu-start" onClick={handleStart}>Start Run</button>
            <button className="main-menu-hub-button" onClick={onOpenHub}>
                Hub
            </button>
        </div>
    );
}