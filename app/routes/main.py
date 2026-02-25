"""
PropertyPlus - Main Route Blueprint
===================================
This module handles core application routes including dashboards, 
property management (CRUD), search, and proxy services for geographic data.
"""

import os
import re
import time
import datetime
import smtplib
import requests
from email.mime.text import MIMEText
from flask import (
    Blueprint,
    render_template,
    session,
    redirect,
    url_for,
    current_app,
    request,
    jsonify,
    make_response,
)
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash

# Model Imports
from app.models import (
    create_property,
    get_properties_by_seller,
    get_all_properties,
    get_property_details,
    toggle_save_property,
    is_property_saved,
    create_property_lead,
    get_saved_properties,
    get_leads_by_seller,
    update_property,
    get_property_by_id,
    get_user_by_email,
    delete_property_by_id,
    get_search_suggestions,
    get_users_who_saved_property,
    get_unread_leads_count,
    get_max_property_price,
    mark_leads_as_read,
    delete_leads_by_seller,
    is_interested,
    get_most_interested_property_info
)

main_bp = Blueprint("main", __name__)


# ==============================================================================
# CORE NAVIGATION ROUTES
# ==============================================================================

@main_bp.route("/")
def home():
    """
    Render the landing page with feature property carousel.
    """
    static_img_path = os.path.join(current_app.static_folder, "img")
    carousel_slides = []
    target_images = ["image1.jpg", "image2.jpg", "image3.jpg", "image4.jpg", "image5.jpg"]

    try:
        if os.path.exists(static_img_path):
            # Attempt to use target images
            for idx, filename in enumerate(target_images):
                if os.path.exists(os.path.join(static_img_path, filename)):
                    carousel_slides.append({
                        "id": idx + 1,
                        "title": f"Premium Collection {idx + 1}",
                        "location": "Premium Location, Gujarat",
                        "image": f"img/{filename}",
                    })

            # Fallback if target images are missing
            if len(carousel_slides) < 5:
                files = [f for f in os.listdir(static_img_path) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
                for idx, filename in enumerate(files[:5]):
                    if not any(s['image'].endswith(filename) for s in carousel_slides):
                        carousel_slides.append({
                            "id": idx + 10,
                            "title": f"Featured Property {idx + 1}",
                            "location": "Gujarat, India",
                            "image": f"img/{filename}",
                        })
    except Exception as e:
        current_app.logger.error(f"Error loading home images: {e}")

    return render_template("landing.html", properties=carousel_slides)


@main_bp.route("/dashboard/buyer")
def buyer_dashboard():
    """
    Render the Buyer Dashboard with search and saved properties.
    """
    if "user" not in session or session["user"]["role"] != "Buyer":
        return redirect(url_for("auth.login"))
    
    user_id = session["user"]["id"]
    
    # Extract Search Filters
    filters = {
        "q": request.args.get("q"),
        "city": request.args.get("city"),
        "state": request.args.get("state"),
        "listing_type": request.args.get("type"),
        "min_price": request.args.get("min_price"),
        "max_price": request.args.get("max_price"),
        "category": request.args.get("category"),
        "property_type": request.args.get("property_type"),
    }
    
    properties = get_all_properties(user_id, filters=filters)
    saved_properties = get_saved_properties(user_id)
    max_db_price = get_max_property_price()
    most_interested = get_most_interested_property_info()
    
    # Get location data for profile edit
    from app.routes.auth import get_location_data
    loc_data = get_location_data()
    states = sorted(list(loc_data.keys()))

    return render_template(
        "dashboard/buyer_dashboard.html",
        properties=properties,
        saved_properties=saved_properties,
        states=states,
        max_db_price=max_db_price,
        location_data=loc_data,
        most_interested=most_interested
    )


@main_bp.route("/dashboard/seller")
def seller_dashboard():
    """
    Render the Seller Dashboard with property management and leads.
    """
    if "user" not in session or session["user"]["role"] != "Seller":
        return redirect(url_for("auth.login"))
    
    user_id = session["user"]["id"]
    
    # Extract Search Filters
    filters = {
        "q": request.args.get("q"),
        "city": request.args.get("city"),
        "state": request.args.get("state"),
        "listing_type": request.args.get("type"),
        "min_price": request.args.get("min_price"),
        "max_price": request.args.get("max_price"),
        "category": request.args.get("category"),
        "property_type": request.args.get("property_type"),
    }
    
    properties = get_properties_by_seller(user_id, filters=filters)
    raw_leads = get_leads_by_seller(user_id)
    
    # Group leads by (buyer_id, property_id) to show latest only
    grouped_leads = {}
    for lead in raw_leads:
        key = f"{lead['buyer_id']}_{lead['property_id']}"
        if key not in grouped_leads:
            grouped_leads[key] = lead
            grouped_leads[key]['history'] = []
        else:
            # raw_leads are sorted by created_at DESC, so the first one is the latest
            grouped_leads[key]['history'].append({
                'id': lead['id'],
                'created_at': lead['created_at'],
                'status': lead['status']
            })
    
    leads = list(grouped_leads.values())
    unread_count = get_unread_leads_count(user_id)
    max_db_price = get_max_property_price()
    most_interested = get_most_interested_property_info()
    
    # Get location data for profile edit
    from app.routes.auth import get_location_data
    loc_data = get_location_data()
    states = sorted(list(loc_data.keys()))

    return render_template(
        "dashboard/seller_dashboard.html", 
        properties=properties, 
        leads=leads,
        unread_count=unread_count,
        states=states,
        max_db_price=max_db_price,
        location_data=loc_data,
        most_interested=most_interested
    )


@main_bp.route("/api/search-suggestions")
def search_suggestions():
    """
    Fetch search suggestions based on partial user input.
    """
    term = request.args.get("q", "")
    if len(term) < 2:
        return jsonify([])
    return jsonify(get_search_suggestions(term))



# ==============================================================================
# PROPERTY MANAGEMENT & UTILITY APIS
# ==============================================================================

@main_bp.route("/property/add", methods=["POST"])
def add_property():
    """
    Handle new property listing submission.
    """
    if "user" not in session or session["user"]["role"] != "Seller":
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        upload_folder = os.path.join(current_app.static_folder, "uploads", "properties")
        os.makedirs(upload_folder, exist_ok=True)

        # Handle File Uploads
        image_paths = []
        for file in request.files.getlist("images"):
            if file and file.filename:
                filename = secure_filename(f"{timestamp}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                image_paths.append(f"uploads/properties/{filename}")

        def save_file(field_name, prefix):
            file = request.files.get(field_name)
            if file and file.filename:
                filename = secure_filename(f"{timestamp}_{prefix}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                return f"uploads/properties/{filename}"
            return None

        video_path = save_file("video", "VID")
        fp_path = save_file("floor_plan", "FP")

        def get_val(key, type_cast=str, default=None):
            val = request.form.get(key)
            if val is None or val == "": return default
            try: return type_cast(val)
            except: return default

        is_plot = request.form.get("property_type") == "Plot"
        data = {
            "seller_id": session["user"]["id"],
            "title": request.form.get("title"),
            "property_type": request.form.get("property_type"),
            "listing_type": request.form.get("listing_type"),
            "category": request.form.get("category"),
            "house_no": request.form.get("house_no"),
            "area": request.form.get("area"),
            "address1": request.form.get("address1"),
            "city": request.form.get("city"),
            "state": request.form.get("state"),
            "pincode": request.form.get("pincode"),
            "landmark": request.form.get("landmark"),
            "latitude": get_val("latitude", float),
            "longitude": get_val("longitude", float),
            "built_up_area": get_val("built_up_area", float),
            "carpet_area": None if is_plot else get_val("carpet_area", float),
            "floor_number": None if is_plot else get_val("floor_number", int),
            "total_floors": None if is_plot else get_val("total_floors", int),
            "furnishing_status": None if is_plot else request.form.get("furnishing_status"),
            "bedrooms": None if is_plot else get_val("bedrooms", int),
            "bathrooms": None if is_plot else get_val("bathrooms", int),
            "balcony": False if is_plot else (request.form.get("balcony") == "true"),
            "expected_price": get_val("expected_price", float),
            "rent_amount": get_val("rent_amount", float),
            "maintenance_charges": get_val("maintenance_charges", float),
            "is_negotiable": request.form.get("is_negotiable") == "on",
            "token_amount": get_val("token_amount", float),
            "security_deposit": get_val("security_deposit", float),
            "ownership_type": request.form.get("ownership_type"),
            "images": image_paths,
            "video_path": video_path,
            "floor_plan": fp_path,
            "description": request.form.get("description"),
            "highlights": request.form.get("highlights"),
            "seller_name": request.form.get("seller_name"),
            "seller_mobile": request.form.get("seller_mobile"),
            "seller_role": request.form.get("seller_role"),
        }

        prop_id = create_property(data)
        if prop_id:
            return jsonify({"success": True, "property_id": prop_id})
        return jsonify({"success": False, "message": "Database error occurred"})

    except Exception as e:
        current_app.logger.error(f"Error adding property: {e}")
        return jsonify({"success": False, "message": str(e)})


@main_bp.route("/postal/postoffice/<string:term>")
def postal_postoffice(term):
    """
    Proxy to Post Office API to avoid CORS issues.
    """
    try:
        resp = requests.get(f"https://api.postalpincode.in/postoffice/{term}", timeout=6)
        return jsonify(resp.json())
    except Exception as e:
        current_app.logger.error(f"Postal proxy error: {e}")
        return jsonify({"error": "postal proxy error"}), 500


@main_bp.route("/postal/pincode/<string:pin>")
def postal_pincode(pin):
    """
    Proxy to Pincode API with validation.
    """
    if not re.fullmatch(r"\d{3,6}", pin):
        return jsonify({"error": "invalid pincode"}), 400
    try:
        resp = requests.get(f"https://api.postalpincode.in/pincode/{pin}", timeout=6)
        return jsonify(resp.json())
    except Exception as e:
        current_app.logger.error(f"Postal proxy error: {e}")
        return jsonify({"error": "postal proxy error"}), 500


@main_bp.route("/api/property/<int:prop_id>")
def get_property_api(prop_id):
    """
    Fetch property + seller details and check interaction status.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Login required"}), 401

    prop = get_property_details(prop_id)
    if not prop:
        return jsonify({"success": False, "message": "Property not found"}), 404

    prop["is_saved"] = is_property_saved(session["user"]["id"], prop_id)
    prop["is_interested"] = is_interested(session["user"]["id"], prop_id)

    return jsonify({"success": True, "property": prop})


@main_bp.route("/api/property/save", methods=["POST"])
def save_property_api():
    """
    Toggle property heart status for a buyer.
    """
    if "user" not in session or session["user"]["role"] != "Buyer":
        return jsonify({"success": False, "message": "Buyer login required"}), 401

    prop_id = request.json.get("property_id")
    if not prop_id:
        return jsonify({"success": False, "message": "Property ID missing"}), 400

    success, is_saved = toggle_save_property(session["user"]["id"], prop_id)
    return jsonify({"success": success, "is_saved": is_saved})


@main_bp.route("/api/property/interest", methods=["POST"])
def property_interest_api():
    """
    Send interest request to a seller and log the lead.
    """
    if "user" not in session or session["user"]["role"] != "Buyer":
        return jsonify({"success": False, "message": "Buyer login required"}), 401

    data = request.json
    prop_id = data.get("property_id")
    prop = get_property_details(prop_id)

    if not prop:
        return jsonify({"success": False, "message": "Property not found"}), 404

    lead_data = {
        "property_id": prop_id,
        "buyer_id": session["user"]["id"],
        "seller_id": prop["seller_id"],
        "buyer_name": session["user"].get("full_name") or session["user"]["username"],
        "buyer_email": session["user"]["email"],
        "buyer_mobile": session["user"].get("contact_number"),
        "property_title": prop["title"],
    }

    if create_property_lead(lead_data):
        seller_name = prop.get("seller_full_name") or prop.get("seller_name") or "Seller"
        seller_email = prop.get("seller_email_main") or prop.get("seller_email")
        
        if seller_email:
            buyer_info = {
                "name": lead_data["buyer_name"],
                "email": lead_data["buyer_email"],
                "mobile": lead_data["buyer_mobile"],
                "location": f"{session['user'].get('city', '')}, {session['user'].get('state', '')}" if session['user'].get('city') else "Not provided"
            }
            send_interest_email(seller_email, seller_name, buyer_info, prop)
            
        return jsonify({"success": True, "message": "Request sent successfully!"})
    
    return jsonify({"success": False, "message": "Database error"})


# ==============================================================================
# NOTIFICATION & LEAD APIS
# ==============================================================================

@main_bp.route("/api/notifications/count")
def get_notification_count():
    """
    Fetch unread notification count for a seller.
    """
    if "user" not in session or session["user"]["role"] != "Seller":
        return jsonify({"success": False, "count": 0}), 401
    
    return jsonify({"success": True, "count": get_unread_leads_count(session["user"]["id"])})


@main_bp.route("/api/notifications/mark-read", methods=["POST"])
def mark_notifications_read():
    """
    Mark all notifications as read for a seller.
    """
    if "user" not in session or session["user"]["role"] != "Seller":
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    return jsonify({"success": mark_leads_as_read(session["user"]["id"])})


@main_bp.route("/api/notifications/clear", methods=["POST"])
def clear_notifications_api():
    """
    Permanently clear all notifications for a seller.
    """
    if "user" not in session or session["user"]["role"] != "Seller":
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    return jsonify({"success": delete_leads_by_seller(session["user"]["id"])})



# ==============================================================================
# EMAIL NOTIFICATION HELPERS
# ==============================================================================

def send_price_drop_email(buyer_email, buyer_name, property_data, old_price, new_price):
    """
    Send a professional price drop notification email.
    """
    try:
        savings = int(old_price - new_price)
        html_content = render_template(
            "emails/price_drop.html",
            buyer_name=buyer_name,
            property_title=property_data['title'],
            location=f"{property_data['area']}, {property_data['city']}",
            old_price=f"₹{old_price:,.0f}",
            new_price=f"₹{new_price:,.0f}",
            savings=f"₹{savings:,.0f}"
        )

        msg = MIMEText(html_content, "html")
        msg["Subject"] = f"🔥 Price Dropped! - {property_data['title']}"
        msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
        msg["To"] = buyer_email

        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], buyer_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Price Drop Mail Error: {e}")
        return False


def send_interest_email(seller_email, seller_name, buyer_info, property_data):
    """
    Send a buyer interest notification email to the seller.
    """
    try:
        price_val = property_data.get('expected_price') or property_data.get('rent_amount') or 0
        price_display = f"₹{price_val:,.0f}"
        if property_data.get('listing_type') != 'Sale':
            price_display += " / month"

        prop_config = f"{property_data.get('bedrooms', 'N/A')} BHK {property_data.get('property_type', 'Property')}"
        location = f"{property_data.get('house_no', '')}, {property_data.get('address1', '')}, {property_data.get('area', '')}, {property_data.get('city', '')}"
        
        html_content = render_template(
            "emails/interest.html",
            seller_name=seller_name,
            property_title=property_data.get('title'),
            price_display=price_display,
            property_config=prop_config,
            property_location=location,
            buyer_name=buyer_info['name'],
            buyer_email=buyer_info['email'],
            buyer_mobile=buyer_info['mobile'] or 'Not provided',
            buyer_location=buyer_info.get('location', 'Not provided')
        )

        msg = MIMEText(html_content, "html")
        msg["Subject"] = f"🏠 New Interest in: {property_data.get('title')}"
        msg["From"] = f"PropertyPlus <{current_app.config['MAIL_USERNAME']}>"
        msg["To"] = seller_email

        server = smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"])
        server.starttls()
        server.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        server.sendmail(current_app.config["MAIL_USERNAME"], seller_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Interest Mail Error: {e}")
        return False



@main_bp.route("/terms-and-conditions")
def terms_and_conditions():
    """
    Render the Terms and Conditions page.
    """
    return render_template("terms_and_conditions.html")


@main_bp.route("/api/property/update", methods=["POST"])
def update_property_api():
    """
    Handle property details update after verification.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        data = request.form.to_dict()
        property_id = data.get("property_id")
        password = data.get("password")

        if not property_id or not password:
            return jsonify({"success": False, "message": "Missing property ID or password"}), 400

        # Verify password
        user = get_user_by_email(session["user"]["email"])
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"success": False, "message": "Incorrect password"}), 401

        # Verify ownership
        prop = get_property_by_id(property_id)
        if not prop or prop["seller_id"] != session["user"]["id"]:
            return jsonify({"success": False, "message": "Forbidden"}), 403

        # Handle File Uploads
        upload_folder = os.path.join(current_app.static_folder, "uploads", "properties")
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        
        image_paths = prop.get("images", [])
        if isinstance(image_paths, str):
            image_paths = image_paths.strip("{}").split(",")

        # -------------------------------------------------------------
        # Handle delete requests for existing media (simple + safe)
        # -------------------------------------------------------------
        def safe_delete_static(rel_path: str):
            """
            Deletes a file under /static/uploads/properties only.
            Prevents path traversal and accidental deletions.
            """
            if not rel_path:
                return
            rel_path = rel_path.strip().lstrip("/")
            if not rel_path.startswith("uploads/properties/"):
                return
            abs_path = os.path.join(current_app.static_folder, rel_path)
            abs_path = os.path.normpath(abs_path)
            static_root = os.path.normpath(current_app.static_folder)
            if not abs_path.startswith(static_root):
                return
            if os.path.exists(abs_path):
                os.remove(abs_path)

        # -------------------------------------------------------------
        # Read delete flags from form (must be defined before use)
        # -------------------------------------------------------------
        delete_video = request.form.get("delete_video") == "1"
        delete_floor_plan = request.form.get("delete_floor_plan") == "1"

        # Delete selected images
        delete_images_raw = request.form.get("delete_images", "").strip()
        if delete_images_raw:
            delete_list = [p.strip() for p in delete_images_raw.split(",") if p.strip()]
            for p in delete_list:
                if p in image_paths:
                    image_paths.remove(p)
                    safe_delete_static(p)

        # Video delete flag
        delete_video = request.form.get("delete_video") == "1"
        if delete_video and prop.get("video_path"):
            safe_delete_static(prop.get("video_path"))

        # Floor plan delete flag
        delete_floor_plan = request.form.get("delete_floor_plan") == "1"
        if delete_floor_plan and prop.get("floor_plan"):
            safe_delete_static(prop.get("floor_plan"))

        for file in request.files.getlist("images"):
            if file and file.filename:
                filename = secure_filename(f"{timestamp}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                image_paths.append(f"uploads/properties/{filename}")

        def update_file(field_name, prefix, current_path):
            file = request.files.get(field_name)
            if file and file.filename:
                filename = secure_filename(f"{timestamp}_{prefix}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                return f"uploads/properties/{filename}"
            return current_path

        video_path = update_file("video", "EDIT_VID", prop.get("video_path"))
        fp_path = update_file("floor_plan", "EDIT_FP", prop.get("floor_plan"))

        # If user requested deletion and did not upload a replacement, clear DB value
        if delete_video and not request.files.get("video"):
            video_path = None
        if delete_floor_plan and not request.files.get("floor_plan"):
            fp_path = None

        def get_val(key, type_cast=str, default=None):
            val = request.form.get(key)
            if val is None or val == "": return default
            try: return type_cast(val)
            except: return default

        is_plot = request.form.get("property_type") == "Plot"
        update_data = {
            "title": request.form.get("title"),
            "property_type": request.form.get("property_type"),
            "listing_type": request.form.get("listing_type"),
            "category": request.form.get("category"),
            "house_no": request.form.get("house_no"),
            "area": request.form.get("area"),
            "address1": request.form.get("address1"),
            "city": request.form.get("city"),
            "state": request.form.get("state"),
            "pincode": request.form.get("pincode"),
            "landmark": request.form.get("landmark"),
            "latitude": get_val("latitude", float),
            "longitude": get_val("longitude", float),
            "built_up_area": get_val("built_up_area", float),
            "carpet_area": None if is_plot else get_val("carpet_area", float),
            "floor_number": None if is_plot else get_val("floor_number", int),
            "total_floors": None if is_plot else get_val("total_floors", int),
            "furnishing_status": None if is_plot else request.form.get("furnishing_status"),
            "bedrooms": None if is_plot else get_val("bedrooms", int),
            "bathrooms": None if is_plot else get_val("bathrooms", int),
            "balcony": False if is_plot else (request.form.get("balcony") == "true"),
            "expected_price": get_val("expected_price", float),
            "rent_amount": get_val("rent_amount", float),
            "maintenance_charges": get_val("maintenance_charges", float),
            "is_negotiable": request.form.get("is_negotiable") == "on",
            "token_amount": get_val("token_amount", float),
            "security_deposit": get_val("security_deposit", float),
            "ownership_type": request.form.get("ownership_type"),
            "images": image_paths,
            "video_path": video_path,
            "floor_plan": fp_path,
            "description": request.form.get("description"),
            "highlights": request.form.get("highlights"),
            "seller_name": request.form.get("seller_name"),
            "seller_mobile": request.form.get("seller_mobile"),
            "seller_role": request.form.get("seller_role"),
        }

        # Handle Price Drop Notification
        old_price = prop.get("expected_price") or prop.get("rent_amount") or 0
        new_price = update_data.get("expected_price") or update_data.get("rent_amount") or 0
        
        if 0 < new_price < old_price:
            # Get users who saved this property
            buyers = get_users_who_saved_property(property_id)
            for b_entry in buyers:
                send_price_drop_email(b_entry["email"], b_entry["username"], update_data, old_price, new_price)

        if update_property(property_id, update_data):
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "Database error"})

    except Exception as e:
        current_app.logger.error(f"Error updating property: {e}")
        return jsonify({"success": False, "message": str(e)})


@main_bp.route("/api/property/delete", methods=["POST"])
def delete_property_api():
    """
    Handle property deletion after verification.
    """
    if "user" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        data = request.json
        property_id = data.get("property_id")
        password = data.get("password")

        if not property_id or not password:
            return jsonify({"success": False, "message": "Missing arguments"}), 400

        # Verify password
        user = get_user_by_email(session["user"]["email"])
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"success": False, "message": "Incorrect password"}), 401

        # Verify ownership
        prop = get_property_by_id(property_id)
        if not prop or prop["seller_id"] != session["user"]["id"]:
            return jsonify({"success": False, "message": "Forbidden"}), 403

        if delete_property_by_id(property_id):
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "Database error"})

    except Exception as e:
        current_app.logger.error(f"Error deleting property: {e}")
        return jsonify({"success": False, "message": str(e)})


