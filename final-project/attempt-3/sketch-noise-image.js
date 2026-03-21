const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

const settings = {
	dimensions: [ 1080, 1080 ],
	animate: true
};

/* ---- Marching Squares filled polygon tables ---- */
const CXY = [[0,0],[1,0],[1,1],[0,1]];
const EDEF = { 4:[0,1], 5:[1,2], 6:[3,2], 7:[0,3] };
const FILL = [
	[],[[7,3,6]],[[6,2,5]],[[7,3,2,5]],[[4,1,5]],[[4,1,5],[7,3,6]],
	[[4,1,2,6]],[[4,1,2,3,7]],[[0,4,7]],[[0,4,6,3]],[[0,4,7],[6,2,5]],
	[[0,4,5,2,3]],[[0,1,5,7]],[[0,1,5,6,3]],[[0,1,2,6,7]],[[0,1,2,3]]
];

/* ---- Config ---- */
const GRID_W = 75;
const NOISE_FREQ = 0.004;
const NOISE_SPEED = 0.005;
const LEVELS = [
	{ threshold: 55,  alpha: 0.88 },
	{ threshold: 95,  alpha: 0.65 },
	{ threshold: 140, alpha: 0.42 },
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

	const gw = GRID_W;
	const gh = Math.round(GRID_W * (height / width));
	const scX = width / (gw - 1);
	const scY = height / (gh - 1);

	const grid = new Float32Array(gw * gh);
	for (let gy = 0; gy < gh; gy++) {
		for (let gx = 0; gx < gw; gx++) {
			const ix = Math.min(Math.round(gx * scX), width - 1);
			const iy = Math.min(Math.round(gy * scY), height - 1);
			const idx = (iy * width + ix) * 4;
			grid[gy * gw + gx] = px[idx] * 0.299 + px[idx+1] * 0.587 + px[idx+2] * 0.114;
		}
	}

	function vertexPos(vid, col, row, vals, th) {
		if (vid <= 3) return [(col + CXY[vid][0]) * scX, (row + CXY[vid][1]) * scY];
		const [ca, cb] = EDEF[vid];
		const va = vals[ca], vb = vals[cb];
		let t = va === vb ? 0.5 : (th - va) / (vb - va);
		t = Math.max(0, Math.min(1, t));
		return [
			(col + CXY[ca][0] + t * (CXY[cb][0] - CXY[ca][0])) * scX,
			(row + CXY[ca][1] + t * (CXY[cb][1] - CXY[ca][1])) * scY,
		];
	}

	const shapeLayers = [];
	for (const lv of LEVELS) {
		const cells = [];
		for (let row = 0; row < gh - 1; row++) {
			for (let col = 0; col < gw - 1; col++) {
				const vals = [
					grid[row*gw+col], grid[row*gw+col+1],
					grid[(row+1)*gw+col+1], grid[(row+1)*gw+col]
				];
				const ci = ((vals[0]<lv.threshold?1:0)<<3)|((vals[1]<lv.threshold?1:0)<<2)|
				           ((vals[2]<lv.threshold?1:0)<<1)|(vals[3]<lv.threshold?1:0);
				const polyDefs = FILL[ci];
				if (!polyDefs.length) continue;
				const polys = polyDefs.map(vids =>
					vids.map(v => vertexPos(v, col, row, vals, lv.threshold))
				);
				cells.push({ polys, mx: (col+0.5)*scX, my: (row+0.5)*scY });
			}
		}
		shapeLayers.push({ cells, alpha: lv.alpha });
	}

	function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

	return ({ context, width, height, frame }) => {
		const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
		const iw = img.naturalWidth * scale;
		const ih = img.naturalHeight * scale;
		context.drawImage(img, (width-iw)/2, (height-ih)/2, iw, ih);

		const time = frame * NOISE_SPEED;

		for (let li = shapeLayers.length - 1; li >= 0; li--) {
			const layer = shapeLayers[li];
			const layerDelay = li * 0.10;
			const buckets = [[], [], []];

			for (const cell of layer.cells) {
				const n = (random.noise3D(cell.mx * NOISE_FREQ, cell.my * NOISE_FREQ, time) + 1) * 0.5;
				const vis = clamp01((n - layerDelay) * 2.2);
				if (vis < 0.03) continue;
				if (vis >= 0.65)      buckets[0].push(cell);
				else if (vis >= 0.3)  buckets[1].push(cell);
				else                  buckets[2].push(cell);
			}

			const visLevels = [0.85, 0.5, 0.18];
			for (let bi = 0; bi < 3; bi++) {
				if (!buckets[bi].length) continue;
				const a = layer.alpha * visLevels[bi];

				context.save();
				context.fillStyle = `rgba(57, 255, 20, ${a})`;
				context.shadowColor = `rgba(57, 255, 20, ${a * 0.45})`;
				context.shadowBlur = 6 + visLevels[bi] * 10;

				context.beginPath();
				for (const cell of buckets[bi]) {
					for (const poly of cell.polys) {
						context.moveTo(poly[0][0], poly[0][1]);
						for (let k = 1; k < poly.length; k++) context.lineTo(poly[k][0], poly[k][1]);
						context.closePath();
					}
				}
				context.fill();
				context.restore();
			}
		}
	};
};

canvasSketch(sketch, settings);
