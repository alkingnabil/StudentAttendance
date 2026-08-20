const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  faculty: { type: String, required: true, enum: ["3", "4"] },
  name: { type: String, required: true },
  nationalId: { type: String, default: "" },
  phone: { type: String, default: "" },
  seat: { type: String, required: true },
  group: { type: String, default: "" },
  code: { type: String, required: true },
  training: { type: String, default: "" },
  facultyMember: { type: String, default: "" },
  assistant: { type: String, default: "" },
  external: { type: String, default: "" },
  registered: { type: Boolean, default: false }
}, { timestamps: true });

studentSchema.index({ faculty: 1, code: 1 }, { unique: true });
module.exports = mongoose.model("Student", studentSchema);