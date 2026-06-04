import fs from 'fs';

async function enableApi() {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const projectId = firebaseConfig.projectId;
  const serviceName = 'firebaserules.googleapis.com';

  console.log(`Attempting to enable ${serviceName} on project: ${projectId}...`);

  let token;
  try {
    const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    if (!tokenResponse.ok) {
      throw new Error(`Failed to fetch metadata token: ${tokenResponse.statusText}`);
    }
    const tokenData = await tokenResponse.json();
    token = tokenData.access_token;
  } catch (error) {
    console.error('Error getting GCP metadata token:', error.message);
    process.exit(1);
  }

  try {
    // We can use Service Usage API to enable the service
    const url = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${serviceName}:enable`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Enable API Error Response:', JSON.stringify(data, null, 2));
      throw new Error(`Failed to enable API: ${response.statusText}`);
    }

    console.log(`API Enable request initiated successfully:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error enabling API:', error.message);
    process.exit(1);
  }
}

enableApi().then(() => process.exit(0));
