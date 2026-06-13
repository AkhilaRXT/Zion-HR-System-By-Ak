async function fetchRealProjectId() {
  try {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    if (!res.ok) {
      throw new Error(`Cloud metadata response error: ${res.statusText}`);
    }
    const projectId = await res.text();
    console.log("REAL PROJECT ID FROM METADATA SERVER:", projectId);
  } catch (err: any) {
    console.error("Failed to fetch real project ID:", err.message);
  }
}

fetchRealProjectId();
