import os
import logging
from datetime import datetime, timedelta
import pytz
import time
from flask import Flask, render_template, request, jsonify
from astral import LocationInfo
from astral.sun import sun
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from timezonefinder import TimezoneFinder
from functools import wraps

# Configure logging with environment variable
log_level = os.environ.get("LOG_LEVEL", "INFO")
logging.basicConfig(level=getattr(logging, log_level))
logger = logging.getLogger(__name__)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", os.urandom(24).hex())

# Initialize geocoder and timezone finder
geolocator = Nominatim(user_agent="sunrisesunsetapp")
tf = TimezoneFinder()

# Simple in-memory rate limiting
request_limits = {}
RATE_LIMIT = int(os.environ.get("RATE_LIMIT", "60"))  # requests per minute
RATE_WINDOW = 60  # seconds

def rate_limiter(f):
    """Decorator for rate limiting."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr
        current_time = time.time()
        
        # Initialize if first request from this IP
        if client_ip not in request_limits:
            request_limits[client_ip] = {"count": 1, "window_start": current_time}
            return f(*args, **kwargs)
        
        # If window has expired, reset
        if current_time - request_limits[client_ip]["window_start"] > RATE_WINDOW:
            request_limits[client_ip] = {"count": 1, "window_start": current_time}
            return f(*args, **kwargs)
        
        # Check if over limit
        if request_limits[client_ip]["count"] >= RATE_LIMIT:
            return jsonify({
                "status": "error",
                "message": "Rate limit exceeded. Please try again later."
            }), 429
        
        # Increment count and proceed
        request_limits[client_ip]["count"] += 1
        return f(*args, **kwargs)
    
    return decorated_function

# Clean up old rate limit entries periodically
def cleanup_rate_limits():
    """Remove old entries from rate limit dictionary."""
    current_time = time.time()
    keys_to_remove = []
    
    for ip, data in request_limits.items():
        if current_time - data["window_start"] > RATE_WINDOW * 2:
            keys_to_remove.append(ip)
    
    for ip in keys_to_remove:
        del request_limits[ip]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint for monitoring."""
    # Cleanup stale rate limit entries when health check is called
    cleanup_rate_limits()
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'active_rate_limits': len(request_limits)
    })

@app.route('/get_sun_times', methods=['POST'])
@rate_limiter
def get_sun_times():
    try:
        data = request.form
        
        # Extract latitude, longitude, and date
        latitude = float(data.get('latitude'))
        longitude = float(data.get('longitude'))
        date_str = data.get('date')
        
        # Parse date or use today's date if not provided
        if date_str:
            selected_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            selected_date = datetime.now().date()
        
        # Create a location object with the given coordinates
        location = LocationInfo(
            name="Selected Location",
            region="",
            timezone=get_timezone(latitude, longitude),
            latitude=latitude,
            longitude=longitude
        )
        
        # Get the timezone for the location
        local_timezone_str = location.timezone
        local_timezone = pytz.timezone(local_timezone_str)
        
        logger.debug(f"Location timezone: {local_timezone_str}")
        
        # Get sun information for the location and date in UTC
        s_utc = sun(location.observer, date=selected_date, tzinfo=pytz.UTC)
        
        # Get sun information for the location and date in local timezone
        s_local = sun(location.observer, date=selected_date, tzinfo=local_timezone)
        
        # Log the times for debugging
        logger.debug(f"UTC sunrise: {s_utc['sunrise']}, sunset: {s_utc['sunset']}")
        logger.debug(f"Local sunrise: {s_local['sunrise']}, sunset: {s_local['sunset']}")
        
        # Format times - UTC
        utc_times = {
            "sunrise": s_utc["sunrise"].strftime('%H:%M:%S'),
            "sunset": s_utc["sunset"].strftime('%H:%M:%S'),
            "date": selected_date.strftime('%Y-%m-%d'),
            "timezone": "UTC"
        }
        
        # Format times - Local
        local_times = {
            "sunrise": s_local["sunrise"].strftime('%H:%M:%S'),
            "sunset": s_local["sunset"].strftime('%H:%M:%S'),
            "date": selected_date.strftime('%Y-%m-%d'),
            "timezone": local_timezone_str
        }
        
        # Log the formatted times
        logger.debug(f"Formatted UTC times: {utc_times}")
        logger.debug(f"Formatted local times: {local_times}")
        
        return jsonify({
            "status": "success",
            "utc": utc_times,
            "local": local_times,
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "name": get_location_name(latitude, longitude)
            }
        })
    except Exception as e:
        logger.error(f"Error calculating sun times: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to calculate sun times: {str(e)}"
        }), 400

