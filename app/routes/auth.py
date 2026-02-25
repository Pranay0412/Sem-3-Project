"""
PropertyPlus Authentication & User Management
--------------------------------------------
This blueprint handles all authentication-related routes, including signup,
login, password reset, profile updates, and 2FA settings.
"""

import os
import json
import time
import random
import string
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    flash,
    current_app,
)
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from app.models import (
    create_user,
    get_user_by_username,
    check_email_exists,
    get_user_by_email,
    update_user_password,
    update_user_profile_image,
    update_user_profile_details,
    update_user_2fa_status,
    delete_user_by_email,
)

auth_bp = Blueprint("auth", __name__)


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def get_location_data():
    """
    Load India states and cities data from the JSON data file.
    
    Returns:
        dict: Geographic data structure.
    """
    json_path = os.path.join(current_app.root_path, "data", "india_states_cities.json")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_avatar(first_name, color_hex=None):
    """
    Generate a placeholder avatar URL using a third-party API.

    Args:
        first_name (str): The user's first name to extract the initial.
        color_hex (str, optional): A specific background color hex code.

    Returns:
        str: The URL for the generated avatar image.
    """
    if color_hex:
        bg = color_hex.lstrip("#")
    else:
        colors = ["4f7cff", "1f2a44", "0ea5a4", "6d28d9", "f43f5e", "22c55e", "f59e0b"]
        index = ord(first_name[0].upper()) % len(colors)
        bg = colors[index]

    letter = first_name[0].upper()
    return f"https://ui-avatars.com/api/?name={letter}&background={bg}&color=ffffff&size=256"


def send_email_otp(to_email, otp):
    """
    Send a 6-digit OTP to the specified email for verification.

    Args:
        to_email (str): Recipient's email address.
        otp (str): The verification code.

    Returns:
        bool: True if sent successfully, False otherwise.
    """
    try:
        html_content = render_template("emails/otp_verification.html", otp=otp)
    except Exception:
        # Fallback if template is missing or fails
        html_content = f"Your verification code is: {otp}"

    msg = MIMEText(html_content, "html")
    msg["Subject"] = "Your Verification Code - PropertyPlus"
    msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Mail Delivery Error: {e}")
        return False


def send_welcome_email(to_email, username):
    """
    Send a welcome email to a newly registered user.

    Args:
        to_email (str): Recipient's email address.
        username (str): The registered user's username.

    Returns:
        bool: True if sent successfully, False otherwise.
    """
    try:
        html_content = render_template("emails/welcome.html", username=username)
    except Exception:
        html_content = f"Welcome to PropertyPlus, {username}!"

    msg = MIMEText(html_content, "html")
    msg["Subject"] = "Welcome to the Family!"
    msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Welcome Mail Delivery Error: {e}")
        return False


def send_password_update_email(to_email, username, update_time):
    """
    Send a notification email when a user's password is changed.

    Args:
        to_email (str): Recipient's email address.
        username (str): The user's username.
        update_time (str): Timestamp of the update.

    Returns:
        bool: True if sent successfully, False otherwise.
    """
    try:
        html_content = render_template(
            "emails/password_updated.html", 
            username=username, 
            update_time=update_time
        )
    except Exception:
        html_content = f"Hi {username}, your password was updated at {update_time}."

    msg = MIMEText(html_content, "html")
    msg["Subject"] = "Your Password Has Been Updated"
    msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Password Update Mail Delivery Error: {e}")
        return False


# ==============================================================================
# AUTHENTICATION ROUTES
# ==============================================================================

@auth_bp.route("/signup")
def signup():
    """
    Render the user registration page.
    """
    data = get_location_data()
    states = sorted(list(data.keys()))
    return render_template("auth/signup.html", states=states)


