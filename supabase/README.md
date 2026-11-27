# คู่มือตั้งค่า (ทำครั้งเดียว)

ลำดับ: **1. Supabase → 2. LINE Developers → 3. Vercel → 4. กลับมาใส่ที่อยู่เว็บใน Supabase/LINE**

> ⚠️ คีย์ลับ (`SUPABASE_SERVICE_ROLE_KEY`, `LINE_LOGIN_CHANNEL_SECRET`) ใส่เฉพาะใน Vercel เท่านั้น ห้ามส่งในแชตหรือ commit ลง GitHub

## 1. Supabase (ฐานข้อมูล + ระบบล็อกอิน)

1. ไปที่ https://supabase.com → **New project** (แยกจากโปรเจกต์ระบบเต้าหู้)
   - Region: **Southeast Asia (Singapore)**
   - ตั้งรหัสผ่านฐานข้อมูลแล้วเก็บไว้
2. เมนู **SQL Editor** → New query → วางเนื้อหาไฟล์ `migrations/0001_init.sql` ทั้งไฟล์ → **Run**
3. เมนู **Project Settings → API** จดค่า:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (ลับ)
4. เมนู **Authentication → Sign In / Providers → Email**: เปิดไว้ (ใช้ทั้งล็อกอินอีเมลและเบื้องหลังของล็อกอิน LINE)
5. (แนะนำก่อนเปิดให้คนจริงใช้) **Authentication → Emails → SMTP Settings**: ตั้ง SMTP ของตัวเอง เช่น Resend
   อีเมลในตัวของ Supabase ส่งได้แค่ไม่กี่ฉบับต่อชั่วโมง (กระทบเฉพาะคนที่ล็อกอินด้วยอีเมล ล็อกอิน LINE ไม่ส่งอีเมล)

## 2. LINE Developers (ปุ่มล็อกอินด้วย LINE)

1. ไปที่ https://developers.line.biz/console/ → สร้าง **Provider** (เช่น "คลังนมแม่")
2. ใน Provider → **Create a new channel → LINE Login**
   - App types: **Web app**
3. แท็บ **Basic settings** จด:
   - Channel ID → `LINE_LOGIN_CHANNEL_ID`
   - Channel secret → `LINE_LOGIN_CHANNEL_SECRET` (ลับ)
4. แท็บ **LINE Login** → **Callback URL**: `https://<โดเมนจริง>/auth/line/callback` (ใส่หลังได้โดเมนจาก Vercel ในขั้นที่ 3)
5. ⚠️ เปลี่ยนสถานะ channel จาก **Developing** เป็น **Published** — ถ้ายังเป็น Developing จะล็อกอินได้เฉพาะแอดมิน/คนที่เพิ่มเป็น tester

> ภายหลังถ้าจะส่งแจ้งเตือนทาง LINE OA ให้สร้าง Messaging API channel ใน **Provider เดียวกัน** (รหัสผู้ใช้ LINE จะตรงกัน)

## 3. Vercel (ขึ้นเว็บ)

1. https://vercel.com → **Add New → Project** → Import repo นี้
2. **Environment Variables**: ใส่ทุกค่าตาม `.env.local.example`
   - `NEXT_PUBLIC_SITE_URL` = ที่อยู่เว็บจริง เช่น `https://nommae.vercel.app` (ไม่มี / ปิดท้าย)
3. **Deploy**
4. ⚠️ แผนฟรี (Hobby) ของ Vercel ใช้ได้เฉพาะงานส่วนตัวที่ไม่หารายได้ — ถ้าเริ่มเก็บเงินให้เปลี่ยนเป็นแผน Pro

## 4. ผูกที่อยู่เว็บ

- Supabase → **Authentication → URL Configuration**
  - Site URL: `https://<โดเมนจริง>`
  - Redirect URLs: เพิ่ม `https://<โดเมนจริง>/auth/callback`
- LINE → Callback URL: `https://<โดเมนจริง>/auth/line/callback` (ข้อ 2.4)

ลองเปิดเว็บ → เข้าสู่ระบบด้วย LINE → สร้างสมุดนม → บันทึกปั๊มนม → สร้างลิงก์เชิญแล้วเปิดด้วยอีกบัญชี

## งานผู้ดูแลระบบ (ชั่วคราว จนกว่าจะมีระบบชำระเงิน)

SQL Editor ใน Supabase:

```sql
-- ดูครอบครัวทั้งหมด + เจ้าของ + สถานะแพ็กเกจ
select h.id, h.baby_name, p.display_name as owner, h.trial_ends_at, h.paid_until,
       (select count(*) from household_members m2 where m2.household_id = h.id) as members,
       (select count(*) from bags b where b.household_id = h.id) as bags
from households h
join household_members m on m.household_id = h.id and m.role = 'owner'
join profiles p on p.id = m.user_id
order by h.created_at desc;

-- ต่ออายุพรีเมียม 1 ปี (เปลี่ยน id ให้ตรงกับครอบครัวที่จ่ายเงิน)
update households
set paid_until = greatest(coalesce(paid_until, now()), now()) + interval '1 year'
where id = '00000000-0000-0000-0000-000000000000';
```

## ทดสอบสิทธิ์ในเครื่อง (สำหรับนักพัฒนา)

`tests/run.sh` รัน migration บน Postgres ธรรมดา (จำลองส่วนที่ Supabase มีให้) แล้วตรวจ 45 ข้อ เช่น
ครอบครัวอื่นอ่าน/แก้/ลบถุงนมไม่ได้, ผู้ใช้แก้วันหมดอายุแพ็กเกจเองไม่ได้, ลบบัญชีแล้วข้อมูลหายถูกต้อง

```bash
PGHOST=/var/run/postgresql PGUSER=postgres npm run test:db
```
