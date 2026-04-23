# =============================================================================
# Baba Falooda - Backend API Server
# =============================================================================
# This is the main backend file for the Baba Falooda online ordering system.
# Built with FastAPI (Python), it provides a RESTful API for the React frontend.
#
# Key features:
#   - JWT-based user authentication with role-based access control
#   - Menu management (CRUD operations)
#   - Order processing and payment via Stripe
#   - AI-powered chatbot and recommendations via OpenAI GPT-4o
#   - Email notifications via SendGrid
#   - Customer reviews and favourites
#   - Admin dashboard analytics
# =============================================================================
 
# Load environment variables from .env file before any other imports

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env') # Loads keys like OPENAI_API_KEY, STRIPE_API_KEY etc.

# FastAPI framework imports
from fastapi import FastAPI, APIRouter, Request, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware  # Allows frontend to call backend
# Database - Motor is the async MongoDB driver compatible with FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

# AI and payment integrations
from openai import AsyncOpenAI  # OpenAI SDK for GPT-4o chatbot and recommendations
import stripe                   # Stripe SDK for payment processing

# Standard library imports
import os
import logging
from pydantic import BaseModel, Field # Pydantic validates incoming request data
from typing import List, Optional, Dict
import uuid          # Generates unique IDs for orders, menu items etc.
import bcrypt        # Secure password hashing (one-way encryption)
import jwt as pyjwt  # JSON Web Token encoding/decoding for authentication
import asyncio       # Async utilities for running sync code in threads
from datetime import datetime, timezone, timedelta
from bson import ObjectId  # MongoDB uses ObjectId for document IDs
import json

# Email sending imports aiosmtplib is async SMTP compatible with FastAPI
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# =============================================================================
# DATABASE CONNECTION
# =============================================================================
# Connect to MongoDB using the URL from .env file
# AsyncIOMotorClient is non-blocking, it won't slow down the API while querying 
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]  # Select the specific database (babafalooda)

# =============================================================================
# THIRD-PARTY SERVICE CLIENTS
# =============================================================================
# OpenAI client for GPT-4o AI features (chatbot and recommendations)

openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# Stripe payment processing - API key set globally for all Stripe operations
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")

# =============================================================================
# FASTAPI APP SETUP
# =============================================================================

app = FastAPI()  # Main FastAPI application instance

# All routes are grouped under /api prefix (e.g. /api/menu, /api/orders)
api_router = APIRouter(prefix="/api")

# Configure logging to show timestamps and log levels in terminal output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
logger = logging.getLogger(__name__)

# =============================================================================
# AUTHENTICATION HELPERS
# =============================================================================
# JWT (JSON Web Token) is used for stateless authentication.
# Tokens are signed with a secret key - if tampered with, verification fails.

JWT_ALGORITHM = "HS256" # HMAC-SHA256 signing algorithm

def get_jwt_secret():
    """Retrieves the JWT secret key from environment variables."""
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    """
    Hashes a plain text password using bcrypt.
    bcrypt is slow by design to prevent brute force attacks.
    gensalt() adds random data so identical passwords produce different hashes.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies a plain text password against a stored bcrypt hash.
    bcrypt is one-way you cannot decrypt the hash, only compare.
    """
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    """
    Creates a short-lived JWT access token (expires in 60 minutes).
    The token contains the user's ID, email and expiry time as claims.
    Used for authenticating API requests.
    """
    payload = {
        "sub": user_id,  # Subject - the user this token belongs to
        "email": email, 
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60), 
        "type": "access"  # Token type to distinguish from refresh tokens
        }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """
    Creates a long-lived JWT refresh token (expires in 7 days).
    Used to obtain new access tokens without requiring re-login.
    """
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    """
    Extracts and validates the JWT token from the incoming request.
    Checks both HTTP-only cookies (browser) and Authorization header (API).
    Returns the user document from MongoDB if the token is valid.
    Raises HTTP 401 if token is missing, expired or invalid.
    """
    # Try to get token from cookie first (set by login/register)
    token = request.cookies.get("access_token")

    # Fall back to Authorization header for API clients
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:] # Strip "Bearer " prefix
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        # Decode and verify the JWT token using the secret key
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        # Ensure this is an access token, not a refresh token
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Look up the user in MongoDB to confirm they still exist
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Convert ObjectId to string for JSON serialisation
        user["_id"] = str(user["_id"])

        # Never return the password hash in API responses
        user.pop("password_hash", None)
        return user
    

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# =============================================================================
# EMAIL HELPERS
# =============================================================================
# Uses SendGrid with TLS encryption to send transactional emails.
# Requires a SendGrid API Key.


async def send_email(to: str, subject: str, html: str):
    """
    Sends transactional emails using SendGrid API.
    Gmail SMTP is blocked on Railway so SendGrid is used instead.
    """
    api_key = os.environ.get("SENDGRID_API_KEY", "")
    if not api_key:
        logger.info("Skipping email: no SendGrid API key configured")
        return
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {
                        "email": "info@babafalooda.co.uk",
                        "name": "Baba Falooda"
                    },
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}]
                },
                timeout=10.0
            )
            if response.status_code == 202:
                logger.info(f"Email sent successfully to {to}")
            else:
                logger.error(f"SendGrid error {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")


