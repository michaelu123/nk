// https://stackoverflow.com/questions/42729632/how-to-preload-leaflet-tiles-of-known-bounds-in-browser-cache-for-faster-display
// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

export async function prefetchTiles(
	zoomMin: number,
	zoomMax: number,
	lowerLeft: number[],
	upperRight: number[],
	prefetch: (url: string, progress: number) => Promise<void>
) {
	const east = upperRight[1];
	const west = lowerLeft[1];
	const north = upperRight[0];
	const south = lowerLeft[0];

	let sum = 0;
	for (let zoom = zoomMin; zoom <= zoomMax; zoom++) {
		const zoomPow = Math.pow(2, zoom);
		const dataEast = long2tile(east, zoomPow);
		const dataWest = long2tile(west, zoomPow);
		const dataNorth = lat2tile(north, zoomPow);
		const dataSouth = lat2tile(south, zoomPow);
		sum += (1 + dataSouth - dataNorth) * (1 + dataEast - dataWest);
	}
	let cnt = 0;
	for (let zoom = zoomMin; zoom <= zoomMax; zoom++) {
		const zoomPow = Math.pow(2, zoom);
		const dataEast = long2tile(east, zoomPow);
		const dataWest = long2tile(west, zoomPow);
		const dataNorth = lat2tile(north, zoomPow);
		const dataSouth = lat2tile(south, zoomPow);
		for (let y = dataNorth; y < dataSouth + 1; y++) {
			for (let x = dataWest; x < dataEast + 1; x++) {
				const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
				await prefetch(url, cnt / sum);
				cnt++;
			}
		}
	}
	await prefetch('', 0);
}

function long2tile(lon: number, zoomPow: number): number {
	return Math.floor(((lon + 180) / 360) * zoomPow);
}

function lat2tile(lat: number, zoomPow: number): number {
	return Math.floor(
		((1 -
			Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
			2) *
			zoomPow
	);
}

function tile2long(x: number, zp: number) {
	return (x / zp) * 360 - 180;
}

function tile2lat(y: number, zp: number) {
	var n = Math.PI - (2 * Math.PI * y) / zp;
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
