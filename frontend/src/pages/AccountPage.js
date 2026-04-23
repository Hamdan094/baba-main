// =============================================================================
// AccountPage.js - Customer Account Dashboard
// =============================================================================
// This page is the personal dashboard for logged-in customers.
// It provides two tabs:
//   1. My Orders - full order history with status tracking and reorder feature
//   2. Favourites - saved menu items with quick order link and remove button
//
// Access control:
//   - Redirects to /login if user is not authenticated
//   - Redirects to /admin/dashboard if user is an admin
//   - Only regular customers should access this page
//
// Data fetched on load:
//   - /api/my-orders - customer's order history (authenticated)
//   - /api/favourites - customer's saved favourite items (authenticated)
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import axios from 'axios';
import {
  User, ShoppingBag, Heart, LogOut, Clock,
  Package, ArrowRight, Trash2, RefreshCw
} from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

export default function AccountPage() {
  // user: current logged-in user, logout: function to log out
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // activeTab: controls which tab content is shown ('orders' or 'favourites')
  const [activeTab, setActiveTab] = useState('orders');

  // orders: array of the customer's past orders
  const [orders, setOrders] = useState([]);

  // favourites: array of the customer's saved menu items
  const [favourites, setFavourites] = useState([]);

  // Loading states for each data set
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingFavs, setLoadingFavs] = useState(true);

  // reorderMsg: toast notification message shown after reorder action
  const [reorderMsg, setReorderMsg] = useState('');

  // addItem: function from CartContext to add items to the cart
  const { addItem } = useCart();

  // Auth headers for authenticated API requests
  const token = localStorage.getItem('token');
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true
  };

  // =============================================================================
  // ACCESS CONTROL AND DATA FETCHING
  // =============================================================================

  useEffect(() => {
    // Redirect unauthenticated users to login page
    if (!user) {
      navigate('/login');
      return;
    }

    // Redirect admin users to their dashboard (they don't have a customer account)
    if (user.role === 'admin') {
      navigate('/admin/dashboard');
      return;
    }

    // Fetch both orders and favourites when component mounts
    fetchOrders();
    fetchFavourites();
  }, [user, navigate]);

  // =============================================================================
  // FETCH ORDER HISTORY
  // =============================================================================

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      // /api/my-orders returns only orders linked to the authenticated user's ID
      const { data } = await axios.get(`${API}/api/my-orders`, authHeaders);
      setOrders(data);
    } catch {
      setOrders([]); // Empty array on error - no orders shown
    } finally {
      setLoadingOrders(false);
    }
  };

  // =============================================================================
  // FETCH FAVOURITES
  // =============================================================================

  const fetchFavourites = async () => {
    setLoadingFavs(true);
    try {
      const { data } = await axios.get(`${API}/api/favourites`, authHeaders);
      setFavourites(data);
    } catch {
      setFavourites([]);
    } finally {
      setLoadingFavs(false);
    }
  };

  // =============================================================================
  // REMOVE FAVOURITE
  // =============================================================================

  const removeFavourite = async (itemId) => {
    try {
      await axios.delete(`${API}/api/favourites/${itemId}`, authHeaders);

      // Optimistic UI update: remove from local state immediately
      // without waiting for a re-fetch - makes the UI feel instant
      setFavourites(prev => prev.filter(f => f.id !== itemId));
    } catch (e) {
      console.error('Failed to remove favourite:', e);
    }
  };

  // =============================================================================
  // REORDER FUNCTION
  // =============================================================================
  // Allows customers to quickly re-add all items from a past order to the cart.
  // Cross-references past order items with the current live menu to ensure
  // only currently available items are added.

  const reorder = async (order) => {
    try {
      // Fetch current menu to check item availability
      const { data: menuItems } = await axios.get(`${API}/api/menu`);

      // Build a lookup map for fast item access by both ID and name
      // Using both keys handles cases where menu item IDs may have changed
      const menuMap = {};
      menuItems.forEach(m => {
        menuMap[m.id] = m;
        menuMap[m.name] = m;
      });

      let added = 0; // Counter for successfully added items

      // Attempt to add each item from the past order
      for (const item of order.items || []) {
        // Look up by menu_item_id first, fall back to name
        const menuItem = menuMap[item.menu_item_id] || menuMap[item.name];

        if (menuItem && menuItem.is_available) {
          // Add item to cart once per quantity
          // (addItem increments by 1 each call)
          for (let q = 0; q < item.quantity; q++) {
            addItem(menuItem);
          }
          added += item.quantity;
        }
        // Items not found or unavailable are silently skipped
      }

      // Show appropriate toast message
      if (added > 0) {
        setReorderMsg(`${added} item${added > 1 ? 's' : ''} added to cart!`);
      } else {
        setReorderMsg('Some items may no longer be available.');
      }

      // Auto-dismiss the toast after 3 seconds
      setTimeout(() => setReorderMsg(''), 3000);

    } catch (e) {
      console.error('Reorder failed:', e);
      setReorderMsg('Failed to reorder. Please try again.');
      setTimeout(() => setReorderMsg(''), 3000);
    }
  };

  // =============================================================================
  // LOGOUT HANDLER
  // =============================================================================

  const handleLogout = async () => {
    await logout();       // Clear token and user state via AuthContext
    navigate('/');        // Redirect to home page after logout
  };

  // =============================================================================
  // STATUS COLOUR MAPPING
  // =============================================================================
  // Maps order status strings to Tailwind CSS classes for colour-coded badges

  const statusColors = {
    pending:   'bg-amber-50 text-amber-600',
    confirmed: 'bg-blue-50 text-blue-600',
    preparing: 'bg-purple-50 text-purple-600',
    ready:     'bg-green-50 text-green-600',
    delivered: 'bg-green-50 text-green-600',
    cancelled: 'bg-red-50 text-red-600'
  };

  // Don't render anything if user is null (redirect is handled in useEffect)
  if (!user) return null;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#FFF8F0] pt-24 pb-16" data-testid="account-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">

        {/* ================================================================
            PROFILE HEADER
            Shows user's name, email and logout button
            ================================================================ */}
        <div
          className="bg-white border border-black/5 rounded-2xl p-6 mb-8 shadow-sm flex items-center justify-between"
          data-testid="profile-header"
        >
          <div className="flex items-center gap-4">
            {/* User avatar placeholder - orange circle with user icon */}
            <div className="w-14 h-14 rounded-full bg-[#FFF3E6] flex items-center justify-center">
              <User size={24} className="text-[#FF6B00]" />
            </div>
            <div>
              <h1
                className="font-heading text-xl text-[#1a1a1a]"
                data-testid="account-name"
              >
                {user.name}
              </h1>
              <p className="text-[#999] text-sm">{user.email}</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-black/10 text-[#999] hover:text-red-500 hover:border-red-200 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            data-testid="account-logout-btn"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* ================================================================
            TAB NAVIGATION
            Toggles between My Orders and Favourites content
            ================================================================ */}
        <div className="flex gap-2 mb-6" data-testid="account-tabs">
          {/* My Orders tab button */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'orders'
                ? 'bg-[#FF6B00] text-white shadow-sm'   // Active tab style
                : 'bg-white border border-black/5 text-[#777] hover:text-[#FF6B00]'
            }`}
            data-testid="tab-orders"
          >
            <ShoppingBag size={14} /> My Orders
          </button>

          {/* Favourites tab button */}
          <button
            onClick={() => setActiveTab('favourites')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'favourites'
                ? 'bg-[#FF6B00] text-white shadow-sm'
                : 'bg-white border border-black/5 text-[#777] hover:text-[#FF6B00]'
            }`}
            data-testid="tab-favourites"
          >
            <Heart size={14} /> Favourites
          </button>
        </div>

        {/* ================================================================
            MY ORDERS TAB CONTENT
            ================================================================ */}
        {activeTab === 'orders' && (
          <div className="space-y-4" data-testid="orders-list">

            {/* Loading spinner */}
            {loadingOrders ? (
              <div className="text-center py-12">
                <span className="w-6 h-6 border-2 border-[#FF6B00]/30 border-t-[#FF6B00] rounded-full animate-spin inline-block" />
              </div>
            ) : orders.length === 0 ? (

              /* Empty state - no orders yet */
              <div
                className="text-center py-16 bg-white border border-black/5 rounded-2xl shadow-sm"
                data-testid="no-orders"
              >
                <Package size={40} className="mx-auto mb-3 text-[#ddd]" />
                <p className="text-[#999] text-sm mb-4">No orders yet</p>
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm"
                  data-testid="browse-menu-from-orders"
                >
                  Browse Menu <ArrowRight size={14} />
                </Link>
              </div>
            ) : (

              /* Orders list - one card per order */
              orders.map(order => (
                <div
                  key={order.id}
                  className="bg-white border border-black/5 rounded-xl p-5 shadow-sm"
                  data-testid={`order-card-${order.id}`}
                >
                  {/* Order header: ID, date, total and status badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {/* Show first 8 chars of UUID as order number */}
                      <p className="text-[#1a1a1a] text-sm font-semibold">
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-[#aaa] text-xs flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {/* Format timestamp to readable date */}
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[#FF6B00] font-bold">£{order.total?.toFixed(2)}</p>
                      <div className="flex gap-1 mt-1">
                        {/* Order status badge with colour coding */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-50 text-gray-500'}`}>
                          {order.status}
                        </span>
                        {/* Payment status badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${order.payment_status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                          {order.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Itemised list of what was ordered */}
                  <div className="border-t border-black/5 pt-3">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-[#777] py-1">
                        <span>{item.name} x{item.quantity}</span>
                        <span>£{item.subtotal?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reorder button - adds all items back to cart */}
                  <div className="mt-3 pt-3 border-t border-black/5">
                    <button
                      onClick={() => reorder(order)}
                      className="flex items-center gap-2 bg-[#FFF3E6] hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300"
                      data-testid={`reorder-btn-${order.id}`}
                    >
                      <RefreshCw size={12} /> Reorder
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================================================================
            FAVOURITES TAB CONTENT
            ================================================================ */}
        {activeTab === 'favourites' && (
          <div data-testid="favourites-list">

            {/* Loading spinner */}
            {loadingFavs ? (
              <div className="text-center py-12">
                <span className="w-6 h-6 border-2 border-[#FF6B00]/30 border-t-[#FF6B00] rounded-full animate-spin inline-block" />
              </div>
            ) : favourites.length === 0 ? (

              /* Empty state - no favourites saved yet */
              <div
                className="text-center py-16 bg-white border border-black/5 rounded-2xl shadow-sm"
                data-testid="no-favourites"
              >
                <Heart size={40} className="mx-auto mb-3 text-[#ddd]" />
                <p className="text-[#999] text-sm mb-4">
                  No favourites yet. Tap the heart on menu items to save them here.
                </p>
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm"
                  data-testid="browse-menu-from-favs"
                >
                  Browse Menu <ArrowRight size={14} />
                </Link>
              </div>
            ) : (

              /* Favourites grid - 2 columns on larger screens */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favourites.map(item => (
                  <div
                    key={item.id}
                    className="bg-white border border-black/5 rounded-xl p-4 flex items-center gap-4 shadow-sm"
                    data-testid={`fav-item-${item.id}`}
                  >
                    {/* Item thumbnail */}
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#1a1a1a] text-sm font-semibold truncate">{item.name}</h3>
                      <p className="text-[#FF6B00] text-sm font-bold">£{item.price?.toFixed(2)}</p>
                      <p className="text-[#aaa] text-xs">{item.category}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2">
                      {/* Link to menu page to order this item */}
                      <Link
                        to="/menu"
                        className="text-[#FF6B00] text-xs hover:underline font-medium"
                      >
                        Order
                      </Link>

                      {/* Remove from favourites button */}
                      <button
                        onClick={() => removeFavourite(item.id)}
                        className="text-[#ccc] hover:text-red-500 transition-colors"
                        data-testid={`remove-fav-${item.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================
          REORDER TOAST NOTIFICATION
          Fixed position popup shown after reorder action.
          Includes a "View Cart" link and auto-dismisses after 3 seconds.
          ================================================================ */}
      {reorderMsg && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up"
          data-testid="reorder-toast"
        >
          <RefreshCw size={14} className="text-[#FF6B00]" />
          {reorderMsg}
          <Link
            to="/cart"
            className="text-[#FF6B00] ml-2 hover:underline font-semibold"
            data-testid="reorder-go-to-cart"
          >
            View Cart
          </Link>
        </div>
      )}
    </div>
  );
}