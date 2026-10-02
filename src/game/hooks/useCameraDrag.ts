import { useEffect, useRef } from 'react';
import { world } from '../state/world.ts';
import { CAMERA_DRAG_SENSITIVITY } from '../data/constants.ts';

export function useCameraDrag() {
    const dragging = useRef(false);
    const lastX = useRef(0);

    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            if ((e. target as HTMLElement).closest('[data-ui]')) return;
            dragging.current = true;
            lastX.current = e.clientX;
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const deltaX = e.clientX - lastX.current;
            world.camera.angle += deltaX * CAMERA_DRAG_SENSITIVITY;
            lastX.current = e.clientX;
        };

        const onMouseUp = () => {
            dragging.current = false;
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);
}