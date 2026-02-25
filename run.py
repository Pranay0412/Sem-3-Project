# Import the create_app function from the app package
# This function creates and configures the Flask application
from app import create_app

# Create the Flask application instance
app = create_app()

# This block ensures the server runs only when this file is executed directly
# and not when it is imported somewhere else
if __name__ == '__main__':
    # Run the Flask development server
    # debug=True helps during development by showing errors clearly
    app.run(debug=True)
