
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// Mock fetch for all tests
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    // Suburb candidates for burwood
    if (url.includes('/api/suburb_candidates?suburb=burwood')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          candidates: [
            { suburb: 'Burwood', postcode: '2134' },
            { suburb: 'Burwood', postcode: '3125' }
          ]
        })
      });
    }
    // Stations for Burwood 2134
    if (url.includes('/api/stations_in_range?suburb=Burwood&postcode=2134')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          stations: [
            { station: 'Metro Petroleum Croydon Park', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Croydon Park', address: '', price: 0, distance_km: 0 },
            { station: 'BP Croydon Park', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Croydon Park', address: '', price: 0, distance_km: 0 },
            { station: 'Budget Enfield', address: '', price: 0, distance_km: 0 },
            { station: 'Speedway Petroleum', address: '', price: 0, distance_km: 0 },
            { station: 'Tanwar Petroleum', address: '', price: 0, distance_km: 0 },
            { station: 'Budget Petersham', address: '', price: 0, distance_km: 0 },
            { station: 'EG Ampol Strathfield', address: '', price: 0, distance_km: 0 },
            { station: 'Metro Croydon', address: '', price: 0, distance_km: 0 },
            { station: 'Budget Ashfield', address: '', price: 0, distance_km: 0 },
            { station: 'Metro Petroleum Chullora', address: '', price: 0, distance_km: 0 },
            { station: 'Enhance Homebush', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Strathfield South', address: '', price: 0, distance_km: 0 },
            { station: 'Speedway Petroleum', address: '', price: 0, distance_km: 0 },
            { station: 'Metro Leichhardt', address: '', price: 0, distance_km: 0 },
            { station: 'Metro Haberfield', address: '', price: 0, distance_km: 0 },
            { station: 'BP Enfield', address: '', price: 0, distance_km: 0 },
            { station: 'BP Connect Ashfield', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Ashfield', address: '', price: 0, distance_km: 0 },
            { station: 'EG Ampol Chullora', address: '', price: 0, distance_km: 0 },
            { station: 'Coles Express Lidcombe', address: '', price: 0, distance_km: 0 },
            { station: 'Budget Nth Strath', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Burwood', address: '', price: 0, distance_km: 0 },
            { station: 'EG Ampol Burwood', address: '', price: 0, distance_km: 0 },
            { station: 'BP Concord', address: '', price: 0, distance_km: 0 },
            { station: 'Ampol Concord', address: '', price: 0, distance_km: 0 },
            { station: 'Coles Express Five Dock', address: '', price: 0, distance_km: 0 },
            { station: 'Shell OTR Strathfield', address: '', price: 0, distance_km: 0 },
            { station: 'Ampol Croydon', address: '', price: 0, distance_km: 0 },
            { station: 'Ampol Five Dock', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Five Dock', address: '', price: 0, distance_km: 0 },
            { station: 'Ampol Strathfield South', address: '', price: 0, distance_km: 0 },
            { station: 'Coles Express Enfield', address: '', price: 0, distance_km: 0 },
            { station: 'BP Haberfield', address: '', price: 0, distance_km: 0 },
            { station: '7-Eleven Haberfield', address: '', price: 0, distance_km: 0 },
            { station: 'Coles Express Roberts Road West', address: '', price: 0, distance_km: 0 },
            { station: 'Coles Express Roberts Road East', address: '', price: 0, distance_km: 0 },
            { station: 'Ampol Homebush', address: '', price: 0, distance_km: 0 },
            { station: 'EG Ampol Lewisham', address: '', price: 0, distance_km: 0 }
          ]
        })
      });
    }
    // Suburb candidates for camberwell
    if (url.includes('/api/suburb_candidates?suburb=camberwell')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          candidates: [
            { suburb: 'Camberwell', postcode: '3124' }
          ]
        })
      });
    }
    // Forecast for Melbourne
    if (url.includes('/api/forecast?city=Melbourne')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          forecast_text: 'Melbourne forecast text',
          created_at: '2025-08-07'
        })
      });
    }
    // Forecast for Sydney
    if (url.includes('/api/forecast?city=Sydney')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          forecast_text: 'Sydney forecast text',
          created_at: '2025-08-07'
        })
      });
    }
    // Default empty
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

it('shows station names after searching burwood and selecting first candidate', async () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText(/Enter suburb/i), { target: { value: 'burwood' } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
  // Wait for modal
  await screen.findByText(/Select suburb \+ postcode/i);
  // Click first candidate
  fireEvent.click(screen.getByText('Burwood 2134'));
  // Wait for table
  await screen.findByText('Metro Petroleum Croydon Park');
  const expectedNames = [
    'Metro Petroleum Croydon Park',
    '7-Eleven Croydon Park',
    'BP Croydon Park',
    '7-Eleven Croydon Park',
    'Budget Enfield',
    'Speedway Petroleum',
    'Tanwar Petroleum',
    'Budget Petersham',
    'EG Ampol Strathfield',
    'Metro Croydon',
    'Budget Ashfield',
    'Metro Petroleum Chullora',
    'Enhance Homebush',
    '7-Eleven Strathfield South',
    'Speedway Petroleum',
    'Metro Leichhardt',
    'Metro Haberfield',
    'BP Enfield',
    'BP Connect Ashfield',
    '7-Eleven Ashfield',
    'EG Ampol Chullora',
    'Coles Express Lidcombe',
    'Budget Nth Strath',
    '7-Eleven Burwood',
    'EG Ampol Burwood',
    'BP Concord',
    'Ampol Concord',
    'Coles Express Five Dock',
    'Shell OTR Strathfield',
    'Ampol Croydon',
    'Ampol Five Dock',
    '7-Eleven Five Dock',
    'Ampol Strathfield South',
    'Coles Express Enfield',
    'BP Haberfield',
    '7-Eleven Haberfield',
    'Coles Express Roberts Road West',
    'Coles Express Roberts Road East',
    'Ampol Homebush',
    'EG Ampol Lewisham'
  ];
  for (const name of expectedNames) {
    expect(screen.getByText(name)).toBeInTheDocument();
  }
});

it('shows Melbourne forecast graph and text for camberwell', async () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText(/Enter suburb/i), { target: { value: 'camberwell' } });
  fireEvent.click(screen.getByRole('button', { name: /forecast/i }));
  // Wait for SVG and forecast text
  await screen.findByAltText(/Melbourne Petrol Price Forecast/i);
  expect(screen.getByText(/Melbourne forecast text/i)).toBeInTheDocument();
});

it('shows Sydney forecast after burwood forecast and candidate select', async () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText(/Enter suburb/i), { target: { value: 'burwood' } });
  fireEvent.click(screen.getByRole('button', { name: /forecast/i }));
  // Wait for modal
  await screen.findByText(/Select suburb \+ postcode/i);
  // Click first candidate
  fireEvent.click(screen.getByText('Burwood 2134'));
  // Wait for SVG and forecast text
  await screen.findByAltText(/Sydney Petrol Price Forecast/i);
  expect(screen.getByText(/Sydney forecast text/i)).toBeInTheDocument();
});