async def send_order_confirmation_email(order: dict):
    """
    Sends a branded HTML order confirmation email to the customer.
    Called automatically when a Stripe payment is confirmed as paid.
    Includes itemised order summary, total and collection reminder.
    """
    customer_email = order.get("customer_email", "")
    if not customer_email:
        logger.info("Skipping customer email: no customer email on order")
        return
    
    # Build HTML table rows for each item in the order
    items_html = ""
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0ebe6;color:#1a1a1a;font-size:14px;">{item.get('name','')}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0ebe6;color:#777;font-size:14px;text-align:center;">x{item.get('quantity',1)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0ebe6;color:#1a1a1a;font-size:14px;text-align:right;font-weight:600;">&pound;{item.get('subtotal',0):.2f}</td>
        </tr>"""

    # Branded HTML email template
    html = f"""
    <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#FFF8F0;padding:32px 20px;">
        <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#FF6B00;font-size:22px;margin:12px 0 4px;">BABA FALOODA</h1>
            <p style="color:#999;font-size:12px;margin:0;">Happiness in every spoon</p>
        </div>
        <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid rgba(0,0,0,0.05);">
            <div style="text-align:center;margin-bottom:20px;">
                <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 4px;">Order Confirmed! 🎉</h2>
                <p style="color:#777;font-size:13px;margin:0;">Thank you, {order.get('customer_name','Customer')}!</p>
            </div>
            <div style="background:#FFF3E6;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
                <p style="color:#FF6B00;font-size:12px;font-weight:700;margin:0 0 2px;">COLLECTION ONLY</p>
                <p style="color:#555;font-size:11px;margin:0;">Please collect your order from our Tooting, London branch. We do not offer delivery.</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <tr>
                    <th style="text-align:left;padding:8px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Item</th>
                    <th style="text-align:center;padding:8px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Qty</th>
                    <th style="text-align:right;padding:8px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Price</th>
                </tr>
                {items_html}
            </table>
            <div style="text-align:right;padding-top:8px;">
                <span style="color:#999;font-size:13px;">Total: </span>
                <span style="color:#FF6B00;font-size:20px;font-weight:800;">&pound;{order.get('total',0):.2f}</span>
            </div>
        </div>
        <div style="text-align:center;margin-top:24px;">
            <p style="color:#999;font-size:11px;margin:0;">Order ID: {order.get('id','N/A')}</p>
            <p style="color:#999;font-size:11px;margin:4px 0 0;">Baba Falooda &middot; Tooting, London &middot; 11am - 10pm Daily</p>
        </div>
    </div>
    """

    await send_email(
        customer_email,
        f"Order Confirmed - Baba Falooda #{order.get('id','')[:8]}",
        html
    )


async def send_store_notification_email(order: dict):
    """
    Sends an operational alert to the store owner (info@babafalooda.co.uk)
    when a new paid order is received. Includes customer contact details
    and itemised order for kitchen preparation.
    """
    store_email = os.environ.get("STORE_EMAIL", "")
    if not store_email:
        logger.info("Skipping store notification: no STORE_EMAIL in .env")
        return

    # Build HTML table rows for order items
    items_html = ""
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f0ebe6;color:#1a1a1a;font-size:14px;">{item.get('name','')}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0ebe6;color:#777;font-size:14px;text-align:center;">x{item.get('quantity',1)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0ebe6;color:#1a1a1a;font-size:14px;text-align:right;font-weight:600;">&pound;{item.get('subtotal',0):.2f}</td>
        </tr>"""

    html = f"""
    <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#FFF8F0;padding:32px 20px;">
        <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#FF6B00;font-size:22px;margin:12px 0 4px;">🍧 NEW ORDER!</h1>
            <p style="color:#999;font-size:12px;margin:0;">Baba Falooda — Store Notification</p>
        </div>
        <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid rgba(0,0,0,0.05);">
            <div style="background:#e8f5e9;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
                <p style="color:#2e7d32;font-size:13px;font-weight:700;margin:0;">✅ Payment Confirmed — Start Preparing!</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <tr><td style="color:#999;font-size:12px;padding:6px 0;">Customer</td><td style="color:#1a1a1a;font-size:13px;font-weight:600;padding:6px 0;">{order.get('customer_name','')}</td></tr>
                <tr><td style="color:#999;font-size:12px;padding:6px 0;">Phone</td><td style="color:#1a1a1a;font-size:13px;padding:6px 0;">{order.get('customer_phone','N/A')}</td></tr>
                <tr><td style="color:#999;font-size:12px;padding:6px 0;">Email</td><td style="color:#1a1a1a;font-size:13px;padding:6px 0;">{order.get('customer_email','N/A')}</td></tr>
                <tr><td style="color:#999;font-size:12px;padding:6px 0;">Notes</td><td style="color:#1a1a1a;font-size:13px;padding:6px 0;">{order.get('notes','None')}</td></tr>
            </table>
            <h3 style="color:#1a1a1a;font-size:14px;margin:0 0 8px;">Order Items:</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <tr>
                    <th style="text-align:left;padding:6px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Item</th>
                    <th style="text-align:center;padding:6px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Qty</th>
                    <th style="text-align:right;padding:6px 0;border-bottom:2px solid #f0ebe6;color:#999;font-size:11px;">Price</th>
                </tr>
                {items_html}
            </table>
            <div style="text-align:right;padding-top:8px;border-top:2px solid #f0ebe6;">
                <span style="color:#999;font-size:13px;">Total Paid: </span>
                <span style="color:#FF6B00;font-size:22px;font-weight:800;">&pound;{order.get('total',0):.2f}</span>
            </div>
        </div>
        <div style="text-align:center;margin-top:24px;">
            <p style="color:#999;font-size:11px;">Order ID: {order.get('id','N/A')}</p>
        </div>
    </div>
    """

    await send_email(
        store_email,
        f"🍧 New Order £{order.get('total',0):.2f} — {order.get('customer_name','')}",
        html
    )

