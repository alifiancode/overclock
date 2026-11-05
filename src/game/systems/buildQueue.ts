type Task = { gen: Generator<void, void>; priority: number; order: number };

const tasks: Task[] = [];
let counter = 0;

export function enqueueTask(gen: Generator<void, void>, priority: number = 0) {
    tasks.push({ gen, priority, order: counter++ });
}

export function cancelTask(gen: Generator<void, void>) {
    const index = tasks.findIndex((t) => t.gen === gen);
    if (index >= 0) tasks.splice(index, 1);
}

export function pendingTaskCount(): number {
    return tasks.length;
}

export function clearTasks() {
    tasks.length = 0;
}

export function runTasks(budgetMs: number) {
    if (tasks.length === 0) return;
    const start = performance.now();
    while (tasks.length > 0) {
        let best = 0;
        for (let i = 1; i < tasks.length; i++) {
            const t = tasks[i];
            const b = tasks[best];
            if (t.priority < b.priority || (t.priority === b.priority && t.order < b.order)) best = i;
        }
        const task = tasks[best];
        const result = task.gen.next();
        if (result.done) tasks.splice(best, 1);
        if (performance.now() - start >= budgetMs) return;
    }
}

export function runToCompletion<T>(gen: Generator<void, T>): T {
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}
