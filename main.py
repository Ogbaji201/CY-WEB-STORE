import os
import time
import random
import asyncio
import json
from pathlib import Path
from typing import List, Optional, Dict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import ssl
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from io import BytesIO
import uvicorn

load_dotenv()
app = FastAPI()

# --- Database Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./sports_jersey.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class DBProduct(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    category = Column(String)
    price = Column(Float)
    image = Column(String)

class DBOrder(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, unique=True, index=True)
    items = Column(JSON)
    total_amount = Column(Float)
    customer_name = Column(String)
    customer_email = Column(String)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    country = Column(String, nullable=True)
    payment_method = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- App Initialization ---
app = FastAPI(title="Sports Jersey Store API", version="1.0")

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# --- Paths ---
BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

class EmailConfig(BaseSettings):
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    TO_EMAIL: str

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

print("Loading email config...")

def datetimeformat(value, format='%Y-%m-%d %H:%M'):
    return value.strftime(format)

templates.env.filters["datetimeformat"] = datetimeformat

# --- Data Models ---
class Product(BaseModel):
    id: str
    name: str
    category: str
    price: float
    image: str

    class Config:
        orm_mode = True

class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int
    image: str

class Order(BaseModel):
    order_id: str
    items: List[OrderItem]
    total_amount: float
    customer_name: str
    customer_email: str
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    status: str = "pending"
    timestamp: float = time.time()

    class Config:
        orm_mode = True

email_config = EmailConfig()
print(f"SMTP User: {email_config.SMTP_USERNAME}")

# --- Initialize Sample Products ---
def init_db():
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(DBProduct).delete()
        
        # Sample products
        sample_products = [
            Product(id='prod1', name='ProFlex Running Jersey', category='Sporting Jerseys', price=49.99, image='image/j1.jpeg'),
            Product(id='prod2', name='Distressed Slim Fit Jeans', category='Fashionable Jeans', price=79.99, image='image/White_Jeans.jpeg'),
            Product(id='prod3', name='Urban Vibe Oversized T-Shirt', category='Trendy T-shirts', price=29.99, image='image/polo1.jpeg'),
            Product(id='prod4', name='Classic Pique Polo', category='Polo Shirts', price=39.99, image='image/polo6.jpeg'),
            Product(id='prod5', name='90s Graphic Vintage Tee', category='Vintage Shirts', price=59.99, image='image/polo8.jpeg'),
            Product(id='prod6', name='Sport-Tech Performance Jersey', category='Sporting Jerseys', price=54.99, image='image/j11.jpeg'),
            Product(id='prod7', name='Chelsea FC Home Jersey', category='Sporting Jerseys', price=69.99, image='image/Chelsea-Blue.jpeg'),
            Product(id='prod8', name='Manchester City Away Jersey', category='Sporting Jerseys', price=69.99, image='image/Mancity.jpeg'),
        ]
        
        # Add to database
        for product in sample_products:
            db.add(DBProduct(**product.dict()))
        
        db.commit()
        print("Database initialized with sample products!")
    except Exception as e:
        db.rollback()
        print(f"Error initializing database: {e}")
    finally:
        db.close()

# Initialize the database
init_db()

# --- Helpers ---
async def generate_order_id():
    return f"JS-{int(time.time() * 1000)}-{random.randint(100, 999)}"

async def send_notification(contact: str, message: str, is_email=True):
    if is_email:
        subject = "Order Notification - Sports Jersey Store"
        html_body = f"<pre>{message}</pre>"
        success = send_email(email_config.SMTP_USERNAME, contact, subject, html_body)
        return success
    else:
        print(f"\n--- SMS to {contact} ---\n{message}\n{'-'*10}\n")
        return True

