const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

const settings = {
	dimensions: [ 1080, 1080 ],
	animate: true
};

const params = {
	cols: 32,
	rows: 24,
	darkThreshold: 140,
	cycleDuration: 280,
	noiseFreq: 0.12,
	padRatio: 0.08,
};

const sketch = async ({ context, width, height }) => {
	// Load the photograph
	const img = await new Promise((resolve, reject) => {
		const i = new Image();
		i.onload = () => resolve(i);
		i.onerror = reject;
		i.src = 'building.webp';
	});

	// Pre-compute brightness grid from the image
	const offCanvas = document.createElement('canvas');
	offCanvas.width = width;
	offCanvas.height = height;
	const offCtx = offCanvas.getContext('2d');
	offCtx.drawImage(img, 0, 0, width, height);
	const pixels = offCtx.getImageData(0, 0, width, height).data;

	const cellW = width / params.cols;
	const cellH = height / params.rows;
	const brightnessGrid = [];

	for (let r = 0; r < params.rows; r++) {
		for (let co = 0; co < params.cols; co++) {
			const x0 = Math.floor(co * cellW);
			const y0 = Math.floor(r * cellH);
			const x1 = Math.floor((co + 1) * cellW);
			const y1 = Math.floor((r + 1) * cellH);

			let totalBrightness = 0;
			let count = 0;
			for (let py = y0; py < y1; py += 2) {
				for (let px = x0; px < x1; px += 2) {
					const idx = (py * width + px) * 4;
					const lum = pixels[idx] * 0.299 + pixels[idx+1] * 0.587 + pixels[idx+2] * 0.114;
					totalBrightness += lum;
					count++;
				}
			}

			const avg = totalBrightness / count;
			brightnessGrid.push({
				col: co, row: r,
				brightness: avg,
				isDark: avg < params.darkThreshold
			});
		}
	}

	return ({ context, width, height, frame }) => {
		// Draw photograph
		const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
		const iw = img.naturalWidth * scale;
		const ih = img.naturalHeight * scale;
		context.drawImage(img, (width - iw) / 2, (height - ih) / 2, iw, ih);

		const pad = Math.min(cellW, cellH) * params.padRatio;
		const cycleT = (frame % params.cycleDuration) / params.cycleDuration;

		for (let idx = 0; idx < brightnessGrid.length; idx++) {
			const cell = brightnessGrid[idx];
			if (!cell.isDark) continue;

			const co = cell.col;
			const r = cell.row;
			const darkness = math.mapRange(cell.brightness, params.darkThreshold, 0, 0, 1, true);

			// Noise-based timing offset per cell
			const noiseOffset = (random.noise3D(co * params.noiseFreq, r * params.noiseFreq, 0) + 1) * 0.5;
			const delay = noiseOffset * 0.5 * (1 - darkness * 0.4);

			let localT = cycleT - delay;
			let growth;
			if (localT < 0) {
				const wrappedT = localT + 1;
				growth = wrappedT > 0.5 ? math.mapRange(wrappedT, 0.5, 1, 0, 1, true) : 0;
			} else {
				growth = math.mapRange(localT, 0, 0.5, 0, 1, true);
			}

			if (growth <= 0.001) continue;

			const cx = co * cellW + cellW * 0.5;
			const cy = r * cellH + cellH * 0.5;
			const blockScale = 0.2 + growth * 0.8;
			const bw = (cellW - pad) * blockScale;
			const bh = (cellH - pad) * blockScale;

			const alpha = math.mapRange(growth, 0, 0.6, 0.4, 0.9, true) * math.mapRange(darkness, 0, 1, 0.5, 1);
			const lineW = math.mapRange(growth, 0, 1, 1.5, 2.5);

			context.save();

			context.shadowColor = `rgba(57, 255, 20, ${alpha * 0.6})`;
			context.shadowBlur = math.mapRange(growth, 0, 1, 4, 14);

			context.strokeStyle = `rgba(57, 255, 20, ${alpha})`;
			context.lineWidth = lineW;
			context.strokeRect(cx - bw/2, cy - bh/2, bw, bh);

			if (growth < 0.5) {
				const fillAlpha = math.mapRange(growth, 0, 0.5, 0.25, 0) * darkness;
				context.fillStyle = `rgba(57, 255, 20, ${fillAlpha})`;
				context.fillRect(cx - bw/2, cy - bh/2, bw, bh);
			}

			context.restore();
		}
	};
};

canvasSketch(sketch, settings);
