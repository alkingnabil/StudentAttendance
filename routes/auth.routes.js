const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Student = require("../models/Student");
const Group = require("../models/Group");

// تسجيل دخول الطالب أو المسؤول
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    let email = username.trim().toLowerCase();
    if (email === "hanihani") email = "master@tadreebi.local";

    const user = await User.findOne({ username: email });
    if (!user) return res.status(400).json({ message: "بيانات الدخول غير صحيحة" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "كلمة المرور غير صحيحة" });

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET || "tadreebi_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        username: user.username,
        groups: user.groups
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// إنشاء حساب طالب
router.post("/register-student", async (req, res) => {
  const { name, nationalId, phone, seat, group, password } = req.body;
  try {
    if (!/^\d{14}$/.test(nationalId)) return res.status(400).json({ message: "الرقم القومي يجب أن يكون 14 رقمًا" });
    
    const student = await Student.findOne({ name: name.trim(), seat: seat.trim() });
    if (!student) return res.status(400).json({ message: "الاسم ورقم الجلوس غير موجودين في قوائم الكلية" });

    const existingUser = await User.findOne({ username: nationalId });
    if (existingUser) return res.status(400).json({ message: "هذا الطالب يمتلك حساباً بالفعل" });

    const grp = await Group.findOne({ faculty: student.faculty, group: group });
    student.nationalId = nationalId;
    student.phone = phone;
    student.group = group;
    student.registered = true;
    if (grp) {
      student.training = grp.location;
      student.facultyMember = grp.facultyMember;
      student.assistant = grp.assistant;
      student.external = grp.external;
    }
    await student.save();

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: nationalId,
      password: hashedPassword,
      role: "student",
      name: student.name,
      studentRef: student._id
    });
    await newUser.save();

    res.json({ message: "تم إنشاء الحساب بنجاح" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;