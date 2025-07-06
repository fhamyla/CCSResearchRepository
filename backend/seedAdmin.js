const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the User model
const User = require('./models/User');

async function seedAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user data
    const adminData = {
      email: 'admin@ccs.edu.ph', // Change this to your desired admin email
      password: 'admin123', // Change this to your desired password
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isEmailVerified: true
    };

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

    // Create the admin user
    const adminUser = new User({
      ...adminData,
      password: hashedPassword
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('Role:', adminData.role);

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeding function
seedAdminUser(); 