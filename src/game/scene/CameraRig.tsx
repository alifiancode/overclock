import { useFrame } from "@react-three/fiber";
import { Vector3 } from 'three';
import { world } from "../state/world.ts";
import { CAMERA_OFFSET, CAMERA_ROTATE_SPEED } from "../data/constants.ts";
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { useCameraDrag } from '../hooks/useCameraDrag.ts';

const targetPosition = new Vector3();
const CAMERA_RADIUS = Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z);

export function CameraRig() {
    const keys = useKeyboard();
    useCameraDrag();

    useFrame(({ camera }, delta) => {
        if (keys.current.cameraLeft) world.camera.angle -= CAMERA_ROTATE_SPEED * delta;
        if (keys.current.cameraRight) world.camera.angle += CAMERA_ROTATE_SPEED * delta;
        targetPosition.set(
            world.player.position.x + Math.cos(world.camera.angle) * CAMERA_RADIUS,
            world.player.position.y + CAMERA_OFFSET.y,
            world.player.position.z + Math.sin(world.camera.angle) * CAMERA_RADIUS
        );

        camera.position.lerp(targetPosition, 0.1);
        camera.lookAt(world.player.position);
    });

    return null;
}