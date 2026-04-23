// =============================================================================
// CartPage.js - Shopping Cart and Checkout
// =============================================================================
// This page displays the customer's current cart contents and handles
// the checkout process. It is split into two columns on desktop:
//   - Left: list of cart items with quantity controls
//   - Right: order summary, customer details form and checkout button
//
// Delivery options section added below the collection notice:
//   - Uber Eats, Deliveroo and Just Eat links for customers who want delivery
//
// Checkout flow:
//   1. Customer reviews cart and fills in name, email, phone
//   2. Clicking "Pay £X.XX" creates an order in MongoDB (status: pending, unpaid)
//   3. A Stripe Checkout Session is created via the backend
//   4. Customer is redirected to Stripe's hosted payment page
//   5. After payment, Stripe redirects to /order-success?session_id=...
//   6. Cart is cleared after successful redirect to Stripe
//
// Security note: Prices are never trusted from the frontend.
// The backend always recalculates totals from the database.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft, CreditCard, MapPin, ExternalLink } from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

// =============================================================================
// DELIVERY PLATFORM DATA
// =============================================================================
// Links for customers who prefer delivery over collection.
// Displayed below the collection-only notice in the checkout form.

const DELIVERY_PLATFORMS = [
  {
    name: 'Uber Eats',
    url: 'https://www.ubereats.com/gb/store/baba-falooda/nj6sJxmhSkaoJPOEamzX7Q?diningMode=DELIVERY&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjIwJTIwTW9udHJvc2UlMjBHYXJkZW5zJTIyJTJDJTIycmVmZXJlbmNlJTIyJTNBJTIyZTNhZjRmMmYtM2ZiZC1mNDRhLTk1YzktMGEzZDA5NDAxNjkxJTIyJTJDJTIycmVmZXJlbmNlVHlwZSUyMiUzQSUyMnViZXJfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0E1MS4zNzQ1MDkzJTJDJTIybG9uZ2l0dWRlJTIyJTNBLTAuMTkxOTc3JTdE&ps=1',
    // Black background matching Uber Eats brand colours
    color: 'bg-black hover:bg-[#333] text-white',
  },
  {
    name: 'Deliveroo',
    url: 'https://deliveroo.co.uk/menu/london/upper-tooting/baba-falooda-tooting-228-upper-tooting-road-sw17-7ew?srsltid=AfmBOopCwNkFwzVjtLwGhXvjZ4gSoa1tvieU54ZthazDerCwFCA9Bers',
    // Teal background matching Deliveroo brand colours
    color: 'bg-[#00CCBC] hover:bg-[#00b8a9] text-white',
  },
  {
    name: 'Just Eat',
    url: 'https://www.just-eat.co.uk/restaurants-baba-falooda-tooting-tooting-broadway/menu',
    // Orange background matching Just Eat brand colours
    color: 'bg-[#FF8000] hover:bg-[#e67300] text-white',
  },
];

