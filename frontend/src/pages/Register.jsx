import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/service';
import '../../styles/Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    studentId: '',
    phoneNumber: ''
  });
  const [emailVerification, setEmailVerification] = useState({
    isEmailSent: false,
    otp: '',
    isVerified: false,
    otpExpiry: null
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
    
    // Reset email verification if email changes
    if (e.target.name === 'email' && emailVerification.isEmailSent) {
      setEmailVerification({
        isEmailSent: false,
        otp: '',
        isVerified: false,
        otpExpiry: null
      });
    }
  };

  const handleOtpChange = (e) => {
    setEmailVerification({
      ...emailVerification,
      otp: e.target.value
    });
    if (error) setError('');
  };

  const sendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your email address first');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const data = await authService.sendOTP(formData.email);
      setEmailVerification({
        ...emailVerification,
        isEmailSent: true,
        otpExpiry: data.expiresAt
      });
      alert('OTP sent to your email. Please check your inbox.');
    } catch (error) {
      setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!emailVerification.otp) {
      setError('Please enter the OTP');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const data = await authService.verifyOTP(formData.email, emailVerification.otp);
      setEmailVerification({
        ...emailVerification,
        isVerified: true
      });
      alert('Email verified successfully!');
    } catch (error) {
      setError(error.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.department || !formData.phoneNumber || !formData.studentId) {
      return 'Please fill in all required fields';
    }

    if (!emailVerification.isVerified) {
      return 'Please verify your email address first';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    if (!/^[0-9+\-\s()]{10,15}$/.test(formData.phoneNumber)) {
      return 'Please enter a valid phone number';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const response = await authService.register(
        formData.email, 
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.phoneNumber,
        formData.department,
        formData.studentId
      );
      
      // Show success message with approval info
      alert('Registration successful! Your account is pending approval. You will receive an email notification once an administrator approves your account.');
      navigate('/signin');
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>CCS Research</h1>
          <h2>Create your account</h2>
          <p>Join our research community</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <div className="email-verification-group">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                disabled={emailVerification.isVerified}
              />
              <button
                type="button"
                className={`verify-btn ${emailVerification.isVerified ? 'verified' : ''}`}
                onClick={sendOTP}
                disabled={otpLoading || emailVerification.isVerified || !formData.email}
              >
                {emailVerification.isVerified ? '✓ Verified' : otpLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
            {emailVerification.isEmailSent && !emailVerification.isVerified && (
              <div className="otp-verification">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={emailVerification.otp}
                  onChange={handleOtpChange}
                  maxLength="6"
                  className="otp-input"
                />
                <button
                  type="button"
                  className="verify-otp-btn"
                  onClick={verifyOTP}
                  disabled={otpLoading || !emailVerification.otp}
                >
                  {otpLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="department">Department *</label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="form-select"
              required
            >
              <option value="" disabled>Select your department</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Faculty">Faculty</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number *</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Enter your phone number"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="studentId">Student/Employee ID *</label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="Enter your ID number"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>

          <div className="form-terms">
            <label className="checkbox-container">
              <input type="checkbox" required />
              <span className="checkmark"></span>
              I agree to the <a href="#" className="terms-link">Terms of Service</a> and <a href="#" className="terms-link">Privacy Policy</a>
            </label>
          </div>

          <button 
            type="submit" 
            className="register-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Already have an account? 
            <Link to="/signin" className="signin-link"> Sign in here</Link>
          </p>
        </div>

        <div className="back-to-home">
          <Link to="/" className="back-link">← Back to Research Repository</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
