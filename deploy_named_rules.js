import fs from 'fs';

async function deploy() {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');

  console.log(`Starting programmatic rule deployment for database: ${databaseId} on project: ${projectId}...`);

  let token;
  try {
    const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-account/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    if (!tokenResponse.ok) {
      throw new Error(`Failed to fetch metadata token: ${tokenResponse.statusText}`);
    }
    const tokenData = await tokenResponse.json();
    token = tokenData.access_token;
    console.log('Successfully retrieved GCP service account access token.');
  } catch (error) {
    console.error('Error getting GCP metadata token. We might not be in a GCP environment:', error.message);
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

    console.log('Creating ruleset...');
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

    console.log(`Successfully deployed ruleset to release ${releaseData.name}. Rules are now LIVE on ${databaseId}!`);
  } catch (error) {
    console.error('Error updating release:', error.message);
    process.exit(1);
  }
}

deploy().then(() => process.exit(0));
