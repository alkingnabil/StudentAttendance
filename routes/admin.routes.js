const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Evaluation = require("../models/Evaluation");
const Month = require("../models/Month");
const Config = require("../models/Config");

// تسجيل الحضور بالكود أو QR
router.post("/attendance", authenticate, authorize(["admin", "master"]), async (req, res) => {
  const { code, faculty } = req.body;
  const paddedCode = String(code).padStart(3, "0");
  try {
    const student = await Student.findOne({ faculty, code: paddedCode });
    if (!student) return res.status(404).json({ message: "لم يتم العثور على الطالب في الفرقة الحالية" });

    // التحقق من صلاحية المشرف على مجموعة الطالب
    if (req.user.role === "admin" && !req.user.groups.includes("*") && !req.user.groups.includes(String(student.group))) {
      return res.status(403).json({ message: "هذا الطالب خارج نطاق المجموعات المصرح لك بإدارتها" });
    }

    const date = new Date().toISOString().slice(0, 10);
    const key = `${student.nationalId}|${date}`;
    
    const exists = await Attendance.findOne({ key });
    if (exists) return res.status(400).json({ message: "تم تسجيل حضور الطالب لهذا اليوم بالفعل" });

    const att = new Attendance({
      key,
      faculty: student.faculty,
      nationalId: student.nationalId,
      code: paddedCode,
      date,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    });
    await att.save();

    res.json({ message: "تم تسجيل الحضور بنجاح", record: att });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// حفظ / تعديل درجة التقييم
router.post("/evaluation", authenticate, authorize(["admin", "master"]), async (req, res) => {
  const { code, faculty, score } = req.body;
  const paddedCode = String(code).padStart(3, "0");
  try {
    const config = await Config.findOne();
    const session = config?.evaluationSession;
    if (!session || String(session.faculty) !== String(faculty)) {
      return res.status(400).json({ message: "لا توجد جلسة تقييم نشطة لهذه الفرقة" });
    }

    if (score < 0 || score > session.max) {
      return res.status(400).json({ message: `الدرجة يجب أن تكون بين 0 و ${session.max}` });
    }

    const student = await Student.findOne({ faculty, code: paddedCode });
    if (!student) return res.status(404).json({ message: "الطالب غير موجود" });

    if (req.user.role === "admin" && !req.user.groups.includes("*") && !req.user.groups.includes(String(student.group))) {
      return res.status(403).json({ message: "الطالب خارج مجموعاتك المصرحة" });
    }

    const evalRecord = await Evaluation.findOneAndUpdate(
      { faculty, code: paddedCode, month: session.month },
      {
        nationalId: student.nationalId,
        score,
        date: session.date,
        max: session.max
      },
      { upsert: true, new: true }
    );

    // إلغاء الاعتماد التلقائي عند إدخال تقييمات جديدة
    config.approved[faculty] = false;
    await config.save();

    res.json({ message: "تم حفظ الدرجة بنجاح", evalRecord });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// API: جلب الملف الشامل للطالب عند فحص الـ QR
router.get("/scan-profile/:faculty/:identifier", authenticate, authorize(["admin", "master"]), async (req, res) => {
  try {
    const { faculty, identifier } = req.params;
    const paddedCode = String(identifier).padStart(3, "0");

    // البحث عن الطالب إما بالكود المكون من 3 أرقام أو بالرقم القومي
    const student = await Student.findOne({
      faculty: String(faculty),
      $or: [{ code: paddedCode }, { nationalId: identifier }]
    });

    if (!student) {
      return res.status(404).json({ message: "لم يتم العثور على الطالب في هذه الفرقة" });
    }

    // التحقق من صلاحيات المشرف على مجموعة الطالب
    if (req.user.role === "admin" && !req.user.groups.includes("*") && !req.user.groups.includes(String(student.group))) {
      return res.status(403).json({ message: "هذا الطالب يتبع مجموعة غير مصرح لحسابك بإدارتها" });
    }

    // 1. جلب سجلات الحضور للطالب
    const attendanceRecords = await Attendance.find({ nationalId: student.nationalId, faculty: String(faculty) }).sort({ date: -1 });
    const todayDate = new Date().toISOString().slice(0, 10);
    const attendedToday = attendanceRecords.some(a => a.date === todayDate);

    // 2. جلب شهور الدراسة واحتساب إجمالي المحاضرات
    const months = await Month.find({ faculty: String(faculty) });
    const totalLectures = months.reduce((acc, m) => acc + Number(m.lectures || 0), 0);
    const attendanceCount = attendanceRecords.length;
    const attendanceRate = totalLectures > 0 ? ((attendanceCount / totalLectures) * 100).toFixed(1) : "0.0";

    // 3. جلب التقييمات والدرجات
    const evaluations = await Evaluation.find({ nationalId: student.nationalId, faculty: String(faculty) });
    const evalTotal = evaluations.reduce((acc, e) => acc + Number(e.score || 0), 0);

    // 4. جلب إعدادات درجات المحاضرة والاعتماد
    const config = (await Config.findOne()) || {};
    const lectureGrade = Number(config.lectureGrade?.[String(faculty)] || 2);
    const attendanceScore = totalLectures * lectureGrade;
    const grandTotal = evalTotal + attendanceScore;

    // إرسال كائن البيانات الشامل للمسؤول
    res.json({
      student: {
        id: student._id,
        name: student.name,
        code: student.code,
        nationalId: student.nationalId,
        seat: student.seat,
        group: student.group,
        faculty: student.faculty,
        phone: student.phone,
        training: student.training || "غير محدد",
        facultyMember: student.facultyMember || "غير محدد",
        assistant: student.assistant || "غير محدد",
        external: student.external || "غير محدد"
      },
      attendanceStats: {
        totalLectures,
        attendanceCount,
        attendanceRate: `${attendanceRate}%`,
        attendedToday,
        todayDate,
        history: attendanceRecords
      },
      evaluationStats: {
        evaluations,
        evalTotal,
        lectureGrade,
        attendanceScore,
        grandTotal,
        isApproved: Boolean(config.approved?.[String(faculty)])
      }
    });

  } catch (err) {
    res.status(500).json({ message: "خطأ في جلب بيانات الطالب: " + err.message });
  }
});

module.exports = router;