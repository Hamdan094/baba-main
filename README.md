# 🍨 Baba Falooda — Online Food Ordering System

A full-stack, production-deployed online ordering system for **Baba Falooda**, a family-owned South Asian dessert and snack restaurant in Tooting, London. Built as a Final Year Project for BSc (Hons) Computer Science at the University of Westminster.

🌐 **Live Site:** [https://babafalooda.vercel.app](https://babafalooda.vercel.app)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Author](#author)

---

## Overview

Baba Falooda is a 40-year-old family restaurant that previously relied entirely on third-party aggregator platforms (Deliveroo, Uber Eats, Just Eat) charging 15–35% commission per order. This project delivers a bespoke direct ordering channel that eliminates those fees, gives the owner full control over their menu and customer data, and provides a modern AI-assisted customer experience.

---

## ✨ Features

### Customer Features
- 🔐 User registration and login with JWT authentication
- 🍽️ Dynamic menu with search, category filtering, and allergen info
- 🛒 Real-time shopping cart with quantity controls
- 💳 Secure checkout with Stripe payment processing (live mode)
- 📧 Automatic email order confirmation via Gmail SMTP
- 🤖 AI-powered chatbot (GPT-4o) for menu queries and support
- ❤️ Favourites — save and manage favourite menu items
- 📦 Order history in customer account portal
- ⭐ Review and rating system

### Admin Features
- 📊 Admin dashboard with order analytics
- 📈 Revenue trends filtered by Today / 7 Days / 30 Days / All Time
- 🍜 Full menu CRUD — add, edit, delete, toggle availability
- 🖼️ Image upload to Cloudinary
- 👥 Order management and status updates

### UI/UX
- 📱 Mobile-first responsive design
- ⚡ Skeleton loading screens
- 🔔 Toast notifications
- 🎬 Scroll reveal animations
- ✍️ Hero typewriter effect
- 🛒 Cart bounce animation on item add

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router v6, Context API |
| Backend | FastAPI (Python), Uvicorn |
| Database | MongoDB Atlas (M0 Free Tier) |
| Payments | Stripe (Live Mode) |
| AI Chatbot | OpenAI GPT-4o |
| Image Storage | Cloudinary |
| Email | SendGrid |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |
| Version Control | GitHub |

---

## 📁 Project Structure

```
baba-main/
├── frontend/                  # React 19 application
│   ├── public/
│   └── src/
│       ├── components/        # Reusable UI components
│       │   ├── Navbar.js
│       │   ├── ChatBot.js
│       │   ├── Toast.js
│       │   ├── BackToTop.js
│       │   ├── Skeletons.js
│       │   └── EmptySearch.js
│       ├── context/
│       │   ├── AuthContext.js  # JWT auth state
│       │   └── CartContext.js  # Cart state management
│       ├── hooks/
│       │   ├── useTypewriter.js
│       │   └── useScrollReveal.js
│       ├── pages/
│       │   ├── HomePage.js
│       │   ├── MenuPage.js
│       │   ├── CartPage.js
│       │   ├── CheckoutPage.js (Stripe)
│       │   ├── OrderSuccessPage.js
│       │   ├── AccountPage.js
│       │   ├── AuthPage.js
│       │   ├── AdminDashboardPage.js
│       │   ├── AdminLoginPage.js
│       │   ├── BranchesPage.js
│       │   ├── ReviewPage.js
│       │   └── ReviewsPage.js
│       ├── App.js
│       └── index.css
│
├── backend/                   # FastAPI application
│   ├── server.py              # Main API file (all endpoints)
│   └── requirements.txt
│
├── backend_test.py            # Test suite (32/32 passing)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Stripe account
- OpenAI API key
- Cloudinary account
- SendGrid API Key

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Hamdan094/baba-main.git
cd baba-main

# Install Python dependencies
cd backend
pip3 install -r requirements.txt

# Create .env file (see Environment Variables section)
# Then start the backend
python3 -m uvicorn server:app --reload
```

Backend runs at: `http://localhost:8000`  
API docs available at: `http://localhost:8000/docs`

### Frontend Setup

```bash
# Open a new terminal
cd frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🔐 Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
OPENAI_API_KEY=sk-...
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
JWT_SECRET=your_jwt_secret_key
SENDGRID_API_KEY=SG.....
```

Create a `.env` file inside the `frontend/` directory:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

---

## 🧪 Running Tests

Make sure the backend is running first, then from the **root** of the repository:

```bash
python3 backend_test.py
```

### Test Results

```
Tests passed: 32/32
Success rate: 100.0%

Test Suite Results:
  MENU:             ✅ PASS
  STORY:            ✅ PASS
  AUTH:             ✅ PASS
  FAVOURITES:       ✅ PASS
  CUSTOMER_ORDERS:  ✅ PASS
  ORDERS:           ✅ PASS
  AI:               ✅ PASS
  ADMIN:            ✅ PASS
  CHECKOUT:         ✅ PASS
```

---

## ☁️ Deployment

### Frontend (Vercel)
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `build`
- Environment variable: `REACT_APP_BACKEND_URL=https://baba-main-production.up.railway.app`

### Backend (Railway)
- Root directory: `backend`
- Start command: `python -m uvicorn server:app --host 0.0.0.0 --port $PORT`
- All environment variables set in Railway dashboard

### Database (MongoDB Atlas)
- Cluster: M0 Free Tier, AWS Europe (Ireland)
- Network access: 0.0.0.0/0 (all IPs — required for Railway dynamic IPs)

---

## 🔗 Live Links

| Service | URL |
|---------|-----|
| 🌐 Live Site | https://babafalooda.vercel.app |
| ⚙️ Backend API | https://baba-main-production.up.railway.app |
| 📚 API Docs | https://baba-main-production.up.railway.app/docs |
| 🚀 GitHub | https://github.com/Hamdan094/baba-main |

### Delivery Platform Links
| Platform | Link |
|----------|------|
| Uber Eats | https://www.ubereats.com/gb/store/baba-falooda/nj6sJxmhSkaoJPOEamzX7Q |
| Deliveroo | https://deliveroo.co.uk/menu/london/upper-tooting/baba-falooda-tooting-228-upper-tooting-road-sw17-7ew |
| Just Eat | https://www.just-eat.co.uk/restaurants-baba-falooda-tooting-tooting-broadway/menu |

---

## 👤 Author

**Hamdan Khan**  
Student ID: W19269500  
BSc (Hons) Computer Science  
University of Westminster  
Module: 6COSC023W.Y  
Supervisor: Deepika  

---

## 📄 License

This project was developed as an academic final year project for the University of Westminster. All rights reserved.
