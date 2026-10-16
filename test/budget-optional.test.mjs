import test from 'node:test';
import assert from 'node:assert/strict';
import {updateBudgets} from '../public/budgets.js';
import {emptyState,validate,serialize,deserialize} from '../lib/store.mjs';
import {categoryIds,plannedBudget,rememberCategory,applyMerchantLearning} from '../public/money-model.js';
import {summarize} from '../public/core.js';
const tx=(kind,category='',account='')=>({id:kind,date:'2026-10-15',description:'Test',amount:1000,kind,category,account,review:false,source:'reviewed'});
test('optional account/category round trip for income refunds transfers; expense and invalid references rejected',()=>{
 const s=emptyState();s.transactions=['income','refund','transfer'].map(k=>tx(k));validate(s);
 const restored=deserialize(serialize(s));assert.ok(restored.transactions.every(t=>t.account===''&&t.category===''));
 const totals=summarize(restored,'2026-10-01','2026-10-31');assert.equal(totals.income,1000);assert.equal(totals.spending,-1000);assert.equal(totals.categories.reduce((n,c)=>n+c.spent,0),0);
 for(const t of [tx('expense'),tx('income','missing'),tx('refund','','missing')])assert.throws(()=>validate({...s,transactions:[t]}));
 assert.equal(rememberCategory(s,tx('refund')).merchantRules.length,0);
});
test('bulk budget creator changes only selected rows and avoids double counting combined targets',()=>{
 const s=emptyState();s.categories.push({id:'coffee',name:'Coffee',parentId:'dining',budget:0,budgetScope:'separate',color:'#123456'});
 const next=updateBudgets(s.categories,['dining','coffee'],{dining:'200.25',coffee:'50'},{dining:'combined'});
 assert.equal(plannedBudget(next),20025);assert.deepEqual(next.find(c=>c.id==='housing'),s.categories.find(c=>c.id==='housing'));
 const separate=updateBudgets(next,['dining'],{dining:'200.25'},{dining:'separate'});assert.equal(plannedBudget(separate),25025);
 const cleared=updateBudgets(next,['dining'],{dining:''},{});assert.equal(plannedBudget(cleared),5000);
 assert.throws(()=>updateBudgets(next,[],{},{}));assert.throws(()=>updateBudgets(next,['dining'],{dining:'-1'},{}));assert.throws(()=>updateBudgets(next,['dining'],{dining:'oops'},{}));
});
test('approved merchant alias fills categories for manual entry and reviewing uncategorized transactions',()=>{
 const s=rememberCategory(emptyState(),{...tx('expense','dining'),description:'COFFEE TERMINAL 1234',merchant:'Neighbourhood Coffee'});
 const result=applyMerchantLearning([{...tx('expense','uncategorized'),description:'Neighbourhood Coffee'}],s)[0];assert.equal(result.category,'dining');
 const corrected=applyMerchantLearning([{...tx('expense','uncategorized'),description:'Other bank description',merchant:'Neighbourhood Coffee'}],s)[0];assert.equal(corrected.category,'dining');
 assert.equal(applyMerchantLearning([{...tx('expense','groceries'),merchant:'Neighbourhood Coffee'}],s)[0].category,'groceries');
 assert.equal(applyMerchantLearning([{...tx('refund'),merchant:'Neighbourhood Coffee'}],s)[0].category,'');
});

test('no-category filter matches only empty category, not all root categories',()=>assert.deepEqual(categoryIds(emptyState().categories,''),['']));
