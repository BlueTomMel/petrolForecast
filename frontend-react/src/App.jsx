import { useState, useMemo, useRef, useEffect } from 'react';
import './App.css'; // Import the new CSS file

function App() {
  // All your state declarations remain the same
  // Detect dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = e => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // All your state declarations remain the same
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
  const FIXED_BRANDS = [
    "All", "BP", "Coles Express", "Ampol", "7-Eleven", "Better Choice", "7Star Service Stations", "Apex Petroleum", "Astron", "Atlas Fuel", "Budget", "Burk", "Caltex", "Costco", "FastFuel", "Freedom Fuels", "Liberty", "Matilda", "Medco Petroleum", "Metro Petroleum", "Mobil", "On The Run (OTR)", "Pacific Petroleum", "Pearl Energy", "Peak Petroleum", "Power Fuel", "Reddy Express", "Shell", "Solo", "Speedway", "U-GO", "United", "Vibe", "Westside Petroleum"
  ];
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [forecastModal, setForecastModal] = useState(false);
  const [forecastCandidates, setForecastCandidates] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [forecastSVG, setForecastSVG] = useState(null);
  const [forecastMsg, setForecastMsg] = useState('');
  const [forecastMsgDate, setForecastMsgDate] = useState('');
  const [forecastCity, setForecastCity] = useState('');

  // All your functions (handleSearch, handleCandidateClick, handleForecast, etc.) remain exactly the same
  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    setCandidates([]);
    setShowModal(false);
    setSelected(null);
    setStations([]);
    // Clear forecast state when searching
    setForecastSVG(null);
    setForecastMsg('');
    setForecastMsgDate('');
    setForecastCity('');
    setForecastError('');
    fetch(`http://127.0.0.1:5000/api/suburb_candidates?suburb=${encodeURIComponent(search)}`)
      .then(res => res.json())
      .then(data => {
        const candidates = data.candidates || [];
        setCandidates(candidates);
        setLoading(false);
        if (candidates.length === 1) {
          setTimeout(() => handleCandidateClick(candidates[0]), 0);
        } else if (candidates.length > 1) {
          setShowModal(true);
        } else {
          setShowModal(true);
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
    fetchStationsForCandidate(c, distance);
  };

  const fetchStationsForCandidate = (candidate, dist) => {
    if (!candidate) return;
    setStationsLoading(true);
    fetch(`http://127.0.0.1:5000/api/stations_in_range?suburb=${encodeURIComponent(candidate.suburb)}&postcode=${encodeURIComponent(candidate.postcode)}&distance=${dist}`)
      .then(res => res.json())
      .then(data => {
        const stationsArr = Array.isArray(data) ? data : (data.stations || []);
        setStations(stationsArr);
        setStationsLoading(false);
      })
      .catch(() => {
        setStations([]);
        setStationsLoading(false);
      });
  };

  function getStationBrand(stationName) {
    if (!stationName) return '';
    const lower = stationName.toLowerCase();
    if (lower.startsWith('eg ampol')) return 'Ampol';
    let found = '';
    for (const brand of FIXED_BRANDS) {
      if (brand === 'All') continue;
      if (lower.startsWith(brand.toLowerCase())) {
        if (brand.length > found.length) found = brand;
      }
    }
    return found || '';
  }

  const allStationBrands = useMemo(() => {
    const brands = new Set();
    stations.forEach(s => {
      brands.add(getStationBrand(s.station) || '__OTHER__');
    });
    return Array.from(brands);
  }, [stations]);

  const hasOtherBrands = allStationBrands.includes('__OTHER__');

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

  const sortedStations = [...filteredStations].sort((a, b) => {
    if (orderBy === 'price') {
      return (a.price ?? 0) - (b.price ?? 0);
    } else if (orderBy === 'distance') {
      return (a.distance_km ?? 0) - (b.distance_km ?? 0);
    }
    return 0;
  });

  async function handleForecast() {
    // Clear search result and filters when forecasting
    setStations([]);
    setSelected(null);
    setShowOptions(false);
    setCandidates([]);
    setShowModal(false);
    setLoading(false);
    setOrderBy('price');
    setDistance(5);
    setSelectedBrands([]);
    setForecastError(''); // Clear error when opening modal
    setForecastSVG(null);
    setForecastMsg('');
    setForecastMsgDate('');
    setForecastCity('');
    setForecastCandidates([]);
    setForecastModal(false);
    setForecastLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/suburb_candidates?suburb=${encodeURIComponent(search)}`);
      const data = await res.json();
      const candidates = data.candidates || [];
      setForecastCandidates(candidates);
      if (candidates.length === 1) {
        // If only one candidate, immediately show forecast for that suburb's capital city
        setSearch(`${candidates[0].suburb} ${candidates[0].postcode}`);
        await handleForecastConfirm(candidates[0]);
      } else if (candidates.length > 1) {
        // If multiple, show modal for user to select
        setForecastModal(true);
      } else {
        // No candidates found, show modal with no results
        setForecastModal(true);
      }
    } catch (e) {
      setForecastCandidates([]);
      setForecastModal(true);
    }
    setForecastLoading(false);
  }

  // Map postcode to state
  function getStateFromPostcode(postcode) {
    const n = parseInt(postcode, 10);
    if (n >= 1000 && n <= 2599) return 'NSW';
    if (n >= 2619 && n <= 2899) return 'NSW';
    if (n >= 200 && n <= 299) return 'ACT';
    if (n >= 3000 && n <= 3999) return 'VIC';
    if (n >= 4000 && n <= 4999) return 'QLD';
    if (n >= 5000 && n <= 5999) return 'SA';
    if (n >= 6000 && n <= 6999) return 'WA';
    if (n >= 7000 && n <= 7999) return 'TAS';
    if (n >= 800 && n <= 999) return 'NT';
    return '';
  }

  async function handleForecastConfirm(candidate) {
    setSearch(`${candidate.suburb} ${candidate.postcode}`);
    setForecastLoading(true);
    setForecastError('');
    setForecastSVG(null);
    setForecastMsg('');
    setForecastMsgDate('');
    setForecastCity('');
    setForecastModal(false);
    // Determine state and city
    const state = getStateFromPostcode(candidate.postcode);
    let city = '';
    let capitalPostcode = '';
    if (state === 'NSW' || state === 'ACT') {
      city = 'Sydney';
      capitalPostcode = '2000';
    } else if (state === 'VIC') {
      city = 'Melbourne';
      capitalPostcode = '3000';
    } else if (state === 'QLD') {
      city = 'Brisbane';
      capitalPostcode = '4000';
    } else {
      setForecastError('No forecast available for this state.');
      setForecastLoading(false);
      return;
    }
    try {
      // Use 'city' param for /api/forecast, not 'suburb' or 'postcode'
      const res = await fetch(`http://127.0.0.1:5000/api/forecast?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (data && data.forecast_text) {
        // Show SVG for the capital city if available
        const svgPath = `/graph/${city.toLowerCase()}.svg`;
        setForecastSVG(svgPath);
        setForecastMsg(data.forecast_text);
        setForecastMsgDate(data.created_at || '');
        setForecastCity(city);
      } else {
        setForecastError('No forecast data available.');
      }
    } catch (e) {
      setForecastError('Failed to fetch forecast.');
    }
    setForecastLoading(false);
  }


  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="title" style={{
          // fontFamily: 'Product Sans, Arial, Helvetica, sans-serif',
          fontFamily: "''Impact', 'Arial Black', Arial, sans-serif",
          fontWeight: 300,
          fontSize: '2.7rem',
          letterSpacing: '0.39em',
          margin: '0 0 30px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          textShadow: '0 5.5px 8px #e0e0e0',
        }}>
          <span style={{ color: '#4285F4', marginRight: '-0.04em', fontWeight: 900 }}>P</span>
          <span style={{ color: '#EA4335', marginRight: '-0.04em', fontWeight: 900 }}>e</span>
          <span style={{ color: '#FBBC05', marginRight: '-0.04em', fontWeight: 900 }}>t</span>
          <span style={{ color: '#34A853', marginRight: '-0.04em', fontWeight: 900 }}>r</span>
          <span style={{ color: '#EA4335', marginRight: '-0.04em', fontWeight: 900 }}>o</span>
          <span style={{ color: '#4285F4', marginRight: '0.18em', fontWeight: 900 }}>l</span>
          <span style={{ width: 2 }} />
          <span style={{ color: '#34A853', marginRight: '-0.04em', fontWeight: 900 }}>P</span>
          <span style={{ color: '#EA4335', marginRight: '-0.04em', fontWeight: 900 }}>r</span>
          <span style={{ color: '#FBBC05', marginRight: '-0.04em', fontWeight: 900 }}>i</span>
          <span style={{ color: '#34A853', marginRight: '-0.04em', fontWeight: 900 }}>c</span>
          <span style={{ color: '#EA4335', fontWeight: 900 }}>e</span>
        </h1>

        <div className="search-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <form onSubmit={handleSearch} className="search-form" autoComplete="off" style={{ width: '100%', maxWidth: 600 }}>
            <div className="input-wrapper" style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Enter suburb"
                className="search-input"
                style={{
                  width: '100%',
                  maxWidth: 540,
                  height: 45, // slightly taller for better usability
                  padding: '0 3.5em 0 3em', // keep vertical padding minimal for modern look
                  fontSize: '1.13em',
                  borderRadius: 24,
                  border: '1.5px solid #dfe1e5',
                  background: '#fff',
                  boxShadow: '0 2px 6px rgba(60,64,67,0.15)',
                  outline: 'none',
                  fontWeight: 400,
                  letterSpacing: 0.1,
                  transition: 'box-shadow 0.2s, border 0.2s',
                  color: '#222',
                  margin: 0,
                  zIndex: 1,
                  lineHeight: 1.2,
                }}
              />
              {/* 3-dots more options button inside input, at far right, like Google mic/settings */}
              <button
                type="button"
                onClick={() => setShowOptions(v => !v)}
                className="options-button"
                aria-label="More options"
                style={{
                  position: 'absolute',
                  right: 18,
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
                  color: '#5f6368',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                }}
                tabIndex={0}
                onMouseDown={e => e.preventDefault()}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="6" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="18" r="2" />
                </svg>
              </button>
              {/* Search icon at left, like Google */}
              <div style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9aa0a6',
                pointerEvents: 'none',
                zIndex: 2,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>

            <div className="button-group" style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 32 }}>
              <button
                type="submit"
                className="button search-button"
                disabled={loading}
                style={{
                  background: 'linear-gradient(180deg, #e26e6eff 0%, #b45b5bff 100%)',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: '1.08em',
                  border: 'none',
                  borderRadius: 999,
                  padding: '0.6em 2.2em',
                  boxShadow: '0 2px 8px #e57373a0',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  margin: 0,
                  minWidth: 120,
                  letterSpacing: 0.02,
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleForecast}
                className="button forecast-button"
                disabled={forecastLoading}
                style={{
                  background: 'linear-gradient(180deg, hsla(207, 47%, 52%, 1.00) 0%, hsla(213, 56%, 33%, 1.00) 100%)',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: '1.08em',
                  border: 'none',
                  borderRadius: 999,
                  padding: '0.6em 2.2em',
                  boxShadow: '0 2px 8px #2196f3a0',
                  cursor: forecastLoading ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  margin: 0,
                  minWidth: 120,
                  letterSpacing: 0.02,
                }}
              >
                {forecastLoading ? 'Forecasting...' : 'Forecast'}
              </button>
            </div>
          </form>
        </div>

        {/* ----- Below this line, components still use inline styles for now ----- */}
        {/* You can refactor them into App.css using the same principles if you like */}

        {forecastModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
          }}>
            <div style={{ background: '#fff', padding: '2.2em 2.5em 2.5em 2.5em', borderRadius: 14, minWidth: 340, boxShadow: '0 6px 32px rgba(0,0,0,0.18)', maxWidth: 420, width: '100%' }}>
              <h2 style={{
                fontSize: '1.6em',
                fontWeight: 700,
                color: '#263238',
                margin: '0 0 1.5em 0',
                letterSpacing: 0.01,
                textAlign: 'center',
              }}>Select suburb + postcode for forecast</h2>
              {forecastLoading ? (
                <div style={{textAlign:'center',color:'#888',fontSize:'1.1em',padding:'1.5em 0'}}>Loading...</div>
              ) : forecastCandidates.length === 0 ? (
                <p style={{textAlign:'center',color:'#888',fontSize:'1.1em'}}>No candidates found.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {forecastCandidates.map((c, idx) => (
                    <li key={idx} style={{ margin: '0 0 14px 0' }}>
                      <button
                        style={{
                          width: '100%',
                          padding: '0.7em 1em',
                          fontSize: '1.08em',
                          border: '1.5px solid #e0e0e0',
                          borderRadius: 6,
                          background: '#fafbfc',
                          color: '#263238',
                          textAlign: 'left',
                          fontWeight: 500,
                          boxShadow: '0 1px 2px #f3f3f3',
                          cursor: 'pointer',
                          transition: 'background 0.18s, border 0.18s',
                        }}
                        onClick={() => handleForecastConfirm(c)}
                        tabIndex={0}
                      >
                        {c.suburb} {c.postcode}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{display:'flex',justifyContent:'center',marginTop:'1.7em'}}>
                <button onClick={() => setForecastModal(false)} style={{
                  background:'#f6f6f6',
                  color:'#444',
                  border:'none',
                  borderRadius:8,
                  fontWeight:500,
                  fontSize:'1.08em',
                  padding:'0.6em 1.7em',
                  boxShadow:'0 1px 4px #e0e0e0',
                  cursor:'pointer',
                  transition:'background 0.18s',
                }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Only show forecast error if modal is not open */}
        {forecastError && !forecastModal && (
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
        
        {showModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: isDark ? '#232323' : '#fff',
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              boxShadow: isDark ? '0 4px 24px #000a' : '0 4px 20px rgba(0,0,0,0.15)',
              color: isDark ? '#f3f3f3' : '#222',
              border: isDark ? '1.5px solid #444' : undefined
            }}>
              <h2 style={{ color: isDark ? '#fff' : undefined }}>Select suburb + postcode</h2>
              {candidates.length === 0 ? (
                <p style={{ color: isDark ? '#ccc' : undefined }}>No candidates found.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {candidates.map((c, idx) => (
                    <li key={idx} style={{ margin: '8px 0' }}>
                      <button
                        style={{
                          padding: 8,
                          fontSize: 16,
                          width: '100%',
                          textAlign: 'left',
                          border: isDark ? '1.5px solid #444' : '1px solid #ccc',
                          borderRadius: 4,
                          background: isDark ? '#181818' : '#f9f9f9',
                          color: isDark ? '#fff' : '#222',
                          cursor: 'pointer',
                          transition: 'background 0.18s, border 0.18s',
                        }}
                        onClick={() => handleCandidateClick(c)}
                      >
                        {c.suburb} {c.postcode}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => setShowModal(false)}
                style={{
                  marginTop: 16,
                  padding: '8px 16px',
                  background: isDark ? '#181818' : '#f6f6f6',
                  color: isDark ? '#fff' : '#444',
                  border: isDark ? '1.5px solid #444' : 'none',
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: '1.08em',
                  boxShadow: isDark ? '0 1px 4px #111' : '0 1px 4px #e0e0e0',
                  cursor: 'pointer',
                  transition: 'background 0.18s',
                }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Only show options/filters if there are stations and not showing forecast */}
        {showOptions && !forecastMsg && !forecastSVG && (
          <div style={{
            marginTop: 28,
            background: '#fff',
            padding: '24px 24px 18px 24px',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(60,64,67,0.10)',
            maxWidth: 900,
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
            border: '1.5px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'row',
            gap: 32,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Distance */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180, flex: 1, maxWidth: 220 }}>
              <label htmlFor="distance-input" style={{ fontWeight: 500, color: '#333', fontSize: 16, marginBottom: 7 }}>Distance (km):</label>
              <input
                id="distance-input"
                type="number"
                min={1}
                max={50}
                value={distance}
                onChange={e => setDistance(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  fontSize: 16,
                  border: '1.5px solid #dfe1e5',
                  borderRadius: 8,
                  background: '#fafbfc',
                  color: '#222',
                  outline: 'none',
                  boxShadow: '0 1px 2px #f3f3f3',
                  transition: 'border 0.18s',
                }}
              />
            </div>
            {/* Brands */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 220, flex: 2, maxWidth: 320 }}>
              <label htmlFor="brand-select" style={{ fontWeight: 500, color: '#333', fontSize: 16, marginBottom: 7 }}>Brands:</label>
              <BrandMultiSelect
                brands={FIXED_BRANDS}
                hasOtherBrands={hasOtherBrands}
                selectedBrands={selectedBrands}
                setSelectedBrands={setSelectedBrands}
              />
            </div>
            {/* Order By */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180, flex: 1, maxWidth: 220 }}>
              <label htmlFor="order-select" style={{ fontWeight: 500, color: '#333', fontSize: 16, marginBottom: 7 }}>Order By:</label>
              <select
                id="order-select"
                value={orderBy}
                onChange={e => setOrderBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  fontSize: 16,
                  border: '1.5px solid #dfe1e5',
                  borderRadius: 8,
                  background: '#fafbfc',
                  color: '#222',
                  outline: 'none',
                  minWidth: 120,
                  boxShadow: '0 1px 2px #f3f3f3',
                  transition: 'border 0.18s',
                  fontWeight: 500,
                }}
              >
                <option value="price">Price</option>
                <option value="distance">Distance</option>
              </select>
            </div>
          </div>
        )}

        {/* Only show stations table if not showing forecast */}
        {sortedStations.length > 0 && !forecastMsg && !forecastSVG && (
          <div style={{ marginTop: 32, width: '100%' }}>
            <h2 style={isDark ? { color: '#fff', textShadow: '0 2px 8px #222' } : {}}>Stations within {distance} km</h2>
            <table style={isDark
              ? { width: '100%', borderCollapse: 'collapse', background: 'rgba(30,30,30,0.98)' }
              : { width: '100%', borderCollapse: 'collapse', background: '#fff' }
            }>
              <thead>
                <tr style={isDark ? { background: 'rgba(60,60,60,0.98)' } : { background: '#fafafa' }}>
                  <th style={isDark
                    ? { border: '1px solid #444', padding: 8, textAlign: 'left', color: '#e0e0e0', fontWeight: 700 }
                    : { border: '1px solid #eee', padding: 8, textAlign: 'left', color: '#222', fontWeight: 700 }
                  }>Name</th>
                  <th style={isDark
                    ? { border: '1px solid #444', padding: 8, textAlign: 'left', color: '#e0e0e0', fontWeight: 700 }
                    : { border: '1px solid #eee', padding: 8, textAlign: 'left', color: '#222', fontWeight: 700 }
                  }>Address</th>
                  <th style={isDark
                    ? { border: '1px solid #444', padding: 8, textAlign: 'left', color: '#e0e0e0', fontWeight: 700 }
                    : { border: '1px solid #eee', padding: 8, textAlign: 'left', color: '#222', fontWeight: 700 }
                  }>Price</th>
                  <th style={isDark
                    ? { border: '1px solid #444', padding: 8, textAlign: 'left', color: '#e0e0e0', fontWeight: 700 }
                    : { border: '1px solid #eee', padding: 8, textAlign: 'left', color: '#222', fontWeight: 700 }
                  }>Changes</th>
                  <th style={isDark
                    ? { border: '1px solid #444', padding: 8, textAlign: 'left', color: '#e0e0e0', fontWeight: 700 }
                    : { border: '1px solid #eee', padding: 8, textAlign: 'left', color: '#222', fontWeight: 700 }
                  }>Distance (km)</th>
                </tr>
              </thead>
              <tbody>
                {sortedStations.map((s, i) => {
                  // Build Google Maps Directions URL
                  let mapsUrl = null;
                  if (s.lat && s.lng) {
                    let origin = '';
                    if (selected && selected.lat && selected.lng) {
                      origin = `${selected.lat},${selected.lng}`;
                    } else if (selected && selected.suburb && selected.postcode) {
                      origin = encodeURIComponent(`${selected.suburb} ${selected.postcode}`);
                    }
                    const destination = `${s.lat},${s.lng}`;
                    mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
                  }
                  return (
                    <tr key={s.id || i} style={i % 2 === 0 ? (isDark ? { background: '#23272f' } : { background: '#fff' }) : (isDark ? { background: '#181c23' } : { background: '#f7f7f7' })}>
                      <td style={isDark
                        ? { border: '1px solid #444', padding: 8, color: '#fff' }
                        : { border: '1px solid #eee', padding: 8, color: '#222' }
                      }>{s.station}</td>
                      <td style={isDark
                        ? { border: '1px solid #444', padding: 8, color: '#fff' }
                        : { border: '1px solid #eee', padding: 8, color: '#222' }
                      }>{s.address}</td>
                      <td style={isDark
                        ? { border: '1px solid #444', padding: 8, color: '#fff' }
                        : { border: '1px solid #eee', padding: 8, color: '#222' }
                      }>{s.price}</td>
                      <td style={{
                        border: isDark ? '1px solid #444' : '1px solid #eee',
                        padding: 8,
                        color: (() => {
                          if (typeof s.changes === 'undefined' || s.changes === null || s.changes === '0c' || s.changes === 0 || s.changes === '-0c') return isDark ? '#222' : '#222';
                          if (typeof s.changes === 'string' && s.changes.startsWith('+')) return '#d32f2f';
                          if (typeof s.changes === 'string' && s.changes.startsWith('-')) return '#388e3c';
                          if (typeof s.changes === 'number' && s.changes > 0) return '#d32f2f';
                          if (typeof s.changes === 'number' && s.changes < 0) return '#388e3c';
                          return isDark ? '#fff' : '#222';
                        })(),
                        fontWeight: 600,
                        textAlign: 'left'
                      }}>
                        {(!s.changes || s.changes.toString().toLowerCase() === '0c' || s.changes === 0 || s.changes === '-0c') ? <span style={{ color: '#222' }}>-</span>
                          : s.changes}
                      </td>
                      <td style={isDark
                        ? { border: '1px solid #444', padding: 8, color: '#82aaff', fontWeight: 600 }
                        : { border: '1px solid #eee', padding: 8, color: '#1976d2', fontWeight: 600 }
                      }>
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Directions (Google Maps)"
                            style={{
                              color: isDark ? '#82aaff' : '#1976d2',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: 600,
                              transition: 'background 0.15s',
                              borderRadius: 4,
                              padding: '2px 6px 2px 2px',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(130,170,255,0.08)' : 'rgba(25,118,210,0.08)'}
                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                          >
                            <img src="/png-transparent-google-maps-pin-location-thumbnail.png" alt="Google Maps Pin" style={{ width: 16, height: 16, marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                            {s.distance_km?.toFixed(2)}
                          </a>
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

// This sub-component still uses inline styles, but can be refactored similarly
function BrandMultiSelect({ brands, hasOtherBrands, selectedBrands, setSelectedBrands }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  let summary = 'All';
  if (selectedBrands.length === 0 || selectedBrands.includes('All')) {
    summary = 'All';
  } else if (selectedBrands.length === 1) {
    summary = selectedBrands[0];
  } else {
    summary = `${selectedBrands.length} Selected`;
  }

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
      setSelectedBrands(next.length > 0 ? next : ['All']); // Default back to 'All' if empty
    }
  }

  const options = brands.concat(hasOtherBrands ? ['Others'] : []);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 10,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.map(brand => (
            <label key={brand} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: 15, userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand) || (brand === 'All' && (selectedBrands.length === 0 || selectedBrands.includes('All')))}
                onChange={() => toggleBrand(brand)}
                style={{ marginRight: 8, cursor: 'pointer' }}
              />
              {brand}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;