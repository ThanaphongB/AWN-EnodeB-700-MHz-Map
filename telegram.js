const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('./login-mnoc-700-mhz-firebase-adminsdk-fbsvc-bfbd0dd4b5.json');

// === 🔐 ตั้งค่า Firebase Admin ===
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();
const token = '8490280302:AAHjm6KmkgDY9YXS5YaS8UhciB4vUulCJyc'; // 🔐 Token ของบอทคุณ

// === ✅ ฟังก์ชันลบ Webhook แล้วเริ่มบอท ===
async function startBot() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/deleteWebhook`);
    console.log("✅ Webhook deleted:", response.data);

    const bot = new TelegramBot(token, { polling: true });
    console.log("🤖 Telegram Bot is running and listening...");

    // === 📥 รับข้อความจาก Telegram ===
    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      console.log(`[${new Date().toLocaleString()}] 📨 [Message from ${chatId}]: ${text}`);

      // ✅ รูปแบบข้อความที่รองรับ
      const patterns = [
        /(?:EnodeB|eNodeB|Site)?\s*(\d{5,6})\s*(?:is|status:|->)?\s*(DOWN|UP|Normal)/i,
        /⛔\s*EnodeB\s*(\d{5,6})\s*is\s*DOWN/i,
        /✅\s*EnodeB\s*(\d{5,6})\s*is\s*UP/i
      ];

      let matched = false;

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          matched = true;

          const enodebId = match[1];
          const rawStatus = match[2]?.toUpperCase() || 'UNKNOWN';
          const status = (rawStatus === 'DOWN') ? 'DOWN' : 'UP';

          const data = {
            status: status,
            updated: Date.now()
          };

          db.ref("enodeb_alarms/" + enodebId).set(data)
            .then(() => {
              console.log(`📡 Saved to Firebase: EnodeB ${enodebId} => ${status}`);
              bot.sendMessage(chatId, `📡 EnodeB ${enodebId} ถูกตั้งค่าเป็น "${status}" แล้ว`);
            })
            .catch((err) => {
              console.error('❌ Firebase write error:', err);
              bot.sendMessage(chatId, "⚠️ เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Firebase");
            });

          break;
        }
      }

      if (!matched) {
        console.log("❌ ไม่พบรูปแบบข้อความที่รองรับ");
        bot.sendMessage(chatId,
          "❌ กรุณาส่งข้อความในรูปแบบ:\nEnodeB <ID> is UP หรือ DOWN\n\nตัวอย่าง:\n• EnodeB 123456 is DOWN\n• ⛔ EnodeB 123456 is DOWN\n• ✅ EnodeB 123456 is UP"
        );
      }
    });

  } catch (error) {
    console.error("❌ ไม่สามารถลบ Webhook ได้:", error.message);
  }
}

startBot();