# Frontend base URL used to construct review links in emails
FRONTEND_BASE_URL = "https://babafalooda.vercel.app"
async def send_review_request_email(order: dict):
    """
    Sends a review request email to the customer after their order
    is marked as 'Collected' by the admin. Contains a unique link
    to the review page for that specific order.
    """
    customer_email = order.get("customer_email", "")
    if not customer_email:
        return
    
    # Generate a unique review URL containing the order ID
    review_url = f"{FRONTEND_BASE_URL}/review/{order.get('id','')}"
    items_list = ", ".join([item.get("name", "") for item in order.get("items", [])])

    html = f"""
    <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#FFF8F0;padding:32px 20px;">
        <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#FF6B00;font-size:22px;margin:12px 0 4px;">BABA FALOODA</h1>
        </div>
        <div style="background:#ffffff;border-radius:16px;padding:28px;text-align:center;">
            <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;">How was your falooda? 🍧</h2>
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Hi {order.get('customer_name','there')}! You recently collected:</p>
            <p style="color:#FF6B00;font-size:13px;font-weight:600;margin:0 0 20px;">{items_list}</p>
            <p style="color:#777;font-size:13px;margin:0 0 24px;">We'd love to hear what you thought. Your feedback helps us serve you better!</p>
            <a href="{review_url}" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:700;">Rate Your Order</a>
        </div>
        <div style="text-align:center;margin-top:24px;">
            <p style="color:#999;font-size:11px;">Baba Falooda &middot; Tooting, London</p>
        </div>
    </div>
    """

    await send_email(
        customer_email,
        "How was your falooda? Rate your order!",
        html
    )

# =============================================================================
# PYDANTIC DATA MODELS
# =============================================================================
# Pydantic models define the expected structure of incoming request data.
# FastAPI automatically validates requests against these models and returns
# a 422 Unprocessable Entity error if the data doesn't match.


class LoginRequest(BaseModel):
    """Request body for the login endpoint."""
    email: str
    password: str

class MenuItem(BaseModel):
    """
    Full menu item model including auto-generated fields.
    Used when creating new items - ID and created_at are set automatically.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4())) # Auto-generate UUID
    name: str
    description: str
    price: float
    category: str
    image_url: str = ""
    is_available: bool = True # Controls whether item shows on menu
    is_featured: bool = False # Featured items appear on homepage
    tags: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MenuItemCreate(BaseModel):
    """
    Request body for creating/updating menu items (admin only).
    Excludes auto-generated fields like id and created_at.
    """
    name: str
    description: str
    price: float
    category: str
    image_url: str = ""
    is_available: bool = True
    is_featured: bool = False
    tags: List[str] = []

class CartItem(BaseModel):
        
        """Represents a single item in a customer's cart with quantity."""
        
        menu_item_id: str # References the menu_items collection
        quantity: int = 1

class OrderCreate(BaseModel):

    """Request body for creating a new order at checkout."""

    items: List[CartItem] # List of items being ordered
    customer_name: str
    customer_email: str = ""
    customer_phone: str = ""
    notes: str = ""       # Special instructions from customer

class ChatMessage(BaseModel):

    """Request body for AI chatbot messages."""

    message: str 
    session_id: str = ""  # Empty string for new conversations

class StoryUpdate(BaseModel):

    """Request body for updating the Our Story page content (admin only)."""

    title: str
    content: str
    video_url: str = "https://res.cloudinary.com/dlm6l9oqc/video/upload/v1776449383/final_vbcipl.mov" #Cloudinary video URL

class CheckoutRequest(BaseModel):

    """Request body for initiating a Stripe checkout session."""

    order_id: str
    origin_url: str # Used to construct Stripe success/cancel redirect URLs

class RegisterRequest(BaseModel):
     
     """Request body for customer registration."""

     name: str
     email: str
     password: str
     phone: str = ""

class ReviewCreate(BaseModel):

    """Request body for submitting an order review."""

    rating: int # Must be between 1 and 5
    comment: str = "" # Optional written review
    customer_name: str = ""

# =============================================================================
# AUTHENTICATION ROUTES
# =============================================================================


@api_router.post("/auth/register")


