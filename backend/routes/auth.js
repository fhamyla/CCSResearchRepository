const express = require('express');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const router = express.Router();

// In-memory storage for OTPs (expires after 10 minutes)
const otpStorage = new Map();

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

// Helper function to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to clean expired OTPs
const cleanExpiredOTPs = () => {
  const now = Date.now();
  for (const [email, data] of otpStorage.entries()) {
    if (now > data.expiresAt) {
      otpStorage.delete(email);
    }
  }
};

// Send OTP to email for verification
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Clean up expired OTPs
    cleanExpiredOTPs();

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Store OTP in memory
    otpStorage.set(email, {
      otp,
      expiresAt,
      verified: false
    });

    // Send email
    const mailOptions = {
      from: process.env.GMAIL,
      to: email,
      subject: 'CCS Research Repository - Email Verification',
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
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: 'OTP sent successfully to your email',
      expiresAt
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Clean up expired OTPs
    cleanExpiredOTPs();

    // Check if OTP exists and is valid
    const otpData = otpStorage.get(email);
    if (!otpData) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // Mark as verified
    otpData.verified = true;
    otpStorage.set(email, otpData);

    res.status(200).json({ 
      message: 'Email verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// Register/Sign Up route
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, department, studentId } = req.body;

    if (!email || !password || !firstName || !lastName || !phoneNumber || !department || !studentId) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    // Validate phone number format
    const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Validate department is one of the allowed values
    const allowedDepartments = ['Computer Science', 'Information Technology', 'Faculty'];
    if (!allowedDepartments.includes(department)) {
      return res.status(400).json({ message: 'Invalid department selection' });
    }

    // Clean up expired OTPs
    cleanExpiredOTPs();

    // Check if email was verified with OTP
    const otpData = otpStorage.get(email);
    if (!otpData || !otpData.verified) {
      return res.status(400).json({ message: 'Email not verified. Please verify your email first.' });
    }

    // Check if user already exists (double check)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with default 'user' role and 'pending' status
    const user = new User({ 
      email, 
      password,
      firstName,
      lastName,
      phoneNumber,
      department,
      studentId, 
      role: 'user', // Always default to 'user' role
      status: 'pending' // Require admin approval
    });
    await user.save();

    // Clean up OTP data after successful registration
    otpStorage.delete(email);

    // Send pending approval email to user
    const approvalMailOptions = {
      from: process.env.GMAIL,
      to: email,
      subject: 'CCS Research Repository - Account Pending Approval',
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
      `
    };

    await transporter.sendMail(approvalMailOptions);

    res.status(201).json({ 
      message: 'User created successfully. Your account is pending approval.',
      user: { id: user._id, email: user.email, role: user.role, status: user.status }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Sign In/Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password (no hashing as requested)
    if (user.password !== password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user account is approved (unless admin or moderator)
    if (!['admin', 'moderator'].includes(user.role) && user.status !== 'approved') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. Please wait for an administrator to approve your account.',
        status: user.status
      });
    }

    res.status(200).json({
      message: 'Login successful',
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        department: user.department
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin routes for user management
// Middleware to check if user is admin or moderator (admin/moderator access)
const requireAdminOrModerator = async (req, res, next) => {
  // In a real app, you'd get this from JWT token or session
  // For now, we'll assume frontend sends user role in headers
  const userRole = req.headers['user-role'];
  if (!userRole || !['admin', 'moderator'].includes(userRole)) {
    return res.status(403).json({ message: 'Access denied. Admin or moderator privileges required.' });
  }
  next();
};

// Middleware to check if user is admin only (admin-only access)
const requireAdminOnly = async (req, res, next) => {
  const userRole = req.headers['user-role'];
  if (!userRole || userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Get all users (admin/moderator access)
router.get('/admin/users', requireAdminOrModerator, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user role (admin only - can only promote users to moderator, not admin)
router.put('/admin/users/:userId/role', requireAdminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Only allow admin to promote users to moderator, not to admin
    if (!['user', 'moderator'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only user and moderator roles are allowed.' });
    }

    // Find the admin user (first admin created)
    const firstAdmin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    
    // Prevent changing the first admin's role
    if (userId === firstAdmin._id.toString()) {
      return res.status(400).json({ message: 'Cannot change the primary admin\'s role.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, select: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/admin/users/:userId', requireAdminOnly, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user statistics (admin/moderator access)
router.get('/admin/stats', requireAdminOrModerator, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const moderatorUsers = await User.countDocuments({ role: 'moderator' });
    const regularUsers = await User.countDocuments({ role: 'user' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const rejectedUsers = await User.countDocuments({ status: 'rejected' });
    
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
      recentUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending users (admin/moderator access)
router.get('/admin/users/pending', requireAdminOrModerator, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }, { password: 0 })
      .sort({ createdAt: -1 });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve/reject user (admin/moderator access)
router.put('/admin/users/:userId/status', requireAdminOrModerator, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true, select: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Send email notification to user
    let emailSubject, emailContent;
    
    if (status === 'approved') {
      emailSubject = 'CCS Research Repository - Account Approved';
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
    } else if (status === 'rejected') {
      emailSubject = 'CCS Research Repository - Account Registration Update';
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
        html: emailContent
      };

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: `User ${status} successfully`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by name (first name + last name)
router.get('/users/by-name/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    console.log('Searching for user by name:', name);
    
    // Split the name to match against first and last name
    const nameParts = name.split(' ');
    let query = {};
    
    if (nameParts.length === 1) {
      // If only one name part is provided, search in both first and last name
      query = {
        $or: [
          { firstName: new RegExp(nameParts[0], 'i') },
          { lastName: new RegExp(nameParts[0], 'i') }
        ]
      };
    } else if (nameParts.length >= 2) {
      // If multiple name parts, try different matching patterns:
      // 1. Match first name + last name
      // 2. Match first name only
      // 3. Match last name only
      // 4. Match either name against either field (more flexible matching)
      query = {
        $or: [
          // Exact match with first and last name
          {
            firstName: new RegExp(`^${nameParts[0]}$`, 'i'),
            lastName: new RegExp(`^${nameParts.slice(1).join(' ')}$`, 'i')
          },
          // Partial matches
          { firstName: new RegExp(nameParts[0], 'i') },
          { lastName: new RegExp(nameParts.slice(1).join(' '), 'i') },
          // Flexible matching (any part of the name matches any field)
          { firstName: new RegExp(name, 'i') },
          { lastName: new RegExp(name, 'i') }
        ]
      };
    }
    
    console.log('Query:', JSON.stringify(query));
    
    // Find users matching the name
    const users = await User.find(query).select('firstName lastName email department');
    
    console.log('Found users:', users.length);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found with this name' });
    }
    
    // Return the list of matching users with limited information for privacy
    res.status(200).json(users);
  } catch (error) {
    console.error('Get user by name error:', error);
    res.status(500).json({ message: 'Failed to retrieve user information' });
  }
});

// Get user by ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log('Fetching user by ID:', userId);
    
    // Find user by ID
    const user = await User.findById(userId).select('firstName lastName email department');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user with limited information for privacy
    res.status(200).json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to retrieve user information' });
  }
});

module.exports = router;
