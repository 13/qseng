/**
 * Inspect the localStorage getter
 */
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
console.log("=== localStorage descriptor on globalThis ===");
console.log("descriptor:", descriptor);
console.log("descriptor.get:", descriptor?.get?.toString?.());

// Try to see what's on window
const w = globalThis as any;
const windowDescriptor = Object.getOwnPropertyDescriptor(w.window, 'localStorage');
console.log("\n=== localStorage descriptor on window ===");
console.log("descriptor:", windowDescriptor);
console.log("descriptor.get:", windowDescriptor?.get?.toString?.());

// Maybe we need to create or initialize it?
console.log("\n=== Trying to initialize ===");
console.log("Object.keys(w.window.navigator):", Object.keys(w.window.navigator).slice(0, 10));
