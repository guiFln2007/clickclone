'use client'

export default function RatMascot({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className={`rat-container ${isAnalyzing ? 'analyzing' : 'idle'}`}>
      <div className="rat-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RatoAds" className="rat-img" width={280} height={280} />
        {isAnalyzing && (
          <>
            <div className="rat-particle p1" />
            <div className="rat-particle p2" />
            <div className="rat-particle p3" />
            <div className="rat-particle p4" />
          </>
        )}
      </div>
      {isAnalyzing && <div className="rat-investigating">Investigando...</div>}

      <style>{`
        .rat-container{display:flex;flex-direction:column;align-items:center;padding:48px 0 24px;transition:all .3s ease}
        .rat-img-wrap{position:relative;display:flex;align-items:center;justify-content:center}
        .rat-img{display:block;width:280px;height:auto;transition:all .3s ease}

        /* IDLE — breathing */
        .rat-container.idle .rat-img{animation:breathe 3s ease-in-out infinite}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}

        /* ANALYZING — search scan */
        .rat-container.analyzing .rat-img-wrap{animation:searchScan 1.5s ease-in-out infinite;transform-origin:center bottom}
        @keyframes searchScan{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
        .rat-container.analyzing .rat-img{animation:none}

        /* Particles */
        .rat-particle{position:absolute;width:8px;height:8px;background:#FF6B00;border-radius:50%;opacity:0;pointer-events:none}
        .rat-container.analyzing .rat-particle{animation:floatUp 1.2s ease-out infinite}
        .rat-particle.p1{top:35%;right:18%;animation-delay:0s}
        .rat-particle.p2{top:30%;right:14%;animation-delay:.3s;width:6px;height:6px}
        .rat-particle.p3{top:38%;right:22%;animation-delay:.6s;width:5px;height:5px}
        .rat-particle.p4{top:32%;right:10%;animation-delay:.9s;width:7px;height:7px}
        @keyframes floatUp{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx,5px),-40px) scale(0)}}
        .rat-particle.p1{--dx:-6px}.rat-particle.p2{--dx:8px}.rat-particle.p3{--dx:-3px}.rat-particle.p4{--dx:10px}

        /* Investigating text */
        .rat-investigating{font-size:15px;font-weight:700;color:#FF6B00;margin-top:16px;animation:pulse 1s ease-in-out infinite alternate}
        @keyframes pulse{0%{opacity:.5}100%{opacity:1}}
      `}</style>
    </div>
  )
}
