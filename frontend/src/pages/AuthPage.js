// =============================================================================
// AuthPage.js - Customer Login and Registration Page
// =============================================================================
// This page handles both customer login and registration in a single component.
// It uses a toggle to switch between two modes:
//   - 'login'    : Email and password sign in
//   - 'register' : Name, email, password and optional phone sign up
//
// On successful login:
//   - Admin users are redirected to /admin/dashboard
//   - Regular customers are redirected to /account
//
// On successful registration:
//   - Customer is automatically logged in and redirected to /account
//
// Error handling:
//   - Backend returns errors as either a string or an array of validation objects
//   - Both formats are handled and displayed to the user
// =============================================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';

// Baba Falooda logo hosted on Cloudinary
const LOGO_URL = "https://res.cloudinary.com/dlm6l9oqc/image/upload/v1776213419/AAF-1Cbbs4M_1740773204589_gzjibt.png";

export default function AuthPage() {
  // mode: controls whether the form is in login or register mode
  const [mode, setMode] = useState('login');

  // Form field state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(''); // Optional for registration

  // UI state
  const [error, setError] = useState('');    // Error message to display
  const [loading, setLoading] = useState(false); // Disables button during request

  // login and register functions from AuthContext
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // =============================================================================
  // FORM SUBMISSION HANDLER
  // =============================================================================

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default browser form submission (page refresh)
    setError('');        // Clear any previous error
    setLoading(true);

    try {
      if (mode === 'login') {
        // Login: send email and password to backend
        const data = await login(email, password);

        // Redirect based on user role after successful login
        if (data.role === 'admin') {
          navigate('/admin/dashboard'); // Admins go to admin panel
        } else {
          navigate('/account');         // Customers go to their account page
        }

      } else {
        // Register: send all fields including optional phone number
        await register(name, email, password, phone);
        navigate('/account'); // Auto-login after registration
      }

    } catch (err) {
      // Handle different error response formats from FastAPI
      const detail = err.response?.data?.detail;

      if (typeof detail === 'string') {
        // Simple string error message (e.g. "Invalid email or password")
        setError(detail);
      } else if (Array.isArray(detail)) {
        // Array of validation errors from Pydantic (e.g. field too short)
        // Extract the msg field from each error object and join them
        setError(detail.map(d => d.msg || JSON.stringify(d)).join(' '));
      } else {
        // Fallback generic error message
        setError(
          mode === 'login'
            ? 'Invalid email or password'
            : 'Registration failed. Please try again.'
        );
      }
    } finally {
      setLoading(false); // Re-enable the submit button
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div
      className="min-h-screen bg-[#FFF8F0] flex items-center justify-center px-6 pt-20"
      data-testid="auth-page"
    >
      <div className="w-full max-w-sm">

        {/* ================================================================
            PAGE HEADER
            Logo, title and subtitle change based on current mode
            ================================================================ */}
        <div className="text-center mb-8">
          <img
            src={LOGO_URL}
            alt="Baba Falooda"
            className="w-16 h-16 mx-auto mb-4 rounded-full shadow-lg"
          />
          <h1
            className="font-heading text-2xl text-[#1a1a1a]"
            data-testid="auth-title"
          >
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-[#999] text-sm mt-1">
            {mode === 'login'
              ? 'Sign in to your Baba Falooda account'
              : 'Join Baba Falooda for a sweeter experience'}
          </p>
        </div>

        {/* ================================================================
            MODE TOGGLE
            Pill-style toggle to switch between Sign In and Sign Up
            ================================================================ */}
        <div
          className="flex bg-white border border-black/5 rounded-full p-1 mb-6 shadow-sm"
          data-testid="auth-toggle"
        >
          {/* Sign In toggle button */}
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              mode === 'login' ? 'bg-[#FF6B00] text-white' : 'text-[#999]'
            }`}
            data-testid="toggle-login"
          >
            Sign In
          </button>

          {/* Sign Up toggle button */}
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              mode === 'register' ? 'bg-[#FF6B00] text-white' : 'text-[#999]'
            }`}
            data-testid="toggle-register"
          >
            Sign Up
          </button>
        </div>

        {/* ================================================================
            AUTH FORM
            Fields shown depend on current mode:
            - Login: email + password
            - Register: name + email + password + phone (optional)
            ================================================================ */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/5 rounded-2xl p-6 space-y-4 shadow-sm"
          data-testid="auth-form"
        >
          {/* Name field - only shown in register mode */}
          {mode === 'register' && (
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                data-testid="auth-name-input"
                required
              />
            </div>
          )}

          {/* Email field - shown in both modes */}
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
              data-testid="auth-email-input"
              required
            />
          </div>

          {/* Password field - shown in both modes */}
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
              data-testid="auth-password-input"
              required
            />
          </div>

          {/* Phone field - only shown in register mode (optional) */}
          {mode === 'register' && (
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                data-testid="auth-phone-input"
              />
            </div>
          )}

          {/* Error message display */}
          {error && (
            <p className="text-red-500 text-xs" data-testid="auth-error">
              {error}
            </p>
          )}

          {/* Submit button - shows loading state and is disabled during request */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
            data-testid="auth-submit-btn"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>

        {/* Link to admin login page - shown below the form in login mode */}
        {mode === 'login' && (
          <p className="text-center text-[#999] text-xs mt-4">
            Admin?{' '}
            <Link
              to="/admin"
              className="text-[#FF6B00] hover:underline"
              data-testid="admin-login-link"
            >
              Admin Dashboard Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}