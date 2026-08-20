const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Evaluation = require("../models/Evaluation");
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

module.exports = router;