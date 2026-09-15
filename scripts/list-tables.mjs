import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(new URL("../data/fix1.db", import.meta.url).pathname.replace(/^\//, ""));
// Windows path fix
import { resolve } from "node:path";
const db2 = new DatabaseSync(resolve(import.meta.dirname, "../data/fix1.db"));
console.log(db2.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all());
