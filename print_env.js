const keys = Object.keys(process.env).filter(k => 
  k.toLowerCase().includes('firebase') || 
  k.toLowerCase().includes('google') || 
  k.toLowerCase().includes('token') || 
  k.toLowerCase().includes('key') || 
  k.toLowerCase().includes('auth') || 
  k.toLowerCase().includes('project') || 
  k.toLowerCase().includes('gcp')
);
console.log("Filtered Env Keys:", keys);
for (const k of keys) {
  console.log(`${k} exists:`, !!process.env[k]);
}
