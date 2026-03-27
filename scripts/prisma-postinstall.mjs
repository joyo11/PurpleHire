import { spawnSync } from "node:child_process";

const isVercel = !!process.env.VERCEL;
const schema = isVercel ? "prisma/schema.prisma" : "prisma/schema.sqlite.prisma";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "generate", "--schema", schema],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);

