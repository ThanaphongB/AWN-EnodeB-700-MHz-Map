import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';

const app = express();
const port = 3000;

// Middleware เพื่ออ่าน JSON จาก Webhook
app.use(bodyParser.json());

// รับ Webhook ที่ path /webhook
app.post('/webhook', (req, res) => {
  const data = req.body;

  // แสดงใน console
  console.log('Webhook Received:', data);

  // เขียนลงไฟล์
  fs.appendFile('webhook_logs.txt', JSON.stringify(data) + '\n', err => {
    if (err) {
      console.error('Error writing file', err);
      return res.status(500).send('Error');
    }
    res.status(200).send('Received');
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