def send_email(from_addr: str, to_addr: str, subject: str, html_body: str, attachment: BytesIO = None, filename: str = "receipt.pdf") -> bool:
    msg = MIMEMultipart()
    msg['From'] = from_addr
    msg['To'] = to_addr
    msg['Subject'] = subject
    msg.attach(MIMEText(html_body, 'html'))

    # Attach PDF if provided
    if attachment:
        from email.mime.application import MIMEApplication
        part = MIMEApplication(attachment.read(), _subtype="pdf")
        part.add_header('Content-Disposition', 'attachment', filename=filename)
        msg.attach(part)

    try:
        with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT) as server:
            server.starttls()
            server.login(email_config.SMTP_USERNAME, email_config.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Email with receipt sent to {to_addr}")
        return True
    except Exception as e:
        print(f"Error sending email to {to_addr}: {e}")
        return False


def send_contact_email(form_data: dict) -> bool:
    subject = "New Contact Form Submission - Sports Jersey"
    body = f"""
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> {form_data['name']}</p>
    <p><strong>Email:</strong> {form_data['email']}</p>
    <p><strong>Phone:</strong> {form_data.get('phone', 'Not provided')}</p>
    <p><strong>Message:</strong></p>
    <p>{form_data['message']}</p>
    """
    return send_email(email_config.SMTP_USERNAME, email_config.TO_EMAIL, subject, body)
    
def send_confirmation_email(user_email: str, name: str, message: str) -> bool:
    subject = "Thanks for contacting Sports Jersey Store"
    body = f"""
    <h2>Hello {name},</h2>
    <p>Thanks for reaching out to us!</p>
    <p>We received your message:</p>
    <blockquote>{message}</blockquote>
    <p>Our team will get back to you shortly.</p>
    <p>Regards,<br>Sports Jersey Store Team</p>
    """
    return send_email(email_config.SMTP_USERNAME, user_email, subject, body)

def send_order_emails(order, order_items, request: Request):
    try:
        # Render email content
        html = templates.get_template("email_order_confirmation.html").render({
            "order": order,
            "order_items": order_items,
            "request": request
        })

        subject = f"Order Confirmation - #{order.order_id}"

        # Send to customer
        send_email(email_config.SMTP_USERNAME, order.customer_email, subject, html)

        # Send to admin
        send_email(email_config.SMTP_USERNAME, email_config.TO_EMAIL, f"New Order Received - {order.order_id}", html)

        print("Order confirmation emails sent.")
    except Exception as e:
        print(f"Failed to send order emails: {e}")

def generate_pdf_receipt(order, order_items) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50
    pdf.setTitle(f"Receipt - {order.order_id}")
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(50, y, "Sports Jersey Store - Order Receipt")
    y -= 30

    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, y, f"Order ID: {order.order_id}")
    y -= 20
    pdf.drawString(50, y, f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}")
    y -= 20
    pdf.drawString(50, y, f"Customer: {order.customer_name}")
    y -= 20
    pdf.drawString(50, y, f"Email: {order.customer_email}")
    y -= 20
    pdf.drawString(50, y, f"Phone: {order.customer_phone}")
    y -= 30

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y, "Items:")
    y -= 20

    pdf.setFont("Helvetica", 11)
    for item in order_items:
        pdf.drawString(60, y, f"{item['quantity']} × {item['name']} - ₦{item['subtotal']:.2f}")
        y -= 18
        if y < 100:
            pdf.showPage()
            y = height - 50

    y -= 10
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y, f"Total Amount: ₦{order.total_amount:.2f}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer

# --- Routes ---
@app.get("/", response_class=HTMLResponse)
async def serve_homepage(request: Request, db: Session = Depends(get_db)):
    products = db.query(DBProduct).all()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "title": "Home",
        "products": products
    })

@app.get("/categories", response_class=HTMLResponse)
async def serve_categories(request: Request, db: Session = Depends(get_db)):
    products = db.query(DBProduct).all()
    return templates.TemplateResponse("categories.html", {
        "request": request,
        "title": "Categories",
        "products": products
    })

@app.get("/about", response_class=HTMLResponse)
async def serve_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})

