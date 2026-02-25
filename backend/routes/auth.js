// Copyright (c) 2025 fhamyla
require("dotenv").config();
const express = require("express");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const otpStorage = new Map();

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many auth requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const cleanExpiredOTPs = () => {
  const now = Date.now();
  for (const [email, data] of otpStorage.entries()) {
    if (now > data.expiresAt) {
      otpStorage.delete(email);
    }
  }
};

router.post("/send-otp", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    cleanExpiredOTPs();

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStorage.set(email, {
      otp,
      expiresAt,
      verified: false,
    });

    const mailOptions = {
      from: process.env.GMAIL,
      to: email,
      subject: "CCS Research Repository - Email Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hello,</p>
          <p>Thank you for registering with CCS Research Repository. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <br>
          <p>Best regards,<br>CCS Research Repository Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "OTP sent successfully to your email",
      expiresAt,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
});

router.post("/verify-otp", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    cleanExpiredOTPs();

    const otpData = otpStorage.get(email);
    if (!otpData) {
      return res
        .status(400)
        .json({
          message: "OTP expired or not found. Please request a new one.",
        });
    }

    if (otpData.otp !== otp) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    otpData.verified = true;
    otpStorage.set(email, otpData);

    res.status(200).json({
      message: "Email verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Server error during OTP verification" });
  }
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      department,
      studentId,
    } = req.body;

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !department ||
      !studentId
    ) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    const allowedDepartments = [
      "Computer Science",
      "Information Technology",
      "Faculty",
    ];
    if (!allowedDepartments.includes(department)) {
      return res.status(400).json({ message: "Invalid department selection" });
    }

    cleanExpiredOTPs();

    const otpData = otpStorage.get(email);
    if (!otpData || !otpData.verified) {
      return res
        .status(400)
        .json({
          message: "Email not verified. Please verify your email first.",
        });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      department,
      studentId,
      role: "user",
      status: "pending",
      isEmailVerified: true,
    });
    await user.save();

    otpStorage.delete(email);

    const approvalMailOptions = {
      from: process.env.GMAIL,
      to: email,
      subject: "CCS Research Repository - Account Pending Approval",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #663399;">Account Registration Successful</h2>
          <p>Hello,</p>
          <p>Thank you for registering with CCS Research Repository. Your account has been created successfully!</p>
          <div style="background-color: #f8f5ff; padding: 20px; border-left: 4px solid #663399; margin: 20px 0;">
            <p style="margin: 0; color: #663399; font-weight: bold;">⏳ Your account is currently pending approval</p>
            <p style="margin: 10px 0 0 0;">An administrator will review your registration and approve your account shortly. You will receive an email notification once your account is approved.</p>
          </div>
          <p>Once approved, you'll be able to access all features of the CCS Research Repository.</p>
          <br>
          <p>Best regards,<br>CCS Research Repository Team</p>
        </div>
      `,
    };

    await transporter.sendMail(approvalMailOptions);

    res.status(201).json({
      message: "User created successfully. Your account is pending approval.",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login attempt for email:", email);
    console.log("Password provided:", password ? "Yes" : "No");

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("User found:", {
      id: user._id,
      email: user.email,
      status: user.status,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      passwordHash: user.password ? "Present" : "Missing",
    });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password does not match for user:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (
      !["admin", "moderator"].includes(user.role) &&
      user.status !== "approved"
    ) {
      return res.status(403).json({
        message:
          "Your account is pending approval. Please wait for an administrator to approve your account.",
        status: user.status,
      });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        department: user.department,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const requireAdminOrModerator = async (req, res, next) => {
  const userRole = req.headers["user-role"];
  if (!userRole || !["admin", "moderator"].includes(userRole)) {
    return res
      .status(403)
      .json({
        message: "Access denied. Admin or moderator privileges required.",
      });
  }
  next();
};

const requireAdminOnly = async (req, res, next) => {
  const userRole = req.headers["user-role"];
  if (!userRole || userRole !== "admin") {
    return res
      .status(403)
      .json({ message: "Access denied. Admin privileges required." });
  }
  next();
};

router.get("/admin/users", requireAdminOrModerator, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/admin/users/:userId/role", requireAdminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "moderator"].includes(role)) {
      return res
        .status(400)
        .json({
          message: "Invalid role. Only user and moderator roles are allowed.",
        });
    }

    const firstAdmin = await User.findOne({ role: "admin" }).sort({
      createdAt: 1,
    });

    if (userId === firstAdmin._id.toString()) {
      return res
        .status(400)
        .json({ message: "Cannot change the primary admin's role." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, select: { password: 0 } },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User role updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/admin/users/:userId", requireAdminOnly, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/admin/stats", requireAdminOrModerator, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: "admin" });
    const moderatorUsers = await User.countDocuments({ role: "moderator" });
    const regularUsers = await User.countDocuments({ role: "user" });
    const pendingUsers = await User.countDocuments({ status: "pending" });
    const approvedUsers = await User.countDocuments({ status: "approved" });
    const rejectedUsers = await User.countDocuments({ status: "rejected" });

    const recentUsers = await User.find({}, { password: 0 })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalUsers,
      adminUsers,
      moderatorUsers,
      regularUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      recentUsers,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get(
  "/admin/users/pending",
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const pendingUsers = await User.find(
        { status: "pending" },
        { password: 0 },
      ).sort({ createdAt: -1 });
      res.json(pendingUsers);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

router.put(
  "/admin/users/:userId/status",
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true, select: { password: 0 } },
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let emailSubject, emailContent;

      if (status === "approved") {
        emailSubject = "CCS Research Repository - Account Approved";
        emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #663399;">Account Approved! 🎉</h2>
          <p>Hello,</p>
          <p>Great news! Your CCS Research Repository account has been approved by an administrator.</p>
          <div style="background-color: #f0f8f0; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
            <p style="margin: 0; color: #28a745; font-weight: bold;">✅ You can now access your account</p>
            <p style="margin: 10px 0 0 0;">You can now sign in and access all features of the CCS Research Repository.</p>
          </div>
          <p>Welcome to the CCS Research Repository community!</p>
          <br>
          <p>Best regards,<br>CCS Research Repository Team</p>
        </div>
      `;
      } else if (status === "rejected") {
        emailSubject = "CCS Research Repository - Account Registration Update";
        emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #663399;">Account Registration Update</h2>
          <p>Hello,</p>
          <p>We regret to inform you that your CCS Research Repository account registration could not be approved at this time.</p>
          <div style="background-color: #fff5f5; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0;">
            <p style="margin: 0; color: #dc3545; font-weight: bold;">Account registration was not approved</p>
            <p style="margin: 10px 0 0 0;">If you believe this is an error or have questions, please contact the administrator.</p>
          </div>
          <p>Thank you for your interest in the CCS Research Repository.</p>
          <br>
          <p>Best regards,<br>CCS Research Repository Team</p>
        </div>
      `;
      }

      if (emailSubject && emailContent) {
        const mailOptions = {
          from: process.env.GMAIL,
          to: user.email,
          subject: emailSubject,
          html: emailContent,
        };

        await transporter.sendMail(mailOptions);
      }

      res.json({ message: `User ${status} successfully`, user });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

router.get("/users/by-name/:name", async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    console.log("Searching for user by name:", name);

    const nameParts = name.split(" ");
    let query = {};

    if (nameParts.length === 1) {
      query = {
        $or: [
          { firstName: new RegExp(nameParts[0], "i") },
          { lastName: new RegExp(nameParts[0], "i") },
        ],
      };
    } else if (nameParts.length >= 2) {
      query = {
        $or: [
          {
            firstName: new RegExp(`^${nameParts[0]}$`, "i"),
            lastName: new RegExp(`^${nameParts.slice(1).join(" ")}$`, "i"),
          },
          { firstName: new RegExp(nameParts[0], "i") },
          { lastName: new RegExp(nameParts.slice(1).join(" "), "i") },
          { firstName: new RegExp(name, "i") },
          { lastName: new RegExp(name, "i") },
        ],
      };
    }

    console.log("Query:", JSON.stringify(query));

    const users = await User.find(query).select(
      "firstName lastName email department",
    );

    console.log("Found users:", users.length);

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found with this name" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Get user by name error:", error);
    res.status(500).json({ message: "Failed to retrieve user information" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    console.log("Fetching user by ID:", userId);

    const user = await User.findById(userId).select(
      "firstName lastName email department",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ message: "Failed to retrieve user information" });
  }
});

module.exports = router;
