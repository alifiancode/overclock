export function pickWeightedWithoutReplacement<T>(
    items: T[],
    getWeight: (item: T) => number,
    count: number
): T[] {
    const pool = [...items];
    const picks: T[] = [];

    for (let i = 0; i < count && pool.length > 0; i++) {
        const totalWeight = pool.reduce((sum, item) => sum + getWeight(item), 0);
        let roll = Math.random() * totalWeight;
        let chosenIndex = pool.length - 1;
        for (let j = 0; j < pool.length; j++) {
            roll -= getWeight(pool[j]);
            if (roll <= 0) {
                chosenIndex = j;
                break;
            }
        }
        picks.push(pool[chosenIndex]);
        pool.splice(chosenIndex, 1);
    }
    return picks;
}