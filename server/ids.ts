import crypto from "node:crypto";

// Kept apart from db.ts so modules that only need ids (the resume parser, job
// sources) can be loaded and tested without opening the database.
export const uid = (p = "") => p + crypto.randomBytes(6).toString("hex");
