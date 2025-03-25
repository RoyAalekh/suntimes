document.addEventListener('DOMContentLoaded', function() {
    // Theme management variables
    let currentTheme = localStorage.getItem('theme') || 'dark';
    const htmlRoot = document.getElementById('htmlRoot');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    
    // Set initial theme from localStorage if available
    if (currentTheme) {
        htmlRoot.setAttribute('data-bs-theme', currentTheme);
    }
    
    // Get map theme based on current app theme
    const getMapTiles = () => {
        return currentTheme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    };
    
    // Initialize the map
    const map = L.map('map').setView([20, 0], 2);
    let tileLayer = L.tileLayer(getMapTiles(), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Initialize variables
    let marker = null;
    let sunriseData = null;
    const locationForm = document.getElementById('locationForm');
    const addressInput = document.getElementById('addressInput');
    const latitudeInput = document.getElementById('latitudeInput');
    const longitudeInput = document.getElementById('longitudeInput');
    const dateInput = document.getElementById('dateInput');
    const geocodeButton = document.getElementById('geocodeButton');
    const timezoneToggle = document.getElementById('timezoneToggle');
    const timezoneLabel = document.getElementById('timezoneLabel');
    const resultsCard = document.getElementById('resultsCard');
    const locationInfo = document.getElementById('locationInfo');
    const sunriseTime = document.getElementById('sunriseTime');
    const sunsetTime = document.getElementById('sunsetTime');
    const timezoneInfo = document.getElementById('timezoneInfo');
    
    // Set the default date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.value = formattedDate;
    
    // Create custom icon for marker
    const sunIcon = L.divIcon({
        html: '<i class="fas fa-map-marker-alt fa-3x text-danger"></i>',
        className: 'custom-marker-icon',
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });
    
    // Function to update theme icon
    const updateThemeIcon = () => {
        if (currentTheme === 'dark') {
            themeIcon.className = 'fas fa-moon';
        } else {
            themeIcon.className = 'fas fa-sun text-warning';
        }
    };
    
    // Set initial icon based on current theme
    updateThemeIcon();
    
    // Theme toggle functionality
    themeToggleBtn.addEventListener('click', function() {
        // Toggle theme
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Save preference to localStorage
        localStorage.setItem('theme', currentTheme);
        
        // Update HTML attribute
        htmlRoot.setAttribute('data-bs-theme', currentTheme);
        
        // Update theme icon
        updateThemeIcon();
        
        // Update map tiles
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(getMapTiles(), {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        
        // Show transition feedback
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 p-3';
        toast.style.zIndex = 1050;
        toast.innerHTML = `
            <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas ${currentTheme === 'dark' ? 'fa-moon text-secondary' : 'fa-sun text-warning'} me-2"></i>
                    <strong class="me-auto">Theme Changed</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Switched to ${currentTheme === 'dark' ? 'dark' : 'light'} mode
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    });
    
    // Function to update the results display
    function updateResults(isUTC = true) {
        if (!sunriseData) return;
        
        // Log the current mode for debugging
        console.log(`Displaying times in ${isUTC ? 'UTC' : 'Local'} mode`);
        
        // Get the appropriate time data based on toggle state
        const timeData = isUTC ? sunriseData.utc : sunriseData.local;
        
        // Update the displayed times
        sunriseTime.textContent = timeData.sunrise;
        sunsetTime.textContent = timeData.sunset;
        
        // Update the location info
        locationInfo.innerHTML = `
            <strong>${sunriseData.location.name}</strong>
            <div class="text-muted">
                ${sunriseData.location.latitude.toFixed(6)}, ${sunriseData.location.longitude.toFixed(6)}
            </div>
        `;
        
        // Update the timezone display
        timezoneInfo.innerHTML = `
            <span class="badge bg-secondary">
                ${timeData.timezone}
            </span>
        `;
        
        // Update the toggle label
        timezoneLabel.textContent = isUTC ? 'UTC' : 'Local';
    }
    
    // Handle map clicks with visual feedback
    map.on('click', function(e) {
        // Update inputs with clicked coordinates
        latitudeInput.value = e.latlng.lat.toFixed(6);
        longitudeInput.value = e.latlng.lng.toFixed(6);
        
        // Add or update marker with animation
        if (marker) {
            marker.setLatLng(e.latlng);
        } else {
            marker = L.marker(e.latlng, {icon: sunIcon}).addTo(map);
        }
        
        // Add a ripple effect at click location
        const ripple = L.divIcon({
            html: '<div class="ripple-effect"></div>',
            className: 'ripple-container',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        const tempMarker = L.marker(e.latlng, {icon: ripple}).addTo(map);
        
        // Remove the temporary marker after animation
        setTimeout(() => {
            map.removeLayer(tempMarker);
        }, 1000);
        
        // Clear the address field
        addressInput.value = '';
    });
    
    // Handle geocode button click
    geocodeButton.addEventListener('click', function() {
        const address = addressInput.value.trim();
        if (!address) {
            showNotification('error', 'Please enter an address to search');
            return;
        }
        
        // Show loading state
        geocodeButton.innerHTML = '<span class="spinner"></span>';
        geocodeButton.disabled = true;
        
        // Geocode the address
        const formData = new FormData();
        formData.append('address', address);
        
        fetch('/geocode', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Update the coordinate inputs
                latitudeInput.value = data.latitude;
                longitudeInput.value = data.longitude;
                
                // Add or update the marker
                const latLng = L.latLng(data.latitude, data.longitude);
                if (marker) {
                    marker.setLatLng(latLng);
                } else {
                    marker = L.marker(latLng, {icon: sunIcon}).addTo(map);
                }
                
                // Center and zoom map
                map.flyTo(latLng, 10, {
                    animate: true,
                    duration: 1.5
                });
                
                // Show the popup with the address
                marker.bindPopup(data.address).openPopup();
                
                // Success notification
                showNotification('success', 'Location found: ' + data.address.split(',')[0]);
            } else {
                showNotification('error', data.message || 'Failed to find the address');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('error', 'Network error. Please try again');
        })
        .finally(() => {
            // Reset button state
            geocodeButton.innerHTML = '<i class="fas fa-search"></i>';
            geocodeButton.disabled = false;
        });
    });
    
    // Function to show notifications
    function showNotification(type, message) {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 p-3';
        toast.style.zIndex = 1050;
        
        const bgClass = type === 'error' ? 'bg-danger' : 'bg-success';
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        
        toast.innerHTML = `
            <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${bgClass} text-white">
                    <i class="fas ${icon} me-2"></i>
                    <strong class="me-auto">${type === 'error' ? 'Error' : 'Success'}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // Handle form submission
    locationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate inputs
        const latitude = parseFloat(latitudeInput.value);
        const longitude = parseFloat(longitudeInput.value);
        const date = dateInput.value;
        
        if (isNaN(latitude) || isNaN(longitude)) {
            showNotification('error', 'Please enter valid coordinates or search for a location');
            return;
        }
        
        if (!date) {
            showNotification('error', 'Please select a date');
            return;
        }
        
        // Create form data
        const formData = new FormData();
        formData.append('latitude', latitude);
        formData.append('longitude', longitude);
        formData.append('date', date);
        
        // Show loading state
        const submitBtn = locationForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span> Loading...';
        submitBtn.disabled = true;
        
        // Fetch sun times
        fetch('/get_sun_times', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Store the data
                sunriseData = data;
                
                // Update the UI
                resultsCard.style.display = 'block';
                const isUTC = !timezoneToggle.checked; // If checked, show local time
                updateResults(isUTC);
                
                // Make sure the marker is on the map
                const latLng = L.latLng(data.location.latitude, data.location.longitude);
                if (marker) {
                    marker.setLatLng(latLng);
                } else {
                    marker = L.marker(latLng, {icon: sunIcon}).addTo(map);
                }
                
                // Center and zoom map with animation
                map.flyTo(latLng, 10, {
                    animate: true,
                    duration: 1.5
                });
                
                // Bind popup with sun info
                marker.bindPopup(`
                    <strong>${data.location.name}</strong><br>
                    <div class="mt-2">
                        <span class="badge bg-warning text-dark"><i class="fas fa-sun me-1"></i> Sunrise: ${data.local.sunrise}</span>
                    </div>
                    <div class="mt-1">
                        <span class="badge bg-info"><i class="fas fa-moon me-1"></i> Sunset: ${data.local.sunset}</span>
                    </div>
                    <div class="mt-2 small text-muted">
                        (Local Time: ${data.local.timezone})
                    </div>
                `).openPopup();
                
                // Show success notification
                showNotification('success', 'Sun times calculated successfully');
                
                // Scroll to results on mobile
                if (window.innerWidth < 992) {
                    resultsCard.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                showNotification('error', data.message || 'Failed to calculate sun times');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('error', 'Network error. Please try again');
        })
        .finally(() => {
            // Reset button state
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        });
    });
    
    // Handle toggle switch for UTC vs Local time
    timezoneToggle.addEventListener('change', function() {
        const isUTC = !this.checked; // If checked (!isUTC), show local time
        updateResults(isUTC);
    });
    
    // Add responsive behaviors
    window.addEventListener('resize', function() {
        map.invalidateSize();
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Alt+T to toggle theme
        if (e.altKey && e.key === 't') {
            themeToggleBtn.click();
        }
        
        // Alt+S to submit the form if filled
        if (e.altKey && e.key === 's' && 
            !isNaN(parseFloat(latitudeInput.value)) && 
            !isNaN(parseFloat(longitudeInput.value))) {
            locationForm.querySelector('button[type="submit"]').click();
        }
    });
});
