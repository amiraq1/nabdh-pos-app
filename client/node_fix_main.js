import fs from 'fs';
import path from 'path';

const mainPath = path.resolve('client/src/main.tsx');
let content = fs.readFileSync(mainPath, 'utf8');

// Insert sonner import
let importTrpc = 'import { trpc } from "@/lib/trpc";\\n';
let newImportTrpc = 'import { trpc } from "@/lib/trpc";\\nimport { toast } from "sonner";\\n';
content = content.replace(/(import \{ trpc \} from "@\/lib\/trpc";\r?\n)/, '$1import { toast } from "sonner";\n');

const oldQryCache = `queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});`;

const newQryCache = `queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error as Error;
    redirectToLoginIfUnauthorized(error);
    if (error?.message && !error.message.includes(UNAUTHED_ERR_MSG)) {
      toast.error(\`فشل جلب البيانات: \${error.message}\`, { className: "font-display text-destructive border-destructive font-bold" });
    }
    console.error("[API Query Error]", error);
  }
});`;

content = content.replace(oldQryCache.replace(/\r?\n/g, '\\r?\\n'), newQryCache);
// We will just do a standard replace without caring for CRLF by turning the regex wild
content = content.replace(/queryClient\.getQueryCache\(\)\.subscribe.*?\}\);\s*\r?\n/s, newQryCache + '\n\n');

const newMutCache = `queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error as Error;
    redirectToLoginIfUnauthorized(error);
    if (error?.message && !error.message.includes(UNAUTHED_ERR_MSG)) {
      toast.error(\`فشلت العملية: \${error.message}\`, { className: "font-display text-destructive border-destructive font-bold" });
    }
    console.error("[API Mutation Error]", error);
  }
});`;

content = content.replace(/queryClient\.getMutationCache\(\)\.subscribe.*?\}\);\s*\r?\n/s, newMutCache + '\n\n');

fs.writeFileSync(mainPath, content);
console.log("Global Trpc error toasts implemented");