async def register(req: RegisterRequest, response: Response):
    """
    Registers a new customer account.
    Validates email format and password length before creating the account.
    Returns JWT tokens and sets them as HTTP-only cookies.
    Returns 409 if the email is already registered.
    """
    email = req.email.lower().strip() # Normalise email to lowercase

    # Input validation
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check for duplicate email (unique index also enforced at database level)
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    
    # Hash password before storing - never store plain text passwords
    hashed = hash_password(req.password)

    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": req.name.strip(),
        "phone": req.phone,
        "role": "customer",  #All registered users are customers by default
        "favourites": [],    # Empty favourites list on registration
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Generate both access token (short-lived) and refresh token (long-lived)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    # Set tokens as HTTP-only cookies (not accessible by JavaScript - more secure)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": email, "name": req.name.strip(), "role": "customer", "token": access_token}

@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    """
    Authenticates a user with email and password.
    Returns the same error for wrong email OR wrong password.
    Sets JWT tokens as HTTP-only cookies on success.
    """
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})

    # Deliberately vague error to prevent email enumeration attacks
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)


    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "customer"), "token": access_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """
    Returns the currently authenticated user's profile including favourites.
    Called on app load to restore user session from stored JWT token.
    """
    user = await get_current_user(request)

    # Re-fetch from database to get latest favourites list

    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    user["favourites"] = user_doc.get("favourites", []) if user_doc else []
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

# =============================================================================
# FAVOURITES ROUTES
# =============================================================================

@api_router.get("/favourites")
async def get_favourites(request: Request):

    """
    Returns the current user's list of favourite menu items.
    Uses $in MongoDB operator to fetch all favourited items in one query.
    """

    user = await get_current_user(request)
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    fav_ids = user_doc.get("favourites", [])
    if not fav_ids:
        return [] # Return early to avoid unnecessary database query
    # Fetch all favourited items in a single query using $in operator
    items = await db.menu_items.find({"id": {"$in": fav_ids}}, {"_id": 0}).to_list(100)
    return items

@api_router.post("/favourites/{item_id}")
async def add_favourite(item_id: str, request: Request):

    """
    Adds a menu item to the user's favourites list.
    Uses $addToSet to prevent duplicate entries in the favourites array.
    Returns 404 if the menu item doesn't exist.
    """

    user = await get_current_user(request)
    item = await db.menu_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # $addToSet only adds if not already present (prevents duplicates)
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])}, 
        {"$addToSet": {"favourites": item_id}}
        )
    return {"message": "Added to favourites"}

@api_router.delete("/favourites/{item_id}")
async def remove_favourite(item_id: str, request: Request):
    
    """
    Removes a menu item from the user's favourites list.
    Uses $pull to remove the specific item ID from the array.
    """

    user = await get_current_user(request)
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$pull": {"favourites": item_id}})
    return {"message": "Removed from favourites"}

# =============================================================================
# CUSTOMER ORDER HISTORY
# =============================================================================

