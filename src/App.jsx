import { useState, useRef, useCallback, useEffect } from 'react';
import { questions } from './data/questions';
import { matchPersonality, calculateTraits, getTopTraits } from './data/personalities';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function StartScreen({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
      <div className="text-center max-w-lg">
        <div className="font-mono text-sm tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
          — PERSONALITY TEST v1.0 —
        </div>
        <h1 className="text-6xl font-black mb-2 tracking-tight">??TI</h1>
        <p className="font-mono text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
          EE · CE · CS Type Indicator
        </p>
        <p className="text-base mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          MBTI已经过时了。
        </p>
        <p className="text-base mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          来测测你在EE/CE/CS世界里的真实人格。
        </p>
        <div className="font-mono text-xs mb-8" style={{ color: 'var(--text-secondary)' }}>
          25道题 · 约3-5分钟 · 纯属娱乐
        </div>
        <button
          onClick={onStart}
          className="w-full py-5 rounded-full font-bold text-base cursor-pointer"
          style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', boxShadow: '0 0 40px rgba(34,211,238,0.4)', transition: 'transform 0.2s', letterSpacing: '0.15em' }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        >
          开始测试
        </button>
        <p className="font-mono text-xs mt-12" style={{ color: 'rgba(148,163,184,0.4)' }}>
          ⚠️ 本测试纯属娱乐，不构成任何心理学建议。<br />
          如果结果像你，那是巧合。如果不像，也是巧合。
        </p>
      </div>
    </div>
  );
}

