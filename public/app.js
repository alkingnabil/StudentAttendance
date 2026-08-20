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