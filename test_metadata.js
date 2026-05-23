async function test() {
  const urls = [
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/',
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/aliases'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
      console.log(`URL: ${url}`);
      console.log(`Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`Content (truncated): ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.error(`URL: ${url} - Error:`, e.message);
    }
  }
}
test();
