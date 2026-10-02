# NovaBlu ERP — خطة الإصدار الأول 1.0

**قاعدة الإصدار:** لا يتم اعتماد 1.0 قبل اكتمال الربط الحقيقي واختباره.

## بوابة 1.0
1. Supabase/PostgreSQL فعلي.
2. Auth حقيقي: Email/OTP، Sessions، Recovery، 2FA لاحقاً.
3. Workspace / Multi-company / Multi-branch بعزل RLS.
4. مزامنة متعددة الأجهزة مع Conflict Handling.
5. Server-side posting للعمليات الحرجة: Invoice/Payment/Stock.
6. Backup Server واستعادة.
7. Billing Provider وتجربة/تجديد/Grace Period بدون حذف بيانات.
8. WhatsApp / Telegram / Email / Webhooks/API.
9. NovaBlu AI السحابي بصلاحيات وتنفيذ Actions بعد موافقة المستخدم.
10. Automation 24/7 على الخادم.
11. Security review + load test + sync/offline conflict tests.
12. Migration Wizard من 0.15 Local إلى 1.0 Cloud بدون فقد بيانات.
13. Code Signing موثوق لنسخة Windows العامة.

## شرط الاعتماد
بعد نجاح الاختبارات السابقة فقط يتغير الإصدار من 0.xx إلى **1.0**.
