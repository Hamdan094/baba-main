// =============================================================================
// MenuPage.js - Full Menu Display with Filtering and AI Recommendations
// =============================================================================
// Animations added:
//   1. Page fade in    - whole page fades in on navigation
//   4. Card entrance   - menu cards stagger in one by one on load
//
// Other features:
//   - Skeleton screens while menu is loading
//   - Animated empty state when no items match filters
//   - Toast notification when item added to cart
//   - Delivery platforms banner (Uber Eats, Deliveroo, Just Eat)
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { MenuSkeletonGrid } from '../components/Skeletons';
import EmptySearch from '../components/EmptySearch';
import axios from 'axios';
import { ShoppingCart, Search, Sparkles, Heart, ExternalLink } from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [aiRec, setAiRec] = useState(null);
  const [preferences, setPreferences] = useState('');
  const [loadingRec, setLoadingRec] = useState(false);

  // loading: true while fetching menu items - shows skeleton screens
  const [loading, setLoading] = useState(true);

  // favouriteIds: Set of menu item IDs that the user has favourited
  const [favouriteIds, setFavouriteIds] = useState(new Set());

  const { addItem } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();

  const token = localStorage.getItem('token');
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true
  };

  // =============================================================================
  // FETCH MENU ITEMS ON LOAD
  // =============================================================================

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/menu`)
      .then(r => {
        setItems(r.data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // =============================================================================
  // FETCH FAVOURITES (LOGGED-IN CUSTOMERS ONLY)
  // =============================================================================

  useEffect(() => {
    if (user && user.role !== 'admin') {
      axios.get(`${API}/api/favourites`, authHeaders)
        .then(r => setFavouriteIds(new Set(r.data.map(f => f.id))))
        .catch(() => {});
    }
  }, [user]);

  // =============================================================================
  // TOGGLE FAVOURITE
  // =============================================================================

  const toggleFavourite = useCallback(async (itemId, itemName) => {
    if (!user || user.role === 'admin') return;
    const isFav = favouriteIds.has(itemId);
    try {
      if (isFav) {
        await axios.delete(`${API}/api/favourites/${itemId}`, authHeaders);
        setFavouriteIds(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        showToast(`Removed from favourites`, 'info');
      } else {
        await axios.post(`${API}/api/favourites/${itemId}`, {}, authHeaders);
        setFavouriteIds(prev => new Set([...prev, itemId]));
        showToast(`${itemName} added to favourites! ❤️`, 'success');
      }
    } catch (e) {
      console.error(e);
    }
  }, [user, favouriteIds, showToast]);

  // =============================================================================
  // ADD TO CART WITH TOAST
  // =============================================================================

  const handleAddToCart = (item) => {
    addItem(item);
    showToast(`${item.name} added to cart! 🛒`, 'success');
  };

  // =============================================================================
  // FILTER LOGIC
  // =============================================================================

  const categories = ['All', ...new Set(items.map(i => i.category))];

  const filtered = items.filter(item => {
    const matchCategory = category === 'All' || item.category === category;
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch && item.is_available;
  });

  // Clear all filters - passed to EmptySearch component
  const clearFilters = () => {
    setSearch('');
    setCategory('All');
  };

  // =============================================================================
  // GET AI RECOMMENDATION
  // =============================================================================

  const getRecommendation = async () => {
    if (!preferences.trim()) return;
    setLoadingRec(true);
    try {
      const { data } = await axios.post(`${API}/api/ai/recommend`, { preferences });
      setAiRec(data);
    } catch {
      setAiRec({ message: "Try our bestsellers!", recommendations: [] });
    } finally {
      setLoadingRec(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#FFF8F0] pt-24 pb-16 page-fade-in" data-testid="menu-page">
      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* Page header */}
        <div className="mb-8">
          <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">Handcrafted</span>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl text-[#1a1a1a] mt-2" data-testid="menu-title">
            Our Menu
          </h1>
          <p className="text-[#777] text-base mt-3 max-w-xl">
            Every creation is a tribute to Mumbai's dessert-making traditions.
          </p>
        </div>

        {/* ================================================================
            DELIVERY PLATFORMS BANNER
            Shown below page header for customers who prefer delivery.
            Each button opens the delivery platform in a new tab.
            ================================================================ */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white border border-black/5 rounded-2xl px-5 py-4 mb-6 shadow-sm">
          <span className="text-[#999] text-xs font-semibold uppercase tracking-wider">
            🛵 Want delivery?
          </span>
          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
            {/* Uber Eats - black brand colour */}
            <a
              href="https://www.ubereats.com/gb/store/baba-falooda/nj6sJxmhSkaoJPOEamzX7Q?diningMode=DELIVERY&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjIwJTIwTW9udHJvc2UlMjBHYXJkZW5zJTIyJTJDJTIycmVmZXJlbmNlJTIyJTNBJTIyZTNhZjRmMmYtM2ZiZC1mNDRhLTk1YzktMGEzZDA5NDAxNjkxJTIyJTJDJTIycmVmZXJlbmNlVHlwZSUyMiUzQSUyMnViZXJfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0E1MS4zNzQ1MDkzJTJDJTIybG9uZ2l0dWRlJTIyJTNBLTAuMTkxOTc3JTdE&ps=1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-black hover:bg-[#333] text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              data-testid="menu-ubereats-link"
            >
              Uber Eats <ExternalLink size={10} />
            </a>

            {/* Deliveroo - teal brand colour */}
            <a
              href="https://deliveroo.co.uk/menu/london/upper-tooting/baba-falooda-tooting-228-upper-tooting-road-sw17-7ew?srsltid=AfmBOopCwNkFwzVjtLwGhXvjZ4gSoa1tvieU54ZthazDerCwFCA9Bers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#00CCBC] hover:bg-[#00b8a9] text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              data-testid="menu-deliveroo-link"
            >
              Deliveroo <ExternalLink size={10} />
            </a>

            {/* Just Eat - orange brand colour */}
            <a
              href="https://www.just-eat.co.uk/restaurants-baba-falooda-tooting-tooting-broadway/menu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#FF8000] hover:bg-[#e67300] text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              data-testid="menu-justeat-link"
            >
              Just Eat <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* AI Recommendation Bar */}
        <div className="bg-white border border-[#FF6B00]/15 rounded-2xl p-6 mb-10 glow-orange shadow-sm" data-testid="menu-ai-section">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#FF6B00]" />
            <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">AI Recommendations</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && getRecommendation()}
              placeholder="Tell us what you like... (e.g., 'I love mango desserts')"
              className="flex-1 bg-[#FFF8F0] border border-black/10 rounded-full px-5 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
              data-testid="ai-preference-input"
            />
            <button
              onClick={getRecommendation}
              disabled={loadingRec}
              className="bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
              data-testid="ai-recommend-btn"
            >
              {loadingRec
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Sparkles size={14} />
              }
              Recommend
            </button>
          </div>
          {aiRec && (
            <div className="mt-4 animate-fade-in-up" data-testid="ai-menu-recommendation">
              <p className="text-[#1a1a1a] text-sm mb-3">{aiRec.message}</p>
              {aiRec.recommendations?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aiRec.recommendations.map((rec, i) => (
                    <span key={i} className="bg-[#FFF3E6] border border-[#FF6B00]/15 text-[#FF6B00] text-xs px-3 py-1.5 rounded-full">
                      {rec.name} — {rec.reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search and category filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full bg-white border border-black/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 shadow-sm"
              data-testid="menu-search-input"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  category === cat
                    ? 'bg-[#FF6B00] text-white shadow-sm'
                    : 'bg-white border border-black/10 text-[#777] hover:border-[#FF6B00]/30 hover:text-[#FF6B00]'
                }`}
                data-testid={`category-filter-${cat.replace(/\s/g, '-').toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================
            MENU CONTENT AREA
            Three states: loading skeleton, empty search, or cards grid.
            card-entrance on each card creates the staggered entrance effect
            using nth-child CSS selectors defined in index.css.
            ================================================================ */}
        {loading ? (
          <MenuSkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptySearch search={search} category={category} onClear={clearFilters} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="menu-grid">
            {filtered.map((item) => {
              const isFav = favouriteIds.has(item.id);
              return (
                <div
                  key={item.id}
                  // card-entrance triggers the staggered slide-up animation
                  // nth-child delays are applied automatically via CSS
                  className="menu-card card-entrance bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm"
                  data-testid={`menu-item-${item.id}`}
                >
                  <div className="overflow-hidden relative">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-64 object-contain bg-white"
                    />
                    {/* Popular badge for featured items */}
                    {item.is_featured && (
                      <span className="absolute top-3 left-3 bg-[#FF6B00] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                        Popular
                      </span>
                    )}
                    {/* Favourite heart button - only shown to logged-in customers */}
                    {user && user.role !== 'admin' && (
                      <button
                        onClick={() => toggleFavourite(item.id, item.name)}
                        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                          isFav ? 'bg-red-500 text-white' : 'bg-white/80 text-[#999] hover:text-red-500'
                        }`}
                        data-testid={`fav-btn-${item.id}`}
                      >
                        <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="font-heading text-base text-[#1a1a1a]">{item.name}</h3>
                      <span className="text-[#FF6B00] font-bold">£{item.price.toFixed(2)}</span>
                    </div>
                    <p className="text-[#999] text-xs mb-1">{item.category}</p>
                    <p className="text-[#777] text-xs mb-4 line-clamp-2">{item.description}</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {item.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="bg-[#FFF3E6] text-[#FF6B00] text-[10px] px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {/* Add to cart triggers toast notification */}
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-2 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
                      data-testid={`add-to-cart-${item.id}`}
                    >
                      <ShoppingCart size={14} /> Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}