// =============================================================================
// useScrollReveal.js - Scroll-Triggered Animation Hook
// =============================================================================
// A custom React hook that uses the IntersectionObserver API to detect when
// elements enter the viewport. Elements with the 'scroll-reveal' CSS class
// get the 'revealed' class added when they become visible, triggering the
// fade-up animation defined in index.css.
//
// Usage:
//   const ref = useScrollReveal();
//   <section ref={ref} className="scroll-reveal">...</section>
//
// How it works:
//   1. A ref is attached to a container element
//   2. IntersectionObserver watches all .scroll-reveal children inside it
//   3. When a child enters the viewport, 'revealed' class is added
//   4. The CSS transition animates opacity and translateY to their final values
// =============================================================================

import { useEffect, useRef } from 'react';

export default function useScrollReveal() {
  // ref: attached to the parent container that holds scroll-reveal elements
  const ref = useRef(null);

  useEffect(() => {
    // Get all elements with scroll-reveal class inside the container
    const elements = ref.current?.querySelectorAll('.scroll-reveal');
    if (!elements || elements.length === 0) return;

    // IntersectionObserver fires when elements enter or leave the viewport
    // threshold: 0.15 means the animation triggers when 15% of element is visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Add 'revealed' class which triggers the CSS transition
            entry.target.classList.add('revealed');
            // Unobserve after revealing - animation only plays once
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    // Start observing each scroll-reveal element
    elements.forEach(el => observer.observe(el));

    // Cleanup: disconnect observer when component unmounts
    return () => observer.disconnect();
  }, []);

  return ref;
}