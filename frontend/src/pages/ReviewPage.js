// =============================================================================
// ReviewPage.js - Individual Order Review Submission Page
// =============================================================================
// This page allows customers to rate and review a specific order.
// It is accessed via a unique URL containing the order ID, which is sent
// to the customer by email when their order is marked as 'delivered'.
//
// URL format: /review/:orderId
// Example:    /review/abc123-def456-ghi789
//
// Page has three possible render states:
//   1. Review form    - customer can submit a rating and comment
//   2. Already reviewed - order has already been reviewed (prevents duplicates)
//   3. Thank you      - shown after successful review submission
//
// Data fetched on load:
//   - Order details from /api/orders/:orderId (shows what was ordered)
//   - Existing review from /api/reviews/order/:orderId (checks for duplicates)
//
// Both the frontend and backend prevent duplicate reviews:
//   - Frontend: checks for existing review on load, shows "Already Reviewed" state
//   - Backend: returns 409 Conflict if review already exists for the order
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Star, CheckCircle, ArrowRight } from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

// Baba Falooda logo hosted on Cloudinary
const LOGO_URL = "https://res.cloudinary.com/dlm6l9oqc/image/upload/v1776213419/AAF-1Cbbs4M_1740773204589_gzjibt.png";

export default function ReviewPage() {
  // useParams extracts the orderId from the URL path (/review/:orderId)
  const { orderId } = useParams();

  // order: the order document fetched from the backend
  // Used to display what the customer ordered and pre-fill customer name
  const [order, setOrder] = useState(null);

  // existingReview: set if the order has already been reviewed
  // When not null, the "Already Reviewed" state is shown instead of the form
  const [existingReview, setExistingReview] = useState(null);

  // Form field state
  const [rating, setRating] = useState(0);        // Selected star rating (1-5, 0 = not selected)
  const [hoveredStar, setHoveredStar] = useState(0); // Star being hovered over (for preview effect)
  const [comment, setComment] = useState('');      // Optional written review
  const [customerName, setCustomerName] = useState(''); // Pre-filled from order data

  // UI state
  const [submitted, setSubmitted] = useState(false); // True after successful submission
  const [loading, setLoading] = useState(false);      // True during form submission
  const [error, setError] = useState('');             // Validation or API error

  // =============================================================================
  // FETCH ORDER AND EXISTING REVIEW ON LOAD
  // =============================================================================

  useEffect(() => {
    const fetchData = async () => {
      // Fetch order details - separate try/catch so one failure doesn't block the other
      try {
        const { data: orderData } = await axios.get(`${API}/api/orders/${orderId}`);
        setOrder(orderData);
        // Pre-fill customer name from the order data
        setCustomerName(orderData.customer_name || '');
      } catch {
        // Order not found - form will render without order details
      }

      // Check if this order has already been reviewed
      try {
        const { data: reviewData } = await axios.get(`${API}/api/reviews/order/${orderId}`);
        // If request succeeds, a review exists - store it to show "Already Reviewed" state
        setExistingReview(reviewData);
      } catch {
        // 404 response means no review exists yet - this is the normal case
        // No action needed - existingReview stays null and form is shown
      }
    };

    if (orderId) fetchData(); // Only fetch if orderId is present in URL
  }, [orderId]); // Re-run if orderId changes

  // =============================================================================
  // SUBMIT REVIEW HANDLER
  // =============================================================================

  const handleSubmit = async () => {
    // Validate that a star rating has been selected before submitting
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // POST review to backend - orderId from URL links review to the order
      await axios.post(`${API}/api/reviews/${orderId}`, {
        rating,
        comment,
        customer_name: customerName
      });

      // Show thank you state after successful submission
      setSubmitted(true);

    } catch (e) {
      // Show backend error (e.g. "Review already submitted for this order")
      setError(e.response?.data?.detail || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // RATING LABEL LOOKUP
  // =============================================================================
  // Array indexed by star number for human-readable rating labels
  // Index 0 is empty because ratings start at 1
  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div
      className="min-h-screen bg-[#FFF8F0] pt-24 flex items-center justify-center px-6"
      data-testid="review-page"
    >
      <div className="max-w-md w-full">

        {/* Page header with logo */}
        <div className="text-center mb-6">
          <img
            src={LOGO_URL}
            alt="Baba Falooda"
            className="w-14 h-14 mx-auto mb-3 rounded-full shadow-lg"
          />
          <h1
            className="font-heading text-2xl text-[#1a1a1a]"
            data-testid="review-title"
          >
            Rate Your Order
          </h1>
        </div>

        {/* ================================================================
            STATE 1: ALREADY REVIEWED
            Shown when the order has already been reviewed.
            Displays the existing rating and comment.
            ================================================================ */}
        {existingReview ? (
          <div
            className="bg-white border border-black/5 rounded-2xl p-8 text-center shadow-sm"
            data-testid="already-reviewed"
          >
            <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
            <h2 className="font-heading text-lg text-[#1a1a1a] mb-2">Already Reviewed</h2>

            {/* Show the existing star rating */}
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  size={20}
                  className={s <= existingReview.rating ? 'text-[#FF6B00]' : 'text-[#ddd]'}
                  fill={s <= existingReview.rating ? '#FF6B00' : 'none'}
                />
              ))}
            </div>

            {/* Show existing comment if one was left */}
            {existingReview.comment && (
              <p className="text-[#777] text-sm italic mb-4">"{existingReview.comment}"</p>
            )}

            <Link to="/reviews" className="text-[#FF6B00] text-sm hover:underline">
              See all reviews
            </Link>
          </div>

        ) : submitted ? (
          /* ================================================================
             STATE 2: SUBMITTED - THANK YOU
             Shown after the customer successfully submits their review.
             Provides links to see all reviews or order again.
             ================================================================ */
          <div
            className="bg-white border border-black/5 rounded-2xl p-8 text-center shadow-sm animate-fade-in-up"
            data-testid="review-submitted"
          >
            {/* Green success icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-500" />
            </div>

            <h2 className="font-heading text-xl text-[#1a1a1a] mb-2">Thank You!</h2>
            <p className="text-[#777] text-sm mb-6">
              Your feedback helps us make every falooda better.
            </p>

            {/* Post-submission navigation options */}
            <div className="flex gap-3 justify-center">
              <Link
                to="/reviews"
                className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm"
                data-testid="view-all-reviews-link"
              >
                See Reviews <ArrowRight size={14} />
              </Link>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 border border-black/10 text-[#777] hover:text-[#FF6B00] hover:border-[#FF6B00]/30 px-5 py-2 rounded-full text-sm font-semibold transition-all"
              >
                Order Again
              </Link>
            </div>
          </div>

        ) : (
          /* ================================================================
             STATE 3: REVIEW FORM
             Main review submission form with:
             - Order summary showing what was ordered
             - Interactive star rating with hover preview
             - Optional comment textarea
             - Optional name input (pre-filled from order)
             ================================================================ */
          <div
            className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm"
            data-testid="review-form"
          >
            {/* Order summary - shows which items are being reviewed */}
            {order && (
              <div className="bg-[#FFF3E6] rounded-xl p-3 mb-5 text-center">
                <p className="text-[#999] text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Your Order
                </p>
                <p className="text-[#1a1a1a] text-sm font-medium">
                  {order.items?.map(i => i.name).join(', ')}
                </p>
              </div>
            )}

            {/* ---- STAR RATING ---- */}
            {/* Interactive stars with hover preview effect.
                hoveredStar shows a preview while hovering.
                rating stores the confirmed selection after clicking. */}
            <div className="text-center mb-5" data-testid="star-rating">
              <p className="text-[#777] text-sm mb-3">How was your experience?</p>

              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}           // Lock in the rating on click
                    onMouseEnter={() => setHoveredStar(s)} // Preview on hover
                    onMouseLeave={() => setHoveredStar(0)} // Clear preview on mouse leave
                    className="transition-transform duration-200 hover:scale-125"
                    data-testid={`star-${s}`}
                  >
                    <Star
                      size={32}
                      // Show hover preview if hovering, otherwise show selected rating
                      className={`transition-colors ${s <= (hoveredStar || rating) ? 'text-[#FF6B00]' : 'text-[#ddd]'}`}
                      fill={s <= (hoveredStar || rating) ? '#FF6B00' : 'none'}
                    />
                  </button>
                ))}
              </div>

              {/* Show rating label (Poor/Fair/Good/Great/Excellent) when hovering or selected */}
              {(hoveredStar || rating) > 0 && (
                <p
                  className="text-[#FF6B00] text-sm font-semibold"
                  data-testid="rating-label"
                >
                  {ratingLabels[hoveredStar || rating]}
                </p>
              )}
            </div>

            {/* Optional written comment */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell us more about your experience... (optional)"
              rows={3}
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 resize-none mb-3"
              data-testid="review-comment"
            />

            {/* Customer name field - pre-filled from order data */}
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full bg-[#FFF8F0] border border-black/10 rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 mb-4"
              data-testid="review-name"
            />

            {/* Validation/API error message */}
            {error && (
              <p className="text-red-500 text-xs mb-3" data-testid="review-error">
                {error}
              </p>
            )}

            {/* Submit button - disabled if no rating selected or loading */}
            <button
              onClick={handleSubmit}
              disabled={loading || rating === 0}
              className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-50 shadow-md"
              data-testid="submit-review-btn"
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}