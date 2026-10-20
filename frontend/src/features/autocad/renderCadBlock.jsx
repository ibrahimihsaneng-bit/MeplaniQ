import React from 'react';

/**
 * Renders professional 2D architectural CAD vector symbols for blocks.
 */
export function renderCadBlock(ent, isSelected, zoom) {
  const bw = ent.width || 1000;
  const bh = ent.height || 1000;
  const rotation = ent.rotation || 0;
  const strokeColor = isSelected ? '#FACC15' : '#38BDF8';
  const fillColor = isSelected ? 'rgba(250, 204, 21, 0.15)' : 'rgba(30, 41, 59, 0.65)';
  const detailColor = isSelected ? '#FDE047' : '#94A3B8';
  const strokeW = (isSelected ? 2.2 : 1.4) / zoom;
  const thinW = 1 / zoom;

  const blockId = ent.blockId || ent.id || '';

  const renderGeometry = () => {
    // 1. BEDS (King / Queen / Single)
    if (blockId.includes('bed') || ent.name?.toLowerCase().includes('bed')) {
      const isSingle = blockId.includes('single') || bw < 1200;
      const headboardH = Math.min(180, bh * 0.1);
      const pillowW = isSingle ? bw * 0.6 : (bw - 200) / 2;
      const pillowH = Math.min(380, bh * 0.22);

      return (
        <g>
          {/* Main Mattress Frame */}
          <rect x={0} y={0} width={bw} height={bh} rx={16 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          {/* Headboard */}
          <rect x={0} y={bh - headboardH} width={bw} height={headboardH} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
          {/* Pillows */}
          {isSingle ? (
            <rect x={(bw - pillowW) / 2} y={bh - headboardH - pillowH - 30} width={pillowW} height={pillowH} rx={12 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
          ) : (
            <>
              <rect x={40} y={bh - headboardH - pillowH - 30} width={pillowW} height={pillowH} rx={12 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
              <rect x={bw - pillowW - 40} y={bh - headboardH - pillowH - 30} width={pillowW} height={pillowH} rx={12 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
            </>
          )}
          {/* Duvet fold line */}
          <line x1={0} y1={bh * 0.55} x2={bw} y2={bh * 0.55} stroke={detailColor} strokeWidth={thinW} strokeDasharray={`${8 / zoom} ${4 / zoom}`} />
        </g>
      );
    }

    // 2. SOFAS (3-Seater / 2-Seater)
    if (blockId.includes('sofa') || ent.name?.toLowerCase().includes('sofa')) {
      const isThree = blockId.includes('3') || bw >= 1800;
      const armW = 160;
      const backH = 180;
      const seatW = (bw - armW * 2) / (isThree ? 3 : 2);
      const seatH = bh - backH;

      return (
        <g>
          {/* Outer Bounds */}
          <rect x={0} y={0} width={bw} height={bh} rx={12 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          {/* Backrest */}
          <rect x={0} y={bh - backH} width={bw} height={backH} rx={8 / zoom} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
          {/* Left Armrest */}
          <rect x={0} y={0} width={armW} height={bh} rx={8 / zoom} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
          {/* Right Armrest */}
          <rect x={bw - armW} y={0} width={armW} height={bh} rx={8 / zoom} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
          {/* Cushions */}
          {Array.from({ length: isThree ? 3 : 2 }).map((_, i) => (
            <rect
              key={i}
              x={armW + i * seatW + 6}
              y={8}
              width={seatW - 12}
              height={seatH - 16}
              rx={10 / zoom}
              fill="#334155"
              stroke={detailColor}
              strokeWidth={thinW}
            />
          ))}
        </g>
      );
    }

    // 3. DINING TABLE (6P / 4P)
    if (blockId.includes('dining') || ent.name?.toLowerCase().includes('dining')) {
      const chairW = 380;
      const chairD = 340;
      const tableInset = 120;

      return (
        <g>
          {/* Table Top */}
          <rect
            x={tableInset}
            y={chairD * 0.7}
            width={bw - tableInset * 2}
            height={bh - chairD * 1.4}
            rx={10 / zoom}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeW}
          />
          {/* Chairs Top */}
          <rect x={bw * 0.25} y={0} width={chairW} height={chairD * 0.6} rx={6 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
          <rect x={bw * 0.75 - chairW} y={0} width={chairW} height={chairD * 0.6} rx={6 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
          {/* Chairs Bottom */}
          <rect x={bw * 0.25} y={bh - chairD * 0.6} width={chairW} height={chairD * 0.6} rx={6 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
          <rect x={bw * 0.75 - chairW} y={bh - chairD * 0.6} width={chairW} height={chairD * 0.6} rx={6 / zoom} fill="#334155" stroke={detailColor} strokeWidth={thinW} />
        </g>
      );
    }

    // 4. SANITARY WC / TOILET
    if (blockId.includes('wc') || ent.name?.toLowerCase().includes('toilet')) {
      const tankH = bh * 0.35;
      return (
        <g>
          {/* Water Tank */}
          <rect x={0} y={bh - tankH} width={bw} height={tankH} rx={8 / zoom} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
          {/* Oval Bowl */}
          <ellipse cx={bw / 2} cy={(bh - tankH) / 2} rx={bw * 0.42} ry={(bh - tankH) * 0.46} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          {/* Inner Rim */}
          <ellipse cx={bw / 2} cy={(bh - tankH) / 2 + 10} rx={bw * 0.28} ry={(bh - tankH) * 0.32} fill="#0F172A" stroke={detailColor} strokeWidth={thinW} />
        </g>
      );
    }

    // 5. WASH BASIN
    if (blockId.includes('basin') || ent.name?.toLowerCase().includes('basin')) {
      return (
        <g>
          <rect x={0} y={0} width={bw} height={bh} rx={10 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          <ellipse cx={bw / 2} cy={bh / 2 - 15} rx={bw * 0.38} ry={bh * 0.35} fill="#0F172A" stroke={detailColor} strokeWidth={strokeW} />
          <circle cx={bw / 2} cy={bh * 0.78} r={18 / zoom} fill={strokeColor} />
          <circle cx={bw / 2} cy={bh / 2 - 15} r={8 / zoom} fill="#64748B" />
        </g>
      );
    }

    // 6. KITCHEN GAS STOVE / COOKTOP
    if (blockId.includes('stove') || ent.name?.toLowerCase().includes('stove')) {
      return (
        <g>
          <rect x={0} y={0} width={bw} height={bh} rx={10 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          {/* 4 Burners */}
          {[
            { cx: bw * 0.28, cy: bh * 0.3 },
            { cx: bw * 0.72, cy: bh * 0.3 },
            { cx: bw * 0.28, cy: bh * 0.7 },
            { cx: bw * 0.72, cy: bh * 0.7 }
          ].map((b, i) => (
            <g key={i}>
              <circle cx={b.cx} cy={b.cy} r={bw * 0.14} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
              <circle cx={b.cx} cy={b.cy} r={bw * 0.05} fill="#F97316" />
              <line x1={b.cx - bw * 0.14} y1={b.cy} x2={b.cx + bw * 0.14} y2={b.cy} stroke={detailColor} strokeWidth={thinW} />
              <line x1={b.cx} y1={b.cy - bw * 0.14} x2={b.cx} y2={b.cy + bw * 0.14} stroke={detailColor} strokeWidth={thinW} />
            </g>
          ))}
        </g>
      );
    }

    // 7. KITCHEN SINK
    if (blockId.includes('sink') || ent.name?.toLowerCase().includes('sink')) {
      return (
        <g>
          <rect x={0} y={0} width={bw} height={bh} rx={10 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          <rect x={bw * 0.1} y={bh * 0.1} width={bw * 0.8} height={bh * 0.8} rx={12 / zoom} fill="#0F172A" stroke={strokeColor} strokeWidth={strokeW} />
          <circle cx={bw / 2} cy={bh / 2} r={16 / zoom} fill="#64748B" />
          <circle cx={bw / 2} cy={bh * 0.15} r={14 / zoom} fill={strokeColor} />
        </g>
      );
    }

    // 8. CEILING FAN
    if (blockId.includes('fan') || ent.name?.toLowerCase().includes('fan')) {
      const cr = Math.min(bw, bh) / 2;
      return (
        <g>
          <circle cx={bw / 2} cy={bh / 2} r={cr} fill="none" stroke={detailColor} strokeWidth={thinW} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />
          <circle cx={bw / 2} cy={bh / 2} r={cr * 0.22} fill="#0284C7" stroke={strokeColor} strokeWidth={strokeW} />
          {/* 3 Blades */}
          {[0, 120, 240].map((deg, i) => (
            <g key={i} transform={`translate(${bw / 2}, ${bh / 2}) rotate(${deg})`}>
              <path d={`M -${cr * 0.08} 0 L -${cr * 0.14} ${cr * 0.9} Q 0 ${cr} ${cr * 0.14} ${cr * 0.9} L ${cr * 0.08} 0 Z`} fill="#1E293B" stroke={strokeColor} strokeWidth={strokeW} />
            </g>
          ))}
        </g>
      );
    }

    // 9. SPLIT AC (INDOOR UNIT)
    if (blockId.includes('ac') || ent.name?.toLowerCase().includes('ac')) {
      return (
        <g>
          <rect x={0} y={0} width={bw} height={bh} rx={6 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
          <line x1={bw * 0.08} y1={bh * 0.28} x2={bw * 0.92} y2={bh * 0.28} stroke={strokeColor} strokeWidth={strokeW} />
          <line x1={bw * 0.08} y1={bh * 0.45} x2={bw * 0.92} y2={bh * 0.45} stroke={detailColor} strokeWidth={thinW} />
          <circle cx={bw * 0.88} cy={bh * 0.72} r={8 / zoom} fill="#22C55E" />
        </g>
      );
    }

    // Default Fallback Vector Block
    return (
      <g>
        <rect x={0} y={0} width={bw} height={bh} rx={8 / zoom} fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />
        <g transform={`translate(${bw / 2}, ${bh / 2}) scale(${1 / zoom}, ${-1 / zoom})`}>
          <text x="0" y="4" textAnchor="middle" fontSize="12" fontWeight="700" fill="#CBD5E1">
            {ent.name || 'Block'}
          </text>
        </g>
      </g>
    );
  };

  return (
    <g
      key={ent.id}
      transform={`translate(${ent.x}, ${ent.y}) rotate(${rotation}) translate(${-bw / 2}, ${-bh / 2})`}
      className="cad-vector-block"
    >
      {renderGeometry()}

      {/* Label Tag */}
      <g transform={`translate(${bw / 2}, ${bh + 20 / zoom}) scale(${1 / zoom}, ${-1 / zoom})`}>
        <rect x="-35" y="-12" width="70" height="15" rx="3" fill="#020617" fillOpacity="0.85" />
        <text x="0" y="0" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={isSelected ? "#FACC15" : "#94A3B8"}>
          {ent.name}
        </text>
      </g>

      {/* Selection Rotation Grip Handle */}
      {isSelected && (
        <g transform={`translate(${bw / 2}, ${-24 / zoom}) scale(${1 / zoom}, ${-1 / zoom})`}>
          <circle cx="0" cy="0" r="10" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#FFFFFF">⟳</text>
        </g>
      )}
    </g>
  );
}
