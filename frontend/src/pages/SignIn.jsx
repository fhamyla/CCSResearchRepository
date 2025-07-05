import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/service';
import '../../styles/SignIn.css';

const SignIn = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }    try {
      const response = await authService.login(formData.email, formData.password);
      
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Redirect based on user role
      if (response.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
      
    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <h1>CCS Research</h1>
          <h2>Sign in to your account</h2>
          <p>Welcome back! Please sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="signin-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="form-options">
            <label className="checkbox-container">
              <input type="checkbox" />
              <span className="checkmark"></span>
              Remember me
            </label>
          </div>

          <button 
            type="submit" 
            className="signin-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="signin-footer">
          <p>
            Don't have an account? 
            <Link to="/register" className="register-link"> Create one here</Link>
          </p>
        </div>

        <div className="back-to-home">
          <Link to="/" className="back-link">← Back to Research Repository</Link>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
