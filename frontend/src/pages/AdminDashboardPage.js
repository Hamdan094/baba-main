// =============================================================================
// AdminDashboardPage.js - Store Administration Dashboard
// =============================================================================
// The main control panel for Baba Falooda store administrators.
// Protected route - redirects to /admin if user is not an admin.
//
// Four tabs:
//   1. Dashboard  - Analytics charts: revenue, top items, category breakdown
//   2. Orders     - Real-time order management with status updates
//   3. Menu       - Create, edit and delete menu items
//   4. Our Story  - Edit the homepage story content and video URL
//
// Key features:
//   - Auto-refresh: Orders poll every 30 seconds for new orders
//   - New order notifications: Red badge and bell notification in header
//   - Real-time status updates: Admin can move orders through workflow
//   - Analytics: Recharts visualisations of sales data
//   - Time period filter: Today, Last 7 Days, Last 30 Days, All Time
//   - Responsive: Collapsible sidebar for mobile screens
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Recharts components for analytics visualisations
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// Lucide icon imports
import {
  LayoutDashboard, ShoppingBag, TrendingUp, BookOpen, LogOut, Menu as MenuIcon,
  X, Package, DollarSign, Users, Edit2, Save, Trash2, Bell, Calendar
} from 'lucide-react';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

// Colour palette for pie chart segments - cycles if more categories than colours
const COLORS = ['#FF6B00', '#FF8C00', '#FF4500', '#FFA500', '#FFD700', '#FF6347'];

// Auto-refresh interval for order polling (30 seconds in milliseconds)
const REFRESH_INTERVAL = 30000;

// =============================================================================
// TIME PERIOD FILTER OPTIONS
// =============================================================================
// Each option has a label shown on the button and a days value.
// days: null means show all time (no date filter applied).

const TIME_PERIODS = [
  { label: 'Today',      days: 1    },
  { label: '7 Days',     days: 7    },
  { label: '30 Days',    days: 30   },
  { label: 'All Time',   days: null },
];

