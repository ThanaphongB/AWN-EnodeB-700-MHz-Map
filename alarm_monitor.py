# -*- coding: utf-8 -*-
import re
import socks
from datetime import datetime, timezone, timedelta
import asyncio

from telethon import TelegramClient, events
import firebase_admin
from firebase_admin import credentials, db

# --- Telegram Config ---
api_id = 20801702
api_hash = 'ab8e072323be623961c22fa7ca42093a'
session_name = 'alarm_session'
group_chat_id = -1002771373578

# --- Proxy Config ---
proxy_address = '10.100.80.239'
proxy_port = 8080
proxy_type = socks.HTTP  # หรือ socks.SOCKS5

# --- Firebase Config ---
cred = credentials.Certificate('login-mnoc-700-mhz-firebase-adminsdk-fbsvc-c899293b15.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://login-mnoc-700-mhz-default-rtdb.asia-southeast1.firebasedatabase.app'
})
firebase_enodeb_alarms_ref = db.reference('/enodeb_alarms')
firebase_enodeb_history_ref = db.reference('/enodeb_alarms_history')

# --- Helper: Parse Telegram alarm message ---
def parse_alarm_data(message_text):
    tz = timezone(timedelta(hours=7))

    enodeb_id = re.search(r"eNodeB ID\s*:\s*(\d+)", message_text)
    status_raw = re.search(r"Status\s*:\s*([^\r\n]+)", message_text, re.IGNORECASE)
    occurred = re.search(r"Alarm Occurred\s*:\s*([\d\-]+\s[\d:]+)", message_text)
    cleared = re.search(r"Alarm Cleared\s*:\s*([\d\-]+\s[\d:]+)?", message_text)
    site_code = re.search(r"eNodeB Site Code\s*:\s*([\w\-]+)", message_text)

    enodeb_id = enodeb_id.group(1).strip() if enodeb_id else None

    # Logic: Uncleared = DOWN, else = NORMAL
    if status_raw:
        status_text = status_raw.group(1).strip().upper()
        status = "DOWN" if status_text == "UNCLEARED" else "NORMAL"
    else:
        status = "NORMAL"

    occurred = datetime.strptime(occurred.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz).isoformat() if occurred else None
    cleared = datetime.strptime(cleared.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz).isoformat() if cleared and cleared.group(1) else ""
    site_code = site_code.group(1).strip() if site_code else None

    print(f"Parsed Data -> EnodeB: {enodeb_id}, Status: {status}, Occurred: {occurred}, Cleared: {cleared}, Site: {site_code}")
    return enodeb_id, status, occurred, cleared, site_code

# --- Check Proxy ---
def check_proxy_connection(proxy_type, proxy_addr, proxy_port):
    import socket as pysocket
    try:
        s = socks.socksocket()
        s.settimeout(10)
        s.set_proxy(proxy_type, proxy_addr, proxy_port)
        s.connect(('api.telegram.org', 443))
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ✅ Proxy connection successful.")
        s.close()
        return True
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ❌ Proxy failed: {e}")
        return False

# --- Main Async Function ---
async def main():
    if not check_proxy_connection(proxy_type, proxy_address, proxy_port):
        print("Exiting program due to failed proxy connection.")
        return

    client = TelegramClient(session_name, api_id, api_hash, proxy=(proxy_type, proxy_address, proxy_port))

    # --- Connect Telegram ---
    try:
        await client.connect()
        if not await client.is_user_authorized():
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ❌ Session ไม่ถูกต้องหรือหมดอายุ. สร้าง session ใหม่ด้วย create_alarm_session.py")
            return
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ❌ Cannot connect Telegram: {e}")
        return

    # --- Event Handler ---
    @client.on(events.NewMessage(chats=group_chat_id))
    async def alarm_handler(event):
        text = event.message.message if hasattr(event.message, "message") else event.raw_text
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📩 New Message:\n{text!r}")

        if 'Alarm Name' in text and 'eNodeB ID' in text:
            enodeb_id, new_status, occurred, cleared, site_code = parse_alarm_data(text)

            if enodeb_id:
                # ข้อมูลสำหรับ status ปัจจุบัน
                data_to_update = {
                    'status': new_status,
                    'alarm_occurred': occurred,
                    'alarm_cleared': cleared,
                    'last_update': datetime.now(timezone(timedelta(hours=7))).isoformat()
                }
                if site_code:
                    data_to_update['eNodeB_Site_Code'] = site_code

                # บันทึก status ปัจจุบัน
                firebase_enodeb_alarms_ref.child(enodeb_id).update(data_to_update)
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ✅ Firebase updated for EnodeB {enodeb_id} to {new_status}")

                # --- บันทึกประวัติ Alarm ---
                history_entry = {
                    'status': new_status,
                    'alarm_occurred': occurred,
                    'alarm_cleared': cleared,
                    'eNodeB_Site_Code': site_code,
                    'raw_message': text,
                    'timestamp': datetime.now(timezone(timedelta(hours=7))).isoformat()
                }
                firebase_enodeb_history_ref.child(enodeb_id).push(history_entry)
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📝 Alarm history saved for EnodeB {enodeb_id}")

            else:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ⚠️ Could not parse EnodeB ID.")
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ➡️ Not an alarm message. Skipped.")

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚀 Listening for alarms...")
    await client.run_until_disconnected()

# --- Run ---
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ⏹️ Script stopped by user/PM2.")
    except asyncio.exceptions.CancelledError:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ⏹️ Async tasks cancelled.")
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🛑 Unexpected error: {e}")
