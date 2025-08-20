// upload_sites.js (ES Module syntax)
import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("login-mnoc-700-mhz-firebase-adminsdk-fbsvc-2250001f62.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

const data = JSON.parse(fs.readFileSync("./awn_sites_with_enodeb.geojson", "utf8"));


async function uploadData() {
  for (const site of data.features) {
    const siteId = site.properties["AWN Site Code"];
    await db.ref(`geojson_sites/${siteId}`).set({
      awn_site_code: site.properties["AWN Site Code"],
      district: site.properties["District"],
      province: site.properties["Province"],
      region: site.properties["Region"],
      subdistrict: site.properties["Subdistrict"],
      lat: site.geometry.coordinates[1],
      long: site.geometry.coordinates[0],
      google_maps_url: `https://www.google.com/maps?q=${site.geometry.coordinates[1]},${site.geometry.coordinates[0]}`,
      status: "On Service"
    });
    console.log(`Uploaded ${siteId}`);
  }
  console.log("Upload complete");
  process.exit(0);
}

uploadData();
