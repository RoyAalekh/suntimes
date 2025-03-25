# 🌅 Sunrise & Sunset Finder

> A sleek web app to find accurate sunrise and sunset times for any location and date — with timezone awareness, interactive map support, and a beautiful dark/light theme toggle.  
> 💡 Built for both **end users** and **developers**. 

---

## 🧠 Key Features

### 🌐 Modern UI
- 🗺️ **Interactive Map** — click anywhere to select coordinates
- 🏙️ **Search by Address** — geocode locations by name (e.g. Tokyo, Paris)
- ⏰ **Timezone Toggle** — view sun times in both local time and UTC
- 🌙 **Theme Switcher** — toggle light/dark mode seamlessly
- 📱 **Responsive Design** — works beautifully on mobile & desktop

### ⚙️ Developer API
- 📡 **REST API Access** — get sunrise/sunset data via HTTP GET
- 📊 **Rate Limiting** — in-memory throttling to avoid misuse
- 🧪 **Debug-Friendly** — includes `/health` and `/docs` endpoints for diagnostics

---

## 🧪 Tech Stack

- **Frontend**: HTML, CSS, Bootstrap 5, Leaflet.js, FontAwesome
- **Backend**: Flask, Astral, GeoPy, TimezoneFinder, Python
- **APIs Used**:
  - [Astral](https://astral.readthedocs.io/) – for sun time calculations
  - [OpenStreetMap + Nominatim](https://nominatim.org/) – for geolocation

---

## 📦 Setup & Run Locally

```bash
# Clone the repo
git clone https://github.com/yourusername/sunrise-sunset-finder.git
cd sunrise-sunset-finder

# (Optional) Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the app locally
python main.py
```

## 📝 License

This project is open-source and available under the MIT License.  

## 🙏 Acknowledgements
- **[Astral](https://astral.readthedocs.io/)**: For providing the core functionality to calculate sunrise and sunset 
  times.
- **[OpenStreetMap](https://www.openstreetmap.org/)**: For the geolocation data and map tiles used in the app.
- **[Leaflet.js](https://leafletjs.com/)**: For the interactive map functionality.

