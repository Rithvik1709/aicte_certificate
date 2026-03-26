import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const initialForm = {
  name: '',
  fromDate: '',
  toDate: '',
  activity: '',
  hours: '',
};

function formatDate(date) {
  if (!date) return '__________';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function MatrixSnakeOverlay() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = 18;
    const baseSpeedMs = 95;
    let animationFrame = 0;
    let lastTick = 0;
    let cols = 0;
    let rows = 0;
    let snake = [];
    let direction = { x: 1, y: 0 };
    let targetLength = 12;
    let foods = [];

    const symbols = ['0', '1', '7', 'Σ', 'λ'];

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const samePoint = (a, b) => a.x === b.x && a.y === b.y;

    const isSnakeCell = (point, includeTail = true) => {
      const limit = includeTail ? snake.length : Math.max(0, snake.length - 1);
      for (let i = 0; i < limit; i += 1) {
        if (samePoint(snake[i], point)) return true;
      }
      return false;
    };

    const spawnFood = () => {
      for (let i = 0; i < 120; i += 1) {
        const next = { x: randomInt(1, cols - 2), y: randomInt(1, rows - 2) };
        if (!isSnakeCell(next) && !foods.some((f) => samePoint(f, next))) {
          foods.push(next);
          return;
        }
      }
    };

    const ensureFood = () => {
      const wanted = Math.max(8, Math.floor((cols * rows) / 500));
      while (foods.length < wanted) spawnFood();
    };

    const resetWorld = () => {
      cols = Math.max(24, Math.floor(window.innerWidth / cell));
      rows = Math.max(14, Math.floor(window.innerHeight / cell));

      snake = [];
      const sx = Math.floor(cols / 2);
      const sy = Math.floor(rows / 2);
      for (let i = 0; i < 12; i += 1) {
        snake.push({ x: sx - i, y: sy });
      }

      direction = { x: 1, y: 0 };
      targetLength = 12;
      foods = [];
      ensureFood();
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetWorld();
    };

    const dirOptionsTowards = (head, target) => {
      const options = [];
      const dx = target.x - head.x;
      const dy = target.y - head.y;

      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx !== 0) options.push({ x: Math.sign(dx), y: 0 });
        if (dy !== 0) options.push({ x: 0, y: Math.sign(dy) });
      } else {
        if (dy !== 0) options.push({ x: 0, y: Math.sign(dy) });
        if (dx !== 0) options.push({ x: Math.sign(dx), y: 0 });
      }

      options.push(direction);
      options.push({ x: direction.y, y: -direction.x });
      options.push({ x: -direction.y, y: direction.x });
      return options;
    };

    const pickDirection = () => {
      const head = snake[0];
      if (!head) return;

      let nearestFood = foods[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      foods.forEach((food) => {
        const dist = Math.abs(food.x - head.x) + Math.abs(food.y - head.y);
        if (dist < bestDistance) {
          bestDistance = dist;
          nearestFood = food;
        }
      });

      const candidates = dirOptionsTowards(head, nearestFood || head);
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (candidate.x === -direction.x && candidate.y === -direction.y) continue;

        const nx = (head.x + candidate.x + cols) % cols;
        const ny = (head.y + candidate.y + rows) % rows;
        const next = { x: nx, y: ny };
        if (!isSnakeCell(next, false)) {
          direction = candidate;
          return;
        }
      }
    };

    const step = () => {
      if (!snake.length) return;

      pickDirection();
      const head = snake[0];
      const nextHead = {
        x: (head.x + direction.x + cols) % cols,
        y: (head.y + direction.y + rows) % rows,
      };

      const biteIndex = snake.findIndex((segment) => samePoint(segment, nextHead));
      if (biteIndex !== -1) {
        snake = snake.slice(0, Math.max(3, biteIndex));
        targetLength = Math.max(8, snake.length);
      }

      snake.unshift(nextHead);

      const eatenIndex = foods.findIndex((food) => samePoint(food, nextHead));
      if (eatenIndex !== -1) {
        foods.splice(eatenIndex, 1);
        targetLength += 2;
      }

      while (snake.length > targetLength) {
        snake.pop();
      }

      ensureFood();
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      foods.forEach((food, index) => {
        const x = food.x * cell;
        const y = food.y * cell;
        const pulse = 0.55 + 0.45 * Math.sin((Date.now() / 220) + index);

        ctx.fillStyle = `rgba(150, 255, 170, ${0.25 + pulse * 0.4})`;
        ctx.fillRect(x + 5, y + 5, 8, 8);

        ctx.font = '13px "Share Tech Mono", monospace';
        ctx.fillStyle = `rgba(180, 255, 190, ${0.55 + pulse * 0.35})`;
        ctx.fillText(symbols[index % symbols.length], x + 2, y + 14);
      });

      snake.forEach((segment, i) => {
        const x = segment.x * cell;
        const y = segment.y * cell;
        const fade = 1 - i / Math.max(snake.length, 1);

        ctx.fillStyle = `rgba(120, 255, 140, ${0.2 + fade * 0.7})`;
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      });

      const head = snake[0];
      if (head) {
        const hx = head.x * cell;
        const hy = head.y * cell;
        ctx.fillStyle = '#dcffe5';
        ctx.fillRect(hx + 1, hy + 1, cell - 2, cell - 2);
      }
    };

    const loop = (time) => {
      if (!lastTick) lastTick = time;
      if (time - lastTick >= baseSpeedMs) {
        step();
        lastTick = time;
      }

      draw();
      animationFrame = window.requestAnimationFrame(loop);
    };

    resize();
    animationFrame = window.requestAnimationFrame(loop);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-snake-canvas" aria-hidden="true" />;
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [certificateData, setCertificateData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hoursWarning, setHoursWarning] = useState('');
  const certificateRef = useRef(null);

  const onChange = (e) => {
    const { name, value } = e.target;

    if (name === 'hours') {
      if (value && Number(value) > 80) {
        setHoursWarning('really?');
      } else {
        setHoursWarning('');
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();

    if (Number(form.hours) > 80) {
      setHoursWarning('really?');
      return;
    }

    setHoursWarning('');

    setCertificateData(form);
  };

  const getCertificateCanvas = async () => {
    return html2canvas(certificateRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
  };

  const downloadCertificate = async (format) => {
    if (!certificateRef.current || !certificateData) return;

    try {
      setIsDownloading(true);
      const canvas = await getCertificateCanvas();
      const baseFileName = `${certificateData.name || 'certificate'}-certificate`;

      if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${baseFileName}.pdf`);
        return;
      }

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpg' ? 0.95 : undefined;
      const imageData = canvas.toDataURL(mimeType, quality);
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `${baseFileName}.${format}`;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="page">
      <MatrixSnakeOverlay />

      <div className="ui-layer">
        <h1>Certificate Generator</h1>

        <form className="form" onSubmit={onSubmit}>
          <label>
            Name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Enter full name"
              required
            />
          </label>

          <label>
            From Date
            <input
              type="date"
              name="fromDate"
              value={form.fromDate}
              onChange={onChange}
              required
            />
          </label>

          <label>
            To Date
            <input
              type="date"
              name="toDate"
              value={form.toDate}
              onChange={onChange}
              required
            />
          </label>

          <label>
            Activity Name
            <input
              type="text"
              name="activity"
              value={form.activity}
              onChange={onChange}
              placeholder="e.g. AICTE Internship Program"
              required
            />
          </label>

          <label>
            Number of Hours
            <input
              type="number"
              min="1"
              name="hours"
              value={form.hours}
              onChange={onChange}
              placeholder="e.g. 40"
              required
            />
          </label>

          <button type="submit">Submit</button>
        </form>

        <div className="actions">
          <button
            type="button"
            onClick={() => downloadCertificate('pdf')}
            disabled={!certificateData || isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download Certificate (PDF)'}
          </button>
          <button
            type="button"
            onClick={() => downloadCertificate('png')}
            disabled={!certificateData || isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download Certificate (PNG)'}
          </button>
          <button
            type="button"
            onClick={() => downloadCertificate('jpg')}
            disabled={!certificateData || isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download Certificate (JPG)'}
          </button>
        </div>

        <div className="question-box">
          <p>did you do activity after oct 2025?</p>
          <a className="question-link" href="/post-oct-2025.html">
            click me
          </a>
        </div>

        <div className="certificate-hidden-render" aria-hidden="true">
          <div className="certificate" ref={certificateRef}>
            <img className="certificate-template" src="/Frame 4.png" alt="Certificate template" />

            <div className="overlay name-field">{certificateData?.name || 'Your Name Here'}</div>
            <div className="overlay summary-field">
              for successfully completing <span className="input-value">{certificateData?.hours || '00'}</span>{' '}
              hours on activity "<span className="input-value">{certificateData?.activity || 'Activity Name'}</span>" from{' '}
              <span className="input-value">{formatDate(certificateData?.fromDate)}</span> to{' '}
              <span className="input-value">{formatDate(certificateData?.toDate)}</span>.
            </div>
          </div>
        </div>

        {hoursWarning && (
          <div className="ui-popup" role="alertdialog" aria-modal="true" aria-label="Hours warning">
            <div className="ui-popup-card">
              <p>{hoursWarning}</p>
              <button type="button" onClick={() => setHoursWarning('')}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
