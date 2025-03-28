import os
from app.app import app

if __name__ == "__main__":
    debug_mode = os.environ.get("DEBUG", "False").lower() == "true"
    port = int(os.environ.get("PORT", 5000))
    
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
