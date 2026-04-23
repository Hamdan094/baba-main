// =============================================================================
// App.js - Root Application Component
// =============================================================================
// This is the top-level component of the Baba Falooda application.
// It sets up:
//   1. Global context providers (authentication, cart state and toast notifications)
//   2. Client-side routing with React Router
//   3. Scroll-to-top behaviour on page navigation
//   4. The persistent Navbar, ChatBot and BackToTop components
//
// Component tree structure:
//   ToastProvider (global toast notification state)
//     AuthProvider (global auth state)
//       CartProvider (global cart state)
//         BrowserRouter (client-side routing)
//           ScrollToTop (resets scroll on navigation)
//           Navbar (persistent top navigation bar)
//           Routes (page components rendered based on URL)
//           ChatBot (persistent floating AI chat button)
//           BackToTop (floating scroll to top button)
// =============================================================================

import React, { useEffect } from "react";
import "@/App.css"; // Global CSS styles and Tailwind base imports

// React Router imports for client-side navigation
// BrowserRouter: uses HTML5 history API for clean URLs (no hash)
// Routes/Route: defines which component renders for each URL path
// useLocation: provides current URL path, used by ScrollToTop
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Global context providers - wrap the app to share state everywhere
import { AuthProvider } from "./contexts/AuthContext";   // User authentication state
import { CartProvider } from "./contexts/CartContext";   // Shopping cart state
import { ToastProvider } from "./components/Toast";     // Global toast notification state

// Persistent components shown on every page
import Navbar from "./components/Navbar";       // Top navigation bar
import ChatBot from "./components/ChatBot";     // Floating AI assistant button
import BackToTop from "./components/BackToTop"; // Floating back to top button (appears on scroll)

// Page components - each represents a distinct page/route
import HomePage from "./pages/HomePage";                     // Landing page
import MenuPage from "./pages/MenuPage";                     // Full menu with filtering
import CartPage from "./pages/CartPage";                     // Shopping cart and checkout
import OrderSuccessPage from "./pages/OrderSuccessPage";     // Post-payment confirmation
import AdminLoginPage from "./pages/AdminLoginPage";         // Admin-only login page
import AdminDashboardPage from "./pages/AdminDashboardPage"; // Admin management dashboard
import BranchesPage from "./pages/BranchesPage";             // All restaurant locations
import AuthPage from "./pages/AuthPage";                     // Customer login/register
import AccountPage from "./pages/AccountPage";               // Customer order history/favourites
import ReviewPage from "./pages/ReviewPage";                 // Single order review form
import ReviewsPage from "./pages/ReviewsPage";               // All public reviews

// =============================================================================
// SCROLL TO TOP COMPONENT
// =============================================================================
// React Router doesn't automatically scroll to the top when navigating between
// pages - it preserves the scroll position from the previous page.
// This component fixes that by scrolling to (0,0) on every route change.
// It renders nothing visually (returns null) - it's purely behavioural.

function ScrollToTop() {
  const { pathname } = useLocation(); // Get current URL path

  useEffect(() => {
    // Scroll to top of page whenever the URL path changes
    window.scrollTo(0, 0);
  }, [pathname]); // Re-run whenever pathname changes (i.e. on page navigation)

  return null; // No UI to render - this component only has a side effect
}

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

function App() {
  return (
    // ToastProvider: makes showToast function available to all components
    // Must be the outermost wrapper so toasts work everywhere in the app
    <ToastProvider>

      {/* AuthProvider: makes user authentication state available to all components
          Must wrap everything that needs to know if user is logged in */}
      <AuthProvider>

        {/* CartProvider: makes shopping cart state available to all components
            Must wrap everything that needs to read or modify the cart */}
        <CartProvider>

          {/* BrowserRouter: enables client-side routing
              Uses the HTML5 History API so URLs look like /menu not /#/menu */}
          <BrowserRouter>

            {/* ScrollToTop must be inside BrowserRouter to access useLocation */}
            <ScrollToTop />

            {/* Navbar is shown on all pages except the admin dashboard
                The Navbar component itself handles hiding on admin routes */}
            <Navbar />

            {/* Routes: renders the matching Route based on the current URL
                Only one Route renders at a time - the first match wins */}
            <Routes>
              {/* Public pages - accessible to all visitors */}
              <Route path="/" element={<HomePage />} />             {/* Landing page */}
              <Route path="/menu" element={<MenuPage />} />         {/* Menu with AI recommendations */}
              <Route path="/cart" element={<CartPage />} />         {/* Cart and checkout */}
              <Route path="/branches" element={<BranchesPage />} /> {/* Branch locations with maps */}
              <Route path="/reviews" element={<ReviewsPage />} />   {/* All customer reviews */}

              {/* Authentication pages */}
              <Route path="/login" element={<AuthPage />} />        {/* Customer login/register */}

              {/* Protected customer pages - redirect to /login if not authenticated
                  Authentication check is handled within each component */}
              <Route path="/account" element={<AccountPage />} />   {/* Order history and favourites */}

              {/* Review page - accessed via unique link sent in delivery email
                  :orderId is a URL parameter extracted with useParams() in ReviewPage */}
              <Route path="/review/:orderId" element={<ReviewPage />} />

              {/* Post-payment confirmation page - receives Stripe session_id as query param
                  e.g. /order-success?session_id=cs_live_abc123 */}
              <Route path="/order-success" element={<OrderSuccessPage />} />

              {/* Admin pages - role check performed within the components themselves */}
              <Route path="/admin" element={<AdminLoginPage />} />               {/* Admin login form */}
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} /> {/* Admin control panel */}
            </Routes>

            {/* ChatBot floats in the bottom-right corner on all pages
                It is a persistent UI element independent of the current route */}
            <ChatBot />

            {/* BackToTop appears in the bottom-left corner after scrolling 400px down
                Clicking it smoothly scrolls back to the top of the page */}
            <BackToTop />

          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;