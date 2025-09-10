
import "server-only";
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseSecrets } from "./secrets";

let app: App;

if (!getApps().length) {
  // We can't use top-level await, so we can't call getFirebaseSecrets here directly.
  // We will initialize on first use of the database instance instead.
}

let adminDb: ReturnType<typeof getFirestore>;

async function getDb() {
    if (!adminDb) {
        if (!getApps().length) {
            const secrets = await getFirebaseSecrets();
            app = initializeApp({
                credential: cert(secrets),
            });
        }
        adminDb = getFirestore(getApps()[0]);
    }
    return adminDb;
}

// We export a getter function now to handle the async initialization
export { getDb as adminDb };
