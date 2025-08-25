import "server-only";
import * as admin from 'firebase-admin';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

let adminDb: admin.firestore.Firestore;

export async function getAdminDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  if (!adminDb) {
    adminDb = admin.firestore();
  }

  return adminDb;
}
