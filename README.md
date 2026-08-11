# سامانه ارزیابی بازاریابی شعب

نسخه React + Django REST Framework فرم ارزیابی بازاریابی شعب بانک اقتصادنوین.

## وضعیت فعلی

این مخزن اکنون شامل یک برش عمودی قابل اجرا از MVP تأییدشده است:

- احراز هویت JWT با access token کوتاه‌عمر در حافظه React
- refresh token چرخشی در کوکی `HttpOnly`
- خروج و blacklist کردن refresh token
- بازیابی رمز عبور از طریق ایمیل
- تغییر رمز عبور با ابطال تمام refresh tokenهای فعال
- نقش‌های ارزیاب، سرپرست منطقه، مدیر بازاریابی و مدیر سامانه
- تخصیص ارزیابی توسط سرپرست منطقه
- دوره‌ها و الگوهای نسخه‌بندی‌شده
- ۷ بخش و ۴۹ معیار فرم اصلی
- پیش‌نویس با ذخیره خودکار
- ارسال، بازگشت برای اصلاح و تأیید
- محاسبه امتیاز در سرور
- داشبورد متناسب با نقش
- داشبورد تکمیل کار ارزیاب، بار کاری سرپرست، پیشرفت دوره مدیر بازاریابی و موجودی سامانه مدیر
- خروجی Excel فردی و گزارشی چندبرگی
- رویدادهای ممیزی
- بازگشایی حسابرسی‌شده ارزیابی تأییدشده توسط مدیر بازاریابی یا مدیر سامانه
- اجرای محلی با SQLite یا Docker/PostgreSQL

فایل [bank_evaluation_form.html](bank_evaluation_form.html) به‌عنوان مرجع نسخه اولیه حفظ شده است.

## ساختار پروژه

```text
backend/    Django 5.2 LTS + DRF + Simple JWT
frontend/   React + TypeScript + Vite
docker-compose.yml
```

## اجرای سریع بدون Docker

### Backend

از ریشه پروژه در PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py bootstrap_local --password "ChangeMe123!"
..\.venv\Scripts\python.exe manage.py runserver
```

دستور `bootstrap_local` فقط برای آزمایش محلی است و چهار حساب زیر را می‌سازد:

| نام کاربری | نقش |
|---|---|
| `evaluator` | ارزیاب |
| `supervisor` | سرپرست منطقه |
| `manager` | مدیر بازاریابی |
| `admin` | مدیر سامانه |

رمز همه حساب‌ها مقداری است که به `--password` داده شده است. این رمز نباید در محیط staging یا production استفاده شود.

### Frontend

در یک PowerShell دیگر:

```powershell
cd frontend
npm install
npm run dev
```

سپس `http://localhost:5173` را باز کنید. Vite درخواست‌های `/api` را به Django روی پورت ۸۰۰۰ هدایت می‌کند.

## اجرای محلی با Docker

```powershell
docker compose up --build
```

بعد از آماده شدن سرویس‌ها، داده آزمایشی را ایجاد کنید:

```powershell
docker compose exec backend python manage.py bootstrap_local --password "ChangeMe123!"
```

- برنامه: `http://localhost:8080`
- صندوق ایمیل آزمایشی Mailpit: `http://localhost:8025`
- مدیریت Django: `http://localhost:8080/admin/`

## تست و Build

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test
..\.venv\Scripts\python.exe manage.py check

cd ..\frontend
npm run build
```

## راه‌اندازی داده واقعی

1. یک superuser یا مدیر بازاریابی ایجاد کنید.
2. قالب اولیه را با نام کاربری سازنده seed کنید:

```powershell
python manage.py seed_initial_template --creator manager_username
```

3. مناطق و شعب را از Django Admin وارد کنید.
4. سرپرستان را به مناطق متصل کنید.
5. مدیر بازاریابی یک دوره فعال ایجاد کند.
6. سرپرست منطقه شعب را به ارزیابان تخصیص دهد.

## تنظیمات production

مقادیر زیر باید از secret manager محیط cloud تزریق شوند:

- `DJANGO_SECRET_KEY`
- اطلاعات PostgreSQL
- اطلاعات SMTP
- دامنه‌های `ALLOWED_HOSTS`
- مبادی `CSRF_TRUSTED_ORIGINS`

در production:

```text
DJANGO_DEBUG=false
JWT_COOKIE_SECURE=true
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true
FRONTEND_URL=https://your-domain.example
```

`DJANGO_SECURE_HSTS_PRELOAD` فقط پس از اطمینان از HTTPS دائمی تمام زیردامنه‌های مربوط فعال شود. پایگاه داده production باید PostgreSQL مدیریت‌شده با backup و point-in-time recovery باشد. TLS در load balancer یا ingress خاتمه می‌یابد و `X-Forwarded-Proto` به Django ارسال می‌شود.

endpoint سلامت:

```text
GET /api/health/
```

## تصمیم‌های معماری مهم

- امتیاز React فقط پیش‌نمایش است؛ امتیاز قطعی در Django محاسبه می‌شود.
- ارزیابی ناقص قابل ارسال نیست.
- ارزیابی ارسال‌شده برای ارزیاب قفل می‌شود.
- الگوی منتشرشده باید تغییرناپذیر تلقی شود و تغییرات در نسخه جدید انجام شوند.
- خروجی‌ها فقط Excel هستند.
- فایل فردی شامل مشخصات، نتایج بخش‌ها، پاسخ‌ها و فرصت‌ها است.
- فایل گزارشی شامل خلاصه، مناطق، شعب، ارزیابان، امتیاز بخش‌ها و جزئیات است.
- دریافت فایل‌های Excel و بازگشایی ارزیابی در رویدادهای ممیزی ثبت می‌شوند.
- تاریخ در دیتابیس میلادی ذخیره و در رابط به تقویم فارسی نمایش داده می‌شود.
- `mobile_number` از ابتدا در مدل کاربر وجود دارد تا بازیابی رمز با OTP در نسخه بعد اضافه شود.
