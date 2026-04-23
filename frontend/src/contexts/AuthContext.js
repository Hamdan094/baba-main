// =============================================================================
// AuthContext.js - Global Authentication State Management
// =============================================================================
// This file implements React's Context API to manage authentication state
// across the entire application. It provides user login status, profile data
// and authentication functions to any component without prop drilling.
//
// How it works:
//   1. AuthProvider wraps the entire app in App.js
//   2. Any component can call useAuth() to access user data and auth functions
//   3. On app load, checkAuth() validates any stored JWT token
//   4. Tokens are stored in localStorage for persistence across page refreshes
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Create the authentication context with null as default value
// null indicates no user is logged in before the context is initialised
const AuthContext = createContext(null);

// Backend API URL from environment variables (.env file)
const API = process.env.REACT_APP_BACKEND_URL;

// =============================================================================
// AUTH PROVIDER COMPONENT
// =============================================================================
// Wraps the entire application and makes auth state available to all children.
// Place this at the top level of the component tree (done in App.js).

export function AuthProvider({ children }) {
  // user: the logged-in user object (null if not logged in)
  // Contains: id, email, name, role, favourites
  const [user, setUser] = useState(null);

  // loading: true while checking if a stored token is still valid on app load
  // Prevents flash of unauthenticated content during initial token verification
  const [loading, setLoading] = useState(true);

  // =============================================================================
  // CHECK AUTHENTICATION ON APP LOAD
  // =============================================================================
  // useCallback memoises this function so it doesn't get recreated on every render,
  // which would cause the useEffect below to run in an infinite loop

  const checkAuth = useCallback(async () => {
    try {
      // Check if a JWT token exists in localStorage from a previous session
      const token = localStorage.getItem('token');

      if (!token) {
        // No token found - user is not logged in
        setLoading(false);
        return;
      }

      // Verify the token is still valid by calling the /api/auth/me endpoint
      // The backend will reject expired or tampered tokens with a 401 error
      const { data } = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true  // Send cookies alongside the request
      });

      // Token is valid - restore the user's session
      setUser(data);

    } catch {
      // Token is expired, invalid or the request failed
      // Remove the invalid token to force re-login
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      // Always set loading to false when done, regardless of success or failure
      setLoading(false);
    }
  }, []); // Empty dependency array - function never needs to change

  // Run checkAuth once when the app first loads to restore any existing session
  useEffect(() => { checkAuth(); }, [checkAuth]);

  // =============================================================================
  // LOGIN FUNCTION
  // =============================================================================

  const login = async (email, password) => {
    // Send credentials to the backend login endpoint
    const { data } = await axios.post(
      `${API}/api/auth/login`,
      { email, password },
      { withCredentials: true }  // Receive HTTP-only cookies in response
    );

    // Store the JWT token in localStorage for persistence across page refreshes
    // localStorage survives browser restarts; sessionStorage does not
    localStorage.setItem('token', data.token);

    // Fetch the full user profile including favourites list
    // The login response doesn't include favourites, so we fetch separately
    try {
      const { data: profile } = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
        withCredentials: true
      });
      setUser(profile);
    } catch {
      // Fall back to the basic login response data if profile fetch fails
      setUser(data);
    }

    return data; // Return data so calling components can check the user role
  };

  // =============================================================================
  // REGISTER FUNCTION
  // =============================================================================

  const register = async (name, email, password, phone) => {
    // Send registration details to the backend
    const { data } = await axios.post(
      `${API}/api/auth/register`,
      { name, email, password, phone },
      { withCredentials: true }
    );

    // Store the token and set the user state
    localStorage.setItem('token', data.token);

    // New accounts start with an empty favourites array
    setUser({ ...data, favourites: [] });

    return data;
  };

  // =============================================================================
  // LOGOUT FUNCTION
  // =============================================================================

  const logout = async () => {
    try {
      // Tell the backend to clear the HTTP-only cookies
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } catch {
      // Ignore errors - we still want to clear local state even if request fails
    }

    // Remove the token from localStorage
    localStorage.removeItem('token');

    // Clear the user from state - this triggers re-renders across the app
    // Components that check user will immediately reflect the logged-out state
    setUser(null);
  };

  // =============================================================================
  // REFRESH USER FUNCTION
  // =============================================================================

  const refreshUser = async () => {
    // Re-fetches the user's profile from the backend
    // Used after changes like adding a favourite to get the updated data
    await checkAuth();
  };

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================
  // These values and functions are made available to all child components
  // through the useAuth() hook defined at the bottom of this file

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}


// =============================================================================
// useAuth HOOK
// =============================================================================
// Custom hook that provides easy access to the auth context.
// Usage in any component: const { user, login, logout } = useAuth();
// Returns null if used outside of an AuthProvider.

export const useAuth = () => useContext(AuthContext);