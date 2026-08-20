const API_URL = window.location.origin + "/api";

// تخزين وإحضار توكن الجلسة
function getToken() { return localStorage.getItem("token"); }
function setSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// دالة موحدة لطلبات الـ API
async function apiCall(endpoint, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "حدث خطأ في الاتصال");
  return data;
}

// تسجيل دخول الإدارة المربوط بالسيرفر
async function adminLogin() {
  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value;
  try {
    const data = await apiCall("/auth/login", "POST", { username, password });
    setSession(data.token, data.user);
    session = data.user;
    toast("تم تسجيل الدخول بنجاح");
    openApp();
  } catch (err) {
    toast(err.message);
  }
}

// تسجيل الحضور بالكود المربوط بالسيرفر
async function markAttendance(codeArg) {
  const code = String(codeArg || document.getElementById("attendanceCode").value || "").padStart(3, "0");
  try {
    const res = await apiCall("/admin/attendance", "POST", { code, faculty: db.faculty });
    toast(res.message);
    adminPage("attendance");
  } catch (err) {
    toast(err.message);
  }
}

// رفع ملف Excel مباشرة للسيرفر
async function importExcel(input, faculty) {
  const file = input.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    toast("جاري رفع واستيراد الملف...");
    const res = await fetch(`${API_URL}/master/import-excel/${faculty}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${getToken()}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast(data.message);
    adminPage("data");
  } catch (err) {
    toast(err.message);
  }
}

// عرض QR الطالب عند دخوله لحسابه
function renderStudentQr(student) {
  const qrContainer = document.getElementById("studentQr");
  if (!qrContainer) return;
  qrContainer.innerHTML = "";

  // نضع في الـ QR كود الطالب أو حمولة JSON يمكن للماسح قراءتها فوراً
  const qrPayload = JSON.stringify({
    app: "tadreebi",
    faculty: student.faculty,
    code: student.code,
    nationalId: student.nationalId
  });

  if (window.QRCode) {
    new QRCode(qrContainer, {
      text: qrPayload,
      width: 190,
      height: 190,
      colorDark: "#0f766e",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}


// تشغيل الكاميرا لفحص QR الطالب
function startStudentScanner() {
  if (!window.Html5Qrcode) return toast("مكتبة الكاميرا غير متاحة");
  stopScanner();

  scanner = new Html5Qrcode("adminQrReader");
  scanner.start(
    { facingMode: "environment" },
    { fps: 15, qrbox: 250 },
    async (decodedText) => {
      stopScanner(); // إيقاف الكاميرا مؤقتاً عند نجاح الالتقاط
      handleQrScanned(decodedText);
    }
  ).catch(err => {
    toast("تعذر تشغيل الكاميرا. تأكد من إعطاء الصلاحية أو استخدام HTTPS/localhost");
  });
}

// معالجة النص المقروء من الكاميرا
async function handleQrScanned(rawText) {
  let identifier = rawText.trim();
  let faculty = db.faculty || "4";

  // فحص ما إذا كان الـ QR يحتوي على كائن JSON أو كود مباشر
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.code) identifier = parsed.code;
    if (parsed.faculty) faculty = parsed.faculty;
  } catch (e) {
    // إذا كان نصاً عادياً (مثل كود 001 أو الرقم القومي)
    const match = rawText.match(/\d{3,14}/);
    if (match) identifier = match[0];
  }

  toast("جاري جلب ملف الطالب...");
  try {
    const res = await apiCall(`/admin/scan-profile/${faculty}/${identifier}`, "GET");
    displayScannedStudentModal(res);
  } catch (err) {
    toast(err.message);
  }
}

// عرض نافذة الملف الشامل للطالب
function displayScannedStudentModal(data) {
  const { student, attendanceStats, evaluationStats } = data;

  const modalHtml = `
    <div id="scanProfileModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2>${esc(student.name)}</h2>
            <span class="pill">كود: ${esc(student.code)}</span>
            <span class="pill">الفرقة: ${esc(student.faculty)}</span>
            <span class="pill">مجموعة: ${esc(student.group)}</span>
          </div>
          <button class="close-btn" onclick="closeScanModal()">✕</button>
        </div>

        <div class="modal-body">
          <!-- إحصائيات سريعة -->
          <div class="grid" style="margin-bottom: 16px;">
            <div class="card stat" style="padding:12px;">
              <div class="label">نسبة الحضور</div>
              <div class="value" style="color:${parseFloat(attendanceStats.attendanceRate) >= 75 ? '#0f766e' : '#b91c1c'}">
                ${attendanceStats.attendanceRate}
              </div>
            </div>
            <div class="card stat" style="padding:12px;">
              <div class="label">المحاضرات المحضورة</div>
              <div class="value">${attendanceStats.attendanceCount} / ${attendanceStats.totalLectures}</div>
            </div>
            <div class="card stat" style="padding:12px;">
              <div class="label">مجموع التقييمات</div>
              <div class="value">${evaluationStats.evalTotal}</div>
            </div>
            <div class="card stat" style="padding:12px;">
              <div class="label">المجموع الكلي</div>
              <div class="value" style="color:var(--p)">${evaluationStats.grandTotal}</div>
            </div>
          </div>

          <!-- تفاصيل الطالب والتدريب -->
          <div class="grid2">
            <div class="info-box">
              <h4>📋 البيانات الأكاديمية</h4>
              <p><b>رقم الجلوس:</b> ${esc(student.seat)}</p>
              <p><b>الرقم القومي:</b> ${esc(student.nationalId || "-")}</p>
              <p><b>رقم الهاتف:</b> ${esc(student.phone || "-")}</p>
              <p><b>مكان التدريب:</b> ${esc(student.training)}</p>
            </div>
            <div class="info-box">
              <h4>👨‍🏫 هيئة الإشراف</h4>
              <p><b>عضو هيئة التدريس:</b> ${esc(student.facultyMember)}</p>
              <p><b>الهيئة المعاونة:</b> ${esc(student.assistant)}</p>
              <p><b>المشرف الخارجي:</b> ${esc(student.external)}</p>
              <p><b>حالة حضور اليوم:</b> ${attendanceStats.attendedToday ? '<span class="badge ok">تم الحضور اليوم ✅</span>' : '<span class="badge warn">لم يحضر اليوم ⚠️</span>'}</p>
            </div>
          </div>

          <!-- جدول التقييمات الشهرية -->
          <h4 style="margin: 15px 0 6px;">📊 التقييمات الشهرية المرصودة</h4>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>الشهر</th><th>الدرجة المرصودة</th><th>الدرجة العظمى</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                ${evaluationStats.evaluations.map(e => `
                  <tr>
                    <td><b>${esc(e.month)}</b></td>
                    <td><b>${e.score}</b></td>
                    <td>${e.max}</td>
                    <td>${esc(e.date)}</td>
                  </tr>
                `).join("") || '<tr><td colspan="4" class="empty">لا توجد تقييمات مرصودة بعد</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- أزرار الإجراءات السريعة -->
        <div class="modal-actions">
          ${!attendanceStats.attendedToday ? `
            <button class="primary" onclick="quickMarkAttendance('${student.code}', '${student.faculty}')">
              ✅ تسجيل حضور اليوم فوراً
            </button>
          ` : '<button class="ghost" disabled>تم تسجيل حضور اليوم بالفعل</button>'}
          <button class="ghost" onclick="startStudentScanner()">📷 فحص طالب آخر</button>
          <button class="ghost" onclick="closeScanModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `;

  // إزالة أي مودال مفتوح سابقاً وإضافة الجديد
  const oldModal = document.getElementById("scanProfileModal");
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// دالة تسجيل الحضور السريع من داخل البطاقة
async function quickMarkAttendance(code, faculty) {
  try {
    const res = await apiCall("/admin/attendance", "POST", { code, faculty });
    toast(res.message);
    // تحديث بيانات البطاقة بعد التسجيل
    const updated = await apiCall(`/admin/scan-profile/${faculty}/${code}`, "GET");
    displayScannedStudentModal(updated);
  } catch (err) {
    toast(err.message);
  }
}

function closeScanModal() {
  const m = document.getElementById("scanProfileModal");
  if (m) m.remove();
}