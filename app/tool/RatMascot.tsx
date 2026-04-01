'use client'

export default function RatMascot({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className={`rat-mascot ${isAnalyzing ? 'analyzing' : 'idle'}`}>
      <svg width="300" height="340" viewBox="0 0 300 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="rat-main-svg">

        {/* === BODY / COAT === */}
        <g className="rat-body-group">
          {/* Legs */}
          <rect x="115" y="280" width="22" height="40" rx="8" fill="#374151" />
          <rect x="163" y="280" width="22" height="40" rx="8" fill="#374151" />
          {/* Shoes */}
          <ellipse cx="126" cy="320" rx="16" ry="8" fill="#1F2937" />
          <ellipse cx="174" cy="320" rx="16" ry="8" fill="#1F2937" className="rat-foot" />

          {/* Torso / Coat */}
          <path d="M110 170 Q100 200 105 270 Q110 290 150 290 Q190 290 195 270 Q200 200 190 170 Z" fill="#374151" stroke="#1a1a1a" strokeWidth="1.5" />
          {/* Coat collar */}
          <path d="M120 175 Q150 185 180 175" fill="none" stroke="#4B5563" strokeWidth="2" />
          {/* Coat buttons */}
          <circle cx="150" cy="210" r="3" fill="#6B7280" />
          <circle cx="150" cy="235" r="3" fill="#6B7280" />
          <circle cx="150" cy="260" r="3" fill="#6B7280" />

          {/* Tie */}
          <polygon points="147,178 153,178 155,195 150,200 145,195" fill="#FF6B00" />
          <polygon points="145,195 155,195 152,215 148,215" fill="#FF6B00" opacity=".85" />

          {/* Arms - idle: crossed / analyzing: one holds magnifier */}
          <g className="rat-arms">
            {/* Left arm */}
            <path className="rat-arm-left" d="M110 190 Q90 210 95 240 Q98 250 108 245" fill="#374151" stroke="#1a1a1a" strokeWidth="1" />
            {/* Left hand */}
            <circle className="rat-hand-left" cx="105" cy="242" r="8" fill="#9CA3AF" />
            {/* Right arm */}
            <path className="rat-arm-right" d="M190 190 Q210 210 205 240 Q202 250 192 245" fill="#374151" stroke="#1a1a1a" strokeWidth="1" />
            {/* Right hand */}
            <circle className="rat-hand-right" cx="195" cy="242" r="8" fill="#9CA3AF" />
          </g>

          {/* Magnifier on belt (idle) / in hand (analyzing) */}
          <g className="rat-magnifier-group">
            <line className="rat-mag-handle" x1="218" y1="185" x2="235" y2="210" stroke="#FF6B00" strokeWidth="5" strokeLinecap="round" />
            <circle className="rat-mag-lens" cx="212" cy="175" r="16" fill="rgba(255,107,0,.06)" stroke="#FF6B00" strokeWidth="3.5" />
            <ellipse cx="206" cy="169" rx="4" ry="3" fill="rgba(255,255,255,.15)" />
            {/* Particles (only visible when analyzing) */}
            <circle className="rat-particle p1" cx="200" cy="160" r="2.5" fill="#FF6B00" />
            <circle className="rat-particle p2" cx="224" cy="165" r="2" fill="#FF6B00" />
            <circle className="rat-particle p3" cx="210" cy="155" r="1.5" fill="#FF6B00" />
            <circle className="rat-particle p4" cx="218" cy="158" r="2" fill="#FF6B00" />
          </g>
        </g>

        {/* === HEAD === */}
        <g className="rat-head-group">
          {/* Neck */}
          <rect x="135" y="155" width="30" height="25" rx="8" fill="#9CA3AF" />
          {/* Head */}
          <ellipse cx="150" cy="115" rx="42" ry="48" fill="#9CA3AF" stroke="#1a1a1a" strokeWidth="1" />

          {/* Ears */}
          <ellipse cx="112" cy="78" rx="18" ry="24" fill="#9CA3AF" stroke="#6B7280" strokeWidth="1.5" />
          <ellipse cx="112" cy="78" rx="11" ry="16" fill="#FDA4AF" />
          <ellipse cx="188" cy="78" rx="18" ry="24" fill="#9CA3AF" stroke="#6B7280" strokeWidth="1.5" />
          <ellipse cx="188" cy="78" rx="11" ry="16" fill="#FDA4AF" />

          {/* Hat */}
          <ellipse cx="150" cy="80" rx="44" ry="7" fill="#FF6B00" />
          <path d="M115 80 Q118 40 150 45 Q182 40 185 80 Z" fill="#FF6B00" />
          <rect x="115" y="74" width="70" height="7" rx="2" fill="#1a1a1a" opacity=".25" />

          {/* Snout */}
          <ellipse cx="130" cy="128" rx="18" ry="12" fill="#D1D5DB" />
          {/* Nose */}
          <ellipse cx="118" cy="124" rx="6" ry="5" fill="#FDA4AF" />
          <ellipse cx="116" cy="122" rx="2" ry="1.5" fill="rgba(255,255,255,.3)" />

          {/* Eyes */}
          <g className="rat-eyes">
            <circle cx="135" cy="108" r="6" fill="#1a1a1a" />
            <circle cx="135" cy="106" r="2.5" fill="#EF4444" className="rat-eye-inner" />
            <circle cx="133" cy="105" r="1" fill="rgba(255,255,255,.4)" />
            <circle cx="165" cy="108" r="6" fill="#1a1a1a" />
            <circle cx="165" cy="106" r="2.5" fill="#EF4444" className="rat-eye-inner" />
            <circle cx="163" cy="105" r="1" fill="rgba(255,255,255,.4)" />
            {/* Eyebrows */}
            <line className="rat-brow-l" x1="127" y1="96" x2="140" y2="98" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" />
            <line className="rat-brow-r" x1="160" y1="98" x2="173" y2="96" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* Smirk */}
          <path className="rat-mouth" d="M125 135 Q135 142 145 136" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
          {/* Teeth */}
          <rect x="131" y="134" width="4" height="6" rx="1.5" fill="#fff" />
          <rect x="137" y="134" width="4" height="6" rx="1.5" fill="#fff" />
        </g>
      </svg>

      <style>{`
        .rat-mascot{display:flex;justify-content:center;padding:16px 0;transition:all .3s ease}

        /* === IDLE STATE === */
        .rat-mascot.idle .rat-foot{animation:rat-tap .6s ease-in-out infinite alternate}
        @keyframes rat-tap{0%{transform:translateY(0)}100%{transform:translateY(-3px)}}

        .rat-mascot.idle .rat-eyes{animation:rat-idle-blink 4s ease-in-out infinite}
        @keyframes rat-idle-blink{0%,92%,96%,100%{opacity:1}94%{opacity:0}}

        /* Idle: magnifier on belt */
        .rat-mascot.idle .rat-magnifier-group{transform:translate(0,50px) scale(.7);opacity:.7;transition:all .4s ease}
        .rat-mascot.idle .rat-particle{opacity:0}

        /* Idle: arms crossed feel */
        .rat-mascot.idle .rat-arm-left{d:path("M110 190 Q85 220 115 240")}
        .rat-mascot.idle .rat-hand-left{cx:112;cy:237}
        .rat-mascot.idle .rat-arm-right{d:path("M190 190 Q215 220 185 240")}
        .rat-mascot.idle .rat-hand-right{cx:188;cy:237}

        /* === ANALYZING STATE === */
        .rat-mascot.analyzing .rat-body-group{animation:rat-lean .3s ease forwards}
        @keyframes rat-lean{to{transform:rotate(-3deg) translateX(-5px);transform-origin:150px 280px}}

        .rat-mascot.analyzing .rat-foot{animation:none}

        .rat-mascot.analyzing .rat-magnifier-group{
          transform:translate(-5px,-10px) scale(1);opacity:1;
          animation:rat-search 1.8s ease-in-out infinite;transition:all .4s ease}
        @keyframes rat-search{0%,100%{transform:translate(-20px,-10px)}50%{transform:translate(20px,-10px)}}

        .rat-mascot.analyzing .rat-particle{animation:rat-sparkle 1.2s ease-out infinite}
        .rat-mascot.analyzing .rat-particle.p1{animation-delay:0s}
        .rat-mascot.analyzing .rat-particle.p2{animation-delay:.3s}
        .rat-mascot.analyzing .rat-particle.p3{animation-delay:.6s}
        .rat-mascot.analyzing .rat-particle.p4{animation-delay:.9s}
        @keyframes rat-sparkle{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx,5px),-20px) scale(0)}}
        .rat-particle.p1{--dx:-8px}.rat-particle.p2{--dx:10px}.rat-particle.p3{--dx:-3px}.rat-particle.p4{--dx:7px}

        .rat-mascot.analyzing .rat-eyes{animation:rat-focus-blink 3.5s ease-in-out infinite}
        @keyframes rat-focus-blink{0%,42%,46%,100%{opacity:1}44%{opacity:0}}

        .rat-mascot.analyzing .rat-brow-l{transform:rotate(-8deg);transform-origin:134px 97px}
        .rat-mascot.analyzing .rat-brow-r{transform:rotate(8deg);transform-origin:167px 97px}

        /* Smooth transitions */
        .rat-magnifier-group,.rat-arm-left,.rat-arm-right,.rat-hand-left,.rat-hand-right,.rat-brow-l,.rat-brow-r{transition:all .4s ease}
      `}</style>
    </div>
  )
}
