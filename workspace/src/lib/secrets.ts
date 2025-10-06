import 'server-only';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// NOTE: When running on App Hosting, environment variables defined in 
// apphosting.yaml are automatically available. This service client
// will automatically use the project's service account.
// For local development, you need to be authenticated via `gcloud auth application-default login`.
const client = new SecretManagerServiceClient();

async function accessSecretVersion(secretName: string): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'eqpmgr-test';
  
  if (!projectId) {
      throw new Error("GCP Project ID (FIREBASE_PROJECT_ID) is not defined. Ensure it's set in your environment or apphosting.yaml.");
  }

  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload.`);
    }
    return payload;
  } catch (error) {
    console.error(`Failed to access secret: ${secretName}`, error);
    throw new Error(`Could not access secret ${secretName}. Ensure it exists and the service has permissions.`);
  }
}


export async function getFirebaseSecrets() {
    // These are now fetched from runtime environment variables, not directly from Secret Manager API
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'eqpmgr-test';

    if (!privateKey || !clientEmail || !projectId) {
        throw new Error("One or more Firebase Admin secrets are missing from the environment.");
    }
  
    // The private key from the environment variable needs to have newlines restored.
    return {
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
      projectId,
    };
}


export async function getGeminiApiKey() {
    return process.env.GEMINI_API_KEY!;
}

export async function getStripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY!;
}

export async function getStripePriceId() {
    return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;
}
