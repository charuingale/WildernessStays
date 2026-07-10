import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

/** Last-resort guard: an unexpected render error shows a styled recovery
 *  screen instead of a blank white page. */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unexpected UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <div className="empty-state" style={{ paddingTop: 90 }}>
            <div className="e-ico">🌩️</div>
            <h3>Something went sideways</h3>
            <p style={{ marginBottom: 18 }}>
              An unexpected error occurred. Your bookings are safe — reload to keep exploring.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