# ==============================================================================
# PDF GENERATION LOGIC
# ==============================================================================

def format_indian_price(num):
    """
    Format a number into Indian currency style (e.g., 1,23,45,678).
    """
    try:
        s = str(int(num))
        if len(s) <= 3: return s
        last_three = s[-3:]
        other_parts = s[:-3]
        res = ""
        while len(other_parts) > 2:
            res = "," + other_parts[-2:] + res
            other_parts = other_parts[:-2]
        if other_parts: res = other_parts + res
        return res + "," + last_three
    except: return str(num)



@main_bp.route("/property/download-pdf/<int:prop_id>")
def download_property_pdf(prop_id):
    """
    Generates a High-Precision Corporate PDF.
    - FIX: Robust PDF output generation (handles bytearray vs string).
    - FIX: Safely handles None/NULL values from database.
    - STYLED: Enhanced visual design with perfect alignment
    """

    # Access control: must be logged in to download
    if "user" not in session:
        return redirect(url_for("auth.login"))

    prop = get_property_details(prop_id)
    if not prop:
        return "Property not found", 404

    # --- ENHANCED BRAND PALETTE ---
    C_BRAND_RED   = (241, 48, 48)     # #F13030 - Primary Brand Color
    C_BRAND_DARK  = (34, 24, 28)      # #22181C - Deep Black
    C_BRAND_DEEP  = (90, 0, 1)        # #5A0001 - Rich Maroon
    
    # UI Elements - Enhanced
    C_BG_HEADER   = (34, 24, 28)      # Header Background
    C_BG_TABLE    = (248, 250, 252)   # Soft Blue-Grey for zebra rows
    C_BG_ACCENT   = (255, 242, 242)   # Subtle Pink highlight
    C_BG_CARD     = (250, 250, 250)   # Light card background
    
    # Text - Professional Typography
    C_TXT_HEAD    = (34, 24, 28)      # Primary Heading
    C_TXT_BODY    = (55, 65, 81)      # Body Text (Slate-700)
    C_TXT_MUTED   = (120, 120, 130)   # Subtle Grey
    C_WHITE       = (255, 255, 255)   # Pure White
    C_BORDER      = (225, 230, 235)   # Soft Border

    try:
        from fpdf import FPDF
        import datetime
        import traceback
        import re

        def format_inr(value):
            if value is None: return "0"
            try:
                s = str(int(value))
                i = len(s) - 3
                if i < 0: return s
                res = s[i:]
                while i > 0:
                    res = s[max(i-2, 0):i] + "," + res
                    i -= 2
                return res
            except:
                return str(value)

        class CorporateBrochure(FPDF):
            def draw_logo(self, x, y, size=15):
                """Renders vector 'Prism P' logo with enhanced styling"""
                s = size / 100.0 
                # Face 1 (Vibrant Red)
                self.set_fill_color(*C_BRAND_RED)
                self.polygon([
                    (x + 20*s, y + 10*s), (x + 55*s, y + 10*s),
                    (x + 55*s, y + 45*s), (x + 40*s, y + 45*s),
                    (x + 40*s, y + 90*s), (x + 20*s, y + 90*s)
                ], fill=True)
                # Face 2 (Deep Maroon)
                self.set_fill_color(*C_BRAND_DEEP)
                self.polygon([
                    (x + 55*s, y + 10*s), (x + 75*s, y + 30*s),
                    (x + 75*s, y + 65*s), (x + 55*s, y + 45*s)
                ], fill=True)
                # Plus Symbol (Crisp White)
                self.set_fill_color(*C_WHITE)
                self.rect(x + 65*s, y + 75*s, 26*s, 6*s, 'F')
                self.rect(x + 75*s, y + 65*s, 6*s, 26*s, 'F')

            def header(self):
                """Professional header with premium design"""
                # Header Background (23mm height for better proportion)
                self.set_fill_color(*C_BG_HEADER)
                self.rect(0, 0, 210, 23, 'F')
                
                # Logo (Slightly larger, better positioned)
                self.draw_logo(x=10, y=4.5, size=16) 
                
                # Brand Text Logo (Enhanced typography)
                self.set_y(7.8) 
                self.set_x(30)
                self.set_font("Arial", 'B', 19)
                self.set_text_color(*C_WHITE)
                self.cell(30, 8, "Property", 0, 0)
                self.set_text_color(*C_BRAND_RED)
                self.cell(19, 8, "Plus", 0, 0)
                
                # Right Side Meta (Refined positioning)
                self.set_xy(118, 9.5)
                self.set_font("Arial", 'B', 8.5)
                self.set_text_color(195, 195, 200)
                date_str = datetime.datetime.now().strftime('%d %b %Y')
                self.cell(82, 4, f"REF: #{prop_id}  |  {date_str}", 0, 0, 'R')
                self.ln(23)

            def footer(self):
                """Elegant footer with brand identity"""
                # Footer bar (Slightly taller for better balance)
                self.set_y(-11)
                self.set_fill_color(*C_BRAND_DEEP)
                self.rect(0, 286, 210, 11, 'F')
                
                self.set_y(-7.5)
                self.set_font("Arial", '', 7.5)
                self.set_text_color(*C_WHITE)
                self.cell(0, 3.5, "PropertyPlus Real Estate Solutions | www.propertyplus.com | Licensed Brokerage", 0, 0, 'C')

            def draw_section_title(self, title, x, y, width=190):
                """Premium section headers with sophisticated underline"""
                self.set_xy(x, y)
                self.set_font("Arial", 'B', 9.5)
                self.set_text_color(*C_BRAND_DEEP)
                # Letter-spaced title for elegance
                spaced_title = " ".join(list(title.upper()))
                self.cell(width, 5.5, spaced_title, 0, 1)
                
                # Dual-tone underline (Signature style)
                self.set_fill_color(*C_BRAND_RED)
                self.rect(x, y + 6.5, 14, 1, 'F')  # Bold accent line
                self.set_fill_color(*C_BORDER)
                self.rect(x + 14, y + 6.5, width - 14, 0.5, 'F')  # Subtle extension

        # --- INIT PDF ---
        pdf = CorporateBrochure()
        pdf.set_auto_page_break(auto=False)
        pdf.set_margins(10, 10, 10)
        pdf.add_page()
        
        # ==========================================
        # 1. HERO SECTION - Premium Layout
        # ==========================================
        hero_y = 32
        pdf.set_y(hero_y)
        
        # --- LEFT: Title & Location (Width: 128mm) ---
        pdf.set_font("Arial", 'B', 21)
        pdf.set_text_color(*C_TXT_HEAD)
        pdf.multi_cell(128, 7.5, prop['title'])
        
        # Spacing for visual breathing room
        pdf.ln(1.5)
        pdf.set_font("Arial", '', 10.5)
        pdf.set_text_color(*C_TXT_BODY)
        # FIX: Handle potential NoneType in address fields
        loc = f"{prop.get('area') or ''}, {prop.get('city') or ''}".upper()
        pdf.cell(128, 5.5, f"LOCATION: {loc}")

        # --- RIGHT: Premium Price Box (Width: 62mm) ---
        price_x = 138
        price_y = hero_y
        price_w = 62
        price_h = 24
        
        # Elegant card with subtle shadow effect
        pdf.set_fill_color(*C_BG_ACCENT) 
        pdf.set_draw_color(*C_BRAND_RED)
        pdf.set_line_width(0.6)
        pdf.rect(price_x, price_y, price_w, price_h, 'FD') 
        
        # Price Label (Refined)
        pdf.set_xy(price_x, price_y + 4.5)
        pdf.set_font("Arial", 'B', 8)
        pdf.set_text_color(*C_BRAND_DEEP)
        p_label = "MONTHLY RENT" if prop.get('listing_type') == "Rent" else "ASKING PRICE"
        pdf.cell(price_w, 4, p_label, 0, 1, 'C')
        
        # Price Value (Bold & Prominent)
        val = prop.get('rent_amount') if prop.get('listing_type') == "Rent" else prop.get('expected_price')
        pdf.set_xy(price_x, price_y + 10.5)
        pdf.set_font("Arial", 'B', 15.5)
        pdf.set_text_color(*C_BRAND_RED)
        pdf.cell(price_w, 7, f"Rs. {format_inr(val)}", 0, 1, 'C')

        # ==========================================
        # 2. MAIN CONTENT GRID - Balanced Design
        # ==========================================
        grid_start_y = 66
        
        # --- LEFT COLUMN: Enhanced Attribute Table (Width: 92mm) ---
        pdf.draw_section_title("PROPERTY DETAILS", 10, grid_start_y, width=92)
        
        table_y = grid_start_y + 11
        col_width_label = 37
        col_width_value = 55
        row_height = 7
        
        is_plot = prop.get('property_type') == "Plot"
        if is_plot:
            attributes = [
                ("Property ID", f"#{str(prop_id)}"),
                ("Type", str(prop.get('property_type') or '-')),
                ("Built-up Area", f"{prop.get('built_up_area') or '-'} sq.ft"),
                ("Ownership", str(prop.get('ownership_type') or '-')),
                ("Negotiable", "Yes" if prop.get('is_negotiable') else "No"),
            ]
        else:
            attributes = [
                ("Property ID", f"#{str(prop_id)}"),
                ("Type", str(prop.get('property_type') or '-')),
                ("Bedrooms", f"{prop.get('bedrooms') or '-'} BHK"),
                ("Bathrooms", str(prop.get('bathrooms') or '-')),
                ("Furnishing", str(prop.get('furnishing_status') or '-')),
                ("Built-up Area", f"{prop.get('built_up_area') or '-'} sq.ft"),
                ("Carpet Area", f"{prop.get('carpet_area') or '-'} sq.ft"),
                ("Floor", f"{prop.get('floor_number') or '-'} / {prop.get('total_floors') or '-'}"),
                ("Balconies", "Yes" if prop.get('balcony') else "No"),
                ("Parking", "Available" if prop.get('parking') else "No"),
                ("Negotiable", "Yes" if prop.get('is_negotiable') else "No"),
            ]
        
        pdf.set_y(table_y)
        
        for i, (label, val) in enumerate(attributes):
            current_y = pdf.get_y()
            
            # Premium zebra striping
            if i % 2 != 0:
                pdf.set_fill_color(*C_BG_TABLE)
                pdf.rect(10, current_y, 92, row_height, 'F')
            
            # Label (Bold & Subtle)
            pdf.set_xy(12, current_y)
            pdf.set_font("Arial", 'B', 9)
            pdf.set_text_color(*C_TXT_MUTED)
            pdf.cell(col_width_label, row_height, label, 0, 0, 'L')
            
            # Value (Clear & Prominent)
            pdf.set_xy(49, current_y)
            pdf.set_font("Arial", '', 9)
            pdf.set_text_color(*C_TXT_HEAD)
            pdf.cell(col_width_value, row_height, str(val), 0, 0, 'L')
            
            pdf.set_y(current_y + row_height)

        # --- RIGHT COLUMN: Rich Description (Width: 98mm) ---
        desc_x = 107
        pdf.draw_section_title("ABOUT THIS PROPERTY", desc_x, grid_start_y, width=93)
        
        pdf.set_xy(desc_x, grid_start_y + 11)
        pdf.set_font("Arial", '', 9.5)
        pdf.set_text_color(*C_TXT_BODY)
        
        # FIX: Ensure description is a string even if None/NULL in DB
        raw_desc = str(prop.get('description') or 'No description available.')
        clean_desc = re.sub(r'\s+', ' ', raw_desc).strip()
        
        # Limit for better layout
        if len(clean_desc) > 520:
            clean_desc = clean_desc[:517] + "..."
        
        pdf.multi_cell(93, 5.5, clean_desc)
        
        # --- LOCATION INFO (Enhanced card style) ---
        loc_y = pdf.get_y() + 7
        pdf.set_xy(desc_x, loc_y)
        
        # Section mini-header
        pdf.set_font("Arial", 'B', 9)
        pdf.set_text_color(*C_BRAND_DEEP)
        pdf.cell(93, 5, "COMPLETE ADDRESS", 0, 1)
        
        # Decorative underline
        pdf.set_draw_color(*C_BORDER)
        pdf.line(desc_x, pdf.get_y(), desc_x + 38, pdf.get_y())
        
        pdf.ln(1.5)
        pdf.set_x(desc_x)
        pdf.set_font("Arial", '', 9.5)
        pdf.set_text_color(*C_TXT_BODY)
        
        # FIX: Safe concatenation avoiding None
        h_no = prop.get('house_no') or ''
        add1 = prop.get('address1') or ''
        area = prop.get('area') or ''
        city = prop.get('city') or ''
        state = prop.get('state') or ''
        pin = prop.get('pincode') or ''
        
        full_addr = f"{h_no}, {add1}\n{area}, {city}\n{state} - {pin}"
        pdf.multi_cell(93, 5, full_addr)

        # ==========================================
        # 3. PREMIUM AGENT CONTACT CARD
        # ==========================================
        card_y = 215
        
        # Elegant card background with subtle border
        pdf.set_fill_color(*C_BG_CARD)
        pdf.set_draw_color(*C_BORDER) 
        pdf.set_line_width(0.3)
        pdf.rect(10, card_y, 190, 42, 'FD')
        
        # Brand accent bar (top edge)
        pdf.set_fill_color(*C_BRAND_RED)
        pdf.rect(10, card_y, 190, 1.8, 'F')
        
        # Section Label
        pdf.set_xy(17, card_y + 6.5)
        pdf.set_font("Arial", 'B', 8.5)
        pdf.set_text_color(*C_BRAND_RED)
        pdf.cell(50, 4.5, "LISTED BY AGENT", 0, 1)
        
        # Agent Name (Prominent)
        pdf.set_xy(17, card_y + 13)
        pdf.set_font("Arial", 'B', 13.5)
        pdf.set_text_color(*C_TXT_HEAD)
        pdf.cell(85, 6.5, str(prop.get('seller_full_name') or 'Verified Agent'), 0, 1)
        
        # Agent Role (Subtle)
        pdf.set_xy(17, card_y + 20.5)
        pdf.set_font("Arial", '', 9.5)
        pdf.set_text_color(*C_TXT_MUTED)
        pdf.cell(85, 5, str(prop.get('seller_role') or 'Property Consultant'), 0, 0)
        
        # Elegant vertical divider
        pdf.set_draw_color(*C_BORDER)
        pdf.set_line_width(0.4)
        pdf.line(106, card_y + 10, 106, card_y + 35)
        
        # Contact Information (Right side)
        pdf.set_xy(114, card_y + 13)
        
        # Phone
        pdf.set_font("Arial", 'B', 9.5)
        pdf.set_text_color(*C_BRAND_DARK)
        pdf.cell(22, 7, "Mobile:", 0, 0)
        pdf.set_font("Arial", '', 10.5)
        pdf.set_text_color(*C_TXT_HEAD)
        pdf.cell(55, 7, str(prop.get('seller_contact_main') or '--'), 0, 1)
        
        # Email
        pdf.set_xy(114, card_y + 21.5)
        pdf.set_font("Arial", 'B', 9.5)
        pdf.set_text_color(*C_BRAND_DARK)
        pdf.cell(22, 7, "Email:", 0, 0)
        pdf.set_font("Arial", '', 9.5)
        pdf.set_text_color(*C_TXT_HEAD)
        pdf.cell(55, 7, str(prop.get('seller_email_main') or '--'), 0, 1)

        # ==========================================
        # 4. PROFESSIONAL DISCLAIMER
        # ==========================================
        disclaimer_y = 262
        pdf.set_xy(10, disclaimer_y)
        pdf.set_font("Arial", '', 7)
        pdf.set_text_color(135, 135, 145)
        disclaimer = "This brochure is for informational purposes only. All information is subject to change without notice. PropertyPlus is not responsible for any errors or omissions. Please verify all details independently before making any decisions."
        pdf.multi_cell(190, 3.2, disclaimer, 0, 'C')

        # -----------------------------------------------------------
        # FIX: ROBUST OUTPUT GENERATION
        # This handles FPDF 1.7 (String) and FPDF 2.x (Bytearray) safely
        # -----------------------------------------------------------
        try:
            # Try to get string (Old FPDF behavior)
            pdf_content = pdf.output(dest='S')
        except (TypeError, ValueError):
            # Fallback to bytes (New FPDF2 behavior)
            pdf_content = pdf.output()

        # Safely convert to bytes
        if isinstance(pdf_content, str):
            # Encode if it's a string (latin-1 is default for fpdf)
            final_data = pdf_content.encode('latin-1')
        elif isinstance(pdf_content, (bytes, bytearray)):
            # Already bytes
            final_data = bytes(pdf_content)
        else:
            return "Error: Failed to generate PDF bytes", 500

        # Create Response
        response = make_response(final_data)
        response.headers.set('Content-Type', 'application/pdf')
        
        safe_title = re.sub(r'[^\w\s-]', '', prop['title']).strip().replace(' ', '_')
        response.headers.set('Content-Disposition', 'attachment', filename=f"Brochure_{safe_title}.pdf")
        return response

    except Exception as e:
        print(f"Error generating PDF: {traceback.format_exc()}")
        return f"Error: {str(e)}", 500