export default function CartPage() {
  // Cart state and operations from CartContext
  const { items, updateQuantity, removeItem, clearCart, total } = useCart();

  // Current logged-in user (for auto-filling customer details)
  const { user } = useAuth();

  // Customer details form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  // =============================================================================
  // AUTO-FILL CUSTOMER DETAILS FROM LOGGED-IN USER
  // =============================================================================

  useEffect(() => {
    // If a customer is logged in (not admin), pre-fill their name and email
    if (user && user.role !== 'admin') {
      setCustomerName(prev => prev || user.name || '');
      setCustomerEmail(prev => prev || user.email || '');
    }
  }, [user]);

  // =============================================================================
  // HANDLE CHECKOUT
  // =============================================================================

  const handleCheckout = async () => {
    // Client-side validation before sending to backend
    if (!customerName.trim()) { setError('Please enter your name'); return; }
    if (!customerEmail.trim()) { setError('Please enter your email'); return; }
    if (!customerPhone.trim()) { setError('Please enter your phone number'); return; }
    if (items.length === 0) { setError('Cart is empty'); return; }

    setError('');
    setLoading(true);

    try {
      // Step 1: Create the order in MongoDB
      // Backend calculates actual prices from database (security measure)
      const orderPayload = {
        items: items.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        notes
      };

      const { data: order } = await axios.post(`${API}/api/orders`, orderPayload, {
        headers: user ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {},
        withCredentials: true
      });

      // Step 2: Create Stripe Checkout Session
      const originUrl = window.location.origin;
      const { data: checkout } = await axios.post(`${API}/api/checkout`, {
        order_id: order.id,
        origin_url: originUrl
      });

      // Step 3: Clear cart before redirecting to Stripe
      clearCart();

      // Step 4: Redirect to Stripe hosted payment page
      window.location.href = checkout.url;

    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to process checkout');
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#FFF8F0] pt-24 pb-16 page-fade-in" data-testid="cart-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">

        {/* Back to menu navigation link */}
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-2 text-[#777] hover:text-[#FF6B00] text-sm mb-8 transition-colors"
          data-testid="back-to-menu-btn"
        >
          <ArrowLeft size={16} /> Back to Menu
        </button>

        <h1
          className="font-heading text-4xl sm:text-5xl text-[#1a1a1a] mb-8"
          data-testid="cart-title"
        >
          Your <span className="text-[#FF6B00]">Cart</span>
        </h1>

        {/* Empty cart state */}
        {items.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-cart">
            <ShoppingCart size={48} className="mx-auto mb-4 text-[#ddd]" />
            <p className="text-[#aaa] text-sm mb-6">Your cart is empty</p>
            <button
              onClick={() => navigate('/menu')}
              className="bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm"
              data-testid="browse-menu-btn"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* ---- LEFT COLUMN: Cart Items List ---- */}
            <div className="lg:col-span-3 space-y-4" data-testid="cart-items">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white border border-black/5 rounded-xl p-4 flex items-center gap-4 shadow-sm"
                  data-testid={`cart-item-${item.id}`}
                >
                  <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[#1a1a1a] text-sm font-semibold truncate">{item.name}</h3>
                    <p className="text-[#FF6B00] text-sm font-bold">£{item.price.toFixed(2)}</p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-[#FFF3E6] flex items-center justify-center text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors"
                      data-testid={`decrease-qty-${item.id}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-[#1a1a1a] text-sm w-6 text-center" data-testid={`qty-${item.id}`}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-[#FFF3E6] flex items-center justify-center text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors"
                      data-testid={`increase-qty-${item.id}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <span className="text-[#1a1a1a] text-sm font-semibold w-16 text-right">
                    £{(item.price * item.quantity).toFixed(2)}
                  </span>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[#ccc] hover:text-red-500 transition-colors"
                    data-testid={`remove-item-${item.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                onClick={clearCart}
                className="text-[#aaa] hover:text-red-500 text-xs transition-colors"
                data-testid="clear-cart-btn"
              >
                Clear Cart
              </button>
            </div>

            {/* ---- RIGHT COLUMN: Order Summary and Checkout Form ---- */}
            <div className="lg:col-span-2" data-testid="checkout-form">
              <div className="bg-white border border-black/5 rounded-2xl p-6 sticky top-24 shadow-sm">
                <h3 className="font-heading text-lg text-[#1a1a1a] mb-4">Order Summary</h3>

                {/* Collection only notice */}
                <div
                  className="bg-[#FFF3E6] border border-[#FF6B00]/15 rounded-xl p-3 mb-4 flex items-start gap-2.5"
                  data-testid="collection-notice"
                >
                  <MapPin size={16} className="text-[#FF6B00] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[#1a1a1a] text-xs font-semibold">Collection Only</p>
                    <p className="text-[#777] text-[11px]">
                      Orders here are for in-store collection at our Tooting branch.
                    </p>
                  </div>
                </div>

                {/* ================================================================
                    DELIVERY PLATFORMS SECTION
                    Shown below the collection notice so customers who want delivery
                    can easily find the alternative ordering options.
                    Each button opens the platform in a new tab.
                    ================================================================ */}
                <div className="mb-4">
                  <p className="text-[#999] text-[11px] font-semibold uppercase tracking-wider mb-2">
                    Want delivery instead?
                  </p>
                  <div className="flex flex-col gap-2">
                    {DELIVERY_PLATFORMS.map(platform => (
                      <a
                        key={platform.name}
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer" // Security: prevents new tab from accessing opener
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${platform.color}`}
                        data-testid={`delivery-${platform.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <span>{platform.name}</span>
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Divider between delivery and checkout sections */}
                <div className="border-t border-black/5 pt-4 mb-4">
                  <p className="text-[#999] text-[11px] font-semibold uppercase tracking-wider mb-3">
                    Or collect your order below
                  </p>

                  {/* Itemised price breakdown */}
                  <div className="space-y-2 mb-4 text-sm">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-[#777]">
                        <span>{item.name} x{item.quantity}</span>
                        <span>£{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-black/5 pt-2 flex justify-between text-[#1a1a1a] font-semibold">
                      <span>Total</span>
                      <span className="text-[#FF6B00]" data-testid="cart-total">£{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Customer details form */}
                <div className="space-y-3 mb-4">
                  {/* Name - required */}
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Your Name *"
                    className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                    data-testid="customer-name-input"
                  />

                  {/* Email - required for order confirmation email */}
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="Email *"
                    className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                    data-testid="customer-email-input"
                  />

                  {/* Phone - required for store to contact customer */}
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Phone Number *"
                    className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                    data-testid="customer-phone-input"
                  />

                  {/* Notes - optional special instructions */}
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Special instructions (optional)"
                    rows={2}
                    className="w-full bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 resize-none"
                    data-testid="order-notes-input"
                  />
                </div>

                {/* Validation error message */}
                {error && (
                  <p className="text-red-500 text-xs mb-3" data-testid="checkout-error">{error}</p>
                )}

                {/* Checkout button */}
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-3 rounded-full font-semibold text-sm transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                  data-testid="checkout-btn"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><CreditCard size={16} /> Pay £{total.toFixed(2)}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}