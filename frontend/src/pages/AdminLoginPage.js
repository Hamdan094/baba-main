// =============================================================================
// AdminLoginPage.js - Administrator Login Page
// =============================================================================
// A dedicated login page for store administrators only.
// Separate from the customer AuthPage for security and UX reasons:
//   - No registration option (admin accounts are created via server seed)
//   - Redirects to /admin/dashboard on successful login
//   - Accessible at /admin route
//
// Admin credentials are set via environment variables in backend/.env:
//   ADMIN_EMAIL=admin@babafalooda.com
//   ADMIN_PASSWORD=BabaAdmin2024!
//
// Security note:
//   - The same error message is shown for wrong email OR wrong password
//   - This prevents attackers from determining whether an email is registered
//   - Admin accounts can only be created through the backend seed function
// =============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail } from 'lucide-react';

// Baba Falooda logo hosted on Cloudinary
const LOGO_URL = "https://res.cloudinary.com/dlm6l9oqc/image/upload/v1776213419/AAF-1Cbbs4M_1740773204589_gzjibt.png";

export default function AdminLoginPage() {
  // Form field state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [error, setError] = useState('');      // Error message shown below form
  const [loading, setLoading] = useState(false); // Disables button during request

  // login function from AuthContext handles JWT token storage
  const { login } = useAuth();
  const navigate = useNavigate();

  // =============================================================================
  // FORM SUBMISSION HANDLER
  // =============================================================================

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default browser form submission (page refresh)
    setError('');        // Clear any previous error message
    setLoading(true);

    try {
      // Attempt login via AuthContext which calls POST /api/auth/login
      // On success, stores JWT token in localStorage and sets user state
      await login(email, password);

      // Redirect to admin dashboard after successful authentication
      navigate('/admin/dashboard');

    } catch (err) {
      // Handle different error response formats from the backend
      const detail = err.response?.data?.detail;

      if (typeof detail === 'string') {
        // Simple string error (e.g. "Invalid email or password")
        setError(detail);
      } else if (Array.isArray(detail)) {
        // Array of Pydantic validation errors - extract and join messages
        setError(detail.map(d => d.msg || JSON.stringify(d)).join(' '));
      } else {
        // Generic fallback error message
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false); // Re-enable submit button regardless of outcome
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div
      className="min-h-screen bg-[#FFF8F0] flex items-center justify-center px-6"
      data-testid="admin-login-page"
    >
      <div className="w-full max-w-sm">

        {/* ================================================================
            PAGE HEADER
            Logo, title and subtitle identifying this as admin-only
            ================================================================ */}
        <div className="text-center mb-8">
          <img
            src={LOGO_URL}
            alt="Baba Falooda"
            className="w-16 h-16 mx-auto mb-4 rounded-full shadow-lg"
          />
          <h1 className="font-heading text-2xl text-[#1a1a1a]">Admin Login</h1>
          <p className="text-[#999] text-sm mt-1">Baba Falooda Dashboard</p>
        </div>

        {/* ================================================================
            LOGIN FORM
            Email and password inputs with icon decorations.
            Both fields are required - enforced by the required attribute.
            ================================================================ */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/5 rounded-2xl p-6 space-y-4 shadow-sm"
          data-testid="admin-login-form"
        >
          {/* Email input with mail icon */}
          <div className="relative">
            {/* Icon positioned absolutely inside the input using Tailwind */}
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
              data-testid="admin-email-input"
              required
            />
          </div>

          {/* Password input with lock icon */}
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg pl-10 pr-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
              data-testid="admin-password-input"
              required
            />
          </div>

          {/* Error message - shown when login fails */}
          {error && (
            <p className="text-red-500 text-xs" data-testid="login-error">
              {error}
            </p>
          )}

          {/* Submit button - disabled and shows loading text during request */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 shadow-md"
            data-testid="admin-login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}