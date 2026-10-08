import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClinicalInbox } from '../src/lib/clinicalInboxData.js';
import { summarizeClinicalInboxTasks } from '../src/lib/clinicalInboxSummary.js';

test('loads past 100 tasks and includes refill tasks from subsequent pages', async () => {
  const tasks=Array.from({length:125},(_,id)=>({id:String(id),category:id<110?'needs_prescription':'refill_review'}));
  const offsets=[];
  const data=await loadClinicalInbox(async url=>{
    const offset=Number(new URL(url,'https://qa.test').searchParams.get('offset'));
    offsets.push(offset);
    return {tasks:tasks.slice(offset,offset+100),has_more:offset+100<tasks.length,counts:{needs_prescription:110,refill_review:15}};
  },'/api','qa');
  assert.deepEqual(offsets,[0,100]);
  assert.equal(data.tasks.length,125);
  assert.equal(summarizeClinicalInboxTasks(data.tasks,data.counts).refillReview,15);
});
test('does not publish a partial snapshot when a later page fails', async () => {
  let calls=0;
  await assert.rejects(loadClinicalInbox(async()=>{
    if (++calls===2) throw Error('connection lost');
    return {tasks:[{id:'first'}],has_more:true,counts:{needs_prescription:125}};
  },'/api','qa'),/connection lost/);
});
test('uses complete server totals instead of the displayed page size',()=>{
  const summary=summarizeClinicalInboxTasks([{category:'needs_prescription'}],{needs_prescription:110,needs_outcome:8,purchase_review:5,purchase_intake:11,refill_review:15,truesight_question:99});
  assert.equal(summary.total,149);
  assert.equal(summary.needsPrescription,110);
  assert.equal(summary.needsOutcome,8);
  assert.equal(summary.purchaseReview,5);
  assert.equal(summary.purchaseIntake,11);
});
