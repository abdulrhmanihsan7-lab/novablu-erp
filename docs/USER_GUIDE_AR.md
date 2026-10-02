# دليل استخدام NovaBlu ERP 0.15

هذه النسخة هي **Final Local Candidate** وتعمل محلياً بدون Cloud أو مزامنة متعددة الأجهزة.

## البداية السريعة
1. افتح **مركز الانطلاق** وحدد نوع النشاط.
2. عدّل بيانات الشركة والفرع والمخزن.
3. أضف المنتجات أو استوردها.
4. أضف العملاء والموردين.
5. جرّب أول فاتورة بيع ثم أول تحصيل.
6. افتح **Pilot Day** ونفّذ سيناريو يوم عمل كامل.
7. افتح **Release Candidate QA** ثم **صحة النظام**.
8. نزّل Backup فعلي من قسم البيانات.
9. افتح **مركز الإصدار المحلي** وتأكد من عدم وجود Blockers حرجة.

## أهم الأقسام
- المبيعات والفواتير: إنشاء، تعديل، دفع جزئي/كامل، مرتجعات، طباعة A4 و80mm.
- POS: بيع سريع، كوبونات، استبدال، ورديات وطباعة حرارية.
- المنتجات والمخزون: Variants، UOM، Barcode، Batch/Lot/Serial، صلاحية، جرد وتحويلات.
- المشتريات: Purchase Request، RFQ، PO، استلام، Vendor Bills/Credits.
- المحاسبة: General Ledger، Opening Balances، Fiscal Periods، Cost Centers.
- CRM / HR / Payroll / Approvals / Automation / Reports.
- NovaBlu AI المحلي: تحليل مباشر لبيانات التطبيق بدون Cloud.
- Health / Recovery: Integrity Scan، Snapshots، Safe Mode، Crash Log.

## النسخ الاحتياطي والاستعادة
- نزّل Backup دوري قبل أي تغيير كبير.
- Recovery Snapshots تحفظ عدة حالات محلية تلقائياً.
- لا تستخدم Clear Site Data في المتصفح أو تمسح App Data في Windows قبل التأكد من وجود نسخة احتياطية.
- Safe Mode لا يحذف البيانات؛ فقط يوقف التشغيل التلقائي الذكي مؤقتاً.

## Windows
- Installer: NovaBlu ERP 0.15 x64.
- البيانات تبقى محلية على الجهاز.
- النسخة الحالية قد تظهر Unknown Publisher إذا لم توجد شهادة Code Signing موثوقة.
- التوقيع الموثوق مجهز تقنياً لكنه يحتاج شهادة فعلية قبل البيع العام.

## ما لا يوجد في 0.15
لا يوجد Cloud Sync أو Server Auth أو Billing أو WhatsApp/Telegram/API فعلي. هذه العناصر محجوزة للإصدار الأول 1.0 بعد الربط الحقيقي والاختبار.
