import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';

const projectId = 'demo-ecoloop';
const ownerId = 'resident-owner';
const otherResidentId = 'resident-other';

let testEnv: RulesTestEnvironment;
let ownerContext: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let otherContext: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let unauthenticatedContext: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;
let adminContext: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let ownerFirestore: ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore'] extends () => infer T ? T : never;
let otherFirestore: typeof ownerFirestore;
let unauthenticatedFirestore: typeof ownerFirestore;
let adminFirestore: typeof ownerFirestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFile('firestore.rules') },
    storage: { rules: readFile('storage.rules') },
  });
  ownerContext = testEnv.authenticatedContext(ownerId);
  otherContext = testEnv.authenticatedContext(otherResidentId);
  unauthenticatedContext = testEnv.unauthenticatedContext();
  adminContext = testEnv.authenticatedContext('operator', { admin: true });
  ownerFirestore = ownerContext.firestore();
  otherFirestore = otherContext.firestore();
  unauthenticatedFirestore = unauthenticatedContext.firestore();
  adminFirestore = adminContext.firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await firestore.doc(`residents/${ownerId}`).set({
      displayName: 'Owner',
      pointsBalance: 25,
    });
    await firestore.doc(`residents/${otherResidentId}`).set({
      displayName: 'Other',
      pointsBalance: 10,
    });
    await firestore.doc('deposits/batch-owner').set({
      ownerId,
      status: 'verified',
    });
    await firestore.doc('bins/bin-1').set({
      enabled: true,
      capacitySpc: 2000,
    });
    await firestore.doc('scanContent/default').set({
      id: 'default',
      scannerTitle: 'Scan a smart bin',
    });
    await context
      .storage()
      .ref('inspection-evidence/resident-owner/deposit-1/run-1/crop.png')
      .put(new Uint8Array([1, 2, 3]));
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore access boundaries', () => {
  it('allows an owner to read their profile and receipt data', async () => {
    await assertSucceeds(ownerFirestore.doc(`residents/${ownerId}`).get());
    await assertSucceeds(ownerFirestore.doc('deposits/batch-owner').get());
  });

  it('denies signed-out and cross-resident private reads', async () => {
    await assertFails(unauthenticatedFirestore.doc('bins/bin-1').get());
    await assertFails(otherFirestore.doc(`residents/${ownerId}`).get());
    await assertFails(otherFirestore.doc('deposits/batch-owner').get());
  });

  it('allows authenticated catalog reads but denies forged direct mutations', async () => {
    await assertSucceeds(ownerFirestore.doc('bins/bin-1').get());
    await assertSucceeds(ownerFirestore.doc('scanContent/default').get());
    await assertFails(unauthenticatedFirestore.doc('scanContent/default').get());
    await assertFails(
      ownerFirestore.doc(`residents/${ownerId}`).set({
        displayName: 'Forged',
        pointsBalance: 999999,
      }),
    );
    await assertFails(
      ownerFirestore.doc('deposits/batch-owner').set({
        ownerId,
        status: 'verified',
        pointsAwarded: 999999,
      }),
    );
  });

  it('allows admin operational reads without allowing resident writes', async () => {
    await assertSucceeds(adminFirestore.doc(`residents/${ownerId}`).get());
    await assertFails(
      adminFirestore.doc(`residents/${ownerId}`).set({
        displayName: 'Admin edited directly',
      }),
    );
  });
});

describe('Storage access boundaries', () => {
  it('allows an owner to read only their evidence and denies another resident', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .storage()
        .ref('inspection-evidence/resident-owner/deposit-1/run-1/crop.png')
        .put(new Uint8Array([1, 2, 3]));
    });

    const ownerStorage = ownerContext.storage();
    await assertSucceeds(ownerStorage.ref('inspection-evidence/resident-owner/deposit-1/run-1/crop.png').getDownloadURL());
    const otherStorage = otherContext.storage();
    await assertFails(
      otherStorage.ref('inspection-evidence/resident-owner/deposit-1/run-1/crop.png').getDownloadURL(),
    );
    await assertFails(
      otherStorage.ref('inspection-evidence/resident-owner/deposit-1/run-1/forged.png').put(new Uint8Array([4])),
    );
  });
});

function readFile(path: string): string {
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}
