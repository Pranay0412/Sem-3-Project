"""
PropertyPlus Application Factory
-------------------------------
This module initializes the Flask application and registers all necessary
blueprints and configurations.
"""

from flask import Flask, request
from config import Config


def create_app():
    """
    Application factory for the PropertyPlus Flask application.
    
    Returns:
        Flask: The configured Flask application instance.
    """
    app = Flask(
        __name__, 
        template_folder='../templates', 
        static_folder='../static'
    )
    
    # Load configuration from Config object
    app.config.from_object(Config)

    # Import and register Blueprints
    from app.routes.auth import auth_bp
    from app.routes.main import main_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)

    # ------------------------------------------------------------------
    # Prevent browser back-button from showing cached dashboard pages
    # (Fixes: user logout -> back arrow -> dashboard appears from cache)
    # ------------------------------------------------------------------
    @app.after_request
    def add_no_cache_headers(response):
        protected_prefixes = ("/dashboard", "/property/add")

        if request.path.startswith(protected_prefixes):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

    return app
    