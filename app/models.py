"""
PropertyPlus Database Models
---------------------------
This module handles all database operations for the PropertyPlus application,
including user management, property listings, leads, and saved properties.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import current_app
from datetime import datetime


def get_db_connection():
    """
    Establish a connection to the PostgreSQL database.
    
    Returns:
        psycopg2.extensions.connection: The database connection object.
    """
    return psycopg2.connect(
        host=current_app.config["DB_HOST"],
        database=current_app.config["DB_NAME"],
        user=current_app.config["DB_USER"],
        password=current_app.config["DB_PASS"],
    )


# ==============================================================================
# USER MANAGEMENT FUNCTIONS
# ==============================================================================

def create_user(data, hashed_password):
    """
    Register a new user in the database.

    Args:
        data (dict): User registration data.
        hashed_password (str): The pre-hashed user password.

    Returns:
        bool: True if registration was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        created_at = datetime.now()
        cur.execute(
            """
            INSERT INTO users 
            (username, email, password, contact_number, full_name, gender, role, 
             profile_image, created_at, state, city, dob, is_2fa_enabled)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """,
            (
                data["username"],
                data["email"],
                hashed_password,
                data["contact_number"],
                data["full_name"],
                data["gender"],
                data["role"],
                data.get("profile_image"),
                created_at,
                data.get("state"),
                data.get("city"),
                data.get("dob"),
            ),
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in create_user: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_user_by_username(username):
    """
    Retrieve user details by their username.

    Args:
        username (str): The username to search for.

    Returns:
        dict: User record if found, None otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def check_email_exists(email):
    """
    Check if an email address is already registered.

    Args:
        email (str): The email address to check.

    Returns:
        bool: True if the email exists, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def get_user_by_email(email):
    """
    Retrieve user details by their email address.

    Args:
        email (str): The email address to search for.

    Returns:
        dict: User record if found, None otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        return cur.fetchone()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_user_by_email: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def update_user_password(email, hashed_password):
    """
    Update a user's password and record the update timestamp.

    Args:
        email (str): User's email address.
        hashed_password (str): New hashed password.

    Returns:
        bool: True if update was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        timestamp = datetime.now()
        cur.execute(
            "UPDATE users SET password = %s, last_password_update = %s WHERE email = %s",
            (hashed_password, timestamp, email)
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in update_user_password: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_user_profile_image(email, image_path):
    """
    Update a user's profile image path.

    Args:
        email (str): User's email address.
        image_path (str): File path to the new profile image.

    Returns:
        bool: True if update was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET profile_image = %s WHERE email = %s",
            (image_path, email)
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in update_user_profile_image: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_user_profile_details(email, contact_number, city, state):
    """
    Update a user's contact information and location.

    Args:
        email (str): User's email address.
        contact_number (str): New contact number.
        city (str): New city.
        state (str): New state.

    Returns:
        bool: True if update was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET contact_number = %s, city = %s, state = %s WHERE email = %s",
            (contact_number, city, state, email)
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in update_user_profile_details: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_user_2fa_status(email, status):
    """
    Enable or disable 2FA for a user.

    Args:
        email (str): User's email address.
        status (bool): 2FA status to set.

    Returns:
        bool: True if update was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET is_2fa_enabled = %s WHERE email = %s",
            (status, email)
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in update_user_2fa_status: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()
    

def delete_user_by_email(email):
    """
    Permanently delete a user account and all associated data.

    Args:
        email (str): User's email address.

    Returns:
        bool: True if deletion was successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_row = cur.fetchone()
        if not user_row:
            return False
        user_id = user_row[0]

        # Cascading deletion of related records
        cur.execute("DELETE FROM property_leads WHERE buyer_id = %s OR seller_id = %s", (user_id, user_id))
        cur.execute("DELETE FROM saved_properties WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM properties WHERE seller_id = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in delete_user_by_email: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()



# ==============================================================================
# PROPERTY MANAGEMENT FUNCTIONS
# ==============================================================================

def create_property(data):
    """
    Insert a new property listing into the database.

    Args:
        data (dict): Property details including seller information and features.

    Returns:
        int: The ID of the newly created property if successful, None otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO properties (
                seller_id, title, property_type, listing_type, category,
                house_no, area, address1, city, state, pincode, landmark, 
                latitude, longitude, built_up_area, carpet_area, floor_number, 
                total_floors, furnishing_status, bedrooms, bathrooms, balcony,
                expected_price, rent_amount, maintenance_charges, is_negotiable, 
                token_amount, security_deposit, ownership_type, images, 
                video_path, floor_plan, description, highlights, seller_name, 
                seller_mobile, seller_role, created_at, status
            )
            VALUES (
                %(seller_id)s, %(title)s, %(property_type)s, %(listing_type)s, %(category)s,
                %(house_no)s, %(area)s, %(address1)s, %(city)s, %(state)s, %(pincode)s, %(landmark)s, %(latitude)s, %(longitude)s,
                %(built_up_area)s, %(carpet_area)s, %(floor_number)s, %(total_floors)s, %(furnishing_status)s,
                %(bedrooms)s, %(bathrooms)s, %(balcony)s,
                %(expected_price)s, %(rent_amount)s, %(maintenance_charges)s, %(is_negotiable)s, 
                %(token_amount)s, %(security_deposit)s, %(ownership_type)s,
                %(images)s, %(video_path)s, %(floor_plan)s,
                %(description)s, %(highlights)s, %(seller_name)s, %(seller_mobile)s, %(seller_role)s,
                NOW(), 'Active'
            )
            RETURNING id
            """,
            data
        )
        property_id = cur.fetchone()[0]
        conn.commit()
        return property_id
    except Exception as e:
        current_app.logger.error(f"Database Error in create_property: {e}")
        conn.rollback()
        return None
    finally:
        cur.close()
        conn.close()


def get_properties_by_seller(seller_id, filters=None):
    """
    Retrieve property listings for a specific seller with optional filtering.

    Args:
        seller_id (int): The ID of the seller.
        filters (dict, optional): Search and category filters.

    Returns:
        list: A list of property records (dicts).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        where_clauses = ["seller_id = %s"]
        params = [seller_id]

        if filters:
            if filters.get("q"):
                search_term = f"%{filters['q']}%"
                where_clauses.append("""
                    (title ILIKE %s OR description ILIKE %s OR city ILIKE %s OR 
                     state ILIKE %s OR area ILIKE %s OR landmark ILIKE %s OR 
                     pincode ILIKE %s OR address1 ILIKE %s OR property_type ILIKE %s OR 
                     listing_type ILIKE %s OR category ILIKE %s OR furnishing_status ILIKE %s OR 
                     seller_name ILIKE %s OR highlights ILIKE %s OR house_no ILIKE %s)
                """)
                params.extend([search_term] * 15)
            
            if filters.get("city"):
                where_clauses.append("city ILIKE %s")
                params.append(f"%{filters['city']}%")
            
            if filters.get("state"):
                where_clauses.append("state ILIKE %s")
                params.append(f"%{filters['state']}%")
            
            for field in ["listing_type", "category", "property_type"]:
                if filters.get(field) and filters[field] != "All":
                    where_clauses.append(f"{field} = %s")
                    params.append(filters[field])

            if filters.get("min_price"):
                where_clauses.append("(expected_price >= %s OR rent_amount >= %s)")
                params.extend([filters["min_price"], filters["min_price"]])
            
            if filters.get("max_price"):
                where_clauses.append("(expected_price <= %s OR rent_amount <= %s)")
                params.extend([filters["max_price"], filters["max_price"]])

        where_sql = " AND ".join(where_clauses)
        query = f"SELECT * FROM properties WHERE {where_sql} ORDER BY created_at DESC"
        
        cur.execute(query, params)
        return cur.fetchall()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_properties_by_seller: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_max_property_price():
    """
    Get the highest price among all active properties.

    Returns:
        float: The maximum price found, or a default value.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT MAX(GREATEST(COALESCE(expected_price, 0), COALESCE(rent_amount, 0))) "
            "FROM properties WHERE status = 'Active'"
        )
        max_price = cur.fetchone()[0]
        return max_price or 10000000.0
    except Exception as e:
        current_app.logger.error(f"Database Error in get_max_property_price: {e}")
        return 10000000.0
    finally:
        cur.close()
        conn.close()


def get_all_properties(user_id=None, filters=None):
    """
    Retrieve all active properties for buyers, with optional filtering and 
    user-specific saved status.

    Args:
        user_id (int, optional): The ID of the current user to check saved status.
        filters (dict, optional): Search and category filters.

    Returns:
        list: A list of active property records (dicts).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        where_clauses = ["p.status = 'Active'"]
        params = []
        
        if user_id:
            params.append(user_id)

        if filters:
            if filters.get("q"):
                search_term = f"%{filters['q']}%"
                where_clauses.append("""
                    (p.title ILIKE %s OR p.description ILIKE %s OR p.city ILIKE %s OR 
                     p.state ILIKE %s OR p.area ILIKE %s OR p.landmark ILIKE %s OR 
                     p.pincode ILIKE %s OR p.address1 ILIKE %s OR p.property_type ILIKE %s OR 
                     p.listing_type ILIKE %s OR p.category ILIKE %s OR p.furnishing_status ILIKE %s OR 
                     p.seller_name ILIKE %s OR p.highlights ILIKE %s OR p.house_no ILIKE %s)
                """)
                params.extend([search_term] * 15)
            
            if filters.get("city"):
                where_clauses.append("p.city ILIKE %s")
                params.append(f"%{filters['city']}%")
            
            if filters.get("state"):
                where_clauses.append("p.state ILIKE %s")
                params.append(f"%{filters['state']}%")
            
            for field in ["listing_type", "category", "property_type"]:
                if filters.get(field) and filters[field] != "All":
                    where_clauses.append(f"p.{field} = %s")
                    params.append(filters[field])

            if filters.get("min_price"):
                where_clauses.append("(p.expected_price >= %s OR p.rent_amount >= %s)")
                params.extend([filters["min_price"], filters["min_price"]])
            
            if filters.get("max_price"):
                where_clauses.append("(p.expected_price <= %s OR p.rent_amount <= %s)")
                params.extend([filters["max_price"], filters["max_price"]])

        where_sql = " AND ".join(where_clauses)
        
        if user_id:
            query = f"""
                SELECT p.*, 
                       CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
                FROM properties p
                LEFT JOIN saved_properties sp ON p.id = sp.property_id AND sp.user_id = %s
                WHERE {where_sql}
                ORDER BY p.created_at DESC
            """
        else:
            query = f"""
                SELECT p.*, FALSE as is_saved 
                FROM properties p
                WHERE {where_sql}
                ORDER BY p.created_at DESC
            """
            
        cur.execute(query, params)
        return cur.fetchall()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_all_properties: {e}")
        return []
    finally:
        cur.close()
        conn.close()



# ==============================================================================
# SAVED PROPERTIES & LEADS FUNCTIONS
# ==============================================================================

def get_property_details(property_id):
    """
    Fetch comprehensive details for a single property, including seller info.

    Args:
        property_id (int): The unique ID of the property.

    Returns:
        dict: Detailed property record if found, None otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT p.*, 
                   u.full_name as seller_full_name, 
                   u.profile_image as seller_profile_image,
                   u.email as seller_email_main,
                   u.contact_number as seller_contact_main
            FROM properties p
            JOIN users u ON p.seller_id = u.id
            WHERE p.id = %s
            """,
            (property_id,)
        )
        return cur.fetchone()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_property_details: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def toggle_save_property(user_id, property_id):
    """
    Toggle the saved (heart) status of a property for a user.

    Args:
        user_id (int): The ID of the user.
        property_id (int): The ID of the property.

    Returns:
        tuple: (bool success, bool is_saved_now)
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id FROM saved_properties WHERE user_id = %s AND property_id = %s",
            (user_id, property_id)
        )
        existing = cur.fetchone()
        
        if existing:
            cur.execute("DELETE FROM saved_properties WHERE id = %s", (existing[0],))
            is_saved = False
        else:
            cur.execute(
                "INSERT INTO saved_properties (user_id, property_id) VALUES (%s, %s)",
                (user_id, property_id)
            )
            is_saved = True
            
        conn.commit()
        return True, is_saved
    except Exception as e:
        current_app.logger.error(f"Database Error in toggle_save_property: {e}")
        conn.rollback()
        return False, False
    finally:
        cur.close()
        conn.close()


