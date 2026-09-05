import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';

const root=fileURLToPath(new URL('..',import.meta.url));
const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
for(const name of ['radix-ui','class-variance-authority','tw-animate-css'])assert(!pkg.dependencies[name],`Retired UI dependency: ${name}`);
assert(!existsSync(path.join(root,'components.json')),'Retired shadcn generator configuration');
for(const file of ['app/globals.css','app/auth.css','app/marketing.css']){
  postcss.parse(readFileSync(path.join(root,file),'utf8'),{from:file}).walk(node=>{
    if(node.type==='rule'){
      assert(node.selector.trim(),`${file}: empty selector`);
      assert(!/\.(?:label|input|input-group|button|card)(?:[\s.:#\[>+~]|$|__|--)/.test(node.selector),`${file}: global override of a native control: ${node.selector}`);
    }
    if(node.type==='decl')assert(!/^--(?:radius(?:-|$)|muted$|success$|surface-shadow$|field-radius$|color-(?:primary|secondary|card|popover|destructive|ring))/.test(node.prop),`${file}: conflicting native theme token ${node.prop}`);
  });
}
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  if(e.name==='heroui-dashboard-template')continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(/\.[jt]sx?$/.test(p)){
    const s=readFileSync(p,'utf8');
    assert(!/from\s+['"](?:@\/components\/ui\/|radix-ui|class-variance-authority)/.test(s),`Retired component import: ${p}`);
    assert(!/\b(?:text-muted-foreground|bg-primary|bg-secondary|text-destructive|shadow-apple-card)\b/.test(s),`Retired visual token: ${p}`);
  }
}}
walk(path.join(root,'app'));walk(path.join(root,'components'));
console.log('UI boundaries passed: native theme tokens, no global control overrides, no retired imports.');