@api_router.get("/my-orders")
async def get_my_orders(request: Request):
    
    """
    Returns the order history for the currently logged-in customer.
    Sorted by creation date (newest first) and limited to 100 orders.
    Only returns orders associated with the authenticated user's ID.
    """

    user = await get_current_user(request)
    orders = await db.orders.find(
        {"user_id": user["_id"]}, 
        {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    return orders

# =============================================================================
# MENU ROUTES
# =============================================================================

@api_router.get("/menu")
async def get_menu():
    
    """
    Returns all menu items. Public endpoint no authentication required.
    The {"_id": 0} projection excludes MongoDB's internal _id field from results.
    """

    items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    return items

@api_router.get("/menu/{item_id}")
async def get_menu_item(item_id: str):
    
    """
    Returns a single menu item by its UUID.
    Returns 404 if the item doesn't exist or has been deleted.
    """

    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@api_router.post("/admin/menu")
async def create_menu_item(item: MenuItemCreate, request: Request):

    """
    Creates a new menu item. Admin only.
    Generates a UUID for the item ID and sets the creation timestamp automatically.
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
        
    # Use MenuItem model to auto-generate ID and created_at timestamp
    menu_item = MenuItem(**item.model_dump())
    doc = menu_item.model_dump()
    await db.menu_items.insert_one(doc)
    doc.pop("_id", None) # Remove MongoDB _id before returning
    return doc

@api_router.put("/admin/menu/{item_id}")
async def update_menu_item(item_id: str, item: MenuItemCreate, request: Request):

    """
    Updates an existing menu item by ID. Admin only.
    Uses $set to update only the provided fields without overwriting the entire document.
    Returns 404 if the item ID doesn't exist.
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    update_data = item.model_dump()
    result = await db.menu_items.update_one({"id": item_id}, {"$set": update_data})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Return the updated document
    updated = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: str, request: Request):

    """
    Permanently deletes a menu item. Admin only.
    Returns 404 if the item ID doesn't exist.
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Deleted"}

# =============================================================================
# ORDER ROUTES
# =============================================================================
 
@api_router.post("/orders")
async def create_order(order: OrderCreate, request: Request):

    """
    Creates a new order in the database with status 'pending' and payment_status 'unpaid'.
    Prices are calculated server-side from the database to prevent price manipulation.
    Both authenticated customers and guests (no login) can place orders.
    The order is linked to the user account if logged in, otherwise user_id is null.
    """

    menu_items_data = []
    total = 0.0

    # Calculate totals server-side  never trust prices from the frontend
    for cart_item in order.items:
        mi = await db.menu_items.find_one({"id": cart_item.menu_item_id}, {"_id": 0})
        if not mi:
            raise HTTPException(status_code=404, detail=f"Menu item {cart_item.menu_item_id} not found")
        
        item_total = mi["price"] * cart_item.quantity
        total += item_total

        menu_items_data.append({
            "menu_item_id": cart_item.menu_item_id,
            "name": mi["name"],
            "price": mi["price"],
            "quantity": cart_item.quantity,
            "subtotal": item_total
        })

    # Try to link order to logged-in user - guests are allowed (user_id stays None)
    user_id = None
    try:
        user = await get_current_user(request)
        user_id = user.get("_id")
    except Exception:
        pass # Guest checkout - no authentication required

    order_doc = {
        "id": str(uuid.uuid4()), # Unique order identifier
        "items": menu_items_data,
        "total": round(total, 2), # Round to 2 decimal places for currency
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "notes": order.notes,
        "status": "pending", # Initial order status
        "payment_status": "unpaid", # Will be updated to 'paid' after Stripe confirmation
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.orders.insert_one(order_doc)
    order_doc.pop("_id", None)
    return order_doc

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):

    """
    Returns a single order by its UUID. Public endpoint.
    Used by the OrderSuccessPage and ReviewPage to display order details.
    """

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.get("/admin/orders")
async def get_all_orders(request: Request):

    """
    Returns all paid orders for the admin dashboard. Admin only.
    Filtered to only show orders with payment_status='paid' to exclude
    abandoned carts and failed payments from the admin view.
    Sorted by creation date (newest first).
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    orders = await db.orders.find(
        {"payment_status": "paid"}, # Only show paid orders to admin
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, request: Request):

    """
    Updates the status of an order. Admin only.
    Valid statuses: pending, preparing, ready, collected, cancelled.
    Automatically sends a review request email to the customer
    when an order is marked as 'collected'.
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    new_status = body.get("status")

    # Validate the status value against allowed options
    if new_status not in ["pending", "preparing", "ready", "collected", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Send review request email when order is marked as colected
    if new_status == "collected":
        order_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order_doc:
            await send_review_request_email(order_doc)

    return {"message": "Status updated"}

@api_router.get("/admin/orders/trends")
async def get_order_trends(request: Request):

    """
    Returns analytics data for the admin dashboard charts. Admin only.
    Calculates: total orders, total revenue, daily revenue breakdown,
    top selling items by quantity, and sales by category.
    Only includes paid orders in calculations.
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Only count paid orders in analytics
    orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(1000)

    # Aggregate data using Python dictionaries
    daily_revenue = {} # Date string -> total revenue
    item_counts = {} # Item name -> total quantity sold
    category_counts = {} # Category name -> total quantity sold
    total_orders = len(orders)
    total_revenue = 0.0

    for order in orders:

        # Extract date portion from ISO timestamp for daily grouping
        date_str = order.get("created_at", "")[:10]
        revenue = order.get("total", 0)
        total_revenue += revenue
        daily_revenue[date_str] = daily_revenue.get(date_str, 0) + revenue

        # Count each item sold across all orders
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            item_counts[name] = item_counts.get(name, 0) + qty

    # Map item names to categories using current menu data
    menu_items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    menu_map = {m["name"]: m.get("category", "Other") for m in menu_items}

    for name, count in item_counts.items():
        cat = menu_map.get(name, "Other")
        category_counts[cat] = category_counts.get(cat, 0) + count

    # Sort and format results for chart consumption
    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    daily_chart = [{"date": k, "revenue": round(v, 2)} for k, v in sorted(daily_revenue.items())]
    category_chart = [{"category": k, "count": v} for k, v in category_counts.items()]

    return {
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "daily_revenue": daily_chart,
        "top_items": [{"name": n, "count": c} for n, c in top_items],
        "category_breakdown": category_chart
    }

# =============================================================================
# AI ROUTES
# =============================================================================

@api_router.post("/ai/recommend")
async def get_ai_recommendation(request: Request):

    """
    Uses OpenAI GPT-4o to recommend menu items based on customer preferences.
    Injects the full menu into the system prompt (simplified RAG pattern).
    Returns structured JSON with recommendations and a friendly message.
    Falls back to featured items if the AI API is unavailable.
    """

    body = await request.json()
    preferences = body.get("preferences", "")

    # Fetch available menu items to include in the AI context
    menu_items = await db.menu_items.find({"is_available": True}, {"_id": 0}).to_list(100)
    menu_text = "\n".join([f"- {m['name']} ({m['category']}): {m['description']} - £{m['price']}" 
    for m in menu_items
    ])

    # System prompt instructs the AI to respond in a specific JSON format
    system_message = f"""You are the AI recommendation engine for Baba Falooda, a premium falooda dessert shop from Mumbai now in Tooting, London.
Based on the customer's preferences, recommend 2-3 items from the menu. Be warm, enthusiastic, and knowledgeable about Indian desserts.
Always respond in JSON format with this structure:
{{"recommendations": [{{"name": "item name", "reason": "why this is perfect for them"}}], "message": "A friendly message to the customer"}}

Available menu:
{menu_text}"""

    try:
        completion = await openai_client.chat.completions.create(
            model="gpt-4o",
            max_tokens=500,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": preferences if preferences else "Suggest your best sellers for a first-time visitor"}
            ]
        )
        response_text = completion.choices[0].message.content

        # Parse the JSON response from the AI
        try:
            clean = response_text.strip()

            # Remove markdown code blocks if present (GPT sometimes wraps JSON in ```)
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
            parsed = json.loads(clean)
            return parsed
        except json.JSONDecodeError:

            # If JSON parsing fails, return the raw text as a message
            return {"recommendations": [], "message": response_text}

    except Exception as e:
        logger.error(f"AI recommendation error: {e}")

            # Graceful fallback: return featured items if AI is unavailable
        featured = [m for m in menu_items if m.get("is_featured")][:3]
        if not featured:
            featured = menu_items[:3]
        return {
            "recommendations": [{"name": m["name"], "reason": "One of our most popular items!"} for m in featured],
            "message": "Here are our top picks for you!"
        }

