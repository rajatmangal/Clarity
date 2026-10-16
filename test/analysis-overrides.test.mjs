import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {emptyState,Store,validate,serialize,deserialize} from '../lib/store.mjs';
import {budgetPlan,monthCategories} from '../public/budget-plan.js';
import {analysisData} from '../public/analysis.js';
import {summarize} from '../public/core.js';
const sample=()=>{const s=emptyState();s.categories.find(c=>c.id==='dining').budget=10000;return s;};
const override=(budget=25000,month='2026-10')=>({id:'dining:'+month,category:'dining',month,budget,note:'Visitors'});
test('one-month overrides expire, prorate calendar days, and feed all summary totals',()=>{
 const s=sample();s.budgetOverrides=[override()];
 assert.equal(budgetPlan(s,'2026-09-01','2026-09-30').total,10000);
 assert.equal(budgetPlan(s,'2026-10-01','2026-10-31').total,25000);
 assert.equal(budgetPlan(s,'2026-11-01','2026-11-30').total,10000);
 assert.equal(budgetPlan(s,'2026-01-01','2026-12-31').total,135000);
 assert.equal(budgetPlan(s,'2026-10-01','2026-10-15').targets.dining,Math.round(25000*15/31));
 assert.equal(s.categories.find(c=>c.id==='dining').budget,10000);
 assert.equal(summarize(s,'2026-10-01','2026-10-31').categories.find(c=>c.id==='dining').targetBudget,25000);
 s.budgetOverrides=[override(0)];assert.equal(budgetPlan(s,'2026-10-01','2026-10-31').total,0);
});
test('combined parents and child targets are not counted twice, including mixed-month overrides',()=>{
 const s=sample();s.categories.find(c=>c.id==='dining').budgetScope='combined';s.categories.push({id:'coffee',name:'Coffee',parentId:'dining',budget:5000,budgetScope:'separate',color:'#123456'});s.budgetOverrides=[override(25000)];
 assert.equal(budgetPlan(s,'2026-09-01','2026-10-31').total,35000);
 const result=analysisData(s,'2026-10-01','2026-10-31','2026-09-01','dining');assert.deepEqual(result.months.map(m=>m.Budget),[100,250]);
 s.budgetOverrides=[override(0)];assert.equal(budgetPlan(s,'2026-10-01','2026-10-31').total,5000);assert.equal(analysisData(s,'2026-10-01','2026-10-31','2026-10-01','dining').months[0].Budget,50);
});
const tx=(id,date,amount,kind='expense',category='dining',description='Coffee #1234 Vancouver BC')=>({id,date,amount,kind,category,description,account:'bank',source:'reviewed',review:false});
test('analysis groups merchants, deducts refunds, excludes transfers, and respects category and date ranges',()=>{
 const s=sample();s.transactions=[tx('a','2026-09-01',10000),tx('b','2026-10-01',5000),tx('c','2026-10-02',1000,'refund'),tx('d','2026-10-03',100000,'transfer'),tx('e','2026-10-04',200000,'income'),tx('f','2026-10-05',3000,'expense','groceries','Market')];
 const d=analysisData(s,'2026-10-01','2026-10-31','2026-09-01','dining');
 assert.equal(d.net,4000);assert.equal(d.purchases,1);assert.equal(d.average,5000);assert.equal(d.merchants[0].Spending,40);assert.equal(d.merchants.length,1);assert.equal(d.months[1].Spending,70);assert.equal(d.months[1].Income,2000);assert.equal(d.months[1].Selected,40);assert.equal(d.daily.length,31);assert.equal(d.daily[1].Spending,-10);assert.equal(d.daily.at(-1).Cumulative,40);
});
test('override and chart preferences validate and round-trip in Markdown',()=>{
 const s=sample();s.budgetOverrides=[override()];s.chartPreferences=[{id:'merchants',visibility:'shown',position:'pinned'},{id:'daily',visibility:'hidden',position:'normal'}];assert.deepEqual(deserialize(serialize(s)),s);
 for(const bad of [{...override(),month:'2026-13'},{...override(),budget:-1},{...override(),category:'missing'}])assert.throws(()=>validate({...s,budgetOverrides:[bad]}));
 assert.throws(()=>validate({...s,budgetOverrides:[override(),override()]}));assert.throws(()=>validate({...s,chartPreferences:[{id:'unknown',visibility:'shown',position:'normal'}]}));
});
test('existing split vault migrates with records and notes preserved; overrides and pins survive reopen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'folio-analysis-'));try{const store=new Store(dir);await store.init();let r=await store.read();const s=sample();s.accounts=[{id:'bank',name:'Bank',type:'bank'}];s.transactions=[tx('a','2026-10-01',5000)];await store.save(s,r.revision);
 await rm(path.join(dir,'BudgetOverrides.md'));await rm(path.join(dir,'ChartPreferences.md'));await writeFile(path.join(dir,'Categories.md'),(await readFile(path.join(dir,'Categories.md'),'utf8'))+'\nKeep this note.\n');
 const upgrade=new Store(dir);await upgrade.init();r=await upgrade.read();assert.equal(r.state.transactions.length,1);assert.ok(r.files['Categories.md'].includes('Keep this note.'));assert.deepEqual(r.state.budgetOverrides,[]);
 const next={...r.state,budgetOverrides:[override()],chartPreferences:[{id:'daily',visibility:'hidden',position:'pinned'}]};await upgrade.save(next,r.revision);const reopened=new Store(dir);await reopened.init();assert.deepEqual((await reopened.read()).state,next);
 await rm(path.join(dir,'BudgetOverrides.md'));await assert.rejects(()=>reopened.read(),/Missing BudgetOverrides/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
