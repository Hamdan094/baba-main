// =============================================================================
// ReviewsPage.js - Public Customer Reviews Page
// =============================================================================
// This page displays all customer reviews publicly. It shows:
//   1. A statistics card with average rating, total count and star breakdown bar chart
//   2. A list of individual review cards sorted by newest first
//
// Data fetched on load (simultaneously using Promise.all for performance):
//   - /api/reviews       - all customer reviews
//   - /api/reviews/stats - aggregate statistics (average, total, breakdown)
//
// The rating breakdown bar chart uses inline styles for dynamic widths
// because Tailwind CSS cannot generate arbitrary percentage values at runtime.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Star, MessageCircle, TrendingUp } from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

export default function ReviewsPage() {
  // reviews: array of all customer review objects
  const [reviews, setReviews] = useState([]);

  // stats: aggregate review statistics object
  // Contains: average_rating, total_reviews, rating_breakdown (object with keys 1-5)
  const [stats, setStats] = useState(null);

  // loading: true while fetching data, shows spinner
  const [loading, setLoading] = useState(true);

  // =============================================================================
  // FETCH REVIEWS AND STATS ON LOAD
  // =============================================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Promise.all fetches both endpoints simultaneously (parallel requests)
        // This is faster than sequential await calls since neither depends on the other
        const [reviewsRes, statsRes] = await Promise.all([
          axios.get(`${API}/api/reviews`),
          axios.get(`${API}/api/reviews/stats`)
        ]);

        setReviews(reviewsRes.data);
        setStats(statsRes.data);

      } catch (e) {
        console.error('Failed to fetch reviews:', e);
      } finally {
        // Always hide loading spinner when done, even if requests failed
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty array - only runs once when component mounts

  // =============================================================================
  // TIME AGO HELPER FUNCTION
  // =============================================================================
  // Converts an ISO timestamp to a human-readable relative time string.
  // Makes reviews feel more recent and personal than showing a full date.
  // Examples: "5m ago", "2h ago", "3d ago", "14 Jan"

  const timeAgo = (dateStr) => {
    // Calculate difference in milliseconds between now and the review date
    const diff = Date.now() - new Date(dateStr).getTime();

    const mins = Math.floor(diff / 60000);         // Convert ms to minutes
    if (mins < 60) return `${mins}m ago`;           // Less than 1 hour

    const hrs = Math.floor(mins / 60);             // Convert minutes to hours
    if (hrs < 24) return `${hrs}h ago`;             // Less than 1 day

    const days = Math.floor(hrs / 24);             // Convert hours to days
    if (days < 30) return `${days}d ago`;           // Less than 1 month

    // For older reviews, show the formatted date (e.g. "14 Jan")
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#FFF8F0] pt-24 pb-16" data-testid="reviews-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">

        {/* Page header */}
        <div className="mb-10">
          <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">
            Social Proof
          </span>
          <h1
            className="font-heading text-4xl sm:text-5xl lg:text-6xl text-[#1a1a1a] mt-2"
            data-testid="reviews-title"
          >
            Customer Reviews
          </h1>
          <p className="text-[#777] text-base mt-3 max-w-xl">
            See what our customers say about their Baba Falooda experience.
          </p>
        </div>

        {/* Loading spinner while fetching data */}
        {loading ? (
          <div className="text-center py-16">
            <span className="w-6 h-6 border-2 border-[#FF6B00]/30 border-t-[#FF6B00] rounded-full animate-spin inline-block" />
          </div>
        ) : (
          <>
            {/* ================================================================
                STATS CARD
                Only shown when reviews exist (total_reviews > 0).
                Shows average rating with filled stars and a breakdown chart.
                ================================================================ */}
            {stats && stats.total_reviews > 0 && (
              <div
                className="bg-white border border-black/5 rounded-2xl p-6 mb-8 shadow-sm"
                data-testid="review-stats"
              >
                <div className="flex flex-col sm:flex-row items-center gap-6">

                  {/* ---- Left: Average Rating Display ---- */}
                  <div className="text-center sm:border-r sm:border-black/5 sm:pr-8">
                    {/* Large orange average rating number */}
                    <p
                      className="text-[#FF6B00] text-5xl font-heading"
                      data-testid="avg-rating"
                    >
                      {stats.average_rating}
                    </p>

                    {/* Star icons - filled up to the rounded average rating */}
                    <div className="flex justify-center gap-0.5 my-1.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={16}
                          className={s <= Math.round(stats.average_rating)
                            ? 'text-[#FF6B00]'
                            : 'text-[#ddd]'
                          }
                          fill={s <= Math.round(stats.average_rating) ? '#FF6B00' : 'none'}
                        />
                      ))}
                    </div>

                    {/* Total review count with grammatical plural handling */}
                    <p className="text-[#999] text-xs">
                      {stats.total_reviews} review{stats.total_reviews !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* ---- Right: Star Breakdown Bar Chart ---- */}
                  {/* Shows distribution of ratings from 5 stars down to 1 star */}
                  <div className="flex-1 w-full space-y-1.5">
                    {[5, 4, 3, 2, 1].map(r => {
                      // Get count for this star rating (default 0 if none)
                      const count = stats.rating_breakdown[r] || 0;

                      // Calculate percentage for bar width
                      // Inline style used because Tailwind can't generate dynamic percentages
                      const pct = stats.total_reviews > 0
                        ? (count / stats.total_reviews) * 100
                        : 0;

                      return (
                        <div key={r} className="flex items-center gap-2 text-xs">
                          {/* Star number label */}
                          <span className="text-[#999] w-3">{r}</span>

                          {/* Small filled star icon */}
                          <Star size={10} className="text-[#FF6B00]" fill="#FF6B00" />

                          {/* Progress bar container */}
                          <div className="flex-1 h-2 bg-[#f0ebe6] rounded-full overflow-hidden">
                            {/* Filled portion - width set dynamically via inline style */}
                            <div
                              className="h-full bg-[#FF6B00] rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Count number on the right */}
                          <span className="text-[#aaa] w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                REVIEWS LIST
                ================================================================ */}
            {reviews.length === 0 ? (

              /* Empty state - no reviews yet */
              <div
                className="text-center py-16 bg-white border border-black/5 rounded-2xl shadow-sm"
                data-testid="no-reviews"
              >
                <MessageCircle size={40} className="mx-auto mb-3 text-[#ddd]" />
                <p className="text-[#999] text-sm mb-4">
                  No reviews yet. Be the first to share your experience!
                </p>
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm"
                >
                  Order Now
                </Link>
              </div>

            ) : (

              /* Reviews list - one card per review, sorted newest first */
              <div className="space-y-4" data-testid="reviews-list">
                {reviews.map(review => (
                  <div
                    key={review.id}
                    className="bg-white border border-black/5 rounded-xl p-5 shadow-sm"
                    data-testid={`review-card-${review.id}`}
                  >
                    {/* Review header: customer name, time ago and star rating */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {/* Customer name - falls back to 'Anonymous' if not provided */}
                        <p
                          className="text-[#1a1a1a] text-sm font-semibold"
                          data-testid={`reviewer-name-${review.id}`}
                        >
                          {review.customer_name || 'Anonymous'}
                        </p>

                        {/* Relative timestamp (e.g. "2h ago") */}
                        <p className="text-[#aaa] text-[10px]">
                          {timeAgo(review.created_at)}
                        </p>
                      </div>

                      {/* Star rating - filled stars up to the review's rating */}
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            size={14}
                            className={s <= review.rating ? 'text-[#FF6B00]' : 'text-[#ddd]'}
                            fill={s <= review.rating ? '#FF6B00' : 'none'}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Optional written comment - only rendered if one was left */}
                    {review.comment && (
                      <p className="text-[#555] text-sm mb-2">{review.comment}</p>
                    )}

                    {/* Item tags showing which items the customer ordered */}
                    {review.items?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.items.map((item, i) => (
                          <span
                            key={i}
                            className="bg-[#FFF3E6] text-[#FF6B00] text-[10px] px-2 py-0.5 rounded-full"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}