@api_router.post("/ai/chat")
async def ai_chat(msg: ChatMessage):

    """
    Powers the AI chatbot using OpenAI GPT-4o.
    Maintains conversation context by storing and retrieving chat history
    from MongoDB using the session ID. Each session has its own history
    allowing multiple simultaneous conversations.
    The full menu is injected into the system prompt for accurate responses.
    """

    # Generate a new session ID if this is a new conversation
    session_id = msg.session_id or str(uuid.uuid4())
    menu_items = await db.menu_items.find({"is_available": True}, {"_id": 0}).to_list(100)
    menu_text = "\n".join([f"- {m['name']} ({m['category']}): {m['description']} - £{m['price']}" for m in menu_items])

    # System prompt defines the AI's persona, knowledge and behaviour
    system_message = f"""You are Baba, the friendly AI assistant for Baba Falooda - a premium falooda dessert shop from Mumbai estabilished in 1986, now in Tooting, London.
You help customers with menu questions, recommendations, and general queries about the shop.
We have 6 branches in Mumbai, India and our first international branch is in Tooting London which opened in September 2024.
The owner of Baba falooda is Irfan Bilakhiya, Phone number of Baba falooda Tooting is 02038760285 and the shop email address is info@babafalooda.co.uk
Be warm, knowledgeable about Indian desserts and use only English.
Keep responses concise (2-3 sentences max) and helpful. the year is 2026.

Our menu:
{menu_text}


Shop location: 228 Upper Tooting road, SW17 7EW, Tooting, London
Opening hours: 12pm - 1 am daily
Important: All orders are for COLLECTION ONLY from our Tooting branch. We do not offer delivery.
For delivery orders order on Uber Eats, Deliveroo or JustEat"""
    


    # Retrieve previous messages in this conversation (up to last 20)
    history = await db.chat_history.find(
        {"session_id": session_id}, 
        {"_id": 0}
        ).sort("timestamp", 1).to_list(20)

    try:
        # Build the complete messages array for the API call
        messages = [{"role": "system", "content": system_message}]

        # Append conversation history to maintain context
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})

        # Add the new user message    
        messages.append({"role": "user", "content": msg.message})

        completion = await openai_client.chat.completions.create(
            model="gpt-4o",
            max_tokens=300,
            messages=messages
        )
        response = completion.choices[0].message.content

        # Save both user message and AI response to chat history
        timestamp = datetime.now(timezone.utc).isoformat()
        await db.chat_history.insert_many([
            {"session_id": session_id, "role": "user", "content": msg.message, "timestamp": timestamp},
            {"session_id": session_id, "role": "assistant", "content": response, "timestamp": timestamp}
        ])

        return {"response": response, "session_id": session_id}

    except Exception as e:
        logger.error(f"AI chat error: {e}")

        # Return a friendly fallback message if AI is unavailable
        return {
            "response": "Welcome to Baba Falooda! I'm having a small hiccup right now, but please browse our delicious menu. Can I help you with anything specific?",
            "session_id": session_id
        }

# =============================================================================
# STORY ROUTES
# =============================================================================

@api_router.get("/story")
async def get_story():

    """
    Returns the 'Our Story' page content from the database.
    Falls back to default content if no story has been saved yet.
    Public endpoint - no authentication required.
    """

    story = await db.site_content.find_one({"type": "story"}, {"_id": 0})
    if not story:

        # Default content shown before admin has customised the story
        return {
            "title": "Our Story",
            "content": "From the bustling streets of Mumbai to the vibrant heart of Tooting, London — Baba Falooda brings you the authentic taste of India's most beloved dessert drink",
            "video_url": "https://res.cloudinary.com/dlm6l9oqc/video/upload/v1776449383/final_vbcipl.mov"
        }
    return story

@api_router.put("/admin/story")
async def update_story(story: StoryUpdate, request: Request):

    """
    Updates the Our Story page content. Admin only.
    Uses upsert=True to create the document if it doesn't exist,
    or update it if it does (insert + update = upsert).
    """

    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.site_content.update_one(
        {"type": "story"},
        {"$set": {"type": "story", 
                  "title": story.title, 
                  "content": story.content, 
                  "video_url": story.video_url}}, # Save video URL to database
        upsert=True # Create document if it doesn't exist
    )
    return {"message": "Story updated"}

