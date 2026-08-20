const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const { authenticate, authorize } = require("../middleware/auth");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Config = require("../models/Config");

const upload = multer({ storage: multer.memoryStorage() });

// رفع واستيراد ملف Excel
router.post("/import-excel/:faculty", authenticate, authorize(["master"]), upload.single("file"), async (req, res) => {
  const { faculty } = req.params;
  try {
    if (!req.file) return res.status(400).json({ message: "الرجاء إرفاق ملف Excel" });

    const wb = xlsx.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "", raw: false });

    if (!rows.length) return res.status(400).json({ message: "الملف لا يحتوي على صفوف بيانات" });

    // مصفوفة مطابقة المسميات
    const aliases = {
      name: ["الاسم", "اسم الطالب", "name"],
      seat: ["رقم الجلوس", "seat", "num", "رقم"],
      nationalId: ["الرقم القومي", "nationalid", "national id"],
      phone: ["رقم الهاتف", "الهاتف", "التليفون", "phone"],
      group: ["رقم المجموعة", "المجموعة", "group"]
    };

    const norm = v => String(v ?? "").trim().toLowerCase();
    const getVal = (r, keys) => {
      const k = Object.keys(r).find(x => keys.map(norm).includes(norm(x)));
      return k ? String(r[k]).trim() : "";
    };

    // حذف طلاب الفرقة الحالية وإعادة بنائهم
    await Student.deleteMany({ faculty });

    let count = 1;
    const studentsToInsert = [];
    const groups = await Group.find({ faculty });

    for (const r of rows) {
      const name = getVal(r, aliases.name);
      if (!name) continue;

      const groupNum = getVal(r, aliases.group);
      const code = String(count).padStart(3, "0");
      const matchedGroup = groups.find(g => String(g.group) === groupNum);

      studentsToInsert.push({
        faculty,
        name,
        nationalId: getVal(r, aliases.nationalId),
        phone: getVal(r, aliases.phone),
        seat: getVal(r, aliases.seat) || String(count),
        group: groupNum,
        code,
        training: matchedGroup?.location || "",
        facultyMember: matchedGroup?.facultyMember || "",
        assistant: matchedGroup?.assistant || "",
        external: matchedGroup?.external || ""
      });
      count++;
    }

    await Student.insertMany(studentsToInsert);
    res.json({ message: `تم استيراد ${studentsToInsert.length} طالب بنجاح للفرقة ${faculty}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;