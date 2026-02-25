import os

class Config:
    """
    Central configuration class for the PropertyPlus Flask application.
    All global settings like security, database, and email are defined here.
    """

    from dotenv import load_dotenv
    load_dotenv()  # Load environment variables from .env file

    # ------------------------------------------------------------------
    # Application Security
    # ------------------------------------------------------------------

    # Secret key is required for session management and security
    # First tries to read from environment variable, otherwise uses default
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'PropertyPlus_Secret_Key_2026'

    # ------------------------------------------------------------------
    # Database Configuration
    # ------------------------------------------------------------------

    # Database connection details
    DB_HOST = "localhost"
    DB_NAME = "propertyplus_db"
    DB_USER = "postgres"
    DB_PASS = "admin"   # Change this according to your PostgreSQL password

    # ------------------------------------------------------------------
    # Email Configuration (Used for OTP verification)
    # ------------------------------------------------------------------

    # SMTP server details for sending emails
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True

    # Email account used to send OTPs
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")          # Sender email
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")          # App password
