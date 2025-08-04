
import { useState, useMemo, useRef, useEffect } from 'react';


function App() {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stations, setStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [distance, setDistance] = useState(5);
  const [orderBy, setOrderBy] = useState('price');
  // Fixed brand list from previous frontend
  // Reordered: BP, Coles Express, Ampol, 7-Eleven at top, then rest, plus 'Better Choice'
  const FIXED_BRANDS = [
    "All",
    "BP",
    "Coles Express",
    "Ampol",
    "7-Eleven",
    "Better Choice",
    "7Star Service Stations", "Apex Petroleum", "Astron", "Atlas Fuel", "Budget", "Burk", "Caltex", "Costco", "FastFuel", "Freedom Fuels", "Liberty", "Matilda", "Medco Petroleum", "Metro Petroleum", "Mobil", "On The Run (OTR)", "Pacific Petroleum", "Pearl Energy", "Peak Petroleum", "Power Fuel", "Reddy Express", "Shell", "Solo", "Speedway", "U-GO", "United", "Vibe", "Westside Petroleum"
  ];
  const [selectedBrands, setSelectedBrands] = useState([]); // array of selected brands

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    setCandidates([]);
    setShowModal(false);
    setSelected(null);
    setStations([]);
    fetch(`http://127.0.0.1:5000/api/suburb_candidates?suburb=${encodeURIComponent(search)}`)
      .then(res => res.json())
      .then(data => {
        const candidates = data.candidates || [];
        setCandidates(candidates);
        setLoading(false);
        if (candidates.length === 1) {
          // If only one candidate, select it and fetch stations after state updates
          setTimeout(() => handleCandidateClick(candidates[0]), 0);
        } else if (candidates.length > 1) {
          setShowModal(true);
        } else {
          setShowModal(true); // show 'no candidates found' in modal
        }
      })
      .catch(() => {
        setLoading(false);
        setShowModal(false);
      });
  };


  const handleCandidateClick = (c) => {
    setSelected(c);
    setSearch(`${c.suburb} ${c.postcode}`);
    setShowModal(false);
    setStations([]);
    // Use current distance and orderBy when fetching stations
    fetchStationsForCandidate(c, distance);
  };

  // Helper to fetch stations for a given candidate
  const fetchStationsForCandidate = (candidate, dist) => {
    if (!candidate) return;
    setStationsLoading(true);
    fetch(`http://127.0.0.1:5000/api/stations_in_range?suburb=${encodeURIComponent(candidate.suburb)}&postcode=${encodeURIComponent(candidate.postcode)}&distance=${dist}`)
      .then(res => res.json())
      .then(data => {
        // Accept both array and object response
        const stationsArr = Array.isArray(data) ? data : (data.stations || []);
        setStations(stationsArr);
        setStationsLoading(false);
      })
      .catch(() => {
        setStations([]);
        setStationsLoading(false);
      });
  };

  // Remove fetchStations, now handled by search and candidate click


  // Helper: find matching brand from fixed list for a station name
  function getStationBrand(stationName) {
    if (!stationName) return '';
    const lower = stationName.toLowerCase();
    // Special case: treat 'EG Ampol' as 'Ampol'
    if (lower.startsWith('eg ampol')) return 'Ampol';
    // Try to match the longest brand name at the start (skip 'All')
    let found = '';
    for (const brand of FIXED_BRANDS) {
      if (brand === 'All') continue;
      if (lower.startsWith(brand.toLowerCase())) {
        if (brand.length > found.length) found = brand;
      }
    }
    return found || '';
  }

  // Get all brands present in stations (for "Others" logic)
  const allStationBrands = useMemo(() => {
    const brands = new Set();
    stations.forEach(s => {
      brands.add(getStationBrand(s.station) || '__OTHER__');
    });
    return Array.from(brands);
  }, [stations]);

  // Brands not in fixed list (for "Others" option)
  const hasOtherBrands = allStationBrands.includes('__OTHER__');

  // Filter stations by selected brands (including 'Others' and 'All')
  const filteredStations =
    selectedBrands.length === 0 || selectedBrands.includes('All')
      ? stations
      : stations.filter(s => {
          const brand = getStationBrand(s.station);
          if (selectedBrands.includes('Others')) {
            return brand === '' || selectedBrands.includes(brand);
          }
          return selectedBrands.includes(brand);
        });

  // Sort stations by selected order
  const sortedStations = [...filteredStations].sort((a, b) => {
    if (orderBy === 'price') {
      return (a.price ?? 0) - (b.price ?? 0);
    } else if (orderBy === 'distance') {
      return (a.distance_km ?? 0) - (b.distance_km ?? 0);
    }
    return 0;
  });

  // --- Forecast state ---
  const [forecastModal, setForecastModal] = useState(false);
  const [forecastCandidates, setForecastCandidates] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [forecastSVG, setForecastSVG] = useState(null);
  const [forecastMsg, setForecastMsg] = useState('');
  const [forecastMsgDate, setForecastMsgDate] = useState('');
  const [forecastCity, setForecastCity] = useState('');

  // --- Forecast logic ---
  async function handleForecast() {
    setForecastError('');
    setForecastSVG(null);
    setForecastMsg('');
    setForecastMsgDate('');
    setForecastCity('');
    const suburbRaw = search.trim();
    if (!suburbRaw) {
      setForecastError('Please enter the suburb');
      return;
    }
    // Only use the part before comma
    const suburb = suburbRaw.split(',')[0].trim();
    setForecastLoading(true);
    // Fetch suburb candidates
    let candidates = [];
    try {
      const resp = await fetch(`http://127.0.0.1:5000/api/suburb_candidates?suburb=${encodeURIComponent(suburb)}`);
      const data = await resp.json();
      candidates = data.candidates || [];
    } catch {
      setForecastError('Error fetching suburb candidates.');
      setForecastLoading(false);
      return;
    }
    setForecastCandidates(candidates);
    setForecastModal(true);
    setForecastLoading(false);
  }

  // When a suburb is confirmed for forecast
  async function handleForecastConfirm(candidate) {
    setForecastModal(false);
    setForecastLoading(true);
    setForecastError('');
    setForecastSVG(null);
    setForecastMsg('');
    setForecastMsgDate('');
    setForecastCity('');
    // Geocode suburb to get state
    let state = null;
    try {
      const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(candidate.suburb + ' ' + candidate.postcode + ', Australia')}`);
      const geoResults = await geoResp.json();
      if (geoResults.length > 0) {
        const best = geoResults[0];
        let stateName = '';
        if (best.address && best.address.state) {
          stateName = best.address.state.toLowerCase();
        } else if (best.display_name) {
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
    } catch {
      setForecastError('Could not determine suburb location. Please try again.');
      setForecastLoading(false);
      return;
    }
    if (!state) {
      setForecastError('Suburb not found or not in VIC/NSW/QLD.');
      setForecastLoading(false);
      return;
    }
    setForecastCity(state);
    // Show SVG
    setForecastSVG(`/graph/${state}.svg`);
    // Fetch forecast message
    try {
      const resp = await fetch(`http://127.0.0.1:5000/api/forecast?city=${encodeURIComponent(state)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.forecast_text) {
          setForecastMsg(data.forecast_text);
          setForecastMsgDate(data.created_at || '');
        } else {
          setForecastMsg('No forecast available at this time.');
        }
      } else {
        setForecastMsg('Failed to fetch forecast.');
      }
    } catch {
      setForecastMsg('Error loading forecast.');
    }
    setForecastLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '3.2em',
          textAlign: 'center',
          marginBottom: '1.2em',
          letterSpacing: '0.21em',
          fontWeight: 900,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          userSelect: 'none',
        }}>
        <span style={{ color: '#4285F4', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>P</span>
        <span style={{ color: '#EA4335', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>e</span>
        <span style={{ color: '#FBBC05', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>t</span>
        <span style={{ color: '#34A853', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>r</span>
        <span style={{ color: '#EA4335', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>o</span>
        <span style={{ color: '#4285F4', marginRight: '0.18em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>l</span>
        <span style={{ color: '#34A853', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>P</span>
        <span style={{ color: '#EA4335', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>r</span>
        <span style={{ color: '#FBBC05', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>i</span>
        <span style={{ color: '#34A853', marginRight: '0.08em', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>c</span>
        <span style={{ color: '#EA4335', textShadow: '0 2px 6px #bdbdbd, 0 1px 0 #fff' }}>e</span>
      </h1>
        <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', marginBottom: '1.5em', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} autoComplete="off">
            <div style={{ position: 'relative', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Enter suburb"
                style={{
                  width: '100%',
                  padding: '1.1em 3em 1.1em 1.2em',
                  fontSize: '1.18em',
                  borderRadius: 24,
                  border: '1px solid #ccc',
                  outline: 'none',
                  background: '#fff',
                  marginBottom: 0,
                  boxShadow: '0 2px 8px #f3f3f3',
                  fontWeight: 400,
                  letterSpacing: 0.5,
                  transition: 'border 0.2s',
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              />
            {/* 3-dots more options button inside input */}
            <button
              type="button"
              onClick={() => setShowOptions(v => !v)}
              style={{
                position: 'absolute',
                right: -33,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                height: 32,
                width: 32,
                zIndex: 2,
              }}
              aria-label="More options"
              tabIndex={-1}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#888" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="6" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="18" r="2" />
              </svg>
            </button>
          </div>
          {/* Search and Forecast buttons side by side */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1em', marginTop: '1.2em' }}>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(to bottom, #d66a6a, #c94c4c)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 24,
                  fontSize: '1em',
                  padding: '0.6em 1.7em',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background 0.2s',
                  minWidth: 110,
                  maxWidth: 110,
                  textAlign: 'center',
                }}
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleForecast}
                style={{
                  background: 'linear-gradient(to bottom, #2580c2, #1565a7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 24,
                  fontSize: '1em',
                  padding: '0.6em 1.7em',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background 0.2s',
                  minWidth: 110,
                  maxWidth: 110,
                  textAlign: 'center',
                }}
                disabled={forecastLoading}
              >
                {forecastLoading ? 'Forecasting...' : 'Forecast'}
              </button>
            </div>
        </form>
      </div>
      {/* Forecast Modal for suburb confirmation */}
      {forecastModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
            <h2>Select suburb + postcode for forecast</h2>
            {forecastCandidates.length === 0 ? (
              <p>No candidates found.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {forecastCandidates.map((c, idx) => (
                  <li key={idx} style={{ margin: '8px 0' }}>
                    <button
                      style={{ padding: 8, fontSize: 16, width: '100%', textAlign: 'left', border: '1px solid #ccc', borderRadius: 4, background: '#f9f9f9', cursor: 'pointer' }}
                      onClick={() => handleForecastConfirm(c)}
                    >
                      {c.suburb} {c.postcode}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setForecastModal(false)} style={{ marginTop: 16, padding: '8px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Forecast error or result display */}
      {forecastError && (
        <div style={{ background:'#ffeaea', color:'#b71c1c', padding:'1.2em 1em', borderRadius:8, textAlign:'center', fontSize:'1.1em', fontWeight:500, boxShadow:'0 2px 8px #f8d7da', maxWidth:400, margin:'2em auto 0 auto' }}>{forecastError}</div>
      )}
      {forecastSVG && (
        <div style={{width:'100%',maxWidth:600,margin:'2.5em auto 0 auto',display:'flex',justifyContent:'center',alignItems:'center',padding:'1.5em 0 1em 0',background:'#fff',borderRadius:12,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <img src={forecastSVG} alt={forecastCity + ' Petrol Price Forecast'} style={{width:'100%',height:'auto',maxWidth:600,display:'block'}} />
        </div>
      )}
      {(forecastMsg || forecastMsgDate) && (
        <div id="forecast-message" style={{width:'100%',maxWidth:600,margin:'1.5em auto 0 auto',display:'flex',justifyContent:'center',alignItems:'center'}}>
          <div style={{background:'#f5faff',borderRadius:8,padding:'1.2em 1em',boxShadow:'0 2px 8px #e3f2fd',fontSize:'1.08em',color:'#1565c0',lineHeight:1.6}}>
            <b>AI Forecast for Next Week:</b><br/>
            {forecastMsg.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
            {forecastMsgDate && <div style={{marginTop:'0.7em',fontSize:'0.93em',color:'#888',textAlign:'right'}}>Generated: <span style={{fontFamily:'monospace'}}>{forecastMsgDate}</span></div>}
          </div>
        </div>
      )}

      {/* Modal for suburb candidates */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
            <h2>Select suburb + postcode</h2>
            {candidates.length === 0 ? (
              <p>No candidates found.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {candidates.map((c, idx) => (
                  <li key={idx} style={{ margin: '8px 0' }}>
                    <button
                      style={{ padding: 8, fontSize: 16, width: '100%', textAlign: 'left', border: '1px solid #ccc', borderRadius: 4, background: '#f9f9f9', cursor: 'pointer' }}
                      onClick={() => handleCandidateClick(c)}
                    >
                      {c.suburb} {c.postcode}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowModal(false)} style={{ marginTop: 16, padding: '8px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* More Options panel */}
      {showOptions && (
        <div style={{ marginBottom: 24, background: '#fffbe6', padding: 16, borderRadius: 8, border: '1px solid #ffe58f', maxWidth: 400 }}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Distance (km):
              <input
                type="number"
                min={1}
                max={50}
                value={distance}
                onChange={e => setDistance(Number(e.target.value))}
                style={{ marginLeft: 8, width: 60, padding: 4, fontSize: 16 }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Brands:</label>
            <BrandMultiSelect
              brands={FIXED_BRANDS}
              hasOtherBrands={hasOtherBrands}
              selectedBrands={selectedBrands}
              setSelectedBrands={setSelectedBrands}
            />
          </div>



          <div>
            <label>
              Order By:
              <select value={orderBy} onChange={e => setOrderBy(e.target.value)} style={{ marginLeft: 8, padding: 4, fontSize: 16 }}>
                <option value="price">Price</option>
                <option value="distance">Distance</option>
              </select>
            </label>
          </div>
        </div>
      )}


      {/* Stations table */}
      {sortedStations.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2>Stations within {distance} km</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ border: '1px solid #eee', padding: 8 }}>Name</th>
                <th style={{ border: '1px solid #eee', padding: 8 }}>Address</th>
                <th style={{ border: '1px solid #eee', padding: 8 }}>Price</th>
                <th style={{ border: '1px solid #eee', padding: 8 }}>Distance (km)</th>
              </tr>
            </thead>
            <tbody>
              {sortedStations.map((s, idx) => {
                // Google Maps link: from selected suburb/postcode to station address
                let mapsUrl = '';
                if (selected && s.address) {
                  const origin = encodeURIComponent(`${selected.suburb} ${selected.postcode}`);
                  const dest = encodeURIComponent(s.address);
                  mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
                }
                return (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #eee', padding: 8 }}>{s.station}</td>
                    <td style={{ border: '1px solid #eee', padding: 8 }}>{s.address}</td>
                    <td style={{ border: '1px solid #eee', padding: 8 }}>{s.price}</td>
                    <td style={{ border: '1px solid #eee', padding: 8 }}>
                      {mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">{s.distance_km?.toFixed(2)}</a>
                      ) : (
                        s.distance_km?.toFixed(2)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}


export default App;

// Custom multi-select dropdown for brands
function BrandMultiSelect({ brands, hasOtherBrands, selectedBrands, setSelectedBrands }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Display summary
  let summary = 'All';
  if (selectedBrands.length === 0 || selectedBrands.includes('All')) {
    summary = 'All';
  } else if (selectedBrands.length === 1) {
    summary = selectedBrands[0];
  } else {
    summary = `${selectedBrands.length} Selected`;
  }

  // Handle brand toggle
  function toggleBrand(brand) {
    if (brand === 'All') {
      setSelectedBrands(['All']);
    } else {
      let next;
      if (selectedBrands.includes(brand)) {
        next = selectedBrands.filter(b => b !== brand && b !== 'All');
      } else {
        next = selectedBrands.filter(b => b !== 'All').concat(brand);
      }
      setSelectedBrands(next);
    }
  }

  // Render options
  const options = brands.concat(hasOtherBrands ? ['Others'] : []);

  return (
    <div ref={ref} style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          background: '#fff',
          padding: '8px 12px',
          cursor: 'pointer',
          minHeight: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 16,
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span>{summary}</span>
        <span style={{ marginLeft: 8, fontSize: 18, color: '#888', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            width: '100%',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 6,
            boxShadow: '0 2px 8px #e3f2fd',
            zIndex: 10,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.map(brand => (
            <label key={brand} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: 15 }}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand) || (brand === 'All' && (selectedBrands.length === 0 || selectedBrands.includes('All')))}
                onChange={() => toggleBrand(brand)}
                style={{ marginRight: 8 }}
              />
              {brand}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}