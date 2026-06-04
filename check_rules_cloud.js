import fs from 'fs';

async function run() {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const projectId = firebaseConfig.projectId;
  
  let token;
  try {
    const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    const tokenData = await tokenResponse.json();
    token = tokenData.access_token;
  } catch (error) {
    console.error('Error getting GCP metadata token', error.message);
    process.exit(1);
  }

  try {
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`;
    const releaseResponse = await fetch(releaseUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const releaseData = await releaseResponse.json();
    console.log(JSON.stringify(releaseData, null, 2));

    if (releaseData.releases && releaseData.releases.length > 0) {
      const dbRelease = releaseData.releases.find(r => r.name.includes(firebaseConfig.firestoreDatabaseId));
      if (dbRelease) {
        console.log("Found release for DB:", dbRelease.name);
        console.log("Ruleset name:", dbRelease.rulesetName);
        
        const rulesetUrl = `https://firebaserules.googleapis.com/v1/${dbRelease.rulesetName}`;
        const rulesetResponse = await fetch(rulesetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rulesetData = await rulesetResponse.json();
        console.log(JSON.stringify(rulesetData, null, 2));
      } else {
        console.log("No release found for this db");
      }
    }
  } catch(e) {
    console.log(e);
  }
}
run();
