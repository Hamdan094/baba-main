// =============================================================================
// BackToTop.js - Floating Back to Top Button
// =============================================================================
// A floating button that appears in the bottom-left corner when the user
// scrolls more than 400px down the page. Clicking it smoothly scrolls
// back to the top of the page.
//
// Appears with a fade-in animation and disappears when near the top.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  // visible: true when user has scrolled more than 400px down
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Listen to scroll events to show/hide the button
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup: remove listener when component unmounts
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smoothly scrolls the window back to the top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Don't render anything if not visible
  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-8 left-8 z-[9998] w-11 h-11 rounded-full bg-[#1a1a1a] hover:bg-[#FF6B00] text-white flex items-center justify-center shadow-lg transition-all duration-300 hover-bounce animate-fade-in-up"
      data-testid="back-to-top-btn"
      aria-label="Back to top"
    >
      <ArrowUp size={18} />
    </button>
  );
}