export default function AdminDashboardPage() {
  // user: current logged-in user (checked for admin role)
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // activeTab: controls which content panel is currently visible
  const [activeTab, setActiveTab] = useState('dashboard');

  // sidebarOpen: controls mobile sidebar visibility (hidden on desktop via CSS)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // trends: analytics data from /api/admin/orders/trends
  // Contains: total_orders, total_revenue, daily_revenue, top_items, category_breakdown
  const [trends, setTrends] = useState(null);

  // orders: array of all paid orders from /api/admin/orders
  const [orders, setOrders] = useState([]);

  // menuItems: array of all menu items from /api/menu
  const [menuItems, setMenuItems] = useState([]);

  // story: the Our Story content object (title, content, image_url, video_url)
  const [story, setStory] = useState({ title: '', content: '', image_url: '', video_url: '' });

  // storyLoading: true while saving story to prevent double-saves
  const [storyLoading, setStoryLoading] = useState(false);

  // editItem: the menu item currently being edited (null = creating new item)
  const [editItem, setEditItem] = useState(null);

  // newOrderCount: number of new orders received since last Orders tab visit
  // Shown as red badge on Orders nav item and bell notification in header
  const [newOrderCount, setNewOrderCount] = useState(0);

  // lastRefresh: timestamp of last order poll - displayed in sidebar footer
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // prevOrderIds: ref stores the Set of order IDs from the previous fetch
  // useRef instead of useState because changes don't need to trigger re-renders
  // Used to detect new orders by comparing current IDs against previous IDs
  const prevOrderIds = useRef(new Set());

  // selectedPeriod: currently active time period filter for dashboard stats
  // Defaults to 'All Time' so behaviour is unchanged on first load
  const [selectedPeriod, setSelectedPeriod] = useState('All Time');

  // filteredTrends: trends data filtered by the selected time period
  // Derived from the full trends data whenever selectedPeriod or trends changes
  const [filteredTrends, setFilteredTrends] = useState(null);

  // menuForm: controlled form state for creating/editing menu items
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Signature Faloodas',
    image_url: '',
    is_available: true,
    is_featured: false,
    tags: ''  // Stored as comma-separated string, converted to array on save
  });

  // Auth headers included in all admin API requests
  const token = localStorage.getItem('token');
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true
  };

  // =============================================================================
  // INITIALISATION AND AUTO-REFRESH
  // =============================================================================

  useEffect(() => {
    // Redirect non-admin users back to admin login page
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }

    // Fetch all data on initial load
    fetchAll();

    // Set up auto-refresh to poll for new orders every 30 seconds
    // Provides near-real-time order notifications without WebSockets
    const interval = setInterval(() => {
      fetchOrders();              // Check for new orders
      setLastRefresh(new Date()); // Update "last refreshed" timestamp in sidebar
    }, REFRESH_INTERVAL);

    // Cleanup: clear interval when component unmounts to prevent memory leaks
    return () => clearInterval(interval);
  }, [user, navigate]);

  // =============================================================================
  // APPLY TIME PERIOD FILTER TO TRENDS DATA
  // =============================================================================
  // Runs whenever the full trends data or selected period changes.
  // Filters the daily_revenue, top_items and category_breakdown arrays
  // to only include data within the selected time window.
  // The stat cards (total_orders, total_revenue) are also recalculated.

  useEffect(() => {
    if (!trends) return;

    // Find the selected period config object
    const period = TIME_PERIODS.find(p => p.label === selectedPeriod);

    if (!period || period.days === null) {
      // All Time: use full unfiltered data
      setFilteredTrends(trends);
      return;
    }

    // Calculate the cutoff date - only include data after this date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period.days);
    const cutoffStr = cutoff.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Filter daily_revenue to only include dates after the cutoff
    const filteredRevenue = (trends.daily_revenue || []).filter(
      d => d.date >= cutoffStr
    );

    // Recalculate total revenue from filtered daily revenue
    const filteredTotalRevenue = filteredRevenue.reduce(
      (sum, d) => sum + d.revenue, 0
    );

    // Recalculate total orders from filtered daily revenue
    // We use the orders array to count orders within the period
    const filteredOrders = orders.filter(o => {
      const orderDate = o.created_at?.split('T')[0];
      return orderDate >= cutoffStr;
    });

    // Recalculate top items from filtered orders
    const itemCounts = {};
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });
    const filteredTopItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Recalculate category breakdown from filtered orders
    const categoryCounts = {};
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const cat = item.category || 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + item.quantity;
      });
    });
    const filteredCategoryBreakdown = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }));

    // Set filtered trends combining recalculated stats with filtered chart data
    setFilteredTrends({
      total_orders: filteredOrders.length,
      total_revenue: Math.round(filteredTotalRevenue * 100) / 100,
      daily_revenue: filteredRevenue,
      top_items: filteredTopItems.length > 0 ? filteredTopItems : trends.top_items,
      category_breakdown: filteredCategoryBreakdown.length > 0
        ? filteredCategoryBreakdown
        : trends.category_breakdown,
    });

  }, [trends, selectedPeriod, orders]); // Re-run when any of these change

  // =============================================================================
  // FETCH ORDERS (USED FOR POLLING)
  // =============================================================================
  // Called every 30 seconds by the auto-refresh interval.
  // Detects new orders by comparing current IDs against previously seen IDs.

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get(`${API}/api/admin/orders`, authHeaders);

      // Build a Set of current order IDs for fast O(1) lookup
      const currentIds = new Set(data.map(o => o.id));

      // Find orders that weren't present in the previous fetch
      const newOnes = data.filter(o => !prevOrderIds.current.has(o.id));

      // Only count as new if we had previous data (not the initial load)
      if (prevOrderIds.current.size > 0 && newOnes.length > 0) {
        setNewOrderCount(prev => prev + newOnes.length);
      }

      // Update the ref for next comparison cycle
      prevOrderIds.current = currentIds;
      setOrders(data);

    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  };

  // =============================================================================
  // FETCH ALL DATA ON LOAD
  // =============================================================================
  // Uses Promise.all to fetch all data simultaneously (parallel requests).

  const fetchAll = async () => {
    try {
      const [trendsRes, ordersRes, menuRes, storyRes] = await Promise.all([
        axios.get(`${API}/api/admin/orders/trends`, authHeaders), // Analytics data
        axios.get(`${API}/api/admin/orders`, authHeaders),         // Paid orders list
        axios.get(`${API}/api/menu`),                              // All menu items
        axios.get(`${API}/api/story`)                              // Story content
      ]);

      setTrends(trendsRes.data);

      // Store initial order IDs so auto-refresh can detect new arrivals
      prevOrderIds.current = new Set(ordersRes.data.map(o => o.id));
      setOrders(ordersRes.data);
      setMenuItems(menuRes.data);
      setStory(storyRes.data);

    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    }
  };

  // =============================================================================
  // LOGOUT
  // =============================================================================

  const handleLogout = async () => {
    await logout();       // Clear JWT token and user state via AuthContext
    navigate('/admin');   // Redirect to admin login page
  };

  // =============================================================================
  // UPDATE ORDER STATUS
  // =============================================================================
  // Optimistically updates the UI immediately while also saving to the backend.
  // Note: marking as 'collected' triggers a review request email (handled by backend).

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(
        `${API}/api/admin/orders/${orderId}/status`,
        { status },
        authHeaders
      );

      // Update order in local state immediately without waiting for re-fetch
      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, status } : o)
      );

    } catch (e) {
      console.error('Failed to update order status:', e);
    }
  };

  // =============================================================================
  // SAVE STORY CONTENT
  // =============================================================================

  const saveStory = async () => {
    setStoryLoading(true);
    try {
      // Saves all story fields including video_url to MongoDB
      await axios.put(`${API}/api/admin/story`, story, authHeaders);
    } catch (e) {
      console.error('Failed to save story:', e);
    } finally {
      setStoryLoading(false);
    }
  };

  // =============================================================================
  // SAVE MENU ITEM (CREATE OR UPDATE)
  // =============================================================================

  const saveMenuItem = async () => {
    const data = {
      ...menuForm,
      price: parseFloat(menuForm.price) || 0,  // Convert price string to float
      // Convert comma-separated tags string to cleaned array
      tags: menuForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      if (editItem) {
        // Update existing item
        await axios.put(`${API}/api/admin/menu/${editItem.id}`, data, authHeaders);
      } else {
        // Create new item
        await axios.post(`${API}/api/admin/menu`, data, authHeaders);
      }

      // Reset form after successful save
      setEditItem(null);
      setMenuForm({
        name: '', description: '', price: '',
        category: 'Signature Faloodas', image_url: '',
        is_available: true, is_featured: false, tags: ''
      });

      // Re-fetch menu to show updated list
      const { data: updated } = await axios.get(`${API}/api/menu`);
      setMenuItems(updated);

    } catch (e) {
      console.error('Failed to save menu item:', e);
    }
  };

  // =============================================================================
  // DELETE MENU ITEM
  // =============================================================================

  const deleteMenuItem = async (id) => {
    try {
      await axios.delete(`${API}/api/admin/menu/${id}`, authHeaders);

      // Remove item from local state immediately
      setMenuItems(prev => prev.filter(m => m.id !== id));

    } catch (e) {
      console.error('Failed to delete menu item:', e);
    }
  };

  // =============================================================================
  // START EDITING A MENU ITEM
  // =============================================================================
  // Pre-fills the menu form with existing item data for editing.

  const startEdit = (item) => {
    setEditItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: String(item.price),          // Convert number to string for input
      category: item.category,
      image_url: item.image_url,
      is_available: item.is_available,
      is_featured: item.is_featured,
      tags: (item.tags || []).join(', ')  // Convert array to comma-separated string
    });
  };

  // =============================================================================
  // HANDLE ORDERS TAB CLICK
  // =============================================================================
  // Clears the new order notification badge when admin opens the Orders tab.

  const handleOrdersTabClick = () => {
    setActiveTab('orders');
    setNewOrderCount(0);    // Clear badge - admin has seen the new orders
    setSidebarOpen(false);
  };

  // =============================================================================
  // SIDEBAR NAV ITEMS
  // =============================================================================

  const sideItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: newOrderCount },
    { id: 'menu', label: 'Menu', icon: MenuIcon },
    { id: 'story', label: 'Our Story', icon: BookOpen },
  ];

  // Order status colour mapping for badge styling
  const statusColors = {
    pending:   'bg-amber-50 text-amber-600 border-amber-200',
    confirmed: 'bg-blue-50 text-blue-600 border-blue-200',
    preparing: 'bg-purple-50 text-purple-600 border-purple-200',
    ready:     'bg-green-50 text-green-600 border-green-200',
    collected: 'bg-green-50 text-green-600 border-green-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200'
  };

  // Use filteredTrends for display - falls back to full trends if filter not ready
  const displayTrends = filteredTrends || trends;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#F5F0EB] flex" data-testid="admin-dashboard">

      {/* ================================================================
          SIDEBAR NAVIGATION
          Fixed on desktop (lg:translate-x-0).
          Slides in from left on mobile when sidebarOpen is true.
          ================================================================ */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-black/5 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 shadow-sm`}>

        {/* Sidebar header */}
        <div className="p-5 flex items-center gap-3 border-b border-black/5">
          <span className="font-heading text-sm text-[#FF6B00]">BF Admin</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-[#aaa]">
            <X size={18} />
          </button>
        </div>

        {/* Navigation buttons */}
        <nav className="flex-1 p-3 space-y-1" data-testid="admin-sidebar-nav">
          {sideItems.map(item => (
            <button
              key={item.id}
              onClick={() =>
                item.id === 'orders'
                  ? handleOrdersTabClick()
                  : (setActiveTab(item.id), setSidebarOpen(false))
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeTab === item.id
                  ? 'bg-[#FFF3E6] text-[#FF6B00] font-semibold'
                  : 'text-[#777] hover:text-[#1a1a1a] hover:bg-[#FFF8F0]'
              }`}
              data-testid={`admin-nav-${item.id}`}
            >
              <item.icon size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {/* Red badge showing new order count */}
              {item.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar footer: last refresh time and logout */}
        <div className="p-3 border-t border-black/5">
          <p className="text-[#ccc] text-[10px] text-center mb-2">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#999] hover:text-red-500 hover:bg-red-50 transition-all"
            data-testid="admin-logout-btn"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* ================================================================
          MAIN CONTENT AREA
          ================================================================ */}
      <main className="flex-1 lg:ml-60">

        {/* Sticky header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[#1a1a1a]">
            <MenuIcon size={20} />
          </button>
          <h2 className="font-heading text-lg text-[#1a1a1a] capitalize">{activeTab}</h2>
          <div className="flex items-center gap-3">
            {/* Pulsing bell notification for new orders */}
            {newOrderCount > 0 && (
              <button
                onClick={handleOrdersTabClick}
                className="flex items-center gap-2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-full font-semibold animate-pulse"
              >
                <Bell size={12} /> {newOrderCount} New Order{newOrderCount > 1 ? 's' : ''}!
              </button>
            )}
            <span className="text-[#999] text-xs">{user?.email}</span>
          </div>
        </header>

        <div className="p-6">

          {/* ==============================================================
              DASHBOARD TAB - Analytics Overview
              ============================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6" data-testid="dashboard-tab">

              {/* ================================================================
                  TIME PERIOD FILTER
                  Four buttons: Today, 7 Days, 30 Days, All Time.
                  Clicking a button filters all stats and charts to that period.
                  All filtering is done client-side from the full orders data.
                  ================================================================ */}
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar size={14} className="text-[#999]" />
                <span className="text-[#999] text-xs mr-1">Show:</span>
                {TIME_PERIODS.map(period => (
                  <button
                    key={period.label}
                    onClick={() => setSelectedPeriod(period.label)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      selectedPeriod === period.label
                        ? 'bg-[#FF6B00] text-white shadow-sm'   // Active period
                        : 'bg-white border border-black/10 text-[#777] hover:border-[#FF6B00]/30 hover:text-[#FF6B00]'
                    }`}
                    data-testid={`period-filter-${period.label.toLowerCase().replace(' ', '-')}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              {/* Summary stat cards - values update based on selected period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Orders', value: displayTrends?.total_orders || 0, icon: Package },
                  { label: 'Total Revenue', value: `£${(displayTrends?.total_revenue || 0).toFixed(2)}`, icon: DollarSign },
                  { label: 'Menu Items', value: menuItems.length, icon: TrendingUp },
                  // Average order = total revenue / total orders
                  { label: 'Avg Order', value: `£${displayTrends?.total_orders ? (displayTrends.total_revenue / displayTrends.total_orders).toFixed(2) : '0.00'}`, icon: Users },
                ].map((stat, i) => (
                  <div key={i} className="bg-white border border-black/5 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-[#FFF3E6] flex items-center justify-center">
                        <stat.icon size={16} className="text-[#FF6B00]" />
                      </div>
                      <span className="text-[#999] text-xs">{stat.label}</span>
                    </div>
                    <p className="text-[#1a1a1a] text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}>
                      {stat.value}
                    </p>
                    {/* Show the active period label below each stat card */}
                    <p className="text-[#ccc] text-[10px] mt-1">{selectedPeriod}</p>
                  </div>
                ))}
              </div>

              {/* Charts - all use displayTrends so they update with the period filter */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Daily Revenue Line Chart */}
                <div className="bg-white border border-black/5 rounded-xl p-5 shadow-sm" data-testid="revenue-chart">
                  <h3 className="text-[#1a1a1a] text-sm font-semibold mb-4">
                    Daily Revenue
                    <span className="text-[#aaa] font-normal text-xs ml-2">— {selectedPeriod}</span>
                  </h3>
                  {displayTrends?.daily_revenue?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={displayTrends.daily_revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="date" tick={{ fill: '#999', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#999', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={2} dot={{ fill: '#FF6B00' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[#ccc] text-sm text-center py-8">No revenue data for this period</p>}
                </div>

                {/* Top Selling Items Horizontal Bar Chart */}
                <div className="bg-white border border-black/5 rounded-xl p-5 shadow-sm" data-testid="top-items-chart">
                  <h3 className="text-[#1a1a1a] text-sm font-semibold mb-4">
                    Top Selling Items
                    <span className="text-[#aaa] font-normal text-xs ml-2">— {selectedPeriod}</span>
                  </h3>
                  {displayTrends?.top_items?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      {/* layout="vertical" makes bars horizontal for better label readability */}
                      <BarChart data={displayTrends.top_items} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" tick={{ fill: '#999', fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#555', fontSize: 10 }} width={120} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" fill="#FF6B00" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[#ccc] text-sm text-center py-8">No order data for this period</p>}
                </div>

                {/* Category Breakdown Pie Chart */}
                <div className="bg-white border border-black/5 rounded-xl p-5 shadow-sm" data-testid="category-chart">
                  <h3 className="text-[#1a1a1a] text-sm font-semibold mb-4">
                    Category Breakdown
                    <span className="text-[#aaa] font-normal text-xs ml-2">— {selectedPeriod}</span>
                  </h3>
                  {displayTrends?.category_breakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={displayTrends.category_breakdown}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                        >
                          {/* Cycle through COLORS array for each pie segment */}
                          {displayTrends.category_breakdown.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[#ccc] text-sm text-center py-8">No category data for this period</p>}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              ORDERS TAB - Order Management
              Admin can view all paid orders and update their status.
              Marking as 'collected' triggers review request email to customer.
              ============================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-4" data-testid="orders-tab">
              <div className="flex items-center justify-between">
                <h3 className="text-[#1a1a1a] text-sm font-semibold">Recent Orders ({orders.length})</h3>
                <span className="text-[#aaa] text-xs">Auto-refreshes every 30s</span>
              </div>
              {orders.length === 0 ? (
                <p className="text-[#aaa] text-sm">No paid orders yet</p>
              ) : (
                <div className="space-y-3">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white border border-black/5 rounded-xl p-4 shadow-sm" data-testid={`order-${order.id}`}>
                      {/* Order header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-[#1a1a1a] text-sm font-semibold">{order.customer_name}</p>
                          <p className="text-[#aaa] text-xs">{order.customer_email} | {order.customer_phone}</p>
                          <p className="text-[#aaa] text-xs">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#FF6B00] font-bold">£{order.total?.toFixed(2)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[order.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            {order.status}
                          </span>
                          <span className={`ml-1 text-xs px-2 py-0.5 rounded-full border ${order.payment_status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {order.payment_status}
                          </span>
                        </div>
                      </div>

                      {/* Ordered items */}
                      <div className="text-[#777] text-xs mb-3">
                        {order.items?.map((item, i) => (
                          <span key={i}>{item.name} x{item.quantity}{i < order.items.length - 1 ? ', ' : ''}</span>
                        ))}
                      </div>

                      {/* Special instructions */}
                      {order.notes && <p className="text-[#aaa] text-xs mb-3 italic">Notes: {order.notes}</p>}

                      {/* Status update buttons - active status highlighted orange */}
                      <div className="flex gap-2 flex-wrap">
                        {['pending', 'preparing', 'ready', 'collected', 'cancelled'].map(s => (
                          <button
                            key={s}
                            onClick={() => updateOrderStatus(order.id, s)}
                            className={`text-xs px-2 py-1 rounded-full border transition-all ${
                              order.status === s
                                ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                : 'border-black/10 text-[#aaa] hover:border-[#FF6B00]/30 hover:text-[#FF6B00]'
                            }`}
                            data-testid={`set-status-${s}-${order.id}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              MENU MANAGEMENT TAB
              ============================================================== */}
          {activeTab === 'menu' && (
            <div className="space-y-6" data-testid="menu-management-tab">

              {/* Add / Edit Form */}
              <div className="bg-white border border-black/5 rounded-xl p-5 shadow-sm">
                <h3 className="text-[#1a1a1a] text-sm font-semibold mb-4">
                  {editItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Item Name" className="bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50" data-testid="menu-form-name" />
                  <input value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="Price" type="number" step="0.01" className="bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50" data-testid="menu-form-price" />
                  <input value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="Category" className="bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50" data-testid="menu-form-category" />
                  <input value={menuForm.image_url} onChange={e => setMenuForm({ ...menuForm, image_url: e.target.value })} placeholder="Image URL (Cloudinary)" className="bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50" data-testid="menu-form-image" />
                  <textarea value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Description" rows={2} className="sm:col-span-2 bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 resize-none" data-testid="menu-form-description" />
                  {/* Tags: comma-separated string, converted to array when saving */}
                  <input value={menuForm.tags} onChange={e => setMenuForm({ ...menuForm, tags: e.target.value })} placeholder="Tags (comma separated)" className="bg-[#FFF8F0] border border-black/10 rounded-lg px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50" data-testid="menu-form-tags" />
                  <div className="flex items-center gap-4">
                    {/* Available: unchecked = hidden from customers */}
                    <label className="flex items-center gap-2 text-[#777] text-sm">
                      <input type="checkbox" checked={menuForm.is_available} onChange={e => setMenuForm({ ...menuForm, is_available: e.target.checked })} className="accent-[#FF6B00]" data-testid="menu-form-available" /> Available
                    </label>
                    {/* Featured: checked = shown on homepage featured section */}
                    <label className="flex items-center gap-2 text-[#777] text-sm">
                      <input type="checkbox" checked={menuForm.is_featured} onChange={e => setMenuForm({ ...menuForm, is_featured: e.target.checked })} className="accent-[#FF6B00]" data-testid="menu-form-featured" /> Featured
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveMenuItem} className="bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm" data-testid="save-menu-item-btn">
                    <Save size={14} /> {editItem ? 'Update' : 'Add Item'}
                  </button>
                  {editItem && (
                    <button
                      onClick={() => {
                        setEditItem(null);
                        setMenuForm({ name: '', description: '', price: '', category: 'Signature Faloodas', image_url: '', is_available: true, is_featured: false, tags: '' });
                      }}
                      className="border border-black/10 text-[#777] px-5 py-2 rounded-lg text-sm transition-all hover:text-[#1a1a1a]"
                      data-testid="cancel-edit-btn"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Menu Items List */}
              <div className="space-y-3">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-white border border-black/5 rounded-xl p-4 flex items-center gap-4 shadow-sm" data-testid={`admin-menu-item-${item.id}`}>
                    <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[#1a1a1a] text-sm font-semibold truncate">{item.name}</h4>
                        {item.is_featured && <span className="text-[#FF6B00] text-[10px] bg-[#FFF3E6] px-1.5 py-0.5 rounded">Featured</span>}
                        {!item.is_available && <span className="text-red-500 text-[10px] bg-red-50 px-1.5 py-0.5 rounded">Unavailable</span>}
                      </div>
                      <p className="text-[#aaa] text-xs truncate">{item.description}</p>
                    </div>
                    <span className="text-[#FF6B00] font-bold text-sm">£{item.price?.toFixed(2)}</span>
                    <button onClick={() => startEdit(item)} className="text-[#aaa] hover:text-[#FF6B00] transition-colors" data-testid={`edit-menu-item-${item.id}`}><Edit2 size={14} /></button>
                    <button onClick={() => deleteMenuItem(item.id)} className="text-[#aaa] hover:text-red-500 transition-colors" data-testid={`delete-menu-item-${item.id}`}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==============================================================
              OUR STORY TAB - Content Management
              ============================================================== */}
          {activeTab === 'story' && (
            <div className="max-w-2xl space-y-4" data-testid="story-management-tab">
              <h3 className="text-[#1a1a1a] text-sm font-semibold">Edit Our Story</h3>

              {/* Story title */}
              <input value={story.title} onChange={e => setStory({ ...story, title: e.target.value })} placeholder="Title" className="w-full bg-white border border-black/10 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 shadow-sm" data-testid="story-title-input" />

              {/* Story body - newlines create separate paragraphs on homepage */}
              <textarea value={story.content} onChange={e => setStory({ ...story, content: e.target.value })} placeholder="Story content..." rows={10} className="w-full bg-white border border-black/10 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 resize-none shadow-sm" data-testid="story-content-input" />

              {/* Optional image URL */}
              <input value={story.image_url} onChange={e => setStory({ ...story, image_url: e.target.value })} placeholder="Image URL" className="w-full bg-white border border-black/10 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 shadow-sm" data-testid="story-image-input" />

              {/* Cloudinary video URL - shown in Our Story section on homepage */}
              <input value={story.video_url || ''} onChange={e => setStory({ ...story, video_url: e.target.value })} placeholder="Video URL (Cloudinary .mp4 link)" className="w-full bg-white border border-black/10 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50 shadow-sm" data-testid="story-video-input" />

              {/* Save button */}
              <button onClick={saveStory} disabled={storyLoading} className="bg-[#FF6B00] hover:bg-[#FF8C00] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm" data-testid="save-story-btn">
                <Save size={14} /> {storyLoading ? 'Saving...' : 'Save Story'}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}