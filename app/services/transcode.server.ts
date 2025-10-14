import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { spawn, ChildProcess } from "child_process";

// Cache directory configuration
const TRANSCODE_CACHE_DIR = process.env.TRANSCODE_CACHE_DIR || "/tmp/media-browser-cache";

// Browser-compatible formats (no transcoding needed)
const BROWSER_COMPATIBLE_FORMATS = [".mp4", ".webm"];

// Formats that need transcoding
const NEEDS_TRANSCODING_FORMATS = [".avi", ".mkv", ".mov", ".m4v", ".flv", ".wmv"];

// HLS segment duration in seconds
const HLS_SEGMENT_DURATION = 4;

// Track active transcoding processes
const activeTranscodings = new Map<string, TranscodingProcess>();

// Track recently logged cache hits to reduce spam
const recentlyLoggedCacheHits = new Set<string>();

interface TranscodingProcess {
  process: ChildProcess;
  startTime: number;
  cacheKey: string;
  inputPath: string;
}

interface TranscodeOptions {
  inputPath: string;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

interface TranscodeResult {
  outputPath: string;
  size: number;
}

interface HLSTranscodeResult {
  manifestPath: string;
  segmentDir: string;
  cacheKey: string;
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
 * Start HLS transcoding for a video file
 * This creates segments on-the-fly, allowing playback to start immediately
 */
export async function startHLSTranscoding(inputPath: string, cacheKey: string): Promise<HLSTranscodeResult> {
  const segmentDir = path.join(TRANSCODE_CACHE_DIR, cacheKey);
  const manifestPath = path.join(segmentDir, "master.m3u8");

  // Create segment directory
  await fs.mkdir(segmentDir, { recursive: true });

  // Check if manifest already exists AND is complete
  try {
    await fs.access(manifestPath);
    const stats = await fs.stat(manifestPath);
    if (stats.size > 0) {
      // Verify manifest has actual content and segment references
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const hasSegments = manifestContent.includes('.ts');
      const isComplete = manifestContent.includes('#EXT-X-ENDLIST');
      
      if (hasSegments) {
        // Only log once per cache key to avoid spam
        if (!recentlyLoggedCacheHits.has(cacheKey)) {
          console.log(`HLS manifest ready: ${manifestPath} (${isComplete ? 'complete' : 'still transcoding'})`);
          recentlyLoggedCacheHits.add(cacheKey);
          // Clear after 10 seconds
          setTimeout(() => recentlyLoggedCacheHits.delete(cacheKey), 10000);
        }
        return { manifestPath, segmentDir, cacheKey };
      } else {
        console.log(`Manifest file exists but has no segments yet, will wait...`);
      }
    }
  } catch {
    // Manifest doesn't exist, continue
  }

  // Check if already transcoding
  if (activeTranscodings.has(cacheKey)) {
    console.log(`Transcoding already in progress for ${cacheKey}, waiting for segments...`);
    // Wait for segments to be ready
    await waitForFirstSegments(segmentDir);
    return { manifestPath, segmentDir, cacheKey };
  }

  const segmentPattern = path.join(segmentDir, "segment%d.ts");

  const ffmpegArgs = [
    "-i", inputPath,
    "-c:v", "libx264",              // Video codec: H.264
    "-preset", "veryfast",          // Fast encoding preset
    "-crf", "23",                   // Quality setting
    "-c:a", "aac",                  // Audio codec
    "-b:a", "128k",                 // Audio bitrate
    "-ac", "2",                     // Stereo audio
    "-f", "hls",                    // HLS format
    "-hls_time", String(HLS_SEGMENT_DURATION),  // Segment duration
    "-hls_list_size", "0",          // Keep all segments in playlist (for seeking)
    "-hls_flags", "independent_segments", // Generate independent segments
    "-hls_segment_type", "mpegts",  // MPEG-TS segments
    "-hls_segment_filename", segmentPattern,
    "-hls_playlist_type", "event",  // Event playlist (grows as segments are created)
    "-start_number", "0",
    manifestPath
  ];

  console.log(`Starting HLS transcoding: ${inputPath}`);
  console.log(`Output directory: ${segmentDir}`);

  const ffmpeg = spawn("ffmpeg", ffmpegArgs);

  // Store the active transcoding process
  activeTranscodings.set(cacheKey, {
    process: ffmpeg,
    startTime: Date.now(),
    cacheKey,
    inputPath,
  });

  let stderrOutput = "";

  ffmpeg.stderr.on("data", (data) => {
    const output = data.toString();
    stderrOutput += output;
    
    // Log progress
    const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(timeMatch[3]);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      console.log(`Transcoding progress: ${currentTime.toFixed(1)}s`);
    }
  });

  ffmpeg.on("close", (code) => {
    activeTranscodings.delete(cacheKey);
    
    if (code === 0) {
      console.log(`HLS transcoding completed: ${cacheKey}`);
    } else {
      console.error(`HLS transcoding failed with code ${code}: ${cacheKey}`);
      console.error(stderrOutput);
    }
  });

  ffmpeg.on("error", (error) => {
    activeTranscodings.delete(cacheKey);
    console.error(`HLS transcoding error: ${error.message}`);
  });

  // Wait for the first segments to be created (30 second timeout)
  await waitForFirstSegments(segmentDir);

  return { manifestPath, segmentDir, cacheKey };
}

/**
 * Wait for the first HLS segments to be created
 */
async function waitForFirstSegments(segmentDir: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();
  const manifestPath = path.join(segmentDir, "master.m3u8");
  
  console.log(`Waiting for segments in ${segmentDir}...`);
  
  while (Date.now() - startTime < timeout) {
    try {
      const files = await fs.readdir(segmentDir);
      const segments = files.filter(f => f.endsWith('.ts'));
      const hasManifest = files.includes('master.m3u8');
      
      if (hasManifest && segments.length >= 2) {
        console.log(`Ready! Manifest exists and ${segments.length} segments created`);
        
        // Double-check manifest has content
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        if (manifestContent.includes('.ts')) {
          return;
        }
      }
      
      if (segments.length > 0) {
        console.log(`Progress: ${segments.length} segments so far...`);
      }
    } catch (error) {
      // Directory might not exist yet, keep waiting
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Timeout waiting for segments after ${timeout}ms`);
}

/**
 * Get or create HLS transcoded version of a video file
 */
export async function getHLSTranscode(inputPath: string): Promise<HLSTranscodeResult> {
  // Initialize cache directory
  await initializeCache();

  // Generate cache key
  const cacheKey = await getCacheKey(inputPath);

  // Start HLS transcoding (will return immediately if already in progress or completed)
  return await startHLSTranscoding(inputPath, cacheKey);
}

/**
 * Check if HLS transcoding is complete
 */
export async function isHLSTranscodingComplete(cacheKey: string): Promise<boolean> {
  return !activeTranscodings.has(cacheKey);
}

/**
 * Get the segment directory for a cache key
 */
export function getHLSSegmentDir(cacheKey: string): string {
  return path.join(TRANSCODE_CACHE_DIR, cacheKey);
}

/**
 * Kill an active transcoding process
 */
export function stopTranscoding(cacheKey: string): void {
  const transcoding = activeTranscodings.get(cacheKey);
  if (transcoding) {
    transcoding.process.kill('SIGTERM');
    activeTranscodings.delete(cacheKey);
    console.log(`Stopped transcoding: ${cacheKey}`);
  }
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

