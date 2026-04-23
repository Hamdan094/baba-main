// =============================================================================
// EmptySearch.js - Animated Empty State for Search/Filter Results
// =============================================================================
// Shown on the MenuPage when no items match the current search or
// category filter. A floating bowl illustration with a friendly message
// is more engaging than plain "no results" text.
// =============================================================================

import React from 'react';
import { Search, X } from 'lucide-react';

export default function EmptySearch({ search, category, onClear }) {
  return (
    <div
      className="text-center py-20 col-span-full"
      data-testid="empty-search-state"
    >
      {/* Floating animated bowl illustration */}
      <div className="relative w-24 h-24 mx-auto mb-6 animate-float">
        {/* Bowl circle */}
        <div className="w-24 h-24 rounded-full bg-[#FFF3E6] border-2 border-[#FF6B00]/20 flex items-center justify-center">
          <Search size={36} className="text-[#FF6B00]/40" />
        </div>

        {/* Floating X badge */}
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-100 border-2 border-white flex items-center justify-center">
          <X size={14} className="text-red-400" />
        </div>
      </div>

      {/* Main message */}
      <h3 className="font-heading text-xl text-[#1a1a1a] mb-2">No results found</h3>

      {/* Dynamic sub-message based on what filter is active */}
      <p className="text-[#999] text-sm mb-6 max-w-xs mx-auto">
        {search && category !== 'All'
          ? `No items matching "${search}" in ${category}`
          : search
          ? `No items matching "${search}"`
          : `No items in the ${category} category`
        }
      </p>

      {/* Clear filters button */}
      <button
        onClick={onClear}
        className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm"
        data-testid="clear-search-btn"
      >
        <X size={14} /> Clear Filters
      </button>
    </div>
  );
}