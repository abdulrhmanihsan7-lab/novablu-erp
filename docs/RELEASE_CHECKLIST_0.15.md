# NovaBlu ERP 0.15 — Release Checklist

## يجب أن تكون ناجحة قبل إغلاق الملف المحلي
- [ ] Pilot Day مكتمل بنسبة 80% أو أكثر على بيانات فعلية.
- [ ] RC QA >= 90.
- [ ] Health Score >= 90.
- [ ] لا توجد Runtime Errors متكررة آخر 7 أيام.
- [ ] لا يوجد Blocker من مستوى High.
- [ ] Backup تم تنزيله واختبار استعادته.
- [ ] Windows Installer يبنى بنجاح.
- [ ] Windows Runtime Smoke ينجح.
- [ ] Chromium Browser Smoke ينجح.
- [ ] PWA Cache وManifest صالحان.
- [ ] طباعة A4 و80mm تم اختبارها.
- [ ] Feature Freeze = ON.

## لا يمنع إغلاق الملف المحلي
العناصر التالية ليست جزءاً من 0.15:
- Cloud Database
- Multi-device Sync
- Server Auth/RLS
- Billing/Subscriptions الفعلية
- WhatsApp/Telegram/Email/API
- AI السحابي

هذه تدخل في الإصدار الأول 1.0 فقط.