def is_property_saved(user_id, property_id):
    """
    Check if a specific property is saved by a user.

    Args:
        user_id (int): The user ID.
        property_id (int): The property ID.

    Returns:
        bool: True if saved, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM saved_properties WHERE user_id = %s AND property_id = %s",
            (user_id, property_id)
        )
        return cur.fetchone() is not None
    except Exception as e:
        current_app.logger.error(f"Database Error in is_property_saved: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def is_interested(user_id, property_id):
    """
    Check if a buyer has already expressed interest in a property.

    Args:
        user_id (int): The buyer's user ID.
        property_id (int): The property ID.

    Returns:
        bool: True if already interested, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM property_leads WHERE buyer_id = %s AND property_id = %s",
            (user_id, property_id)
        )
        return cur.fetchone() is not None
    except Exception as e:
        current_app.logger.error(f"Database Error in is_interested: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def create_property_lead(data):
    """
    Create a new lead (interest request) for a property.

    Args:
        data (dict): Lead details including buyer and seller IDs.

    Returns:
        bool: True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO property_leads 
            (property_id, buyer_id, seller_id, buyer_name, buyer_email, 
             buyer_mobile, property_title)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data["property_id"],
                data["buyer_id"],
                data["seller_id"],
                data["buyer_name"],
                data["buyer_email"],
                data["buyer_mobile"],
                data["property_title"]
            )
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in create_property_lead: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_saved_properties(user_id):
    """
    Retrieve all properties saved by a specific user.

    Args:
        user_id (int): The user ID.

    Returns:
        list: A list of saved property records (dicts).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT p.* FROM properties p
            JOIN saved_properties sp ON p.id = sp.property_id
            WHERE sp.user_id = %s
            ORDER BY sp.created_at DESC
            """,
            (user_id,)
        )
        return cur.fetchall()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_saved_properties: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_users_who_saved_property(property_id):
    """
    Get a list of users who have saved a specific property.

    Args:
        property_id (int): The property ID.

    Returns:
        list: A list of user records (dicts).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT u.id, u.username, u.email, u.full_name
            FROM users u
            JOIN saved_properties sp ON u.id = sp.user_id
            WHERE sp.property_id = %s
            """,
            (property_id,)
        )
        return cur.fetchall()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_users_who_saved_property: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_leads_by_seller(seller_id, only_pending=False):
    """
    Retrieve all interest leads for a seller's properties.

    Args:
        seller_id (int): The seller's user ID.
        only_pending (bool): Whether to fetch only 'Pending' leads.

    Returns:
        list: A list of lead records (dicts).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT l.*, p.title as prop_title, p.images as prop_images,
                   p.city as prop_city, p.state as prop_state, p.listing_type as prop_listing_type,
                   u.profile_image as buyer_profile_image
            FROM property_leads l
            JOIN properties p ON l.property_id = p.id
            JOIN users u ON l.buyer_id = u.id
            WHERE l.seller_id = %s
        """
        if only_pending:
            query += " AND l.status = 'Pending'"
        
        query += " ORDER BY l.created_at DESC"
        
        cur.execute(query, (seller_id,))
        return cur.fetchall()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_leads_by_seller: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def mark_leads_as_read(seller_id):
    """
    Mark all pending leads for a seller as 'Read'.

    Args:
        seller_id (int): The seller's user ID.

    Returns:
        bool: True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE property_leads
            SET status = 'Read'
            WHERE seller_id = %s AND status = 'Pending'
            """,
            (seller_id,)
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in mark_leads_as_read: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_unread_leads_count(seller_id):
    """
    Get the count of unread (Pending) leads for a seller.

    Args:
        seller_id (int): The seller's user ID.

    Returns:
        int: Number of unread leads.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM property_leads WHERE seller_id = %s AND status = 'Pending'",
            (seller_id,)
        )
        result = cur.fetchone()
        return result[0] if result else 0
    except Exception as e:
        current_app.logger.error(f"Database Error in get_unread_leads_count: {e}")
        return 0
    finally:
        cur.close()
        conn.close()


