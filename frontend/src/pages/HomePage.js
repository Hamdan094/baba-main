// =============================================================================
// HomePage.js - Landing Page
// =============================================================================
// The main landing page that customers see when they first visit the website.
//
// Animations:
//   1. Page fade in     - whole page fades in smoothly on load
//   3. Typewriter       - "BABA FALOODA" types itself out in the hero
//   4. Card entrance    - featured cards animate in one by one
//   8. Scroll reveal    - Featured, AI and Story sections reveal on scroll
//
// Footer includes:
//   - Instagram link
//   - Address, phone and hours
//   - Delivery platform links (Uber Eats, Deliveroo, Just Eat)
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import axios from 'axios';
import { ArrowRight, Star, MapPin, Clock, Sparkles, ShoppingCart, Phone, ExternalLink } from 'lucide-react';
import useTypewriter from '../hooks/useTypewriter';
import useScrollReveal from '../hooks/useScrollReveal';

const API = process.env.REACT_APP_BACKEND_URL;
const HERO_BG = "https://res.cloudinary.com/dlm6l9oqc/image/upload/v1776210991/Baba-Falooda-Tooting_9c2fa4f9ceb7bfd70b54db9d4436b262_fzg83j.jpg";

// Instagram SVG icon
const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

// =============================================================================
// DELIVERY PLATFORM DATA
// =============================================================================
const DELIVERY_PLATFORMS = [
  {
    name: 'Uber Eats',
    url: 'https://www.ubereats.com/gb/store/baba-falooda/nj6sJxmhSkaoJPOEamzX7Q?diningMode=DELIVERY&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjIwJTIwTW9udHJvc2UlMjBHYXJkZW5zJTIyJTJDJTIycmVmZXJlbmNlJTIyJTNBJTIyZTNhZjRmMmYtM2ZiZC1mNDRhLTk1YzktMGEzZDA5NDAxNjkxJTIyJTJDJTIycmVmZXJlbmNlVHlwZSUyMiUzQSUyMnViZXJfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0E1MS4zNzQ1MDkzJTJDJTIybG9uZ2l0dWRlJTIyJTNBLTAuMTkxOTc3JTdE&ps=1',
    color: 'bg-black hover:bg-[#333] text-white',
  },
  {
    name: 'Deliveroo',
    url: 'https://deliveroo.co.uk/menu/london/upper-tooting/baba-falooda-tooting-228-upper-tooting-road-sw17-7ew?srsltid=AfmBOopCwNkFwzVjtLwGhXvjZ4gSoa1tvieU54ZthazDerCwFCA9Bers',
    color: 'bg-[#00CCBC] hover:bg-[#00b8a9] text-white',
  },
  {
    name: 'Just Eat',
    url: 'https://www.just-eat.co.uk/restaurants-baba-falooda-tooting-tooting-broadway/menu',
    color: 'bg-[#FF8000] hover:bg-[#e67300] text-white',
  },
];

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [story, setStory] = useState(null);
  const [aiRec, setAiRec] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  // Typewriter effect for hero title
  const typedText = useTypewriter('BABA FALOODA', 100, 400);

  // Scroll reveal for homepage sections
  const scrollRef = useScrollReveal();

  // =============================================================================
  // FETCH DATA ON COMPONENT MOUNT
  // =============================================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, storyRes] = await Promise.all([
          axios.get(`${API}/api/menu`),
          axios.get(`${API}/api/story`)
        ]);
        setFeatured(menuRes.data.filter(i => i.is_featured).slice(0, 3));
        setStory(storyRes.data);
      } catch (e) {
        console.error('Failed to fetch homepage data:', e);
      }
    };
    fetchData();
  }, []);

  // =============================================================================
  // GET AI RECOMMENDATION
  // =============================================================================

  const getRecommendation = async () => {
    setLoadingRec(true);
    try {
      const { data } = await axios.post(`${API}/api/ai/recommend`, {
        preferences: "I'm visiting for the first time, what should I try?"
      });
      setAiRec(data);
    } catch {
      setAiRec({ message: "Our top picks are the Royal Falooda, Mango Falooda, and Kulfi Falooda!", recommendations: [] });
    } finally {
      setLoadingRec(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#FFF8F0] page-fade-in" data-testid="home-page">

      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          {/* Typewriter hero title with blinking cursor */}
          <h1
            className={`font-heading text-5xl sm:text-6xl lg:text-7xl text-white mb-4 ${typedText.length < 'BABA FALOODA'.length ? 'typewriter-cursor' : ''}`}
            data-testid="hero-title"
          >
            {typedText.length <= 4 ? (
              <span>{typedText}</span>
            ) : (
              <>
                <span>BABA </span>
                <span className="text-[#FF6B00]">{typedText.slice(5)}</span>
              </>
            )}
          </h1>

          <p className="text-base md:text-lg text-white/80 mb-8 max-w-2xl mx-auto animate-fade-in-up stagger-2">
            Mumbai's finest dessert tradition, now in Tooting, London. Experience the authentic taste of handcrafted falooda.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up stagger-3">
            <Link to="/menu" className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-lg" data-testid="hero-explore-menu-btn">
              Explore Our Menu <ArrowRight size={16} />
            </Link>
            <a href="#story" className="inline-flex items-center gap-2 border border-white/40 hover:border-[#FF6B00] text-white px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:bg-[#FF6B00] hover:text-white" data-testid="hero-our-story-btn">
              Our Story
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-white/70 text-xs animate-fade-in-up stagger-4">
            <div className="flex items-center gap-2"><MapPin size={14} className="text-[#FF6B00]" /> Tooting, London</div>
            <div className="flex items-center gap-2"><Clock size={14} className="text-[#FF6B00]" /> 12pm - 1am</div>
            <div className="flex items-center gap-2"><Star size={14} className="text-[#FF6B00]" /> 4.4 Rating</div>
            <div className="flex items-center gap-2"><ShoppingCart size={14} className="text-[#FF6B00]" /> Collection Only</div>
          </div>
        </div>
      </section>

      {/* Scroll reveal container - all sections inside animate on scroll */}
      <div ref={scrollRef}>

        {/* ================================================================
            FEATURED CREATIONS SECTION
            ================================================================ */}
        <section className="py-24 md:py-32 max-w-7xl mx-auto px-6 md:px-12 scroll-reveal" data-testid="featured-section">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">Handcrafted</span>
              <h2 className="font-heading text-3xl md:text-4xl text-[#1a1a1a] mt-2">Featured Creations</h2>
            </div>
            <Link to="/menu" className="text-[#FF6B00] text-sm font-medium hover:underline flex items-center gap-1" data-testid="view-full-menu-link">
              View Full Menu <ArrowRight size={14} />
            </Link>
          </div>

          {/* card-entrance class triggers staggered slide-up animation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featured.map((item) => (
              <div key={item.id} className="menu-card card-entrance bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm" data-testid={`featured-item-${item.id}`}>
                <div className="h-56 overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-contain bg-white" />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-heading text-lg text-[#1a1a1a]">{item.name}</h3>
                    <span className="text-[#FF6B00] font-bold text-lg">£{item.price.toFixed(2)}</span>
                  </div>
                  <p className="text-[#777] text-sm mb-4 line-clamp-2">{item.description}</p>
                  {/* Add to cart with toast notification */}
                  <button
                    onClick={() => { addItem(item); showToast(`${item.name} added to cart! 🛒`, 'success'); }}
                    className="w-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white py-2.5 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
                    data-testid={`add-to-cart-${item.id}`}
                  >
                    <ShoppingCart size={14} /> Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================
            AI RECOMMENDATION SECTION
            ================================================================ */}
        <section className="py-24 md:py-32 max-w-7xl mx-auto px-6 md:px-12 scroll-reveal" data-testid="ai-recommendation-section">
          <div className="relative bg-white border border-[#FF6B00]/15 rounded-3xl p-8 md:p-12 glow-orange overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B00]/5 rounded-full blur-[100px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FF6B00]/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-[#FF6B00]" />
                </div>
                <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">AI Powered</span>
              </div>
              <h2 className="font-heading text-3xl md:text-4xl text-[#1a1a1a] mb-3">Not sure what to order?</h2>
              <p className="text-[#777] text-base mb-6 max-w-xl">
                Let our AI recommend the perfect falooda based on your taste preferences.
              </p>
              {!aiRec ? (
                <button onClick={getRecommendation} disabled={loadingRec} className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 disabled:opacity-50 shadow-md" data-testid="get-ai-recommendation-btn">
                  {loadingRec ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Getting Recommendations...</> : <><Sparkles size={16} /> Get Personalised Picks</>}
                </button>
              ) : (
                <div className="space-y-4 animate-fade-in-up" data-testid="ai-recommendation-result">
                  <p className="text-[#1a1a1a] text-sm font-medium">{aiRec.message}</p>
                  {aiRec.recommendations?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {aiRec.recommendations.map((rec, i) => (
                        <div key={i} className="bg-[#FFF3E6] border border-[#FF6B00]/10 rounded-xl p-4">
                          <h4 className="text-[#FF6B00] font-semibold text-sm mb-1">{rec.name}</h4>
                          <p className="text-[#777] text-xs">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setAiRec(null)} className="text-[#FF6B00] text-xs hover:underline" data-testid="try-again-btn">Try different preferences</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================
            OUR STORY SECTION
            ================================================================ */}
        <section id="story" className="py-24 md:py-32 max-w-7xl mx-auto px-6 md:px-12 scroll-reveal" data-testid="story-section">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-lg">
                <video src={story?.video_url || ""} className="w-full h-[400px] md:h-[500px] object-cover rounded-2xl" autoPlay muted loop playsInline />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#FF6B00] rounded-2xl flex items-center justify-center rotate-6 shadow-lg">
                <span className="font-heading text-white text-lg -rotate-6">Since<br/>1986</span>
              </div>
            </div>
            <div className="md:col-span-7 md:pl-8">
              <span className="text-[#FF6B00] text-xs font-semibold uppercase tracking-widest">Mumbai to London</span>
              <h2 className="font-heading text-3xl md:text-4xl text-[#1a1a1a] mt-2 mb-6">{story?.title || "Our Story"}</h2>
              <div className="text-[#555] text-sm leading-relaxed space-y-4">
                {(story?.content || "").split('\n').filter(Boolean).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ================================================================
          FOOTER
          Includes: brand, nav links, Instagram, delivery platforms,
          address, phone, hours and copyright.
          ================================================================ */}
      <footer className="border-t border-black/5 bg-white pt-10 pb-6" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          {/* Top Row: Brand, Links and Social */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <span className="font-heading text-[#FF6B00] text-base">BABA FALOODA</span>
            <div className="flex items-center gap-6 text-[#999] text-xs">
              <Link to="/menu" className="hover:text-[#FF6B00] transition-colors">Menu</Link>
              <Link to="/branches" className="hover:text-[#FF6B00] transition-colors">Branches</Link>
              <Link to="/reviews" className="hover:text-[#FF6B00] transition-colors">Reviews</Link>
              <Link to="/cart" className="hover:text-[#FF6B00] transition-colors">Order Online</Link>
            </div>
            <a href="https://www.instagram.com/babafaloodauk" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#999] hover:text-[#FF6B00] transition-colors text-xs" data-testid="instagram-link">
              <InstagramIcon />
              <span>@babafaloodauk</span>
            </a>
          </div>

          {/* ================================================================
              DELIVERY PLATFORMS ROW
              Shows all three delivery platforms as branded buttons.
              Label makes it clear these are for delivery orders.
              ================================================================ */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 py-6 border-t border-black/5">
            <span className="text-[#999] text-xs font-semibold uppercase tracking-wider mr-2">
              Order for delivery:
            </span>
            {DELIVERY_PLATFORMS.map(platform => (
              <a
                key={platform.name}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all ${platform.color}`}
                data-testid={`footer-delivery-${platform.name.toLowerCase().replace(' ', '-')}`}
              >
                {platform.name} <ExternalLink size={11} />
              </a>
            ))}
          </div>

          {/* Address, Phone and Hours Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-[#999] text-xs mb-8 pb-6 border-b border-black/5">
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-[#FF6B00] mt-0.5 flex-shrink-0" />
              <span>228 Upper Tooting Road, London, SW17 7EW</span>
            </div>
            <span className="hidden sm:block text-[#ddd]">|</span>
            <a href="tel:02038760285" className="flex items-center gap-2 hover:text-[#FF6B00] transition-colors" data-testid="footer-phone">
              <Phone size={13} className="text-[#FF6B00]" />
              <span>020 3876 0285</span>
            </a>
            <span className="hidden sm:block text-[#ddd]">|</span>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#FF6B00]" />
              <span>12pm – 1am Daily</span>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-[#bbb] text-xs">
              &copy; {new Date().getFullYear()} Baba Falooda. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}