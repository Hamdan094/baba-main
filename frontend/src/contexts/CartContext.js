// =============================================================================
// CartContext.js - Global Shopping Cart State Management
// =============================================================================
// This file manages the shopping cart state across the entire application
// using React's Context API. It provides cart data and operations to any
// component without needing to pass props through multiple layers.
//
// How it works:
//   1. CartProvider wraps the entire app in App.js
//   2. Any component calls useCart() to access cart data and functions
//   3. Cart state lives in React memory (not localStorage or database)
//   4. Cart is cleared after successful checkout (clearCart called in CartPage)
//
// Note: Cart data is lost on page refresh - this is intentional since
// orders are for immediate collection at the restaurant.
// =============================================================================

import React, { createContext, useContext, useState, useCallback } from 'react';

// Create the cart context with null as the default value
const CartContext = createContext(null);

// =============================================================================
// CART PROVIDER COMPONENT
// =============================================================================
// Wraps the entire application to provide cart state to all child components.

export function CartProvider({ children }) {

  // items: array of cart items
  // Each item contains all menu item fields plus a quantity property
  // Example: { id: "abc", name: "Royal Falooda", price: 7.99, quantity: 2, ... }
  const [items, setItems] = useState([]);

  // =============================================================================
  // ADD ITEM TO CART
  // =============================================================================
  // useCallback memoises this function to prevent unnecessary re-renders.
  // The function only changes if its dependencies change (empty array = never).

  const addItem = useCallback((menuItem) => {
    setItems(prev => {
      // Check if this item is already in the cart
      const existing = prev.find(i => i.id === menuItem.id);

      if (existing) {
        // Item already exists - increment its quantity by 1
        // Uses map to create a new array (React requires immutable state updates)
        return prev.map(i =>
          i.id === menuItem.id
            ? { ...i, quantity: i.quantity + 1 }  // Spread existing item, update quantity
            : i
        );
      }

      // Item is new - add it to the cart with quantity 1
      // Spread operator copies all menu item properties (name, price, image etc.)
      return [...prev, { ...menuItem, quantity: 1 }];
    });
  }, []); // No dependencies - function logic never needs to change

  // =============================================================================
  // REMOVE ITEM FROM CART
  // =============================================================================

  const removeItem = useCallback((itemId) => {
    // Filter out the item with the matching ID
    // Creates a new array without the removed item
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  // =============================================================================
  // UPDATE ITEM QUANTITY
  // =============================================================================

  const updateQuantity = useCallback((itemId, quantity) => {
    // If quantity reaches 0 or below, remove the item entirely
    // This handles the case where user clicks minus on quantity 1
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== itemId));
      return;
    }

    // Otherwise update the quantity to the new value
    setItems(prev =>
      prev.map(i =>
        i.id === itemId
          ? { ...i, quantity }  // Update quantity for matching item
          : i                   // Leave other items unchanged
      )
    );
  }, []);

  // =============================================================================
  // CLEAR CART
  // =============================================================================

  const clearCart = useCallback(() => {
    // Reset items to empty array
    // Called after successful checkout to empty the cart
    setItems([]);
  }, []);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================
  // These are calculated from the items array on every render.
  // No need to store them in state - they're always derived from items.

  // Total price: sum of (price × quantity) for all items
  // reduce() iterates through all items and accumulates the total
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0  // Initial value of the accumulator
  );

  // Total item count: sum of quantities across all items
  // Used to show the badge number on the cart icon in the Navbar
  // e.g. 2x Royal Falooda + 1x Mango Lassi = itemCount of 3
  const itemCount = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================
  // All cart data and functions made available to child components via useCart()

  return (
    <CartContext.Provider value={{
      items,           // Array of cart items with quantities
      addItem,         // Add a menu item to cart (or increment if exists)
      removeItem,      // Remove an item completely from cart
      updateQuantity,  // Set a specific quantity for an item
      clearCart,       // Empty the entire cart
      total,           // Total price of all items (£)
      itemCount        // Total number of individual items in cart
    }}>
      {children}
    </CartContext.Provider>
  );
}

// =============================================================================
// useCart HOOK
// =============================================================================
// Custom hook for accessing cart context in any component.
// Usage: const { items, addItem, total, itemCount } = useCart();

export const useCart = () => useContext(CartContext);
