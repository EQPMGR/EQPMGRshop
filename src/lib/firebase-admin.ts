
import "server-only";
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseSecrets } from "./secrets";

// Initialize Firebase Admin SDK
let app: App;

async function initializeAdminApp() {
  if (!getApps().length) {
    const secrets = await getFirebaseSecrets();
    app = initializeApp({
      credential: cert(secrets),
    });
  }
}

// We call this function to ensure the app is initialized before we export the db
initializeAdminApp();

// Export the initialized Firestore instance
const adminDb = getFirestore(app);

export { adminDb };