@auth_bp.route("/api/register", methods=["POST"])
def register():
    """
    Process user registration and profile image/avatar creation.
    """
    data = request.form.to_dict()

    try:
        data["email"] = session.get("temp_email")
        hashed_pw = generate_password_hash(data["password"])

        image_path = None
        # Handle Profile Image Upload
        if "profile_image" in request.files:
            file = request.files["profile_image"]
            if file and file.filename != "":
                filename = secure_filename(f"{data['username']}_{int(time.time())}.jpg")
                upload_folder = os.path.join(current_app.static_folder, "uploads")
                os.makedirs(upload_folder, exist_ok=True)
                file.save(os.path.join(upload_folder, filename))
                image_path = filename

        # Fallback to generated avatar
        if not image_path:
            selected_color = data.get("avatar_color")
            image_path = generate_avatar(data.get("full_name", "User"), selected_color)

        data["profile_image"] = image_path

        if create_user(data, hashed_pw):
            send_welcome_email(data["email"], data["username"])
            
            # Auto-login after registration
            new_user = get_user_by_email(data["email"])
            if new_user:
                session["user"] = dict(new_user)
            return jsonify({"success": True})
        
        return jsonify({"success": False, "message": "Database Error"})
    except Exception as e:
        current_app.logger.error(f"Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)})


@auth_bp.route("/api/cities/<state>")
def get_cities(state):
    """
    API endpoint to fetch cities for a given state.
    """
    data = get_location_data()
    if state in data:
        return jsonify(data[state]["cities"])
    return jsonify([])


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """
    Handle user login (GET renders page, POST processes credentials).
    """
    if request.method == "POST":
        login_input = request.form["username"]
        password = request.form["password"]

        # Search by username or email
        user = get_user_by_username(login_input) or get_user_by_email(login_input)

        if user and check_password_hash(user["password"], password):
            session.permanent = True
            session["user"] = dict(user)
            
            if user["role"] == "Seller":
                return redirect(url_for("main.seller_dashboard"))
            return redirect(url_for("main.buyer_dashboard"))
        
        flash("Invalid username or password", "error")

    return render_template("auth/login.html")


@auth_bp.route("/logout")
def logout():
    """
    Log out the current user and clear session.
    """
    session.clear()

    resp = redirect(url_for("main.home"))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp



@auth_bp.route("/api/send-otp", methods=["POST"])
def api_send_otp():
    """
    Send verification OTP during registration.
    """
    data = request.json
    email = data.get("email")
    
    if check_email_exists(email):
        return jsonify({"success": False, "message": "Email already registered"})
    
    now = time.time()
    if ("current_otp" in session and session.get("current_email") == email and 
        session.get("current_otp_time", 0) > now - 60):
        otp = session["current_otp"]
    else:
        otp = "".join(random.choices(string.digits, k=6))
        session["current_otp"] = otp
        session["current_email"] = email
        session["current_otp_time"] = now
    
    session["temp_email"] = email
    if send_email_otp(email, otp):
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Failed to send email"})



@auth_bp.route("/api/verify-otp", methods=["POST"])
def api_verify_otp():
    """
    Verify the OTP provided by the user during registration.
    """
    user_otp = request.json.get("otp")
    if "current_otp" in session and session["current_otp"] == user_otp:
        # Check expiration (10 minutes)
        if session.get("current_otp_time", 0) < time.time() - 600:
            return jsonify({"success": False, "message": "OTP has expired"})
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid OTP"})


@auth_bp.route("/api/check-username", methods=["POST"])
def check_username():
    """
    Check if a username is already taken in real-time.
    """
    data = request.get_json()
    username = data.get("username")

    if not username:
        return jsonify({"exists": False})

    return jsonify({"exists": get_user_by_username(username) is not None})


# ==============================================================================
# FORGOT PASSWORD ROUTES
# ==============================================================================

@auth_bp.route("/forgot-password")
def forgot_password():
    """
    Render the Forgot Password page.
    """
    return render_template("auth/forgot-password.html")


@auth_bp.route("/api/send-forgot-otp", methods=["POST"])
def send_forgot_otp():
    """
    Send an OTP to the user's email for password reset.
    """
    data = request.json
    email = data.get("email")

    if not get_user_by_email(email):
        return jsonify({"success": False, "message": "Email not registered"})

    now = time.time()
    if ("forgot_otp" in session and session.get("forgot_email") == email and 
        session.get("forgot_otp_time", 0) > now - 60):
        otp = session["forgot_otp"]
    else:
        otp = "".join(random.choices(string.digits, k=6))
        session["forgot_otp"] = otp
        session["forgot_email"] = email
        session["forgot_otp_time"] = now

    if send_email_otp(email, otp):
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Failed to send email"})


@auth_bp.route("/api/verify-forgot-otp", methods=["POST"])
def verify_forgot_otp():
    """
    Verify the OTP for password reset.
    """
    user_otp = request.json.get("otp")

    if "forgot_otp" in session and session["forgot_otp"] == user_otp:
        if session.get("forgot_otp_time", 0) < time.time() - 600:
            return jsonify({"success": False, "message": "OTP has expired"})
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid OTP"})


@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password():
    """
    Reset the user's password using the verified email in session.
    """
    data = request.json
    try:
        email = session.get("forgot_email")
        new_password = data.get("new_password")

        if not email or not new_password:
            return jsonify({"success": False, "message": "Invalid request"})

        hashed_pw = generate_password_hash(new_password)
        if update_user_password(email, hashed_pw):
            session.pop("forgot_otp", None)
            session.pop("forgot_email", None)
            return jsonify({"success": True, "message": "Password updated successfully"})
        return jsonify({"success": False, "message": "Database error"})
    except Exception as e:
        current_app.logger.error(f"Reset Password Error: {e}")
        return jsonify({"success": False, "message": str(e)})


# ==============================================================================
# PROFILE MANAGEMENT ROUTES
# ==============================================================================

@auth_bp.route("/api/update-profile-image", methods=["POST"])
def update_profile_image_route():
    """
    Update the user's profile image or avatar.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        user_email = session["user"]["email"]
        username = session["user"]["username"]
        fullname = session["user"].get("full_name", "User")

        image_path = None
        # Handle File Upload
        if "profile_image" in request.files:
            file = request.files["profile_image"]
            if file and file.filename != "":
                filename = secure_filename(f"{username}_updated_{int(time.time())}.jpg")
                upload_folder = os.path.join(current_app.static_folder, "uploads")
                os.makedirs(upload_folder, exist_ok=True)
                file.save(os.path.join(upload_folder, filename))
                image_path = filename

        # Handle Color Selection for Avatar
        if not image_path and "avatar_color" in request.form:
            image_path = generate_avatar(fullname, request.form["avatar_color"])

        if not image_path:
            return jsonify({"success": False, "message": "No file or color selected"}), 400

        if update_user_profile_image(user_email, image_path):
            session["user"]["profile_image"] = image_path
            session.modified = True
            
            ret_url = image_path if image_path.startswith("http") else url_for("static", filename="uploads/" + image_path)
            return jsonify({"success": True, "image_url": ret_url})
        return jsonify({"success": False, "message": "Database Error"}), 500
    except Exception as e:
        current_app.logger.error(f"Update Image Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/api/update-profile-details", methods=["POST"])
def update_profile_details_route():
    """
    Update user contact details after password verification.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        data = request.json
        password = data.get("password")
        contact_number = data.get("contact_number")
        city = data.get("city")
        state = data.get("state")
        email = session["user"]["email"]

        db_user = get_user_by_email(email)
        if not db_user or not check_password_hash(db_user["password"], password):
            return jsonify({"success": False, "message": "Incorrect password"})

        if update_user_profile_details(email, contact_number, city, state):
            session["user"].update({
                "contact_number": contact_number,
                "city": city,
                "state": state
            })
            session.modified = True
            return jsonify({"success": True, "message": "Profile updated successfully"})
        return jsonify({"success": False, "message": "Database Error"}), 500
    except Exception as e:
        current_app.logger.error(f"Update Profile Details Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
# ==============================================================================
# SETTINGS & ACCOUNT MANAGEMENT ROUTES
# ==============================================================================

def send_deletion_email(to_email, username):
    """
    Send a confirmation email after an account is successfully deleted.
    """
    try:
        html_content = render_template("emails/account_deleted.html", username=username)
    except Exception:
        html_content = f"Hello {username}, your account has been successfully deleted."

    msg = MIMEText(html_content, "html")
    msg["Subject"] = "Account Deleted - PropertyPlus"
    msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Deletion Mail Error: {e}")
        return False


def send_2fa_otp_email(to_email, otp, action="disable"):
    """
    Send a 2FA verification code via email.
    """
    try:
        html_content = render_template("emails/2fa_otp.html", otp=otp, action=action)
    except Exception:
        html_content = f"Your code to {action} 2FA is: {otp}"

    msg = MIMEText(html_content, "html")
    msg["Subject"] = f"2FA {action.upper()} - PropertyPlus"
    msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"2FA Mail Error: {e}")
        return False


@auth_bp.route("/api/settings/change-password", methods=["POST"])
def change_password():
    """
    Initiate password change process (check 2FA and send OTP if needed).
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    email = session["user"]["email"]
    user = get_user_by_email(email)
    
    if user and not user.get("is_2fa_enabled"):
        return jsonify({"success": True, "otp_required": False})

    now = time.time()
    if "pwd_change_otp" in session and session.get("pwd_otp_time", 0) > now - 60:
        otp = session["pwd_change_otp"]
    else:
        otp = "".join(random.choices(string.digits, k=6))
        session.update({"pwd_change_otp": otp, "pwd_otp_time": now})

    if send_email_otp(email, otp):
        return jsonify({"success": True, "otp_required": True, "message": "OTP sent to your email"})
    return jsonify({"success": False, "message": "Failed to send OTP"})


@auth_bp.route("/api/settings/verify-otp-only", methods=["POST"])
def verify_otp_only():
    """
    Verify password change OTP.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    user_otp = request.json.get("otp")
    if "pwd_change_otp" in session and session["pwd_change_otp"] == user_otp:
        if session.get("pwd_otp_time", 0) < time.time() - 600:
            return jsonify({"success": False, "message": "OTP has expired"})
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid OTP"})


@auth_bp.route("/api/settings/verify-old-pwd", methods=["POST"])
def verify_old_pwd():
    """
    Verify user's current password.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.json
    password = data.get("password")
    
    db_user = get_user_by_email(session["user"]["email"])
    if db_user and check_password_hash(db_user["password"], password):
        session["pwd_verify_success"] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Incorrect password"})


@auth_bp.route("/api/settings/verify-pwd-final", methods=["POST"])
def verify_pwd_final():
    """
    Finalize password update after OTP or old password verification.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.json
    new_password = data.get("new_password")
    email = session["user"]["email"]
    
    is_verified = False
    if "otp" in data:
        user_otp = data.get("otp")
        if "pwd_change_otp" in session and session["pwd_change_otp"] == user_otp:
            if session.get("pwd_otp_time", 0) >= time.time() - 600:
                is_verified = True
    elif session.get("pwd_verify_success"):
        is_verified = True

    if not is_verified:
        return jsonify({"success": False, "message": "Verification failed or timed out"})

    db_user = get_user_by_email(email)
    if db_user and check_password_hash(db_user["password"], new_password):
        return jsonify({"success": False, "message": "New password cannot be the same as your old password"})

    if update_user_password(email, generate_password_hash(new_password)):
        session.pop("pwd_change_otp", None)
        session.pop("pwd_verify_success", None)
        
        update_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
        
        # Update session to reflect changes in UI without relogin
        session["user"]["last_password_update"] = update_time
        session.modified = True
        
        send_password_update_email(email, session["user"]["username"], update_time)
        return jsonify({"success": True, "message": "Password changed successfully"})

    return jsonify({"success": False, "message": "Database error"})


@auth_bp.route("/api/settings/toggle-2fa-otp", methods=["POST"])
def toggle_2fa_otp():
    """
    Send OTP for enabling/disabling 2FA.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    email = session["user"]["email"]
    now = time.time()
    
    if "two_fa_otp" in session and session.get("two_fa_otp_time", 0) > now - 60:
        otp = session["two_fa_otp"]
    else:
        otp = "".join(random.choices(string.digits, k=6))
        session.update({"two_fa_otp": otp, "two_fa_otp_time": now})

    if send_2fa_otp_email(email, otp, "disable"):
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Failed to send OTP"})


@auth_bp.route("/api/settings/verify-2fa-otp", methods=["POST"])
def verify_2fa_otp():
    """
    Verify OTP for 2FA status change.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    user_otp = request.json.get("otp")
    if "two_fa_otp" in session and session["two_fa_otp"] == user_otp:
        if session.get("two_fa_otp_time", 0) < time.time() - 600:
            return jsonify({"success": False, "message": "OTP has expired"})
        session["two_fa_verify_success"] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid OTP"})


@auth_bp.route("/api/settings/toggle-2fa-final", methods=["POST"])
def toggle_2fa_final():
    """
    Finalize 2FA status update.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.json
    target_status = data.get("status")
    password = data.get("password")
    email = session["user"]["email"]

    db_user = get_user_by_email(email)
    if not db_user or not check_password_hash(db_user["password"], password):
        return jsonify({"success": False, "message": "Incorrect password"})

    if target_status is False and not session.get("two_fa_verify_success"):
        return jsonify({"success": False, "message": "Verification incomplete"})

    if update_user_2fa_status(email, target_status):
        session["user"]["is_2fa_enabled"] = target_status
        session.pop("two_fa_verify_success", None)
        session.pop("two_fa_otp", None)
        session.modified = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Database error"})


@auth_bp.route("/api/settings/delete-account-request", methods=["POST"])
def delete_account_request():
    """
    Initiate account deletion process by sending a verification code.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    email = session["user"]["email"]
    now = time.time()
    
    if "delete_otp" in session and session.get("delete_otp_time", 0) > now - 60:
        otp = session["delete_otp"]
    else:
        otp = "".join(random.choices(string.digits, k=6))
        session.update({"delete_otp": otp, "delete_otp_time": now})

    if send_email_otp(email, otp):
        return jsonify({"success": True, "message": "Verification code sent"})
    return jsonify({"success": False, "message": "Failed to send code"})


@auth_bp.route("/api/settings/verify-otp-only-del", methods=["POST"])
def verify_otp_only_del():
    """
    Verify account deletion OTP.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    user_otp = request.json.get("otp")
    if "delete_otp" in session and session["delete_otp"] == user_otp:
        if session.get("delete_otp_time", 0) < time.time() - 600:
            return jsonify({"success": False, "message": "OTP has expired"})
        session["del_verify_success"] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid OTP"})


@auth_bp.route("/api/settings/delete-account-verify", methods=["POST"])
def delete_account_verify():
    """
    Permanently delete the user account after final verification.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.json
    password = data.get("password")
    
    if not session.get("del_verify_success"):
        return jsonify({"success": False, "message": "OTP verification incomplete"})

    db_user = get_user_by_email(session["user"]["email"])
    if not db_user or not check_password_hash(db_user["password"], password):
        return jsonify({"success": False, "message": "Incorrect password"})

    email, username = session["user"]["email"], session["user"]["username"]

    if delete_user_by_email(email):
        send_deletion_email(email, username)
        session.clear()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Database error"})

