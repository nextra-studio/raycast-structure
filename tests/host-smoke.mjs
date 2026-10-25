/** Run outside Raycast with a minimal API adapter; validates command rendering and live event paths. */
import { build } from "esbuild";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const scratch = mkdtempSync(join(tmpdir(), "structural-toolbox-test-"));
const escaped = JSON.stringify(scratch),
  assets = JSON.stringify(resolve("assets"));
const react = `let state=[],idx=0,pending=[];export function reset(){state=[];idx=0;pending=[];}export function start(){idx=0;}export function flush(){const jobs=pending;pending=[];jobs.forEach(f=>f());}export function useState(initial){const i=idx++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];}export function useEffect(fn){const i=idx++;if(!(i in state)){state[i]=true;pending.push(fn);}}export function useMemo(fn){idx++;return fn();}`;
const api = `const component=name=>Object.defineProperty(function(){},'displayName',{value:name});const add=(name,keys)=>{const v=component(name);keys.forEach(k=>v[k]=component(name+'.'+k));return v;};export const List=add('List',['Item','Section','EmptyView','Dropdown']);List.Item.Detail=component('List.Item.Detail');List.Item.Detail.Metadata=add('Metadata',['Label']);List.Dropdown.Item=component('List.Dropdown.Item');List.Dropdown.Section=component('List.Dropdown.Section');export const Form=add('Form',['TextField','TextArea','Dropdown','Description','Checkbox','Separator']);Form.Dropdown.Item=component('Form.Dropdown.Item');export const Detail=component('Detail');export const ActionPanel=add('ActionPanel',['Section']);export const Action=add('Action',['Open','OpenInBrowser','CopyToClipboard','SubmitForm']);export const Icon=new Proxy({},{get:(_,k)=>k});export const Toast={Style:{Success:'success',Failure:'failure'}};export const environment={supportPath:${escaped},assetsPath:${assets},appearance:${JSON.stringify(process.env.STRUCTURAL_QA_APPEARANCE || "dark")}};export const getPreferenceValues=()=>({defaultMaterial:'C24',precision:'3',diagramTextSize:globalThis.__qaDiagramTextSize || '22'});export const LocalStorage={getItem:async()=>undefined,setItem:async()=>{}};export const showToast=async()=>{};export const openExtensionPreferences=async()=>{};export const open=async()=>{};export const pushed=[];export const useNavigation=()=>({push:v=>pushed.push(v),pop:()=>{}});`;
const entry = readFileSync("tests/ui-scenarios.tsx", "utf8");
try {
  await build({
    stdin: { contents: entry, resolveDir: resolve("tests"), loader: "tsx" },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(scratch, "smoke.cjs"),
    jsx: "transform",
    jsxFactory: "h",
    jsxFragment: "fragment",
    banner: {
      js: 'const fragment="Fragment";const h=(type,props,...children)=>({type,props:{...props,children}});',
    },
    plugins: [
      {
        name: "host-adapter",
        setup(b) {
          b.onResolve(
            { filter: /^(react(?:\/jsx(?:-dev)?-runtime)?|@raycast\/api)$/ },
            (a) => ({ path: a.path, namespace: "stub" }),
          );
          b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
            contents:
              a.path === "react"
                ? react
                : a.path.startsWith("react/")
                  ? 'export const Fragment="Fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const jsxDEV=jsx;'
                  : api,
            loader: "js",
          }));
        },
      },
    ],
  });
  await (
    await import(pathToFileURL(join(scratch, "smoke.cjs")).href)
  ).default;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
