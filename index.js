const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const fs = require('fs');

const serviceAccount = require('./login-mnoc-700-mhz-firebase-adminsdk-fbsvc-bfbd0dd4b5.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const data = req.body;
  console.log('📦 Received from Python:', data);

  const ref = db.ref('alarms');
  ref.push(data, (err) => {
    if (err) {
      console.error('❌ Failed to write to Firebase:', err);
      res.status(500).send('Firebase write failed');
    } else {
      console.log('✅ Saved to Firebase!');
      res.status(200).send('OK');
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Webhook listening on http://localhost:${port}`);
});
