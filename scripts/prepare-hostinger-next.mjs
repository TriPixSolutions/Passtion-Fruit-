import { cp, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const webRoot = path.join(repositoryRoot, "apps", "web");
const nextRoot = path.join(webRoot, ".next");
const standaloneRoot = path.join(nextRoot, "standalone");
const workspaceServerRoot = path.join(standaloneRoot, "apps", "web");

await mkdir(standaloneRoot, { recursive: true });
await copyFile(
  path.join(workspaceServerRoot, "server.js"),
  path.join(standaloneRoot, "server.js"),
);
await copyFile(
  path.join(workspaceServerRoot, "package.json"),
  path.join(standaloneRoot, "package.json"),
);
await cp(
  path.join(workspaceServerRoot, ".next"),
  path.join(standaloneRoot, ".next"),
  { recursive: true },
);
await cp(
  path.join(nextRoot, "static"),
  path.join(standaloneRoot, ".next", "static"),
  { recursive: true },
);
await cp(
  path.join(webRoot, "public"),
  path.join(standaloneRoot, "public"),
  { recursive: true },
);

console.log("Prepared Hostinger-compatible Next.js standalone output.");