@app.route('/geocode', methods=['POST'])
@rate_limiter
def geocode():
    try:
        address = request.form.get('address')
        if not address:
            return jsonify({
                "status": "error",
                "message": "Address is required"
            }), 400
        
        # Geocode the address to coordinates
        location = geolocator.geocode(address)
        
        if not location:
            return jsonify({
                "status": "error",
                "message": f"Could not find coordinates for address: {address}"
            }), 404
        
        return jsonify({
            "status": "success",
            "latitude": location.latitude,
            "longitude": location.longitude,
            "address": location.address
        })
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.error(f"Geocoder service error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Geocoding service timed out or error. Please try again."
        }), 503
    except Exception as e:
        logger.error(f"Error geocoding address: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to geocode address: {str(e)}"
        }), 400

def get_timezone(latitude, longitude):
    """Get the timezone for a given latitude and longitude using TimezoneFinder."""
    try:
        # Use TimezoneFinder to get the timezone at this location
        tz_str = tf.timezone_at(lat=latitude, lng=longitude)
        logger.debug(f"TimezoneFinder found timezone: {tz_str}")
        
        if tz_str:
            return tz_str
        
        # Fallback to UTC if timezone can't be determined
        logger.warning(f"Could not determine timezone for coordinates: {latitude}, {longitude}")
        return 'UTC'
    except Exception as e:
        logger.error(f"Error getting timezone: {str(e)}")
        return 'UTC'

def get_location_name(latitude, longitude):
    """Get the location name for a given latitude and longitude."""
    try:
        location = geolocator.reverse(f"{latitude}, {longitude}", exactly_one=True)
        if location:
            return location.address
        return f"Lat: {latitude}, Long: {longitude}"
    except Exception as e:
        logger.error(f"Error getting location name: {str(e)}")
        return f"Lat: {latitude}, Long: {longitude}"

# API endpoints for programmatic usage
@app.route('/api/sun_times', methods=['GET'])
@rate_limiter
def api_sun_times():
    """API endpoint for getting sun times programmatically."""
    try:
        # Extract parameters from query string
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')
        date_str = request.args.get('date')
        
        # Validate parameters
        if not latitude or not longitude:
            return jsonify({
                "error": "Missing required parameters: latitude and longitude",
                "required_parameters": {
                    "latitude": "Latitude in decimal degrees",
                    "longitude": "Longitude in decimal degrees",
                    "date": "Date in YYYY-MM-DD format (optional, defaults to today)"
                }
            }), 400
        
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except ValueError:
            return jsonify({
                "error": "Invalid coordinates. Latitude and longitude must be numeric values"
            }), 400
        
        # Validate coordinates
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return jsonify({
                "error": "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180"
            }), 400
        
        # Parse date or use today
        if date_str:
            try:
                selected_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    "error": "Invalid date format. Use YYYY-MM-DD"
                }), 400
        else:
            selected_date = datetime.now().date()
        
        # Get timezone and location info
        timezone_str = get_timezone(latitude, longitude)
        location_name = get_location_name(latitude, longitude)
        
        # Create location info
        location = LocationInfo(
            name=location_name,
            region="",
            timezone=timezone_str,
            latitude=latitude,
            longitude=longitude
        )
        
        # Calculate sun times in UTC
        s_utc = sun(location.observer, date=selected_date, tzinfo=pytz.UTC)
        
        # Calculate sun times in local timezone
        local_timezone = pytz.timezone(timezone_str)
        s_local = sun(location.observer, date=selected_date, tzinfo=local_timezone)
        
        # Format response
        return jsonify({
            "success": True,
            "date": selected_date.strftime('%Y-%m-%d'),
            "location": {
                "name": location_name,
                "latitude": latitude,
                "longitude": longitude,
                "timezone": timezone_str
            },
            "sun_times": {
                "utc": {
                    "sunrise": s_utc["sunrise"].isoformat(),
                    "sunset": s_utc["sunset"].isoformat(),
                    "noon": s_utc["noon"].isoformat(),
                },
                "local": {
                    "sunrise": s_local["sunrise"].isoformat(),
                    "sunset": s_local["sunset"].isoformat(),
                    "noon": s_local["noon"].isoformat(),
                }
            }
        })
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return jsonify({
            "error": f"An error occurred: {str(e)}"
        }), 500

# Documentation endpoint
@app.route('/api/docs')
def api_docs():
    """API documentation endpoint."""
    return jsonify({
        "title": "Sunrise-Sunset API",
        "version": "1.0.0",
        "description": "Get sunrise and sunset times for any location and date",
        "endpoints": {
            "GET /api/sun_times": {
                "description": "Get sunrise and sunset times for a location",
                "parameters": {
                    "latitude": "Latitude in decimal degrees (required)",
                    "longitude": "Longitude in decimal degrees (required)",
                    "date": "Date in YYYY-MM-DD format (optional, defaults to today)"
                },
                "example": "/api/sun_times?latitude=40.7128&longitude=-74.0060&date=2025-06-21"
            }
        }
    })
