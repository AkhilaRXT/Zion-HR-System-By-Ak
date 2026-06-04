import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const storage = getStorage(app);

async function test() {
  try {
    const r = ref(storage, "test.txt");
    await uploadString(r, "Hello Storage");
    console.log("Success:", await getDownloadURL(r));
    process.exit(0);
  } catch(e) {
    console.error("Storage error:", e);
    process.exit(1);
  }
}
test();
