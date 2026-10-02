import { world } from '../../state/world.ts';
import './RunSummary.css';

type RunSummaryProps = {
    onReturnToMenu: () => void;
};

export function RunSummary({ onReturnToMenu }: RunSummaryProps) {
    const minutes = Math.floor(world.run.elapsedSeconds / 60);
    const seconds = Math.floor(world.run.elapsedSeconds % 60);

    return (
        <div className="run-summary" data-ui>
            <div className="run-summary-title">{world.player.alive ? 'Run Complete' : 'Run Over'}</div>
            <div className="run-summary-stat">Survived: {minutes}m {seconds.toString().padStart(2, '0')}s</div>
            <div className="run-summary-stat">Level Reached: {world.player.level}</div>
            <div className="run-summary-stat run-summary-currency">Currency Earned: {world.run.currencyEarned}</div>
            <div className="run-summary-stat">Total Currency: {world.currency}</div>
            <button className="run-summary-button" onClick={onReturnToMenu}>
                Return to Menu
            </button>
        </div>
    );
}