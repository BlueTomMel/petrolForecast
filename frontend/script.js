document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('price-table-container');
    const forecastButton = document.getElementById('forecast');
    // Forecast button: show error if empty, else show correct SVG by state
    forecastButton.addEventListener('click', async function() {
        const suburb = suburbInput.value.trim();
        // Hide advanced options and clear filters
        advancedOptions.style.display = 'none';
        if (brandSelect) {
            const checkboxes = brandSelect.querySelectorAll('input[type=checkbox]');
            checkboxes.forEach(cb => { cb.checked = false; });
        }
        if (distanceInput) distanceInput.value = 5;
        if (orderBySelect) orderBySelect.value = 'price';
        if (displayInfoSelect) displayInfoSelect.value = 'simple';
        // If empty, show error
        if (!suburb) {
            container.style.display = '';
            container.innerHTML = `<div style="background:#ffeaea;color:#b71c1c;padding:1.2em 1em;border-radius:8px;text-align:center;font-size:1.1em;font-weight:500;box-shadow:0 2px 8px #f8d7da;max-width:400px;margin:2em auto 0 auto;">Please enter the suburb</div>`;
            return;
        }
        // Geocode suburb to determine state
        container.style.display = '';
        container.innerHTML = '<p style="text-align:center;font-size:1.1em;color:#888;">Checking suburb...</p>';
        let state = null;
        try {
            const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suburb + ', Australia')}`);
            const geoResults = await geoResp.json();
            if (geoResults.length > 0) {
                // Try to extract state from display_name or address
                const best = geoResults[0];
                let stateName = '';
                if (best.address && best.address.state) {
                    stateName = best.address.state.toLowerCase();
                } else if (best.display_name) {
                    // Fallback: parse state from display_name
                    const parts = best.display_name.split(',').map(s => s.trim().toLowerCase());
                    const knownStates = ['victoria', 'new south wales', 'queensland'];
                    stateName = parts.find(p => knownStates.includes(p)) || '';
                }
                if (stateName.includes('victoria')) {
                    state = 'melbourne';
                } else if (stateName.includes('new south wales')) {
                    state = 'sydney';
                } else if (stateName.includes('queensland')) {
                    state = 'brisbane';
                }
            }
        } catch (e) {
            // If geocoding fails, show error
            container.innerHTML = `<div style="background:#ffeaea;color:#b71c1c;padding:1.2em 1em;border-radius:8px;text-align:center;font-size:1.1em;font-weight:500;box-shadow:0 2px 8px #f8d7da;max-width:400px;margin:2em auto 0 auto;">Could not determine suburb location. Please try again.</div>`;
            return;
        }
        if (!state) {
            container.innerHTML = `<div style="background:#ffeaea;color:#b71c1c;padding:1.2em 1em;border-radius:8px;text-align:center;font-size:1.1em;font-weight:500;box-shadow:0 2px 8px #f8d7da;max-width:400px;margin:2em auto 0 auto;">Suburb not found or not in VIC/NSW/QLD.</div>`;
            return;
        }
        // Show correct SVG
        let svgFile = '';
        let svgAlt = '';
        if (state === 'melbourne') {
            svgFile = 'graph/melbourne.svg';
            svgAlt = 'Melbourne Petrol Price Forecast';
        } else if (state === 'sydney') {
            svgFile = 'graph/sydney.svg';
            svgAlt = 'Sydney Petrol Price Forecast';
        } else if (state === 'brisbane') {
            svgFile = 'graph/brisbane.svg';
            svgAlt = 'Brisbane Petrol Price Forecast';
        }
        // Show graph
        container.innerHTML = `
            <div style="width:100%;max-width:600px;margin:2.5em auto 0 auto;display:flex;justify-content:center;align-items:center;padding:1.5em 0 1em 0;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                <img src="${svgFile}" alt="${svgAlt}" style="width:100%;height:auto;max-width:600px;display:block;" />
            </div>
            <div id="forecast-message" style="width:100%;max-width:600px;margin:1.5em auto 0 auto;display:flex;justify-content:center;align-items:center;"></div>
        `;
        // Fetch and display forecast message
        const forecastMsgDiv = document.getElementById('forecast-message');
        forecastMsgDiv.innerHTML = '<span style="color:#888;font-size:1.1em;">Loading AI forecast...</span>';
        try {
            const resp = await fetch(`/api/forecast?city=${encodeURIComponent(state)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.forecast_text) {
                    let dateStr = '';
                    if (data.created_at) {
                        dateStr = `<div style="margin-top:0.7em;font-size:0.93em;color:#888;text-align:right;">Generated: <span style="font-family:monospace">${data.created_at}</span></div>`;
                    }
                    forecastMsgDiv.innerHTML = `<div style=\"background:#f5faff;border-radius:8px;padding:1.2em 1em;box-shadow:0 2px 8px #e3f2fd;font-size:1.08em;color:#1565c0;line-height:1.6;\"><b>AI Forecast for Next Week:</b><br>${data.forecast_text.replace(/\n/g,'<br>')}${dateStr}</div>`;
                } else {
                    forecastMsgDiv.innerHTML = '<span style="color:#b71c1c;">No forecast available at this time.</span>';
                }
            } else {
                forecastMsgDiv.innerHTML = '<span style="color:#b71c1c;">Failed to fetch forecast.</span>';
            }
        } catch (e) {
            forecastMsgDiv.innerHTML = '<span style="color:#b71c1c;">Error loading forecast.</span>';
        }
    });
    container.style.display = 'none';
    const suburbInput = document.getElementById('suburb-input');
    const button = document.getElementById('range-search');
    const toggleAdvanced = document.getElementById('toggle-advanced');
    const advancedOptions = document.getElementById('advanced-options');
    let distanceInput = null;
    let orderBySelect = null;
    let brandSelect = null;
    let displayInfoSelect = null;
    let lastSuburbSearched = '';

    // Remove placeholder on focus, restore if empty on blur
    suburbInput.addEventListener('focus', function() {
        suburbInput.placeholder = '';
    });
    suburbInput.addEventListener('blur', function() {
        if (!suburbInput.value) {
            suburbInput.placeholder = 'Please enter the suburb here';
        }
    });

    button.addEventListener('click', async () => {
        const suburb = suburbInput.value.trim();
        // Get advanced options only if visible
        let distance = 5;
        let orderBy = 'price';
        let displayMode = 'simple';
        if (advancedOptions.style.display !== 'none') {
            distanceInput = document.getElementById('distance-input');
            orderBySelect = document.getElementById('order-by');
            brandSelect = document.getElementById('brand-select');
            displayInfoSelect = document.getElementById('display-info');
            distance = parseFloat(distanceInput.value);
            orderBy = orderBySelect.value;
            displayMode = displayInfoSelect ? displayInfoSelect.value : 'simple';
            // Get selected brands as array
            let selectedBrands = Array.from(brandSelect.selectedOptions || []).map(opt => opt.value);
            if (!suburb || isNaN(distance) || distance <= 0) {
                container.innerHTML = '<p>Please enter a valid suburb and distance.</p>';
                container.style.display = '';
                return;
            }
        } else {
            if (!suburb) {
                container.innerHTML = '<p>Please enter a valid suburb.</p>';
                container.style.display = '';
                return;
            }
        }
        container.innerHTML = '<p>Searching...</p>';
        container.style.display = '';
        // Validate suburb using Nominatim
        let validSuburb = false;
        let suggestion = '';
        try {
            const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suburb + ', Australia')}`);
            const geoResults = await geoResp.json();
            if (geoResults.length > 0) {
                // Check if the first result matches suburb
                const best = geoResults[0];
                // Accept if the input matches the display_name suburb part
                if (best.display_name.toLowerCase().includes(suburb.toLowerCase())) {
                    validSuburb = true;
                } else {
                    suggestion = best.display_name.split(',')[0];
                }
            }
        } catch (e) {
            // If geocoding fails, fallback to search
            validSuburb = true;
        }
        if (!validSuburb && suggestion) {
            container.innerHTML = `<p>Suburb not found. Did you mean <b>\"${suggestion}\"</b>?`;
            return;
        }
        // Proceed with search if valid
        try {
            const resp = await fetch(`/api/stations_in_range?suburb=${encodeURIComponent(suburb)}&distance=${distance}`);
            let rows = await resp.json();
            // Deduplicate by station+address+postcode+date
            const dedupMap = new Map();
            rows.forEach(row => {
                const key = row.station + '|' + (row.address || '') + '|' + row.postcode + '|' + row.date;
                if (!dedupMap.has(key)) {
                    dedupMap.set(key, row);
                }
            });
            let dedupRows = Array.from(dedupMap.values());
            // Filter by selected brands if any selected
            if (advancedOptions.style.display !== 'none' && brandSelect) {
                const selectedBrands = Array.from(brandSelect.querySelectorAll('input[type=checkbox]:checked')).map(checkbox => checkbox.value.toLowerCase());
                if (selectedBrands.length > 0) {
                    dedupRows = dedupRows.filter(row => {
                        if (!row.station) return false;
                        return selectedBrands.some(brand => row.station.toLowerCase().includes(brand));
                    });
                }
            }
            // Sort rows by selected order
            if (orderBy === 'price') {
                dedupRows.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            } else {
                dedupRows.sort((a, b) => a.distance_km - b.distance_km);
            }
            renderTable(dedupRows);
            container.style.display = '';
        } catch (e) {
            container.innerHTML = '<p>Error loading data.</p>';
            container.style.display = '';
        }
    });

    function renderTable(rows) {
        if (!rows || rows.length === 0) {
            container.innerHTML = '<p>No results found.</p>';
            return;
        }
        let displayMode = 'simple';
        if (advancedOptions.style.display !== 'none') {
            displayInfoSelect = document.getElementById('display-info');
            displayMode = displayInfoSelect ? displayInfoSelect.value : 'simple';
        }
        let html = '<table><thead><tr>';
        if (displayMode === 'simple') {
            html += '<th>Station</th><th>Address</th><th>Price</th><th>Changes</th><th>Direct Distance</th>';
        } else {
            html += '<th>Postcode</th><th>Suburb</th><th>Station</th><th>Address</th><th>Date</th><th>Price</th><th>Changes</th><th>Distance (km)</th><th>Map</th>';
        }
        html += '</tr></thead><tbody>';
        // Group rows by station+address+postcode and sort by date descending
        const stationMap = new Map();
        rows.forEach(row => {
            const key = row.station + '|' + (row.address || '') + '|' + row.postcode;
            if (!stationMap.has(key)) {
                stationMap.set(key, []);
            }
            stationMap.get(key).push(row);
        });
        // Sort each station's rows by date descending (latest first)
        for (const stationRows of stationMap.values()) {
            stationRows.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        // For each station, show only the latest and 2nd latest price, and their difference
        for (const [key, stationRows] of stationMap.entries()) {
            // Sort by date descending
            stationRows.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latest = stationRows[0];
            let changeHtml = '<span>-</span>';
            if (latest.changes) {
                if (latest.changes.startsWith('+')) {
                    changeHtml = `<span class="price-change-pos">${latest.changes}</span>`;
                } else if (latest.changes.startsWith('-')) {
                    changeHtml = `<span class="price-change-neg">${latest.changes}</span>`;
                } else if (latest.changes === '0C') {
                    changeHtml = `<span style="color:black;display:inline-block;width:2em;text-align:center;">-</span>`;
                } else {
                    changeHtml = `<span>${latest.changes}</span>`;
                }
            }
            if (displayMode === 'simple') {
                // Build MapLink: distance + link to Google Maps from suburb center to station
                let mapLink = '';
                if (latest.distance_km !== undefined && latest.lat && latest.lng && latest.suburb_center_lat && latest.suburb_center_lng) {
                    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latest.suburb_center_lat},${latest.suburb_center_lng}&destination=${latest.lat},${latest.lng}`;
                    mapLink = `${latest.distance_km.toFixed(2)} km <a href="${gmapsUrl}" target="_blank" style="color:#4285f4;text-decoration:underline;">MapLink</a>`;
                } else if (latest.gmaps_url && latest.distance_km !== undefined) {
                    mapLink = `${latest.distance_km.toFixed(2)} km <a href="${latest.gmaps_url}" target="_blank" style="color:#4285f4;text-decoration:underline;">MapLink</a>`;
                } else {
                    mapLink = '-';
                }
                html += `<tr>` +
                    `<td>${latest.station}</td>` +
                    `<td>${latest.address || ''}</td>` +
                    `<td>${latest.price}</td>` +
                    `<td>${changeHtml}</td>` +
                    `<td>${mapLink}</td>` +
                `</tr>`;
            } else {
                html += `<tr>` +
                    `<td>${latest.postcode}</td>` +
                    `<td>${latest.suburb}</td>` +
                    `<td>${latest.station}</td>` +
                    `<td>${latest.address || ''}</td>` +
                    `<td>${latest.date}</td>` +
                    `<td>${latest.price}</td>` +
                    `<td>${changeHtml}</td>` +
                    `<td>${latest.distance_km !== undefined ? latest.distance_km.toFixed(2) : ''}</td>` +
                    `<td><a href="${latest.gmaps_url}" target="_blank">Map</a></td>` +
                `</tr>`;
            }
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // Allow Enter key to trigger search
    suburbInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            button.click();
        }
    });

    // Advanced options listeners (added only when visible)
    toggleAdvanced.addEventListener('click', function() {
        if (advancedOptions.style.display === 'none') {
            advancedOptions.style.display = '';
            // Add listeners when shown
            distanceInput = document.getElementById('distance-input');
            orderBySelect = document.getElementById('order-by');
            brandSelect = document.getElementById('brand-select');
            distanceInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    button.click();
                }
            });
            orderBySelect.addEventListener('change', function() {
                // Do not trigger search automatically on order-by change
            });
            brandSelect.addEventListener('change', function() {
                // Do not trigger search automatically on brand selection change
            });
        } else {
            advancedOptions.style.display = 'none';
        }
    });

    // Replace the brand checkboxes with reordered brands
    brandSelect = document.getElementById('brand-select');
    if (brandSelect) {
        const prioritizedBrands = ['BP', 'Shell', 'Coles Express', 'Ampol', 'Caltex', '7-Eleven', 'Mobil', 'Costco', 'United'];
        const otherBrands = ['7Star Service Station', 'Apex Petroleum', 'Astron', 'Atlas Fuel', 'Budget', 'Burk', 'FastFuel', 'Freedom Fuels', 'Liberty', 'Matilda', 'Medco Petroleum', 'Metro Petroleum', 'On The Run (OTR)', 'Pacific Petroleum', 'Pearl Energy', 'Peak Petroleum', 'Power Fuel', 'Reddy Express', 'Solo', 'Speedway', 'U-GO', 'Vibe', 'Westside Petroleum'];
        const allBrands = [...prioritizedBrands, ...otherBrands];

        brandSelect.innerHTML = ''; // Clear existing options
        brandSelect.style.overflowY = 'auto'; // Enable scrolling
        brandSelect.style.height = '5em'; // Limit height to display approximately 2.5 options

        allBrands.forEach(brand => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = brand;
            checkbox.id = `brand-${brand.replace(/\s+/g, '-').toLowerCase()}`;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = brand;
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '5px';
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            brandSelect.appendChild(wrapper);
        });
    }
});
