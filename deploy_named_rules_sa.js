import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

async function deploy() {
  const saKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saKeyJson) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    process.exit(1);
  }

  const saKey = JSON.parse(saKeyJson);
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');

  console.log(`Deploying rules to database: ${databaseId} on project: ${projectId} using custom Service Account...`);

  let token;
  try {
    const auth = new GoogleAuth({
      credentials: saKey,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const tokenObj = await client.getAccessToken();
    token = tokenObj.token;
    console.log("Successfully retrieved access token for project service account.");
  } catch (error) {
    console.error("Failed to authenticate service account:", error.message);
    process.exit(1);
  }

  // 1. Create Ruleset
  let rulesetName;
  try {
    const rulesetUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
    const rulesetPayload = {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent
          }
        ]
      }
    };

    console.log("Creating core ruleset...");
    const rulesetResponse = await fetch(rulesetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rulesetPayload)
    });

    const rulesetData = await rulesetResponse.json();
    if (!rulesetResponse.ok) {
      console.error('Create Ruleset Error Response:', JSON.stringify(rulesetData, null, 2));
      throw new Error(`Failed to create ruleset: ${rulesetResponse.statusText}`);
    }

    rulesetName = rulesetData.name;
    console.log(`Successfully created ruleset: ${rulesetName}`);
  } catch (error) {
    console.error('Error creating ruleset:', error.message);
    process.exit(1);
  }

  // 2. Update Release for named database
  try {
    const releaseId = `cloud.firestore%2F${databaseId}`;
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${releaseId}`;
    const releasePayload = {
      release: {
        name: `projects/${projectId}/releases/cloud.firestore/${databaseId}`,
        rulesetName: rulesetName
      }
    };

    console.log(`Updating release cloud.firestore/${databaseId}...`);
    const releaseResponse = await fetch(releaseUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(releasePayload)
    });

    const releaseData = await releaseResponse.json();
    if (!releaseResponse.ok) {
      console.error('Update Release Error Response:', JSON.stringify(releaseData, null, 2));
      throw new Error(`Failed to update release: ${releaseResponse.statusText}`);
    }

    console.log(`\n🎉 SUCCESS! Firestore rules have been deployed to database '${databaseId}' in project '${projectId}'!`);
  } catch (error) {
    console.error('Error updating release:', error.message);
    process.exit(1);
  }
}

deploy().then(() => process.exit(0));
