import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const require = createRequire(`${root}/functions/package.json`);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { FirestoreSettlementStore } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/firestore/settlement_store.js`));
const { FirestoreMaintenanceStore } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/firestore/maintenance_store.js`));
const { FirestoreJobsStore } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/firestore/jobs_store.js`));
const { FirestoreSessionsStore } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/firestore/sessions_store.js`));
const { FirestoreAccountsStore } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/firestore/accounts_store.js`));
const { bootstrapAccount } = await import(pathToFileURL(`${root}/functions/lib/application/accounts.js`));
const { createTaskRequest } = await import(pathToFileURL(`${root}/functions/lib/infrastructure/cloud_tasks.js`));
const { calculateFinalization, initialPolicy } = await import(pathToFileURL(`${root}/functions/lib/domain/policy.js`));
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required');
const app = initializeApp({ projectId: 'demo-ecoloop' }, 'ultimate-audit');
const db = getFirestore(app);
const settlement = new FirestoreSettlementStore(db);
const maintenance = new FirestoreMaintenanceStore(db);
const worker = { subject: 'worker-service', issuer: 'trusted-issuer' };
const now = '2026-10-20T01:00:00.000Z';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,32);
const findings = (id, classes, inventoryState = 'resolved') => ({schemaVersion:'backend.v1',source:'worker',jobId:id,attemptId:`${id}-attempt`,image:{assetId:'asset-audit',assetVersion:'v1',contentSha256:'a'.repeat(64),width:100,height:100},inventoryState,findings:classes.map((resolution,i)=>({objectId:`object-${i}`,resolution,eligibility:resolution === 'unknown'?'unresolved':resolution === 'cardboard_item'?'excluded':'eligible',box:null,evidence:{modelIds:['A'],rawLabel:resolution},confidence:0.9}))});
async function fixture(id) {
  const batchId=`${id}-batch`, sessionId=`${id}-session`, uid=`${id}-owner`, binId=`${id}-bin`;
  const documents = {
    [`inferenceJobs/${id}`]: { id,batchId,sessionId,ownerId:uid,state:'running',activeAttemptId:`${id}-attempt`,activeLeaseExpiresAt:'2026-10-20T01:01:30.000Z',attemptCount:1,deadlineAt:'2026-10-20T01:05:00.000Z',traceId:'a'.repeat(32),workerSubject:worker.subject,workerIssuer:worker.issuer,source:{assetId:'asset-audit',assetVersion:'v1',contentSha256:'a'.repeat(64)},policyVersion:'policy-v1',cycleId:`${id}-cycle` },
    [`inferenceJobs/${id}/attempts/${id}-attempt`]:{id:`${id}-attempt`,state:'claimed',leaseExpiresAt:'2026-10-20T01:01:30.000Z'},
    [`deposits/${batchId}`]:{id:batchId,ownerId:uid,sessionId,binId,cycleId:`${id}-cycle`,policyVersion:'policy-v1',status:'processing',decisionVersion:0,spaceContributionSpc:0},
    [`depositResults/result-${hash(batchId)}`]:{id:`result-${hash(batchId)}`,ownerId:uid,sessionId,batchId,outcome:'processing',decisionVersion:0},
    [`depositSessions/${sessionId}`]:{id:sessionId,ownerId:uid,binId,stage:'processing',version:3},
    [`binOperations/${binId}`]:{binId,ownerId:uid,sessionId,phase:'processing'},
    [`bins/${binId}`]:{id:binId,cycleId:`${id}-cycle`,capacitySpc:100,occupiedSpc:10},
    [`binCycles/${id}-cycle`]:{id:`${id}-cycle`,binId,openingOccupiedSpc:10},
    [`residents/${uid}`]:{activeSessionId:sessionId},
    [`residents/${uid}/wallet/current`]:{residentId:uid,balance:0,version:0},
    [`residents/${uid}/stats/current`]:{residentId:uid,verifiedBatchCount:0,acceptedItemCount:0},
    'policies/policy-v1':initialPolicy(),
  };
  const batch=db.batch(); for(const [path,data] of Object.entries(documents)) batch.set(db.doc(path),data); await batch.commit();
  return {batchId,sessionId,uid,binId};
}
const report={};
try {
  const id='audit-normal', f=await fixture(id);
  report.normal=await settlement.finalizeInspection({jobId:id,attemptId:`${id}-attempt`,identity:worker,findings:findings(id,['plastic_bottle','plastic_bottle','aluminium_can','aluminium_can','aluminium_can','paper_bag','cardboard_item']),artifactReferences:[`vision-artifacts/${id}/${id}-attempt/findings.json`],expectedDecisionVersion:0,now});
  report.normal.bin=(await db.doc(`bins/${f.binId}`).get()).data();
  report.normal.stats=(await db.doc(`residents/${f.uid}/stats/current`).get()).data();
  report.normal.attempt=(await db.doc(`inferenceJobs/${id}/attempts/${id}-attempt`).get()).data();
  const reviewId='audit-review', r=await fixture(reviewId);
  await settlement.finalizeInspection({jobId:reviewId,attemptId:`${reviewId}-attempt`,identity:worker,findings:findings(reviewId,['plastic_bottle','plastic_bottle','unknown']),artifactReferences:[`vision-artifacts/${reviewId}/${reviewId}-attempt/findings.json`],expectedDecisionVersion:0,now});
  report.review=await settlement.resolveReview({batchId:r.batchId,decisionVersion:1,findings:findings(reviewId,['plastic_bottle','plastic_bottle','paper_bag']),now,actorId:'audit-operator'});
  report.review.bin=(await db.doc(`bins/${r.binId}`).get()).data();
  report.review.stats=(await db.doc(`residents/${r.uid}/stats/current`).get()).data();
  report.review.notificationV2Exists=(await db.doc(`notificationEvents/${r.batchId}-2`).get()).exists;
  const expiredId='audit-expired', e=await fixture(expiredId);
  await settlement.finalizeExpiredJob({jobId:expiredId,now:'2026-10-20T01:06:00.000Z',reason:'processing_deadline_elapsed'});
  report.expired={result:(await db.doc(`depositResults/result-${hash(e.batchId)}`).get()).data(),session:(await db.doc(`depositSessions/${e.sessionId}`).get()).data(),reservation:(await db.doc(`binOperations/${e.binId}`).get()).data(),resident:(await db.doc(`residents/${e.uid}`).get()).data(),capacityExists:(await db.doc(`capacityEntries/${e.batchId}-initial`).get()).exists};
  const failedId='audit-failed', ff=await fixture(failedId);
  await db.doc(`inferenceJobs/${failedId}`).update({attemptCount:3});
  await new FirestoreJobsStore(db).fail(failedId,`${failedId}-attempt`,worker,'provider_failed',now);
  await maintenance.reconcileJobs('2026-10-20T01:06:00.000Z',100,settlement);
  report.failedAfterReconcile={job:(await db.doc(`inferenceJobs/${failedId}`).get()).data().state,batch:(await db.doc(`deposits/${ff.batchId}`).get()).data().status};
  const claims=[];
  const auth={getUser:async()=>({customClaims:{}}),setCustomUserClaims:async(...args)=>{claims.push(args)}};
  const accounts=new FirestoreAccountsStore(db,auth);
  const account=await bootstrapAccount(accounts,{uid:'audit-bootstrap',claims:{},displayName:'Trusted',email:'trusted@example.invalid',avatarUrl:null},'audit-bootstrap-0001',{email:'forged@example.invalid'},now);
  report.bootstrap={profile:account.profile,claimWrites:claims.length,topLevelWalletExists:(await db.doc('wallets/audit-bootstrap').get()).exists};
  const paused='audit-paused';
  await db.doc('bins/audit-paused-bin').set({id:'audit-paused-bin',capacitySpc:100,occupiedSpc:0,enabled:true,isOnline:true,cycleId:'paused-cycle'});
  await db.doc('binQrMappings/audit-paused-bin').set({binId:'audit-paused-bin',enabled:true});
  await db.doc('processingAvailability/global').set({enabled:false,status:'paused'});
  report.scanWhilePaused=(await new FirestoreSessionsStore(db).scanBinQr({uid:paused,requestId:'audit-paused-request'},'ecoloop://bin/audit-paused-bin',now)).session.stage;
  const task=createTaskRequest({projectId:'demo-ecoloop',region:'asia-southeast1',queueName:'vision-processing',workerServiceUrl:'https://example.invalid',taskInvokerServiceAccount:'task@example.invalid',audience:'https://example.invalid',dispatchDeadlineSeconds:30},'queue','task',{id:'job-audit',traceId:'a'.repeat(32)});
  report.taskUrl=task.task.httpRequest.url;
  report.emptyWithVisibleFinding=calculateFinalization(initialPolicy(),'empty',findings('id',['plastic_bottle']).findings);
  report.duplicateObjectId=calculateFinalization(initialPolicy(),'resolved',[findings('id',['plastic_bottle']).findings[0],findings('id',['plastic_bottle']).findings[0]]);
  console.log(JSON.stringify(report,null,2));
} finally { await deleteApp(app); }
