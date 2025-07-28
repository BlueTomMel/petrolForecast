document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('price-table-container');
    container.style.display = 'none';
    const suburbInput = document.getElementById('suburb-input');
    const button = document.getElementById('range-search');
    const toggleAdvanced = document.getElementById('toggle-advanced');
    const advancedOptions = document.getElementById('advanced-options');
    let distanceInput = null;
    let orderBySelect = null;
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
        if (advancedOptions.style.display !== 'none') {
            distanceInput = document.getElementById('distance-input');
            orderBySelect = document.getElementById('order-by');
            distance = parseFloat(distanceInput.value);
            orderBy = orderBySelect.value;
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
        let html = '<table><thead><tr>' +
            '<th>Postcode</th><th>Suburb</th><th>Station</th><th>Address</th><th>Date</th><th>Price</th><th>Changes</th><th>Distance (km)</th><th>Map</th>' +
            '</tr></thead><tbody>';
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
            distanceInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    button.click();
                }
            });
            orderBySelect.addEventListener('change', function() {
                button.click();
            });
        } else {
            advancedOptions.style.display = 'none';
        }
    });
});
