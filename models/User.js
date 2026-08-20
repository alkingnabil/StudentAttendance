const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // National ID للطالب أو Email للإدارة
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin", "master"], required: true },
  name: { type: String, required: true },
  groups: [{ type: String }], // للمسؤولين: أرقام المجموعات المسموح بها، أو ["*"] للـ Master
  studentRef: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);