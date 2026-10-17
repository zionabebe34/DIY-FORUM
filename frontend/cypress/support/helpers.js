// Shared by the specs and the commands.
export const PASSWORD = 'password123';

/** A unique username for this run (the e2e database is shared by every spec of the run). */
export const uniqueName = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
