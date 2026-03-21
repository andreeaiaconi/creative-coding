const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

const settings = {
	dimensions: [ 1080, 1080 ],
	animate: true
};

/* ---- Marching Squares ---- */
const EDGE_TABLE = [
	[],[[3,2]],[[2,1]],[[3,1]],[[1,0]],[[3,0],[1,2]],[[2,0]],[[3,0]],
	[[0,3]],[[0,2]],[[0,1],[2,3]],[[0,1]],[[1,3]],[[1,2]],[[2,3]],[]
];
const EDGE_CORNERS = [[0,1],[1,2],[3,2],[0,3]];
const CORNER_XY = [[0,0],[1,0],[1,1],[0,1]];

function extractContours(grid, gw, gh, threshold, sx, sy) {
	const segs = [];
	for (let r = 0; r < gh - 1; r++) {
		for (let c = 0; c < gw - 1; c++) {
			const vals = [
				grid[r*gw+c], grid[r*gw+c+1],
				grid[(r+1)*gw+c+1], grid[(r+1)*gw+c]
			];
			const ci = ((vals[0]<threshold?1:0)<<3)|((vals[1]<threshold?1:0)<<2)|
			           ((vals[2]<threshold?1:0)<<1)|(vals[3]<threshold?1:0);
			const edges = EDGE_TABLE[ci];
			if (!edges.length) continue;

			for (const [e1, e2] of edges) {
				const [a1,b1] = EDGE_CORNERS[e1];
				const [a2,b2] = EDGE_CORNERS[e2];
				const t1 = vals[a1]===vals[b1] ? 0.5 : (threshold-vals[a1])/(vals[b1]-vals[a1]);
				const t2 = vals[a2]===vals[b2] ? 0.5 : (threshold-vals[a2])/(vals[b2]-vals[a2]);
				const x1 = (c+CORNER_XY[a1][0]+t1*(CORNER_XY[b1][0]-CORNER_XY[a1][0]))*sx;
				const y1 = (r+CORNER_XY[a1][1]+t1*(CORNER_XY[b1][1]-CORNER_XY[a1][1]))*sy;
				const x2 = (c+CORNER_XY[a2][0]+t2*(CORNER_XY[b2][0]-CORNER_XY[a2][0]))*sx;
				const y2 = (r+CORNER_XY[a2][1]+t2*(CORNER_XY[b2][1]-CORNER_XY[a2][1]))*sy;
				segs.push({ x1, y1, x2, y2, mx:(x1+x2)/2, my:(y1+y2)/2 });
			}
		}
	}
	return segs;
}

/* ---- Config ---- */
const gridRes = 220;
const NOISE_FREQ = 0.003;
const NOISE_SPEED = 0.006;
const LEVELS = [
	{ threshold: 45,  lineWidth: 3.0, alpha: 1.0  },
	{ threshold: 80,  lineWidth: 2.4, alpha: 0.88 },
	{ threshold: 115, lineWidth: 1.8, alpha: 0.72 },
	{ threshold: 155, lineWidth: 1.0, alpha: 0.55 },
];

const sketch = async ({ width, height }) => {
	const img = await new Promise((resolve, reject) => {
		const i = new Image();
		i.onload = () => resolve(i);
		i.onerror = reject;
		i.src = 'building.webp';
	});

	const off = document.createElement('canvas');
	off.width = width; off.height = height;
	const oc = off.getContext('2d');
	oc.drawImage(img, 0, 0, width, height);
	const px = oc.getImageData(0, 0, width, height).data;

	const aspect = width / height;
	const gw = gridRes;
	const gh = Math.round(gridRes / aspect);
	const sx = width / (gw - 1);
	const sy = height / (gh - 1);

	const grid = new Float32Array(gw * gh);
	for (let gy = 0; gy < gh; gy++) {
		for (let gx = 0; gx < gw; gx++) {
			const ix = Math.min(Math.round(gx * sx), width - 1);
			const iy = Math.min(Math.round(gy * sy), height - 1);
			const idx = (iy * width + ix) * 4;
			grid[gy * gw + gx] = px[idx]*0.299 + px[idx+1]*0.587 + px[idx+2]*0.114;
		}
	}

	const contourLayers = LEVELS.map(lv => ({
		segments: extractContours(grid, gw, gh, lv.threshold, sx, sy),
		lineWidth: lv.lineWidth,
		alpha: lv.alpha,
	}));

	function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

	return ({ context, width, height, frame }) => {
		const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
		const iw = img.naturalWidth * scale;
		const ih = img.naturalHeight * scale;
		context.drawImage(img, (width-iw)/2, (height-ih)/2, iw, ih);

		const time = frame * NOISE_SPEED;

		for (let li = 0; li < contourLayers.length; li++) {
			const layer = contourLayers[li];
			const layerDelay = li * 0.12;

			const buckets = [
				{ minVis: 0.75, segs: [] },
				{ minVis: 0.4,  segs: [] },
				{ minVis: 0.05, segs: [] },
			];

			for (const seg of layer.segments) {
				const n = (random.noise3D(seg.mx * NOISE_FREQ, seg.my * NOISE_FREQ, time) + 1) * 0.5;
				const vis = clamp01((n - layerDelay) * 2.5);
				if (vis < 0.05) continue;
				if (vis >= 0.75)     buckets[0].segs.push(seg);
				else if (vis >= 0.4) buckets[1].segs.push(seg);
				else                 buckets[2].segs.push(seg);
			}

			for (const bucket of buckets) {
				if (!bucket.segs.length) continue;
				const visAvg = bucket.minVis + 0.15;
				const a = layer.alpha * visAvg;

				context.save();
				context.lineCap = 'round';
				context.strokeStyle = `rgba(57, 255, 20, ${a})`;
				context.lineWidth = layer.lineWidth * (0.5 + visAvg * 0.5);
				context.shadowColor = `rgba(57, 255, 20, ${a * 0.55})`;
				context.shadowBlur = 6 + visAvg * 10;

				context.beginPath();
				for (const s of bucket.segs) {
					context.moveTo(s.x1, s.y1);
					context.lineTo(s.x2, s.y2);
				}
				context.stroke();
				context.restore();
			}
		}
	};
};

canvasSketch(sketch, settings);