# =============================================================================
# REVIEW ROUTES
# =============================================================================
 
@api_router.post("/reviews/{order_id}")
async def create_review(order_id: str, review: ReviewCreate):

    """
    Submits a customer review for a specific order.
    Prevents duplicate reviews - each order can only be reviewed once (409 Conflict).
    Validates rating is between 1 and 5.
    Links the review to the items from the original order.
    """

    # Verify the order exists
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Prevent duplicate reviews for the same order
    existing = await db.reviews.find_one({"order_id": order_id})
    if existing:
        raise HTTPException(status_code=409, detail="Review already submitted for this order")
    
    # Prevent duplicate reviews for the same order
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    review_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "rating": review.rating,
        "comment": review.comment,
        "customer_name": review.customer_name or order.get("customer_name", "Anonymous"),
        "items": [item.get("name", "") for item in order.get("items", [])], # Save item names for display
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.reviews.insert_one(review_doc)
    review_doc.pop("_id", None)
    return review_doc


@api_router.get("/reviews")
async def get_reviews():

    """
    Returns all customer reviews sorted by newest first.
    Public endpoint - visible to all visitors on the Reviews page.
    Limited to 50 most recent reviews.
    """

    reviews = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return reviews

@api_router.get("/reviews/stats")
async def get_review_stats():

    """
    Returns aggregate review statistics for the Reviews page.
    Calculates average rating, total count and breakdown by star rating (1-5).
    Used to display the rating summary card and bar chart.
    """

    reviews = await db.reviews.find({}, {"_id": 0}).to_list(500)

    if not reviews:
        return {"average_rating": 0, "total_reviews": 0, "rating_breakdown": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
    
    total = len(reviews)
    avg = sum(r["rating"] for r in reviews) / total

    # Count reviews for each star rating
    breakdown = {i: 0 for i in range(1, 6)}
    for r in reviews:
        breakdown[r["rating"]] = breakdown.get(r["rating"], 0) + 1

    return {"average_rating": round(avg, 1), "total_reviews": total, "rating_breakdown": breakdown}

@api_router.get("/reviews/order/{order_id}")
async def get_order_review(order_id: str):

    """
    Returns the review for a specific order, if one exists.
    Used by the ReviewPage to check if the order has already been reviewed.
    Returns 404 if no review exists for this order.
    """

    review = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="No review found for this order")
    return review

# =============================================================================
# PAYMENT ROUTES
# =============================================================================

@api_router.post("/checkout")
async def create_checkout(req: CheckoutRequest, http_request: Request):

    """
    Creates a Stripe Checkout Session for the specified order.
    Stripe Checkout is a hosted payment page - customers are redirected to
    Stripe's servers to enter card details, keeping PCI compliance off our servers.
    The session ID is saved to the order and payment_transactions collection.
    asyncio.to_thread is used to run the synchronous Stripe SDK in a thread pool
    without blocking FastAPI's async event loop.
    """

    order = await db.orders.find_one({"id": req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    host_url = req.origin_url.rstrip("/")

    # Success URL uses Stripe's {CHECKOUT_SESSION_ID} placeholder
    # which Stripe replaces with the actual session ID on redirect
    success_url = f"{host_url}/order-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/menu"

    try:
        # Run synchronous Stripe SDK in thread pool to avoid blocking
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {"name": "Baba Falooda Order"},
                    "unit_amount": int(order["total"] * 100),  #Stripe uses pence (multiply by 100)
                },
                "quantity": 1,
            }],

            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"order_id": req.order_id, "customer_name": order.get("customer_name", "")}
        )

        # Record the payment transaction in the database
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "order_id": req.order_id,
            "amount": order["total"],
            "currency": "gbp",
            "status": "initiated",
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Link the Stripe session to the order for later status checking
        await db.orders.update_one(
            {"id": req.order_id}, 
            {"$set": {"stripe_session_id": session.id}}
            )
        
        # Return the Stripe checkout URL for frontend redirect
        return {"url": session.url, "session_id": session.id}

    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):

    """
    Polls Stripe to check the payment status of a checkout session.
    Called repeatedly by the frontend OrderSuccessPage after redirect from Stripe.
    When payment is confirmed as 'paid':
      1. Updates the payment transaction record in MongoDB
      2. Updates the order status to 'confirmed' and payment_status to 'paid'
      3. Sends order confirmation email to customer
      4. Sends store notification email to staff
    All Stripe response fields are converted to native Python types to prevent
    JSON serialisation errors with Stripe's custom object types.
    """

    try:
        # Retrieve session from Stripe API
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)

        # Convert Stripe objects to native Python types for JSON serialisation
        payment_status = str(session.payment_status) if session.payment_status else "unpaid"
        session_status = str(session.status) if session.status else "unknown"
        amount_total = int(session.amount_total) if session.amount_total else 0
        currency = str(session.currency) if session.currency else "gbp"

        # Safely extract metadata (may be None)
        try:
            metadata = dict(session.metadata) if session.metadata else {}
        except Exception:
            metadata = {}

        logger.info(f"Stripe session {session_id}: status={session_status}, payment_status={payment_status}")

        # Process confirmed payment - update database and send emails
        if payment_status == "paid":
            tx = await db.payment_transactions.find_one({"session_id": session_id})

            # Only process once - check payment hasn't already been recorded
            if tx and tx.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "completed", "payment_status": "paid"}}
                )

                order_id = tx.get("order_id") or metadata.get("order_id")
                if order_id:
                    # Update order to confirmed status
                    await db.orders.update_one(
                        {"id": order_id},
                        {"$set": {"payment_status": "paid", "status": "confirmed"}}
                    )

                    # Send notification emails
                    order_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
                    if order_doc:
                        await send_order_confirmation_email(order_doc) # Email to customer
                        await send_store_notification_email(order_doc) # Email to store staff


        return {
            "status": session_status,
            "payment_status": payment_status,
            "amount_total": amount_total,
            "currency": currency,
            "metadata": metadata
        }

    except Exception as e:
        logger.error(f"Checkout status error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):

    """
    Handles incoming Stripe webhook events.
    Webhooks are server-to-server notifications sent by Stripe when payment events occur.
    If a webhook secret is configured, the signature is verified to confirm authenticity.
    Processes 'checkout.session.completed' events to update order status and send emails.
    This provides a backup payment confirmation mechanism alongside the polling approach.
    """

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    try:
        # Verify webhook signature if secret is configured (recommended for production)
        if webhook_secret:
            event = await asyncio.to_thread(stripe.Webhook.construct_event, body, sig, webhook_secret)
        else:
            # Skip signature verification in development (not recommended for production)
            event = json.loads(body)

        logger.info(f"Stripe webhook event: {event.get('type', '')}")

        # Handle successful payment completion
        if event.get("type") == "checkout.session.completed":
            session = event["data"]["object"]
            session_id = session["id"]

            if session.get("payment_status") == "paid":
                tx = await db.payment_transactions.find_one({"session_id": session_id})
                
                # Only process if not already handled by the polling endpoint
                if tx and tx.get("payment_status") != "paid":
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"status": "completed", "payment_status": "paid"}}
                    )

                    order_id = tx.get("order_id") or (session.get("metadata") or {}).get("order_id")
                    if order_id:
                        await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "paid", "status": "confirmed"}})
                        order_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
                        if order_doc:
                            await send_order_confirmation_email(order_doc)
                            await send_store_notification_email(order_doc)

        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# =============================================================================
