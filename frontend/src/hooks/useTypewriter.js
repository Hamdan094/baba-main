// =============================================================================
// useTypewriter.js - Typewriter Text Animation Hook
// =============================================================================
// A custom React hook that creates a typewriter effect for any text string.
// Characters are revealed one at a time with a configurable delay between each.
//
// Usage:
//   const displayed = useTypewriter('BABA FALOODA', 100);
//   <h1>{displayed}</h1>
//
// Parameters:
//   text  - the full string to type out
//   speed - milliseconds between each character (default: 80ms)
//   delay - milliseconds to wait before starting (default: 300ms)
// =============================================================================

import { useState, useEffect } from 'react';

export default function useTypewriter(text, speed = 80, delay = 300) {
  // displayed: the portion of text revealed so far
  const [displayed, setDisplayed] = useState('');

  // started: false until the initial delay has passed
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Wait for the initial delay before starting to type
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    // If all characters are already displayed, stop
    if (displayed.length >= text.length) return;

    // Add one character at a time with the speed delay
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    // Cleanup timer on each render to prevent stacking
    return () => clearTimeout(timer);
  }, [displayed, text, speed, started]);

  return displayed;
}