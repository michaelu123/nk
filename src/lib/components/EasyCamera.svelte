<script lang="ts">
	// https://www.npmjs.com/package/@cloudparker/easy-camera-svelte

	type Props = {
		width?: number;
		style?: string;
		autoOpen?: boolean;
		mirrorDisplay?: boolean;
		useFrontCamera?: boolean;
		ideal?: number;
		onImage?: (imageDate: ImageData | string) => void;
		onOpen?: () => void;
		onClose?: () => void;
		onInit?: (devices: MediaDeviceInfo[]) => void;
	};

	let {
		width = $bindable(600),
		style = '',
		autoOpen = true,
		mirrorDisplay = $bindable(true),
		useFrontCamera = true,
		ideal = 1024,
		onImage,
		onOpen,
		onClose,
		onInit
	}: Props = $props();

	let isOpened: boolean;
	let videoRef: HTMLVideoElement | null = $state(null);
	$inspect(videoRef);
	let canvasRef: HTMLCanvasElement;
	let stream: MediaStream | null;
	let ctx: CanvasRenderingContext2D;
	let mediaRecorder: MediaRecorder | null;
	let recordedChunks: Blob[] = [];
	let cameras: MediaDeviceInfo[];
	let frontCamera: MediaDeviceInfo;
	let rearCamera: MediaDeviceInfo;
	let isPause: boolean = false;

	let imageCapture: ImageCapture | null = null;
	let videoHeight = $state(0);
	let videoWidth = $state(0);

	let height: number = $derived.by(() => {
		console.log('height', videoRef, videoHeight, videoWidth);
		let ratio = videoWidth == 0 ? 1 : videoHeight / videoWidth;
		return width * ratio;
	});

	export const takePhoto = async (): Promise<Blob | null> => {
		if (imageCapture) {
			const cap = await imageCapture.getPhotoCapabilities();
			console.log('cap', cap);
			const b: Blob = await imageCapture.takePhoto({
				fillLightMode: 'off'
				// imageWidth: cap.imageWidth.max
			});
			return b;
		}
		return null;
	};

	export const captureImage = async (isImageData?: boolean): Promise<ImageData | string | null> => {
		let imageData: any = null;
		console.log('1ci', ctx);
		if (ctx && canvasRef && isOpened) {
			if (isImageData) {
				console.log('2ci');
				imageData = ctx.getImageData(0, 0, width, height);
				console.log('3ci', imageData);
			} else {
				imageData = canvasRef.toDataURL();
			}

			onImage && onImage(imageData);
			return imageData;
		}
		return imageData;
	};

	export const open = (): void => {
		if (canvasRef) {
			openCamera();
		}
	};

	export const close = (): void => {
		if (canvasRef) {
			closeCamera();
		}
	};

	export const isPlaying = (): boolean => {
		return isOpened;
	};

	export const isRecording = (): boolean => {
		return !!mediaRecorder;
	};

	export const switchCamera = (deviceId?: string): void => {
		useFrontCamera = !useFrontCamera;
		openCamera(deviceId);
	};

	export const getCameraDevices = async (): Promise<MediaDeviceInfo[]> => {
		console.log('1getCameraDevices');
		let devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
		console.log('2getCameraDevices', devices);
		const cameras: MediaDeviceInfo[] = [];
		(devices || []).forEach((device: MediaDeviceInfo) => {
			if (device.kind === 'videoinput') {
				cameras.push(device);
				if (device.label.includes('front')) {
					frontCamera = device;
				} else {
					rearCamera = device;
				}
			}
		});
		return cameras;
	};

	const handleOpen = () => {
		isOpened = true;
		onOpen && onOpen();
	};

	const handleClose = () => {
		onClose && onClose();
	};

	const initCamera = async () => {
		if (videoRef && canvasRef) {
			ctx = canvasRef.getContext('2d', { willReadFrequently: true })!;
			videoRef.addEventListener('canplay', () => {
				console.log('canplay', videoRef!.videoHeight, videoRef!.videoWidth);
				videoHeight = videoRef!.videoHeight;
				videoWidth = videoRef!.videoWidth;
				// adjustResolution(width);
				// ctx.drawImage(videoRef, 0, 0, width, height);
				handleOpen();
				drawCanvas();
			});
			let devices = await getCameraDevices();
			if (devices) {
				onInit && onInit(devices);
			}
			if (autoOpen) {
				openCamera();
			}
		}
	};

	const openCamera = (deviceId?: string) => {
		if (isOpened) {
			closeCamera();
		}

		let video: any =
			//  { width: { ideal: 4096 }, height: { ideal: 2160 } };
			//  { width: { ideal: 1921 } /*, height: { ideal: 2160 }*/ };
			{ width: 1921, height: 1081 };
		//  {
		// 	width: { min: 641, ideal: 1281, max: 1921 },
		// 	height: { min: 361, ideal: 721, max: 1081 }
		// };
		console.log('cameras', useFrontCamera, 'front', frontCamera, 'rear', rearCamera);
		if (deviceId) {
			video.deviceId = deviceId;
		} else {
			if (useFrontCamera && frontCamera) {
				video.deviceId = frontCamera.deviceId;
			} else if (rearCamera) {
				video.deviceId = rearCamera.deviceId;
			}
		}
		let constraints: MediaStreamConstraints = { video, audio: false };
		console.log('constraints', constraints);

		navigator.mediaDevices
			.getUserMedia(constraints)
			.then((mediaStream) => {
				if (videoRef) {
					videoRef.srcObject = mediaStream;
					stream = mediaStream;
					videoRef.play();
				}
				const track = mediaStream.getVideoTracks()[0];
				const cap = track.getCapabilities();
				console.log('cap', cap);
				const maxWidth = cap?.width?.max;
				const maxHeight = cap?.height?.max;
				console.log('cap wxh', maxWidth, maxHeight);
				console.log('constr  track', track.getConstraints());
				const settings = track.getSettings();
				console.log('track settings', settings);
				const tWidth = settings.width;
				const tHeight = settings.height;
				console.log('settings wxh', tWidth, tHeight);
				imageCapture = new ImageCapture(track);
			})
			.catch((error) => {
				console.error('Unable to access the camera.', error);
			});
	};

	const closeCamera = () => {
		if (stream) {
			stream.getTracks().forEach((track) => {
				track.stop();
				stream?.removeTrack(track);
			});
			handleClose();
			if (mediaRecorder) {
				mediaRecorder.stop();
				mediaRecorder = null;
			}
			stream = null;
		}
	};

	const drawCanvas = () => {
		if (videoRef && canvasRef && width && height && isOpened) {
			if (!isPause) {
				if (stream) {
					if (mirrorDisplay) {
						// flip image | mirror image
						ctx.scale(-1, 1);
						ctx.drawImage(videoRef, -width, 0, width, height);
						ctx.scale(-1, 1);
					} else {
						ctx.drawImage(videoRef, 0, 0, width, height);
					}
				}
			}
		}

		requestAnimationFrame(drawCanvas);
	};

	$effect(() => {
		console.log('camera effect');
		initCamera();
		return () => {
			closeCamera();
		};
	});
</script>

<div>
	<video id="camera-video" class="camera-video" bind:this={videoRef} {width} {height} muted>
		<track kind="captions" />
	</video>
	<canvas id="camera-canvas" class="camera-canvas" {style} bind:this={canvasRef} {width} {height}
	></canvas>
</div>

<style>
	.camera-video {
		display: none;
	}
</style>
