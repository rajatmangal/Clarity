import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extractMerchant,merchantKey,rememberCategory,applyMerchantLearning,plannedBudget,upgradeState,themes} from '../public/money-model.js';
import {emptyState,Store,validate} from '../lib/store.mjs';
import {summarize} from '../public/core.js';
import {listAllowedModels} from '../lib/openai-models.mjs';
const purchase=(description,category='uncategorized')=>({id:'t',date:'2026-10-13',description,amount:1500,kind:'expense',account:'bank',category,review:false,source:'reviewed'});
test('merchant cleanup separates references and recognized locations, preserves brand digits',()=>{
 assert.deepEqual(extractMerchant('POS COFFEE SHOP #1425 VANCOUVER BC'),{merchant:'COFFEE SHOP',reference:'#1425',location:'VANCOUVER BC'});
 for(const brand of ['7-Eleven','3M','Forever 21','London Drugs'])assert.equal(extractMerchant(brand).merchant,brand);
 assert.deepEqual(extractMerchant('COFFEE SHOP 001 SURREY'), {merchant:'COFFEE SHOP',location:'SURREY',reference:'001'});
 assert.equal(extractMerchant('COFFEE SHOP UNKNOWN CITY').merchant,'COFFEE SHOP UNKNOWN CITY');
 assert.equal(merchantKey('COFFEE SHOP #1425 VANCOUVER BC'),merchantKey('Coffee Shop 9876 TORONTO ON'));
});
test('explicit choices teach new imports without overwriting manual categories or original statement text',()=>{
 const state=rememberCategory(emptyState(),purchase('COFFEE SHOP #1425 VANCOUVER BC','dining'));
 const raw='Coffee Shop 9876 TORONTO ON';
 const [learned,manual,income]=applyMerchantLearning([purchase(raw),purchase(raw,'groceries'),{...purchase(raw),kind:'income'}],state);
 assert.equal(learned.category,'dining');assert.equal(learned.description,raw);assert.equal(learned.location,'TORONTO ON');assert.equal(learned.source,'learned');assert.equal(manual.category,'groceries');assert.equal(income.category,'uncategorized');
 const corrected=rememberCategory(state,purchase(raw,'groceries'));assert.equal(corrected.merchantRules.length,1);assert.equal(applyMerchantLearning([purchase(raw)],corrected)[0].category,'groceries');
});
test('conflicting history and different merchants stay uncategorized',()=>{
 const state=emptyState();state.transactions=[purchase('Coffee','dining'),purchase('Coffee','other')];
 assert.equal(applyMerchantLearning([purchase('Coffee')],state)[0].category,'uncategorized');
 state.transactions=[purchase('Coffee','dining')];assert.equal(applyMerchantLearning([purchase('Coffee House')],state)[0].category,'uncategorized');
});
test('combined budgets include child spending once; separate limits remain independent',()=>{
 const state=emptyState();state.categories.push({id:'coffee',name:'Coffee',parentId:'dining',budget:5000,budgetScope:'separate',color:'#abcdef'});
 const parent=state.categories.find(c=>c.id==='dining');parent.budget=20000;parent.budgetScope='combined';
 state.transactions=[purchase('Cafe','coffee'),{...purchase('Restaurant','dining'),id:'t2',amount:2500}];
 let summary=summarize(state,'2026-10-01','2026-10-31');assert.equal(plannedBudget(state.categories),20000);assert.equal(summary.spending,4000);assert.equal(summary.categories.reduce((n,c)=>n+c.spent,0),4000);assert.equal(summary.categories.find(c=>c.id==='dining').budgetSpent,4000);
 parent.budgetScope='separate';assert.equal(plannedBudget(state.categories),25000);summary=summarize(state,'2026-10-01','2026-10-31');assert.equal(summary.categories.find(c=>c.id==='dining').budgetSpent,2500);
});
test('old split Markdown vault upgrades with notes and data intact; themes and rules survive reopening',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'folio-themes-'));try{
  const store=new Store(dir);await store.init();let r=await store.read();let state=emptyState();state.accounts=[{id:'bank',name:'Bank',type:'bank'}];state.transactions=[purchase('COFFEE #1234 VANCOUVER BC','dining')];await store.save(state,r.revision);
  // Recreate the previous six-file schema by removing only added columns.
  for(const [file,oldLength] of [['Settings',2],['Categories',4],['Transactions',9]]){
   const raw=await readFile(path.join(dir,file+'.md'),'utf8');await writeFile(path.join(dir,file+'.md'),raw.split('\n').map(line=>line.startsWith('|')?'|'+line.split('|').slice(1,oldLength+1).join('|')+'|':line).join('\n')+'\nMy '+file+' note.\n');
  }
  await rm(path.join(dir,'MerchantRules.md'));const reopened=new Store(dir);await reopened.init();r=await reopened.read();assert.deepEqual(r.state,upgradeState(state));assert.ok(r.files['Transactions.md'].includes('My Transactions note.'));assert.ok((await readdir(path.join(dir,'.backups'))).some(x=>x.startsWith('upgrade-')));
  state=rememberCategory(r.state,state.transactions[0]);
  for(const theme of themes){await reopened.save({...state,theme:theme.id},r.revision);r=await reopened.read();assert.equal(r.state.theme,theme.id);assert.equal(r.state.merchantRules[0].category,'dining');}
  await assert.rejects(()=>reopened.save({...r.state,theme:'wrong'},r.revision));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid category nesting is rejected',()=>{
 const s=emptyState();s.categories[0].parentId=s.categories[0].id;assert.throws(()=>validate(s));
});
test('model choices intersect supported models and account access; rejected keys surface errors',async()=>{
 assert.deepEqual(await listAllowedModels(''),[]);
 const list=await listAllowedModels('test',async()=>({ok:true,json:async()=>({data:[{id:'gpt-5-mini'},{id:'audio-only'},{id:'gpt-4.1-mini'}]})}));assert.deepEqual(list.map(m=>m.id),['gpt-5-mini','gpt-4.1-mini']);
 await assert.rejects(()=>listAllowedModels('test',async()=>({ok:false,status:401})),/rejected/);
});
