from telethon import TelegramClient, events
import firebase_admin
from firebase_admin import credentials, db
import re
from datetime import datetime, timezone, timedelta

# ---------- Telegram Config ----------
api_id = 20801702
api_hash = 'ab8e072323be623961c22fa7ca42093a'
session_name = 'alarm_session'
group_chat_id = -1002771373578

# ---------- Firebase Config ----------
cred = credentials.Certificate('login-mnoc-700-mhz-firebase-adminsdk-fbsvc-bfbd0dd4b5.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app'
})
firebase_ref = db.reference('/enodeb_alarms')

# ---------- Helper Function ----------
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

    # เวลาไทย
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
        alarm_cleared = ""

    return enodeb_id, status, alarm_occurred, alarm_cleared

# ---------- Telegram Handler ----------
client = TelegramClient(session_name, api_id, api_hash)

@client.on(events.NewMessage(chats=group_chat_id))
async def alarm_handler(event):
    text = event.raw_text
    print("📩 New Message:\n", text)

    if 'Alarm Name' in text and 'eNodeB ID' in text:
        enodeb_id, status, occurred, cleared = parse_alarm_data(text)

        if enodeb_id:
            firebase_ref.child(enodeb_id).set({
                'status': status,
                'alarm_occurred': occurred,
                'alarm_cleared': cleared,
                'last_update': datetime.now(timezone(timedelta(hours=7))).isoformat()
            })
            print(f"✅ Updated Firebase for EnodeB {enodeb_id}")

# ---------- Run ----------
client.start()
print("🚀 Listening for alarms...")
client.run_until_disconnected()
