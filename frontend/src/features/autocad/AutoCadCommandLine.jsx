import React, { useState, useEffect, useRef } from 'react';

export default function AutoCadCommandLine({
  promptText = "Command: ",
  history = [],
  onExecuteCommand,
  onCoordinateSubmit,
  onCancelCommand
}) {
  const [inputVal, setInputVal] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);
  const historyEndRef = useRef(null);

  // Auto-scroll history to bottom when new entries arrive
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Keep input focused when user clicks in CAD environment
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputVal.trim();
      if (!trimmed) {
        // In AutoCAD, pressing Enter on empty prompt repeats last command or confirms default
        onExecuteCommand("");
        return;
      }

      // Check if it's a coordinate or dimension value
      if (
        trimmed.startsWith('@') ||
        trimmed.includes(',') ||
        trimmed.includes('<') ||
        !isNaN(Number(trimmed))
      ) {
        onCoordinateSubmit(trimmed);
      } else {
        onExecuteCommand(trimmed.toUpperCase());
      }

      setInputVal("");
      setHistoryIndex(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputVal("");
      onCancelCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Scroll command history backward
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]?.cmd || "");
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Scroll command history forward
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInputVal("");
        } else {
          setHistoryIndex(nextIdx);
          setInputVal(history[nextIdx]?.cmd || "");
        }
      }
    }
  };

  return (
    <div className="autocad-command-line-wrapper" style={{
      position: 'absolute',
      bottom: '36px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(780px, 92vw)',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #334155',
      borderRadius: '6px',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
      zIndex: 40,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '12px',
      color: '#E2E8F0',
      overflow: 'hidden'
    }}>
      {/* Scrollable Command History Console */}
      <div style={{
        maxHeight: isExpanded ? '160px' : '46px',
        overflowY: 'auto',
        padding: '6px 12px',
        backgroundColor: '#090D16',
        borderBottom: '1px solid #1E293B',
        transition: 'max-height 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      }}>
        {history.slice(-10).map((item, idx) => (
          <div key={`cmd-hist-${idx}`} style={{
            color: item.type === 'error' ? '#F87171' : (item.type === 'info' ? '#38BDF8' : '#94A3B8'),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '11px',
            lineHeight: 1.4
          }}>
            {item.text}
          </div>
        ))}
        <div ref={historyEndRef} />
      </div>

      {/* Active Command Input Line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 10px',
        gap: '8px'
      }}>
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          title="Toggle Command History"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: '0 4px',
            fontSize: '10px'
          }}
        >
          {isExpanded ? '▼' : '▲'}
        </button>

        <span style={{
          color: '#38BDF8',
          fontWeight: 700,
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}>
          {promptText}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command (e.g. LINE, WALL, REC, OFFSET, 3000) or press Esc..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: '12px',
            padding: '2px 0'
          }}
        />

        <div style={{ display: 'flex', gap: '6px', color: '#64748B', fontSize: '10px' }}>
          <span style={{ background: '#1E293B', padding: '1px 5px', borderRadius: '3px' }}>Enter ↵</span>
          <span style={{ background: '#1E293B', padding: '1px 5px', borderRadius: '3px' }}>Esc ✕</span>
        </div>
      </div>
    </div>
  );
}
