# Baba Falooda - AI Enhanced Web Platform PRD

## Original Problem Statement
Build an AI-enhanced web platform for Baba Falooda, a dessert shop from Mumbai recently opened in Tooting, London. Features: AI recommendation engine, AI chatbot, admin dashboard with order trends, Stripe payment, Our Story section, Branches page. Theme: bright orange and cream.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn UI + Recharts
- **Backend**: FastAPI + MongoDB + emergentintegrations (OpenAI GPT-5.2)
- **Payments**: Stripe via emergentintegrations
- **Auth**: JWT with bcrypt password hashing

## What's Been Implemented (April 10, 2026)
### Iteration 1
- Full-stack app, dark theme, all core features

### Iteration 2 (Current)
- Switched to bright/light theme (#FFF8F0 cream bg, white cards, orange accents)
- Added Login link in navbar (visible to all users)
- Added Branches page with 6 locations (1 London flagship + 5 Mumbai: Andheri, Bandra, Dadar, Colaba, Juhu)
- Hidden Emergent badge via CSS
- Navbar shows Dashboard/Logout when admin is logged in

## Testing Results
- Backend: 100% (16/16 tests passed)
- Frontend: 98% (minor AI rec timing)

## Prioritized Backlog
### P1 (Next)
- Populate branch details (addresses, phone, images)
- Order confirmation notifications
- Customer order history

### P2 (Future)
- Customer accounts/registration
- Loyalty points system
- Multi-language support
