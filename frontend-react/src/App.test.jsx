import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Basic smoke test
it('renders the Petrol Price title', () => {
  render(<App />);
  expect(screen.getByText(/Petrol/i)).toBeInTheDocument();
  expect(screen.getByText(/Price/i)).toBeInTheDocument();
});

it('renders the search input and buttons', () => {
  render(<App />);
  expect(screen.getByPlaceholderText(/Enter suburb/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /forecast/i })).toBeInTheDocument();
});

it('disables search button when loading', async () => {
  render(<App />);
  const searchBtn = screen.getByRole('button', { name: /search/i });
  fireEvent.click(searchBtn);
  await waitFor(() => expect(searchBtn).toBeDisabled());
});

// You can add more tests for modal, forecast, and table rendering as needed
