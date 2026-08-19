/**
 * Expo'ya FCM V1 service account key yükler.
 * node scripts/upload-fcm-credentials.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT = '@ercanaslan/mystoneinn-mobile';
const KEY_FILE = path.join(__dirname, '..', 'fcm-service-account.json');

function loadSession() {
  const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
  if (!state?.auth?.sessionSecret) throw new Error('Expo oturumu yok');
  return state.auth.sessionSecret;
}

async function gql(session, query, variables = {}) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'expo-session': session },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function main() {
  const keyJson = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const session = loadSession();
  console.log('Firebase project:', keyJson.project_id);

  const app = await gql(
    session,
    `query($fullName: String!) {
      app {
        byFullName(fullName: $fullName) {
          id
          androidAppCredentials(filter: { legacyOnly: false }) {
            id
            applicationIdentifier
            googleServiceAccountKeyForFcmV1 {
              id
              projectIdentifier
              clientEmail
            }
          }
        }
      }
    }`,
    { fullName: PROJECT }
  );

  const androidCred = app.app.byFullName.androidAppCredentials?.[0];
  if (!androidCred) throw new Error('Android credentials yok');
  console.log('androidCred.id:', androidCred.id);

  if (androidCred.googleServiceAccountKeyForFcmV1?.projectIdentifier === keyJson.project_id) {
    console.log('FCM key zaten yüklü:', androidCred.googleServiceAccountKeyForFcmV1);
    return;
  }

  // En doğrudan yol: createFcmV1Credential(credential: String)
  const result = await gql(
    session,
    `mutation($androidAppCredentialsId: String!, $credential: String!) {
      androidAppCredentials {
        createFcmV1Credential(
          androidAppCredentialsId: $androidAppCredentialsId
          credential: $credential
        ) {
          id
          googleServiceAccountKeyForFcmV1 {
            id
            projectIdentifier
            clientEmail
          }
        }
      }
    }`,
    {
      androidAppCredentialsId: androidCred.id,
      credential: JSON.stringify(keyJson),
    }
  );

  console.log('SUCCESS:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
