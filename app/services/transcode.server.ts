import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

// Cache directory configuration
const TRANSCODE_CACHE_DIR = process.env.TRANSCODE_CACHE_DIR || "/tmp/media-browser-cache";

// Browser-compatible formats (no transcoding needed)
const BROWSER_COMPATIBLE_FORMATS = [".mp4", ".webm"];

// Formats that need transcoding
const NEEDS_TRANSCODING_FORMATS = [".avi", ".mkv", ".mov", ".m4v", ".flv", ".wmv"];

interface TranscodeOptions {
  inputPath: string;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

interface TranscodeResult {
  outputPath: string;
  size: number;
}

/**
 * Initialize the cache directory
 */
export async function initializeCache(): Promise<void> {
  try {
    await fs.mkdir(TRANSCODE_CACHE_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Generate a cache key for a video file based on its path and modified time
 */
export async function getCacheKey(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  const hash = crypto.createHash("md5");
  hash.update(filePath + stats.mtime.toISOString());
  return hash.digest("hex");
}

/**
 * Get the cached transcoded file path
 */
export function getCachedFilePath(cacheKey: string): string {
  return path.join(TRANSCODE_CACHE_DIR, `${cacheKey}.mp4`);
}

/**
 * Check if a video format needs transcoding
 */
export function needsTranscoding(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return NEEDS_TRANSCODING_FORMATS.includes(ext);
}

/**
 * Check if a transcoded version exists in cache
 */
export async function hasTranscodedCache(cacheKey: string): Promise<boolean> {
  try {
    const cachedPath = getCachedFilePath(cacheKey);
    await fs.access(cachedPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    ffprobe.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Transcode a video file to browser-compatible format (MP4 with H.264)
 */
export async function transcodeVideo(options: TranscodeOptions): Promise<TranscodeResult> {
  const { inputPath, outputPath, onProgress } = options;

  return new Promise(async (resolve, reject) => {
    // Get video duration for progress calculation
    let duration: number | null = null;
    try {
      duration = await getVideoDuration(inputPath);
    } catch (error) {
      console.warn("Could not get video duration, progress will not be available");
    }

    const ffmpegArgs = [
      "-i", inputPath,
      "-c:v", "libx264",        // Video codec: H.264
      "-preset", "veryfast",     // Fast encoding preset
      "-crf", "23",              // Quality setting (lower = better quality, 23 is default)
      "-c:a", "aac",             // Audio codec
      "-b:a", "128k",            // Audio bitrate
      "-movflags", "+faststart", // Enable progressive playback
      "-maxrate", "5M",          // Max bitrate
      "-bufsize", "10M",         // Buffer size
      "-y",                      // Overwrite output file
      outputPath
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let stderrOutput = "";

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      stderrOutput += output;

      // Parse progress from ffmpeg stderr output
      if (duration && onProgress) {
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseFloat(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const percent = (currentTime / duration) * 100;
          onProgress(Math.min(percent, 100));
        }
      }
    });

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(outputPath);
          resolve({
            outputPath,
            size: stats.size,
          });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderrOutput}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Get or create a transcoded version of a video file
 */
export async function getTranscodedVideo(inputPath: string): Promise<TranscodeResult> {
  // Initialize cache directory
  await initializeCache();

  // Generate cache key
  const cacheKey = await getCacheKey(inputPath);
  const cachedPath = getCachedFilePath(cacheKey);

  // Check if already transcoded
  if (await hasTranscodedCache(cacheKey)) {
    const stats = await fs.stat(cachedPath);
    return {
      outputPath: cachedPath,
      size: stats.size,
    };
  }

  // Transcode the video
  console.log(`Transcoding video: ${inputPath} -> ${cachedPath}`);
  return await transcodeVideo({
    inputPath,
    outputPath: cachedPath,
    onProgress: (percent) => {
      console.log(`Transcoding progress: ${percent.toFixed(2)}%`);
    },
  });
}

/**
 * Clear old cache files (optional utility function)
 */
export async function clearOldCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const files = await fs.readdir(TRANSCODE_CACHE_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TRANSCODE_CACHE_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.unlink(filePath);
        console.log(`Cleared old cache file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

export { TRANSCODE_CACHE_DIR };

