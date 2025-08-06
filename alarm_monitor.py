from telethon import TelegramClient, events
import firebase_admin
from firebase_admin import credentials, db
import re
from datetime import datetime, timezone, timedelta

# --- Telegram Config ---
api_id = 20801702
api_hash = 'ab8e072323be623961c22fa7ca42093a' # ตรวจสอบให้แน่ใจว่าเป็น api_hash ที่ถูกต้องของคุณ
session_name = 'alarm_session'
group_chat_id = -1002771373578 # **สำคัญ:** เปลี่ยนเป็น Group ID ที่ถูกต้องของคุณ

# --- Firebase Config ---
# ตรวจสอบให้แน่ใจว่าไฟล์ service account key อยู่ในไดเรกทอรีเดียวกันกับสคริปต์ Python นี้
cred = credentials.Certificate('login-mnoc-700-mhz-firebase-adminsdk-fbsvc-441f91667b.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app'
})
# Path ใน Firebase ที่เก็บข้อมูลสถานะ EnodeB
firebase_enodeb_alarms_ref = db.reference('/enodeb_alarms')

# --- Helper Function: สำหรับแยกวิเคราะห์ข้อมูลจากข้อความ Telegram ---
def parse_alarm_data(message_text):
    enodeb_id = None
    status_raw = None
    alarm_occurred = None
    alarm_cleared = None

    # ดึง EnodeB ID
    m = re.search(r"eNodeB ID\s*:\s*(\d+)", message_text)
    if m:
        enodeb_id = m.group(1)

    # ดึง Status (Uncleared หรือ Cleared)
    m2 = re.search(r"Status\s*:\s*(\w+)", message_text)
    if m2:
        status_raw = m2.group(1).strip().upper()

    # แปลง Status เป็น DOWN / NORMAL
    status = "DOWN" if status_raw == "UNCLEARED" else "NORMAL"

    # เวลาไทย (UTC+7)
    tz = timezone(timedelta(hours=7))

    # ดึงเวลา Alarm Occurred
    m3 = re.search(r"Alarm Occurred\s*:\s*([\d\-]+\s[\d:]+)", message_text)
    if m3:
        alarm_occurred = datetime.strptime(m3.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz).isoformat()

    # ดึงเวลา Alarm Cleared (อาจไม่มี)
    m4 = re.search(r"Alarm Cleared\s*:\s*([\d\-]+\s[\d:]+)", message_text)
    if m4:
        alarm_cleared = datetime.strptime(m4.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz).isoformat()
    else:
        alarm_cleared = "" # ตั้งเป็นสตริงว่างถ้าไม่มีข้อมูล

    return enodeb_id, status, alarm_occurred, alarm_cleared

# --- Telegram Handler: ตรวจจับข้อความใหม่ในกลุ่ม ---
client = TelegramClient(session_name, api_id, api_hash)

@client.on(events.NewMessage(chats=group_chat_id))
async def alarm_handler(event):
    text = event.raw_text
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📩 New Message:\n{text}")

    # ตรวจสอบว่าเป็นข้อความแจ้งเตือนที่เกี่ยวข้องหรือไม่
    if 'Alarm Name' in text and 'eNodeB ID' in text:
        enodeb_id, new_status, occurred, cleared = parse_alarm_data(text)

        if enodeb_id:
            # ดึงสถานะปัจจุบันของ EnodeB ID นี้จาก Firebase
            current_data = firebase_enodeb_alarms_ref.child(enodeb_id).get()
            current_status = current_data.get('status') if current_data else None

            # เตรียมข้อมูลที่จะอัปเดต
            data_to_update = {
                'status': new_status,
                'alarm_occurred': occurred,
                'alarm_cleared': cleared,
                'last_update': datetime.now(timezone(timedelta(hours=7))).isoformat()
            }

            # **สำคัญ:** อัปเดต Firebase ก็ต่อเมื่อสถานะมีการเปลี่ยนแปลงเท่านั้น
            if new_status != current_status:
                firebase_enodeb_alarms_ref.child(enodeb_id).set(data_to_update)
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ✅ Status changed! Updated Firebase for EnodeB {enodeb_id} to {new_status}")
            else:
                # ถ้าสถานะไม่เปลี่ยน แต่อาจต้องการอัปเดตแค่ last_update เพื่อบอกว่ามีการรับข้อความล่าสุดแล้ว
                # การ 'update' จะไม่ทริกเกอร์ onValue ใน frontend ถ้าค่าอื่นๆ ไม่เปลี่ยน
                # แต่ถ้า last_update เปลี่ยน onValue ก็จะทริกเกอร์อยู่ดี
                # ถ้าต้องการลดการรีเฟรชให้ถึงที่สุด ไม่ควร update อะไรเลยถ้า status ไม่เปลี่ยน
                # อย่างไรก็ตาม ในตัวอย่างนี้ ผมเลือกที่จะ update last_update เสมอเพื่อให้มีข้อมูลการรับข้อความ
                firebase_enodeb_alarms_ref.child(enodeb_id).update({'last_update': data_to_update['last_update']})
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ℹ️ Status for EnodeB {enodeb_id} is still {new_status}. Only last_update was refreshed.")
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ⚠️ Could not parse EnodeB ID from message.")
    else:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ➡️ Message not an alarm, skipping.")

# --- Run the Telegram Client ---
client.start()
print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚀 Listening for alarms...")
client.run_until_disconnected()