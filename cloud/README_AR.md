# NovaBlu ERP Cloud Foundation

هذه الملفات تجهز الانتقال المستقبلي من النسخة المحلية إلى Cloud ERP حقيقي بدون كسر بنية 0.05.

## المعمارية المقترحة
- PostgreSQL / Supabase
- Auth حقيقي للمستخدمين
- Company/Tenant isolation عبر RLS
- Branches وWarehouses
- Sales Orders / Invoices / Payments
- Inventory movements
- Purchasing
- Audit logs
- Offline-first frontend مع مزامنة لاحقة

## مهم
هذا المخطط **غير مطبق على قاعدة بيانات حية حالياً**. لا يوجد في 0.05 تسجيل دخول سحابي أو مزامنة أجهزة حقيقية حتى يتم إنشاء مشروع Backend وربطه بمفاتيح ومجال آمن.

## ترتيب التفعيل لاحقاً
1. إنشاء مشروع Supabase.
2. تشغيل supabase_schema.sql.
3. إنشاء Owner membership لأول مستخدم.
4. إضافة Environment variables للواجهة.
5. نقل بيانات localStorage/IndexedDB عبر Importer.
6. تفعيل Auth وRLS.
7. اختبار Tenant isolation.
8. تفعيل النسخ الاحتياطية والمزامنة.