# SEED DATA
# =============================================================================
# SEED_MENU is empty because menu items are managed through the admin dashboard.
# Previously contained default items - cleared after real menu was added.

SEED_MENU = []

async def seed_admin():

    """
    Creates the admin user account on first startup if it doesn't exist.
    Admin credentials are read from environment variables for security.
    If the admin exists but has a different password, the password is updated.
    """

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@babafalooda.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "BabaAdmin2026!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        # Create new admin account
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed,
            "name": "Admin", "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        
        # Update password if it has changed in environment variables
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

async def seed_menu():

    """
    Seeds default menu items on first startup if the menu is empty.
    SEED_MENU is currently empty - all items are managed via admin dashboard.
    """

    count = await db.menu_items.count_documents({})
    if count == 0:
        for item_data in SEED_MENU:
            menu_item = MenuItem(**item_data)
            doc = menu_item.model_dump()
            await db.menu_items.insert_one(doc)
        logger.info(f"Seeded {len(SEED_MENU)} menu items")

async def seed_story():

    """
    Creates default Our Story content on first startup if none exists.
    Content can be updated through the admin dashboard Story tab.
    """

    existing = await db.site_content.find_one({"type": "story"})
    if not existing:
        await db.site_content.insert_one({
            "type": "story",
            "title": "Our Story",
            "content": "From the bustling streets of Mumbai to the vibrant heart of Tooting, London — Baba Falooda brings you the authentic taste of India's most beloved dessert drink.\n\nOur journey began with a simple passion: to craft the perfect falooda that captures the essence of Mumbai's street food culture.\n\nUsing only the finest ingredients — premium rose syrup, hand-cut falooda sev, creamy kulfi, and fresh basil seeds — we create an experience that takes you straight to the streets of Mumbai, right here in London.",
            "video_url": "https://res.cloudinary.com/dlm6l9oqc/video/upload/v1776449383/final_vbcipl.mov"
        })
        logger.info("Seeded story content")

 
# =============================================================================
# APPLICATION LIFECYCLE EVENTS
# =============================================================================

@app.on_event("startup")
async def startup():

    """
    Runs automatically when the FastAPI server starts.
    Creates database indexes and seeds initial data if needed.
    The unique index on email prevents duplicate user accounts at database level.
    """
    # Create unique index on email field to prevent duplicate accounts

    await db.users.create_index("email", unique=True)
    
    # Seed initial data
    await seed_admin()
    await seed_menu()
    await seed_story()

    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():

    """
    Runs when the server shuts down.
    Cleanly closes the MongoDB connection to prevent resource leaks.
    """

    client.close()

# =============================================================================
# REGISTER ROUTER AND MIDDLEWARE
# =============================================================================

# Register all routes defined in api_router under the /api prefix
app.include_router(api_router)

# CORS middleware allows the React frontend (different port/domain) to make
# requests to this backend. Without CORS, browsers block cross-origin requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://babafalooda.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
