const root=new URL('../../../../functions/lib/transport/',import.meta.url).href;
const {scanBinQr,recoverOperation}=await import(`${root}resident_sessions.js`);
const {submitInspection}=await import(`${root}resident_inspections.js`);
const {saveResidentPreferences,registerResidentDevice}=await import(`${root}resident_accounts.js`);
for(const [name,handler,payload] of [
  ['scanBinQr',scanBinQr,{qrPayload:'ecoloop://bin/audit'}],
  ['submitInspection',submitInspection,{sessionId:'audit-session',assetId:'audit-asset',assetVersion:'v1',expectedVersion:1}],
  ['recoverOperation',recoverOperation,{operationId:'audit-request-001'}],
  ['saveResidentPreferences',saveResidentPreferences,{preferences:{pointsCredits:true}}],
  ['registerResidentDevice',registerResidentDevice,{deviceId:'audit-device',platform:'web',token:'test-only'}],
]) {
  try {
    await handler.run({auth:{uid:'audit-user',token:{}},data:{schemaVersion:'backend.v1',requestId:'audit-request-001',operation:name,payload}});
    console.log(name,'UNEXPECTED_SUCCESS');
  } catch(error) { console.log(name,error.code,error.message); }
}
