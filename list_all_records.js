import fs from 'fs';

async function run() {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  
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
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/attendance?pageSize=100`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    console.log("Documents in /attendance:");
    if (data.documents) {
      console.log("Total received:", data.documents.length);
      data.documents.forEach(doc => {
        const fields = doc.fields;
        console.log({
          name: doc.name.split('/').pop(),
          empId: fields.empId?.stringValue,
          date: fields.date?.stringValue,
          status: fields.status?.stringValue,
          checkIn: fields.checkIn?.stringValue,
          timestamp: fields.timestamp?.stringValue,
        });
      });
    } else {
      console.log("No documents found:", data);
    }
  } catch(e) {
    console.log("Error querying Firestore REST API:", e);
  }
}
run();
