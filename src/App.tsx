import { useState, useEffect } from 'react';
import { Scene } from './game/scene/Scene.tsx';
import { Hud } from './game/ui/hud/Hud.tsx';
import { BotDialogue } from './game/ui/hud/BotDialogue.tsx';
import { UpgradeChoice } from './game/ui/popups/UpgradeChoice.tsx';
import { MainMenu } from './game/ui/menu/MainMenu.tsx';
import { RunSummary } from './game/ui/hub/RunSummary.tsx';
import { Hub } from './game/ui/hub/Hub.tsx';
import { world } from './game/state/world.ts';

type Phase = 'menu' | 'playing' | 'summary' | 'hub';
const POLL_INTERVAL_MS = 100;

function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      if (world.run.over) {
        setPhase('summary');
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {phase === 'menu' && <MainMenu onStart={() => setPhase('playing')} onOpenHub={() => setPhase('hub')} />}
      {phase === 'playing' && (
        <>
          <Scene />
          <Hud />
          <BotDialogue />
          <UpgradeChoice />
        </>
      )}
      {phase === 'summary' && <RunSummary onReturnToMenu={() => setPhase('menu')} />}
      {phase === 'hub' && <Hub onBack={() => setPhase('menu')} />}
    </div>
  );
}

export default App;