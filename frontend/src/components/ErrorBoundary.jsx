import React from 'react';

/**
 * Global & Component-level Error Boundary for CAD Engine and Schedule Tables.
 * Catches rendering anomalies gracefully, preventing entire app crashes.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CAD Engine ErrorBoundary caught an exception:", error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const componentName = this.props.name || 'Component';

      return (
        <div style={{
          backgroundColor: '#0F172A',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '24px',
          margin: '16px 0',
          color: '#E2E8F0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              ⚠
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F87171' }}>
                {componentName} Rendering Anomaly Intercepted
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                The CAD engine safely isolated this issue to prevent data loss or canvas crashes.
              </p>
            </div>
          </div>

          {this.state.error && (
            <div style={{
              backgroundColor: '#0B0F19',
              border: '1px solid #1E293B',
              borderRadius: '6px',
              padding: '10px 14px',
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: '12px',
              color: '#FCA5A5',
              overflowX: 'auto',
              marginBottom: '16px',
              maxHeight: '120px'
            }}>
              {this.state.error.toString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseOver={(e) => { e.target.style.backgroundColor = '#2563EB'; }}
              onMouseOut={(e) => { e.target.style.backgroundColor = '#3B82F6'; }}
            >
              ↻ Retry Component
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#1E293B',
                color: '#94A3B8',
                border: '1px solid #334155',
                borderRadius: '5px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => { e.target.style.backgroundColor = '#334155'; e.target.style.color = '#FFFFFF'; }}
              onMouseOut={(e) => { e.target.style.backgroundColor = '#1E293B'; e.target.style.color = '#94A3B8'; }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
