const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "غير مصرح - الرجاء تسجيل الدخول" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "tadreebi_secret_key");
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "المستخدم غير موجود" });
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "جلسة غير صالحة أو منتهية" });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "ليس لديك صلاحية لتنفيذ هذا الإجراء" });
    }
    next();
  };
};

module.exports = { authenticate, authorize };