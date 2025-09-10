import "server-only";
import * as admin from 'firebase-admin';
import { getFirebaseSecrets } from "./secrets";

let adminDb: admin.firestore.Firestore;

export async function getAdminDb() {
  if (!admin.apps.length) {
    const secrets = await getFirebaseSecrets();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: secrets.projectId,
        clientEmail: secrets.clientEmail,
        privateKey: secrets.privateKey,
      }),
    });
  }

  if (!adminDb) {
    adminDb = admin.firestore();
  }

  return adminDb;
}