def delete_leads_by_seller(seller_id):
    """
    Permanently delete all leads associated with a seller.

    Args:
        seller_id (int): The seller's user ID.

    Returns:
        bool: True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM property_leads WHERE seller_id = %s", (seller_id,))
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in delete_leads_by_seller: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()



# ==============================================================================
# SEARCH & MODIFICATION FUNCTIONS
# ==============================================================================

def get_property_by_id(property_id):
    """
    Retrieve a single property record by its ID.

    Args:
        property_id (int): The unique ID of the property.

    Returns:
        dict: Property record if found, None otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM properties WHERE id = %s", (property_id,))
        return cur.fetchone()
    except Exception as e:
        current_app.logger.error(f"Database Error in get_property_by_id: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def update_property(property_id, data):
    """
    Update an existing property listing in the database.

    Args:
        property_id (int): The ID of the property to update.
        data (dict): The updated property data.

    Returns:
        bool: True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE properties SET
                title = %(title)s, property_type = %(property_type)s, 
                listing_type = %(listing_type)s, category = %(category)s,
                house_no = %(house_no)s, area = %(area)s, address1 = %(address1)s, 
                city = %(city)s, state = %(state)s, pincode = %(pincode)s, 
                landmark = %(landmark)s, latitude = %(latitude)s, 
                longitude = %(longitude)s, built_up_area = %(built_up_area)s, 
                carpet_area = %(carpet_area)s, floor_number = %(floor_number)s, 
                total_floors = %(total_floors)s, furnishing_status = %(furnishing_status)s,
                bedrooms = %(bedrooms)s, bathrooms = %(bathrooms)s, balcony = %(balcony)s,
                expected_price = %(expected_price)s, rent_amount = %(rent_amount)s, 
                maintenance_charges = %(maintenance_charges)s, is_negotiable = %(is_negotiable)s, 
                token_amount = %(token_amount)s, security_deposit = %(security_deposit)s, 
                ownership_type = %(ownership_type)s, images = %(images)s, 
                video_path = %(video_path)s, floor_plan = %(floor_plan)s, 
                description = %(description)s, highlights = %(highlights)s, 
                seller_name = %(seller_name)s, seller_mobile = %(seller_mobile)s, 
                seller_role = %(seller_role)s
            WHERE id = %(id)s
            """,
            {**data, "id": property_id}
        )
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in update_property: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def delete_property_by_id(property_id):
    """
    Permanently delete a property and all its associated data (leads, saved).

    Args:
        property_id (int): The ID of the property to delete.

    Returns:
        bool: True if successful, False otherwise.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Delete related records first due to foreign key constraints if any
        cur.execute("DELETE FROM property_leads WHERE property_id = %s", (property_id,))
        cur.execute("DELETE FROM saved_properties WHERE property_id = %s", (property_id,))
        cur.execute("DELETE FROM properties WHERE id = %s", (property_id,))
        
        conn.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Database Error in delete_property_by_id: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_search_suggestions(term):
    """
    Fetch autocomplete search suggestions for cities, states, and titles.

    Args:
        term (str): The search term to find matches for.

    Returns:
        list: A list of formatted suggestion strings.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        suggestions = set()
        term_param = f"%{term}%"
        
        # Search Cities
        cur.execute(
            "SELECT DISTINCT city FROM properties WHERE city ILIKE %s LIMIT 3", 
            (term_param,)
        )
        for row in cur.fetchall():
            suggestions.add(f"In City: {row[0]}")
            
        # Search States
        cur.execute(
            "SELECT DISTINCT state FROM properties WHERE state ILIKE %s LIMIT 2", 
            (term_param,)
        )
        for row in cur.fetchall():
            suggestions.add(f"In State: {row[0]}")

        # Search Localities/Areas
        cur.execute("SELECT DISTINCT area FROM properties WHERE area ILIKE %s LIMIT 3", (term_param,))
        for row in cur.fetchall():
            suggestions.add(f"In Area: {row[0]}")
            
        # Search Titles
        cur.execute(
            "SELECT title FROM properties WHERE title ILIKE %s LIMIT 5", 
            (term_param,)
        )
        for row in cur.fetchall():
            suggestions.add(row[0])
            
        # Search Categories/Types
        cur.execute("SELECT DISTINCT category FROM properties WHERE category ILIKE %s LIMIT 2", (term_param,))
        for row in cur.fetchall():
            suggestions.add(f"Category: {row[0]}")

        cur.execute("SELECT DISTINCT property_type FROM properties WHERE property_type ILIKE %s LIMIT 2", (term_param,))
        for row in cur.fetchall():
            suggestions.add(f"Type: {row[0]}")
            
        return list(suggestions)
    except Exception as e:
        print(f"DB Error (get_search_suggestions): {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_most_interested_property_info():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT property_id, COUNT(*) FROM property_leads GROUP BY property_id ORDER BY 2 DESC LIMIT 1")
    res = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if res:
        return {"id": res[0], "count": res[1]}
    return None
