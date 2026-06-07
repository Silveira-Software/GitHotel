import { useEffect, useRef, useState } from 'react';
import { loadModel, getModel, drawFurni } from '../lib/furni3d';

export default function Furni3DView({ cls, size = 180 }) {
  const ref = useRef(null);
  const [dir, setDir] = useState(2);
  const [state, setState] = useState('loading');

  useEffect(() => { if (cls) loadModel(cls); setState('loading'); }, [cls]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const m = getModel(cls);
      if (!m) return;
      if (!m.ok) { setState('none'); return; }
      setState('ok');
      drawFurni(ctx, m, cv.width / 2, cv.height * 0.62, { direction: dir, t: performance.now(), scale: 1.2 });
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [cls, dir]);

  const dirs = getModel(cls)?.frames?.dirs || [0, 2, 4, 6];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ background: 'linear-gradient(180deg,#1b3b5a,#0e2638)', border: '2px solid var(--hb-border)', borderRadius: 10, display: 'grid', placeItems: 'center', height: size }}>
        <canvas ref={ref} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
      </div>
      {state === 'none' && <div style={{ color: 'var(--hb-muted)', fontSize: 12, marginTop: 6 }}>sem modelo 3D — usa ícone do catálogo</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
        {dirs.map(d => (
          <button key={d} className={'hb-btn hb-btn-sm ' + (dir === d ? '' : 'hb-btn-ghost')} onClick={() => setDir(d)}>↻ {d}</button>
        ))}
      </div>
    </div>
  );
}
