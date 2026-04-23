// =============================================================================
// OrderSuccessPage.js - Payment Confirmation Page
// =============================================================================
// This page is shown after the customer completes payment on Stripe's
// hosted checkout page. Stripe redirects here with a session_id query parameter.
//
// The page uses a polling mechanism to check payment status:
//   1. Extracts session_id from the URL query parameters
//   2. Calls /api/checkout/status/{session_id} every 3 seconds
//   3. Retries up to 10 times (30 seconds total)
//   4. Shows success, processing, error or timeout state accordingly
//
// Why polling instead of instant success?
//   Stripe redirects to this page almost immediately after payment, but
//   their servers may not have finished processing the payment confirmation.
//   Polling gives Stripe time to fully process and confirm the payment.
//
// Page states:
//   - 'checking'    Initial state while first request is in flight
//   - 'processing'  Payment detected but not yet confirmed as paid
//   - 'success'     Payment confirmed - shows order confirmation
//   - 'expired'     Stripe session has expired
//   - 'timeout'     10 attempts made without confirmation
//   - 'error'       API request failed or no session_id in URL
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, AlertCircle, ArrowRight, MapPin } from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

export default function OrderSuccessPage() {
  // useSearchParams extracts query parameters from the URL
  // e.g. /order-success?session_id=cs_live_abc123
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id'); // Get the Stripe session ID

  // status: current state of the payment check (see states above)
  const [status, setStatus] = useState('checking');

  // orderData: the payment details returned when status is 'paid'
  // Contains: amount_total, currency, metadata
  const [orderData, setOrderData] = useState(null);

  // attempts: number of polling attempts made so far
  // Incremented by setTimeout to trigger the next poll via useEffect
  const [attempts, setAttempts] = useState(0);

  // =============================================================================
  // POLLING MECHANISM
  // =============================================================================
  // useEffect runs whenever sessionId or attempts changes.
  // Each poll either confirms payment (success) or schedules the next attempt.

  useEffect(() => {
    // If no session_id in URL, something went wrong
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const poll = async () => {
      try {
        // Check payment status with Stripe via our backend
        const response = await fetch(`${API}/api/checkout/status/${sessionId}`);
        const data = await response.json();
        console.log('Poll response:', data);
        if (data.payment_status === 'paid' || data.status === 'complete') {
          // Payment confirmed - show success state with order details
          setStatus('success');
          setOrderData(data);

        } else if (data.status === 'expired') {
          // Stripe session has expired
          setStatus('expired');

        } else if (attempts < 10) {
          // Payment not yet confirmed - wait 3 seconds and try again
          setStatus('processing');
          setTimeout(() => setAttempts(a => a + 1), 3000);

        } else {
          // 10 attempts made (30 seconds) without confirmation
          setStatus('timeout');
        }

      } catch (err) {
        console.error('Poll error:', err);
        if (attempts < 10) {
          setTimeout(() => setAttempts(a => a + 1), 3000);
        } else {
          setStatus('error');
        }
      }
    };

    poll();

  }, [sessionId, attempts]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div
      className="min-h-screen bg-[#FFF8F0] pt-24 flex items-center justify-center"
      data-testid="order-success-page"
    >
      <div className="max-w-md w-full mx-auto px-6 text-center">

        {/* ================================================================
            PROCESSING STATE
            ================================================================ */}
        {(status === 'checking' || status === 'processing') && (
          <div className="animate-fade-in-up" data-testid="payment-processing">
            <Clock size={48} className="mx-auto mb-4 text-[#FF6B00] animate-pulse" />
            <h2 className="font-heading text-2xl text-[#1a1a1a] mb-2">Processing Payment</h2>
            <p className="text-[#777] text-sm">Please wait while we confirm your payment...</p>
          </div>
        )}

        {/* ================================================================
            SUCCESS STATE
            ================================================================ */}
        {status === 'success' && (
          <div className="animate-fade-in-up" data-testid="payment-success">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle size={36} className="text-green-500" />
            </div>

            <h2 className="font-heading text-3xl text-[#1a1a1a] mb-2">Order Confirmed!</h2>
            <p className="text-[#777] text-sm mb-4">
              Thank you for your order. Your delicious falooda is being prepared!
            </p>

            {/* Collection only reminder */}
            <div
              className="bg-[#FFF3E6] border border-[#FF6B00]/15 rounded-xl p-3 mb-6 flex items-center gap-2.5 text-left"
              data-testid="collection-success-notice"
            >
              <MapPin size={16} className="text-[#FF6B00] flex-shrink-0" />
              <p className="text-[#555] text-xs">
                <span className="font-semibold text-[#1a1a1a]">Collection Only</span> — Please
                collect your order from our Tooting, London branch.
              </p>
            </div>

            {/* Amount paid - amount_total from Stripe is in pence, divide by 100 */}
            {orderData && (
              <div className="bg-white border border-black/5 rounded-xl p-4 mb-6 text-left shadow-sm">
                <p className="text-[#999] text-xs mb-1">Amount Paid</p>
                <p className="text-[#FF6B00] font-bold text-lg" data-testid="paid-amount">
                  {orderData.currency?.toUpperCase()} {(orderData.amount_total / 100).toFixed(2)}
                </p>
              </div>
            )}

            <Link
              to="/menu"
              className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-md"
              data-testid="back-to-menu-link"
            >
              Order More <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* ================================================================
            ERROR / TIMEOUT / EXPIRED STATE
            ================================================================ */}
        {(status === 'error' || status === 'timeout' || status === 'expired') && (
          <div className="animate-fade-in-up" data-testid="payment-error">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />

            {/* Dynamic heading based on specific error type */}
            <h2 className="font-heading text-2xl text-[#1a1a1a] mb-2">
              {status === 'expired'
                ? 'Session Expired'
                : status === 'timeout'
                ? 'Status Check Timeout'
                : 'Something Went Wrong'}
            </h2>

            {/* Dynamic message based on error type */}
            <p className="text-[#777] text-sm mb-6">
              {status === 'expired'
                ? 'Your payment session has expired. Please try again.'
                : 'We could not confirm your payment. Please check your email for confirmation or contact us.'}
            </p>

            <Link
              to="/menu"
              className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-md"
              data-testid="try-again-link"
            >
              Back to Menu <ArrowRight size={16} />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}