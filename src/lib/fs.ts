export function getfs() {
	window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
	return new Promise<FileSystem>(function (resolve, reject) {
		window.requestFileSystem(window.PERSISTENT, 1024 * 1024 * 1024 * 100, resolve, reject);
	});
}

export function getDirectory(fs: FileSystem, path: string) {
	return new Promise<FileSystemDirectoryEntry>(function (resolve, reject) {
		fs.root.getDirectory(path, {}, resolve, reject);
	});
}

export function getDirectoryFromRoot(root: FileSystemDirectoryEntry, path: string) {
	return new Promise<FileSystemDirectoryEntry>(function (resolve, reject) {
		root.getDirectory(path, {}, resolve, reject);
	});
}

export function listEntries(dir: FileSystemDirectoryEntry) {
	return new Promise<FileSystemEntry[]>(function (resolve, reject) {
		const der = dir.createReader();
		der.readEntries(resolve, reject);
	});
}

export function createDir(dir: FileSystemDirectoryEntry, name: string) {
	return new Promise<FileSystemDirectoryEntry>(function (resolve, reject) {
		dir.getDirectory(name, { create: true, exclusive: false }, resolve, reject);
	});
}

export function createFile(dir: FileSystemDirectoryEntry, path: string) {
	return new Promise<FileEntry>(function (resolve, reject) {
		dir.getFile(path, { create: true, exclusive: false }, resolve, reject);
	});
}

export function getFile(dir: FileSystemDirectoryEntry, path: string) {
	return new Promise<FileEntry>(function (resolve, reject) {
		dir.getFile(path, { create: false, exclusive: false }, resolve, reject);
	});
}

export function createWriter(fe: FileEntry) {
	return new Promise<FileWriter>(function (resolve, reject) {
		fe.createWriter(resolve, reject);
	});
}

export function writeFile(fw: FileWriter, blob: Blob) {
	return new Promise<number>(function (resolve, reject) {
		fw.write(blob);
		fw.onwriteend = (pevt: ProgressEvent) => resolve(pevt.total);
	});
}

export function getMetaData(fse: FileSystemEntry) {
	return new Promise<Metadata>(function (resolve, reject) {
		fse.getMetadata(resolve, reject);
	});
}

export function removeFile(fse: FileSystemEntry) {
	return new Promise<void>(function (resolve, reject) {
		fse.remove(resolve, reject);
	});
}

export function toFile(fe: FileEntry) {
	return new Promise<File>(function (resolve, reject) {
		fe.file(resolve, reject);
	});
}

export async function removePath(root: FileSystemDirectoryEntry, path: string) {
	try {
		const fe = await getFile(root, path);
		await removeFile(fe);
	} catch (e) {
		console.log('could not remove', path, e);
	}
	try {
		// this loop stops at the first non-empty directory; no need to check if dir is empty.
		for (;;) {
			const x = path.lastIndexOf('/');
			if (x <= 0) break;
			path = path.substring(0, x);
			const fsde = await getDirectoryFromRoot(root, path);
			await removeFile(fsde);
		}
	} catch (e) {}
}

export async function walkFS(dir: FileSystemDirectoryEntry, indent: string) {
	// console.log(indent + dir.fullPath);
	let entries = await listEntries(dir);
	for (const fse of entries) {
		console.log(indent + fse.fullPath);
		if (fse.isDirectory) {
			await walkFS(fse as FileSystemDirectoryEntry, indent + '  ');
		} else {
			const md = await getMetaData(fse);
			console.log(indent + md.modificationTime + ',' + md.size);
		}
	}
}

export async function fetchBlob(root: FileSystemDirectoryEntry, path: string) {
	const fe = await getFile(root, path);
	const f = await toFile(fe);
	const blob = new Blob([f]);
	return URL.createObjectURL(blob);
}
