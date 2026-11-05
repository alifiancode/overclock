import { useEffect, useRef, useState } from 'react';
import { world } from '../../state/world.ts';
import './BotDialogue.css';

const POLL_INTERVAL_MS = 100;
const DISPLAY_DURATION_MS = 4000;

export function BotDialogue() {
    const [text, setText] = useState('');
    const [visible, setVisible] = useState(false);
    const lastSeenId = useRef(0);
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const interval = setInterval(() => {
            if (world.dialogue.id !== lastSeenId.current) {
                lastSeenId.current = world.dialogue.id;
                setText(world.dialogue.text);
                setVisible(true);

                clearTimeout(hideTimeout.current);
                hideTimeout.current = setTimeout(() => setVisible(false), DISPLAY_DURATION_MS);
            }
        }, POLL_INTERVAL_MS);
        return () => {
            clearInterval(interval);
            clearTimeout(hideTimeout.current);
        };
    }, []);

    if (!visible) return null;
    return (
        <div className="bot-dialogue" data-ui>
            {text}
        </div>
    );
}