@app.get("/contact", response_class=HTMLResponse)
async def serve_contact(request: Request):
    return templates.TemplateResponse("contact.html", {"request": request})

@app.get("/shop", response_class=HTMLResponse)
async def serve_shop(request: Request, db: Session = Depends(get_db)):
    products = db.query(DBProduct).all()
    return templates.TemplateResponse("shop.html", {
        "request": request,
        "products": products
    })

@app.get("/api/products", response_model=List[Product])
async def get_products(db: Session = Depends(get_db)):
    return db.query(DBProduct).all()

@app.get("/api/products/{product_id}", response_model=Product)
async def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(DBProduct).filter(DBProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.get("/checkout", response_class=HTMLResponse)
async def serve_checkout(request: Request):
    return templates.TemplateResponse("checkout.html", {
        "request": request,
        "title": "Checkout"
    })

@app.post("/api/orders")
async def place_order(request: Request, db: Session = Depends(get_db)):
    try:
        order_data = await request.json()
        
        if not order_data.get('items'):
            raise HTTPException(status_code=400, detail="Cart is empty")
        
        # Generate order ID
        order_id = await generate_order_id()
        
        # Create database order
        db_order = DBOrder(
            order_id=order_id,
            items=json.dumps(order_data['items']),
            total_amount=float(order_data.get('total_amount', 0)),
            customer_name=order_data.get('customer_name', ''),
            customer_email=order_data.get('customer_email', ''),
            customer_phone=order_data.get('customer_phone'),
            customer_address=order_data.get('customer_address'),
            city=order_data.get('city'),
            zip_code=order_data.get('zip_code'),
            country=order_data.get('country'),
            payment_method=order_data.get('payment_method'),
            status="received"
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

        # Parse items for subtotal
        order_items = []
        for item in order_data['items']:
            subtotal = float(item['price']) * int(item['quantity'])
            order_items.append({**item, "subtotal": subtotal})

        # Send confirmation emails
        send_order_emails(db_order, order_items, request)
        
        return {
            "success": True,
            "order_id": order_id,
            "redirect_url": f"/order-confirmation/{order_id}"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/orders/{order_id}", response_model=Order)
async def check_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(DBOrder).filter(DBOrder.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Convert JSON items back to list
    order.items = json.loads(order.items)
    return order
    print(await request.body())

@app.get("/order-confirmation/{order_id}", response_class=HTMLResponse)
async def order_confirmation(request: Request, order_id: str, db: Session = Depends(get_db)):
    order = db.query(DBOrder).filter(DBOrder.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        # Safely parse JSON string if not already a list
        items_data = json.loads(order.items) if isinstance(order.items, str) else order.items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid order data format: {str(e)}")

    order_items = []
    for item in items_data:
        try:
            subtotal = float(item['price']) * int(item['quantity'])
        except (KeyError, ValueError, TypeError):
            subtotal = 0.0
        order_items.append({**item, "subtotal": subtotal})

    return templates.TemplateResponse("order_confirmation.html", {
        "request": request,
        "order": order,
        "order_items": order_items,
        "title": "Order Confirmation"
    })

@app.post("/api/contact")
async def contact_form(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),
    message: str = Form(...)
):
    form_data = {
        "name": name,
        "email": email,
        "phone": phone,
        "message": message
    }

    try:
        admin_sent = send_contact_email(form_data)
        user_sent = send_confirmation_email(email, name, message)
        
        if not admin_sent and not user_sent:
            raise HTTPException(status_code=500, detail="Failed to send both admin and confirmation emails.")
        elif not admin_sent:
            raise HTTPException(status_code=500, detail="Failed to send message to admin.")
        elif not user_sent:
            raise HTTPException(status_code=500, detail="Message sent to admin, but failed to send confirmation to you.")

        return JSONResponse(status_code=200, content={"success": True, "message": "Thank you! Your message has been sent."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/static/Script1.js")
async def get_script():
    return FileResponse("static/Script1.js")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)