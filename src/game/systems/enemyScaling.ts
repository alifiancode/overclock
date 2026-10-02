export type ScalingResult = {
    spawnInterval: number;
    healthMultiplier: number;
};

export function getScaling(elapsedSeconds: number, dangerDial: number): ScalingResult {
    const minutesElapsed = elapsedSeconds / 60;
    const baseInterval = 2.2 - dangerDial * 0.2;
    const spawnInterval = Math.max(0.3, baseInterval - minutesElapsed * 0.15);
    const healthMultiplier = 1 + dangerDial * 0.15 + minutesElapsed * 0.25;
    return { spawnInterval, healthMultiplier };
}