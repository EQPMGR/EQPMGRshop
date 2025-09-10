import 'server-only';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Note: This assumes you are running in a GCP environment (like Cloud Run)
// with appropriate service account permissions to access Secret Manager.
// For local development, you need to be authenticated via `gcloud auth application-default login`.
const client = new SecretManagerServiceClient();

async function accessSecretVersion(secretName: string): Promise<string> {
  // This is a placeholder for your GCP Project ID.
  // In a real production setup, you would have this in an environment variable.
  const projectId = process.env.FIREBASE_PROJECT_ID || 'eqpmgr-test';
  
  if (!projectId) {
      throw new Error("GCP Project ID is not defined. Cannot access secrets.");
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
    // In a production app, you might have more robust error handling or a fallback.
    throw new Error(`Could not access secret ${secretName}. Ensure it exists and the service has permissions.`);
  }
}


export async function getFirebaseSecrets() {
    const [privateKey, clientEmail, projectId] = await Promise.all([
      accessSecretVersion('FIREBASE_PRIVATE_KEY'),
      accessSecretVersion('FIREBASE_CLIENT_EMAIL'),
      accessSecretVersion('FIREBASE_PROJECT_ID')
    ]);
  
    // The private key from Secret Manager needs to have newlines restored.
    return {
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
      projectId,
    };
}


export async function getGeminiApiKey() {
    return accessSecretVersion('GEMINI_API_KEY');
}
