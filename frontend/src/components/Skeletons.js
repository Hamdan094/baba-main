// =============================================================================
// Skeletons.js - Loading Skeleton Screen Components
// =============================================================================
// Skeleton screens show animated placeholder content while data is loading.
// They improve perceived performance by showing the page structure immediately
// rather than a blank screen or spinner.
//
// Components:
//   - MenuItemSkeleton    Used in MenuPage while items are loading
//   - FeaturedSkeleton   Used in HomePage featured section while loading
//   - OrderSkeleton      Used in AccountPage order history while loading
// =============================================================================

import React from 'react';

// =============================================================================
// MENU ITEM SKELETON
// =============================================================================
// Matches the shape of a real menu card with image, title, description and button

export function MenuItemSkeleton() {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
      {/* Image placeholder */}
      <div className="skeleton h-64 w-full" />

      <div className="p-5 space-y-3">
        {/* Name and price row */}
        <div className="flex justify-between items-center">
          <div className="skeleton h-4 w-32 rounded-full" />
          <div className="skeleton h-4 w-12 rounded-full" />
        </div>

        {/* Category */}
        <div className="skeleton h-3 w-20 rounded-full" />

        {/* Description lines */}
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="skeleton h-3 w-3/4 rounded-full" />

        {/* Tag pills */}
        <div className="flex gap-2">
          <div className="skeleton h-4 w-16 rounded-full" />
          <div className="skeleton h-4 w-12 rounded-full" />
        </div>

        {/* Add to cart button */}
        <div className="skeleton h-9 w-full rounded-full mt-2" />
      </div>
    </div>
  );
}

// =============================================================================
// FEATURED ITEM SKELETON
// =============================================================================
// Matches the shape of a featured card on the homepage

export function FeaturedSkeleton() {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
      {/* Image placeholder */}
      <div className="skeleton h-56 w-full" />

      <div className="p-6 space-y-3">
        {/* Name and price */}
        <div className="flex justify-between items-center">
          <div className="skeleton h-5 w-36 rounded-full" />
          <div className="skeleton h-5 w-14 rounded-full" />
        </div>

        {/* Description */}
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="skeleton h-3 w-2/3 rounded-full" />

        {/* Button */}
        <div className="skeleton h-10 w-full rounded-full mt-2" />
      </div>
    </div>
  );
}

// =============================================================================
// ORDER SKELETON
// =============================================================================
// Matches the shape of an order card in the AccountPage

export function OrderSkeleton() {
  return (
    <div className="bg-white border border-black/5 rounded-xl p-5 shadow-sm space-y-3">
      {/* Order header row */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32 rounded-full" />
          <div className="skeleton h-3 w-48 rounded-full" />
        </div>
        <div className="space-y-2 items-end flex flex-col">
          <div className="skeleton h-4 w-16 rounded-full" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Items list */}
      <div className="skeleton h-3 w-full rounded-full" />
      <div className="skeleton h-3 w-2/3 rounded-full" />

      {/* Reorder button */}
      <div className="skeleton h-8 w-28 rounded-full" />
    </div>
  );
}

// =============================================================================
// MENU PAGE SKELETON GRID
// =============================================================================
// Renders 6 skeleton cards in the same grid layout as the real menu

export function MenuSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <MenuItemSkeleton key={i} />
      ))}
    </div>
  );
}

// =============================================================================
// FEATURED SKELETON GRID
// =============================================================================
// Renders 3 skeleton cards for the homepage featured section

export function FeaturedSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[...Array(3)].map((_, i) => (
        <FeaturedSkeleton key={i} />
      ))}
    </div>
  );
}