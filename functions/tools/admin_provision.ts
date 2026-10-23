import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type Environment = "emulator" | "live";

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  })
);

const environment = (args.get("environment") ?? "emulator") as Environment;
const projectId = args.get("project") ?? (environment === "emulator" ? "demo-ecoloop" : "ecoloop-thesmartrecycling");
const databaseId = args.get("database") ?? "ecoloop-db";
const action = args.get("action") ?? "provision";
const email = args.get("email");
const password = args.get("password");
const displayName = args.get("displayName") ?? "EcoLoop Admin";

if (environment !== "emulator" && environment !== "live") {
  throw new Error("--environment must be emulator or live");
}

if (!email) {
  throw new Error("--email is required");
}
const adminEmail: string = email;

if (environment === "emulator") {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
}

process.env.GCLOUD_PROJECT = projectId;
if (getApps().length === 0) {
  initializeApp({ projectId });
}

const auth = getAuth();
const firestore = getFirestore(databaseId);

async function run() {
  console.log(`[admin_provision] Environment: ${environment}, Project: ${projectId}, Database: ${databaseId}, Action: ${action}`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(adminEmail);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "auth/user-not-found") {
      if (action !== "provision") {
        throw new Error(`Cannot perform ${action}: user ${adminEmail} not found.`);
      }
      if (!password) {
        throw new Error(`User does not exist. --password is required to create a new user.`);
      }
      userRecord = await auth.createUser({
        email: adminEmail,
        password,
        displayName,
      });
      console.log(`Created new Auth user: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  const uid = userRecord.uid;
  const adminDocRef = firestore.doc(`adminAccounts/${uid}`);

  if (action === "provision") {
    const existingClaims = userRecord.customClaims ?? {};
    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      role: "admin",
    });

    await adminDocRef.set(
      {
        uid,
        email: adminEmail,
        displayName: userRecord.displayName ?? displayName,
        role: "admin",
        enabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Successfully provisioned admin:`);
    console.log(`  UID: ${uid}`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: admin`);
    console.log(`  Enabled: true`);
    console.log(`  Document: adminAccounts/${uid} in ${databaseId}`);
  } else if (action === "disable") {
    await adminDocRef.set(
      {
        enabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Successfully disabled admin account ${uid}`);
  } else if (action === "enable") {
    await adminDocRef.set(
      {
        enabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Successfully re-enabled admin account ${uid}`);
  } else if (action === "revoke") {
    const claims = { ...(userRecord.customClaims ?? {}) };
    delete claims.role;
    delete claims.admin;
    await auth.setCustomUserClaims(uid, claims);
    await adminDocRef.set(
      {
        enabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Successfully revoked admin privileges from ${uid}`);
  } else if (action === "check") {
    const docSnap = await adminDocRef.get();
    console.log(`Admin account diagnostic:`);
    console.log(`  Auth UID: ${uid}`);
    console.log(`  Auth Claims: ${JSON.stringify(userRecord.customClaims)}`);
    console.log(`  Firestore Doc Exists: ${docSnap.exists}`);
    if (docSnap.exists) {
      console.log(`  Firestore Doc Data: ${JSON.stringify(docSnap.data())}`);
    }
  }
}

await run();
