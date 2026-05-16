'use client'

export default function RatMascot({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className={`rat-stage ${isAnalyzing ? 'rat-active' : ''}`}>
      <div className="rat-img-wrap">
        <div className="rat-aura" />
        <div className="rat-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rato-mascot.png" alt="RatoAds" className="rat-thinking" width={200} height={200} />
        {isAnalyzing && (
          <>
            <div className="rat-spark s1" />
            <div className="rat-spark s2" />
            <div className="rat-spark s3" />
          </>
        )}
      </div>

      <style>{`
        .rat-stage{display:flex;flex-direction:column;align-items:center;gap:20px;padding:40px 0 16px;max-width:560px;margin:0 auto;width:100%}
        .rat-stage .rat-img-wrap{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;max-width:55vw}
        .rat-stage .rat-aura{position:absolute;inset:-20px;border-radius:50%;background:radial-gradient(circle,rgba(255,140,0,.08),transparent 65%);pointer-events:none;opacity:1}
        .rat-active .rat-aura{animation:rat-aura-pulse 2.4s ease-in-out infinite}
        @keyframes rat-aura-pulse{0%,100%{transform:scale(.85);opacity:.4}50%{transform:scale(1.12);opacity:.85}}
        .rat-stage .rat-ring{display:none}
        .rat-stage .rat-thinking{
          width:180px;max-width:50vw;height:auto;position:relative;z-index:1;transition:all .4s;
          filter:
            drop-shadow(0 0 0 rgba(255,170,0,1))
            drop-shadow(1px 0 0 rgba(255,160,0,.9))
            drop-shadow(-1px 0 0 rgba(255,160,0,.9))
            drop-shadow(0 1px 0 rgba(255,160,0,.9))
            drop-shadow(0 -1px 0 rgba(255,160,0,.9))
            drop-shadow(0 0 6px rgba(255,140,0,.6))
            drop-shadow(0 0 16px rgba(255,140,0,.3));
        }
        .rat-active .rat-thinking{
          animation:rat-float 2.8s ease-in-out infinite;
          filter:
            drop-shadow(0 0 0 rgba(255,170,0,1))
            drop-shadow(1px 0 0 rgba(255,160,0,.95))
            drop-shadow(-1px 0 0 rgba(255,160,0,.95))
            drop-shadow(0 1px 0 rgba(255,160,0,.95))
            drop-shadow(0 -1px 0 rgba(255,160,0,.95))
            drop-shadow(2px 0 0 rgba(255,150,0,.5))
            drop-shadow(-2px 0 0 rgba(255,150,0,.5))
            drop-shadow(0 2px 0 rgba(255,150,0,.5))
            drop-shadow(0 -2px 0 rgba(255,150,0,.5))
            drop-shadow(0 0 10px rgba(255,140,0,.7))
            drop-shadow(0 0 24px rgba(255,140,0,.4));
        }
        @keyframes rat-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}

        /* Sparks */
        .rat-spark{position:absolute;width:6px;height:6px;background:#FF8C00;border-radius:50%;opacity:0;pointer-events:none;z-index:2}
        .rat-active .rat-spark{animation:rat-spark-fly 1.4s ease-out infinite}
        .rat-spark.s1{top:30%;right:15%;animation-delay:0s}
        .rat-spark.s2{top:25%;right:20%;animation-delay:.4s;width:4px;height:4px;background:#FFB347}
        .rat-spark.s3{top:35%;right:10%;animation-delay:.8s;width:5px;height:5px}
        @keyframes rat-spark-fly{
          0%{opacity:.9;transform:translate(0,0) scale(1)}
          50%{opacity:.6}
          100%{opacity:0;transform:translate(var(--dx,6px),-35px) scale(0)}
        }
        .rat-spark.s1{--dx:-8px}
        .rat-spark.s2{--dx:10px}
        .rat-spark.s3{--dx:-4px}
      `}</style>
    </div>
  )
}
