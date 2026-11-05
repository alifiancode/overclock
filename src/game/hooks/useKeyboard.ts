import { useEffect, useRef } from 'react';

export type HeldKeys = {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
    cameraLeft: boolean;
    cameraRight: boolean;
    interactPressed: boolean; 
    switchWeaponPressed: boolean;
    reloadPressed: boolean;
};

export function useKeyboard() {
    const keys = useRef<HeldKeys>({
        forward: false,
        back: false,
        left: false,
        right: false,
        cameraLeft: false,
        cameraRight: false,
        interactPressed: false,
        switchWeaponPressed: false,
        reloadPressed: false,
    });

    useEffect(() => {
        const setKey = (e: KeyboardEvent, value: boolean) => {
            switch (e.code) {
                case 'KeyW':
                    keys.current.forward = value;
                    break;
                case 'KeyS':
                    keys.current.back = value;
                    break;
                case 'KeyA':
                    keys.current.left = value;
                    break;
                case 'KeyD':
                    keys.current.right = value;
                    break;
                case 'ArrowLeft':
                    keys.current.cameraLeft = value;
                    break;
                case 'ArrowRight':
                    keys.current.cameraRight = value;
                    break;
                case 'KeyE':
                    if (value) keys.current.interactPressed = true;
                    break;
                case 'KeyQ':
                    if (value) keys.current.switchWeaponPressed = true;
                    break;
                case 'KeyR':
                    if (value) keys.current.reloadPressed = true;
                    break;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => setKey(e, true);
        const onKeyUp = (e: KeyboardEvent) => setKey(e, false);

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return keys;
}
