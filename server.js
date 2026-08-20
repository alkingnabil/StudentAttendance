const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Config = require("./models/Config");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// استدعاء المسارات
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/master", require("./routes/master.routes"));

// بذر البيانات الابتدائية للمسؤولين في حال كانت قاعدة البيانات فارغة
async function seedInitialData() {
  const masterCount = await User.countDocuments({ role: "master" });
  if (masterCount === 0) {
    const hashedMaster = await bcrypt.hash("master123", 10);
    await User.create({
      username: "master@tadreebi.local",
      password: hashedMaster,
      name: "Master",
      role: "master",
      groups: ["*"]
    });

    const hashedMai = await bcrypt.hash("123456", 10);
    await User.create({
      username: "mai@tadreebi.local",
      password: hashedMai,
      name: "م.م/ مي عبداللطيف",
      role: "admin",
      groups: ["1", "6", "11", "21"]
    });
  }

  const configCount = await Config.countDocuments();
  if (configCount === 0) {
    await Config.create({
      locations: ["مديرية الشباب والرياضة", "كلية الحاسبات والمعلومات", "كلية العلوم", "كلية الهندسة"],
      facultyMembers: ["أ.د/ عبد الحق سيد", "أ.م.د/ عبد الرحمن خلاوي", "د/ محمد غانم"],
      assistants: ["م.م/ مي عبداللطيف", "م.م/ مصطفي الزناتي", "م.م/ أبو الحسن ربيع"]
    });
  }
}

// الاتصال بقاعدة البيانات وبدء السيرفر
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tadreebi";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB successfully");
    await seedInitialData();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error("Database connection error:", err));