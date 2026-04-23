// =============================================================================
// Navbar.js - Persistent Top Navigation Bar
// =============================================================================
// This component renders the navigation bar that appears at the top of every
// page except the admin dashboard. It is fixed to the top of the viewport
// so it remains visible as the user scrolls.
//
// Key features:
//   - Responsive design: full nav on desktop, hamburger menu on mobile
//   - Dynamic auth state: shows Login or Account/Logout based on user status
//   - Cart badge: shows number of items currently in the cart
//   - Cart bounce animation: cart icon bounces when a new item is added
//   - Hidden on admin dashboard (detected via useLocation)
//   - Glass effect background using Tailwind backdrop-blur classes
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Menu, X, User, LogOut } from 'lucide-react';

// Logo image URL hosted on Cloudinary
const LOGO_URL = "https://res.cloudinary.com/dlm6l9oqc/image/upload/v1776213419/AAF-1Cbbs4M_1740773204589_gzjibt.png";

export default function Navbar() {
  // mobileOpen: controls whether the mobile dropdown menu is visible
  const [mobileOpen, setMobileOpen] = useState(false);

  // cartBouncing: true briefly when an item is added to trigger bounce animation
  const [cartBouncing, setCartBouncing] = useState(false);

  // itemCount: total number of items in the cart (used for badge display)
  const { itemCount } = useCart();

  // user: the currently logged-in user (null if not logged in)
  const { user, logout } = useAuth();

  // pathname: current URL path, used to hide navbar on admin dashboard
  const location = useLocation();

  // prevItemCount: ref to track previous cart count for detecting new additions
  // useRef instead of useState because we don't want changes to trigger re-renders
  const prevItemCount = useRef(itemCount);

  // =============================================================================
  // CART BOUNCE ANIMATION
  // =============================================================================
  // Detects when itemCount increases (item added) and triggers bounce animation.
  // The bounce class is removed after 500ms so it can be re-triggered next time.

  useEffect(() => {
    if (itemCount > prevItemCount.current) {
      // Item was added - trigger bounce animation
      setCartBouncing(true);
      // Remove bounce class after animation completes so it can replay
      setTimeout(() => setCartBouncing(false), 500);
    }
    // Update ref to current count for next comparison
    prevItemCount.current = itemCount;
  }, [itemCount]); // Re-run whenever cart count changes

  // =============================================================================
  // HIDE NAVBAR ON ADMIN DASHBOARD
  // =============================================================================
  const isAdminDash = location.pathname === '/admin/dashboard';
  if (isAdminDash) return null;

  // =============================================================================
  // NAVIGATION LINKS
  // =============================================================================
  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/menu', label: 'Menu' },
    { to: '/branches', label: 'Branches' },
    { to: '/reviews', label: 'Reviews' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo and brand name */}
          <Link to="/" className="flex items-center gap-3" data-testid="nav-logo">
            <img
              src={LOGO_URL}
              alt="Baba Falooda"
              className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover"
            />
            <span className="font-heading text-lg md:text-xl text-[#FF6B00]">BABA FALOODA</span>
          </Link>

          {/* ================================================================
              DESKTOP NAVIGATION
              ================================================================ */}
          <div className="hidden md:flex items-center gap-7">

            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-[#555] hover:text-[#FF6B00] transition-colors duration-300"
                data-testid={`nav-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
              </Link>
            ))}

            {/* Our Story uses plain anchor tag to scroll to homepage section */}
            <a
              href="/#story"
              className="text-sm font-medium text-[#555] hover:text-[#FF6B00] transition-colors duration-300"
            >
              Our Story
            </a>

            {/* Auth state buttons */}
            {user ? (
              user.role === 'admin' ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/admin/dashboard"
                    className="text-sm font-medium text-[#FF6B00] hover:text-[#FF8C00] transition-colors flex items-center gap-1.5"
                    data-testid="nav-admin-dashboard"
                  >
                    <User size={14} /> Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-[#999] hover:text-red-500 transition-colors flex items-center gap-1"
                    data-testid="nav-logout-btn"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/account"
                    className="text-sm font-medium text-[#FF6B00] hover:text-[#FF8C00] transition-colors flex items-center gap-1.5"
                    data-testid="nav-account-link"
                  >
                    <User size={14} />
                    {/* Show only first name to keep nav concise */}
                    {user.name?.split(' ')[0] || 'Account'}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-[#999] hover:text-red-500 transition-colors flex items-center gap-1"
                    data-testid="nav-logout-btn"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              )
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-[#555] hover:text-[#FF6B00] transition-colors flex items-center gap-1.5"
                data-testid="nav-login-link"
              >
                <User size={14} /> Login
              </Link>
            )}

            {/* ================================================================
                CART BUTTON WITH BOUNCE ANIMATION
                cartBouncing adds the cart-bounce CSS class which plays the
                bounce keyframe animation defined in index.css.
                The animation duration is 500ms matching the setTimeout above.
                ================================================================ */}
            <Link
              to="/cart"
              className="relative flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300"
              data-testid="nav-cart-btn"
            >
              {/* Cart icon gets bounce class when item is added */}
              <ShoppingCart
                size={16}
                className={cartBouncing ? 'cart-bounce' : ''}
              />
              Cart
              {/* Badge only shown when cart has items */}
              {itemCount > 0 && (
                <span
                  className={`absolute -top-2 -right-2 bg-[#1a1a1a] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${cartBouncing ? 'cart-bounce' : ''}`}
                  data-testid="cart-count"
                >
                  {itemCount}
                </span>
              )}
            </Link>
          </div>

          {/* ================================================================
              MOBILE HEADER CONTROLS
              ================================================================ */}
          <div className="md:hidden flex items-center gap-4">
            <Link to="/cart" className="relative" data-testid="nav-cart-btn-mobile">
              <ShoppingCart
                size={20}
                className={`text-[#FF6B00] ${cartBouncing ? 'cart-bounce' : ''}`}
              />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#FF6B00] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-[#1a1a1a]"
              data-testid="mobile-menu-toggle"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          MOBILE DROPDOWN MENU
          ================================================================ */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-black/5 px-6 py-4 space-y-3">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-[#555] hover:text-[#FF6B00] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {/* Our Story anchor link in mobile menu */}
          <a
            href="/#story"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-medium text-[#555] hover:text-[#FF6B00] transition-colors"
          >
            Our Story
          </a>
          {user ? (
            <>
              {user.role === 'admin' ? (
                <Link
                  to="/admin/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-[#FF6B00]"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-[#FF6B00]"
                >
                  My Account
                </Link>
              )}
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                className="block text-sm font-medium text-red-500"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-[#FF6B00]"
            >
              Login / Sign Up
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}