function QuestionScreen({ question, index, total, onAnswer }) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey(prev => prev + 1); }, [index]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>Q{index + 1}</span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{index + 1}/{total}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
        </div>
        <div key={`q-${animKey}`} className="animate-fade-in">
          <h2 className="text-xl font-bold mb-8" style={{ lineHeight: 1.6 }}>{question.text}</h2>
          <div className="flex flex-col gap-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className="option-btn animate-slide-in"
                style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
                onClick={() => onAnswer(opt)}
              >
                <span className="font-mono text-xs mr-3" style={{ color: 'var(--accent)' }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ personality, traits, onRestart }) {
  const topTraits = getTopTraits(traits);
  const cardRef = useRef(null);
  const [shareImg, setShareImg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const maxTrait = Math.max(...Object.values(traits).map(v => Math.max(0, v)), 1);

  const traitLabels = {
    hw: "硬件亲和力", sw: "代码亲和力", perf: "完美主义",
    ai: "AI依赖度", proc: "拖延指数", solo: "独狼指数",
    doom: "存在危机", grind: "肝帝指数", chaos: "混沌能量", debug: "debug耐力"
  };

  const generateShareCard = useCallback(async () => {
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      // Wait for fonts to load
      await document.fonts.ready;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0f',
        scale: 2,
        useCORS: true,
        logging: false,
        width: cardRef.current.scrollWidth,
        height: cardRef.current.scrollHeight,
      });
      setShareImg(canvas.toDataURL('image/png'));
    } catch (err) { console.error(err); }
    setGenerating(false);
  }, []);

  const downloadImage = useCallback(() => {
    if (!shareImg) return;
    const a = document.createElement('a');
    a.href = shareImg;
    a.download = `QQTI_${personality.code}.png`;
    a.click();
  }, [shareImg, personality]);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg animate-fade-in">
        <div ref={cardRef} style={{
          background: '#141420',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: '20px',
          padding: '40px',
          position: 'relative',
          overflow: 'hidden',
          borderTop: `4px solid ${personality.color}`,
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '0.1em', marginBottom: '12px', color: '#94a3b8' }}>你的??TI人格是</div>
            <div style={{ fontSize: '48px', marginBottom: '12px', lineHeight: 1 }}>{personality.emoji}</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '28px', fontWeight: 'bold', marginBottom: '4px', color: personality.color }}>{personality.code}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#e2e8f0' }}>{personality.name}</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#94a3b8' }}>{personality.tagline}</div>
          </div>
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', margin: '24px 0' }} />
          <p style={{ fontSize: '14px', lineHeight: 1.8, marginBottom: '24px', color: '#94a3b8' }}>{personality.desc}</p>
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', margin: '24px 0' }} />
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', marginBottom: '16px', color: '#94a3b8' }}>维度分析</div>
            <div>
              {Object.entries(traits)
                .sort(([, a], [, b]) => b - a)
                .map(([key, val]) => (
                  <div key={key} style={{ display: 'table', width: '100%', tableLayout: 'fixed', marginBottom: '12px' }}>
                    <div style={{ display: 'table-row' }}>
                      <span style={{ display: 'table-cell', fontSize: '12px', color: '#e2e8f0', width: '80px', verticalAlign: 'middle', paddingBottom: '4px' }}>{traitLabels[key]}</span>
                      <span style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '4px' }}>
                        <div style={{ height: '6px', background: 'rgba(148,163,184,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '3px', width: `${Math.max(0, (val / maxTrait) * 100)}%`, background: personality.color, transition: 'width 0.8s ease' }} />
                        </div>
                      </span>
                      <span style={{ display: 'table-cell', fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#94a3b8', width: '32px', textAlign: 'right', verticalAlign: 'middle', paddingBottom: '4px' }}>{Math.max(0, val)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', marginBottom: '12px', color: '#94a3b8' }}>你的前三特质</div>
            <div>
              {topTraits.map((t) => (
                <span key={t.key} style={{
                  display: 'inline-block',
                  fontFamily: "'Space Mono', monospace", fontSize: '12px',
                  padding: '5px 14px', borderRadius: '9999px',
                  background: 'rgba(34,211,238,0.15)', color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.2)',
                  marginRight: '8px', marginBottom: '8px',
                  lineHeight: '1.4',
                }}>
                  #{t.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: 'rgba(148,163,184,0.3)' }}>??TI · EE-CE-CS Type Indicator</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={generateShareCard} disabled={generating}
            className="flex-1 py-3 rounded-xl font-bold text-sm cursor-pointer"
            style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', opacity: generating ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {generating ? '生成中...' : '📸 生成分享图'}
          </button>
          <button onClick={onRestart}
            className="flex-1 py-3 rounded-xl font-bold text-sm cursor-pointer"
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid rgba(148,163,184,0.15)', transition: 'all 0.2s' }}>
            🔄 重新测试
          </button>
        </div>

        {shareImg && (
          <div className="mt-6 animate-fade-in">
            <div className="text-center mb-3">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>长按保存或点击下载</span>
            </div>
            <img src={shareImg} alt="??TI分享卡片" className="w-full rounded-xl" style={{ border: '1px solid rgba(148,163,184,0.1)' }} />
            <button onClick={downloadImage} className="w-full mt-3 py-3 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: 'var(--bg-card)', color: 'var(--accent)', border: '1px solid rgba(34,211,238,0.2)' }}>
              💾 下载图片
            </button>
          </div>
        )}

        <p className="font-mono text-xs mt-8 text-center" style={{ color: 'rgba(148,163,184,0.3)' }}>
          本测试纯属娱乐，不代表你的真实能力。<br />你比任何标签都要复杂。
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState('start');
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [traits, setTraits] = useState(null);

  const handleStart = () => {
    setShuffledQuestions(shuffle(questions));
    setCurrentQ(0);
    setAnswers([]);
    setPhase('quiz');
  };

  const handleAnswer = (option) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);
    if (currentQ + 1 >= shuffledQuestions.length) {
      const t = calculateTraits(newAnswers);
      setTraits(t);
      setResult(matchPersonality(t));
      setPhase('result');
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  const handleRestart = () => {
    setPhase('start');
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
    setTraits(null);
  };

  return (
    <>
      <div className="noise-bg" />
      <div className="grid-bg" />
      <div className="scanline" />
      {phase === 'start' && <StartScreen onStart={handleStart} />}
      {phase === 'quiz' && shuffledQuestions.length > 0 && (
        <QuestionScreen question={shuffledQuestions[currentQ]} index={currentQ} total={shuffledQuestions.length} onAnswer={handleAnswer} />
      )}
      {phase === 'result' && result && (
        <ResultScreen personality={result} traits={traits} onRestart={handleRestart} />
      )}
    </>
  );
}
