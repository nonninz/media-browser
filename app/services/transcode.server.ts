import { promises as fs, createWriteStream } from "fs";
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
  const startSegment = 0;
  const manifestPath = path.join(segmentDir, `manifest_seg${startSegment}.m3u8`);
  const durationFilePath = path.join(segmentDir, "duration.txt");

  // Create segment directory
  await fs.mkdir(segmentDir, { recursive: true });

  // Get and save video duration upfront for the custom player (only if not already saved)
  try {
    await fs.access(durationFilePath);
    // Duration file already exists, no need to regenerate
  } catch {
    // Duration file doesn't exist, create it
    try {
      const duration = await getVideoDuration(inputPath);
      await fs.writeFile(durationFilePath, duration.toString());
      console.log(`Video duration: ${duration.toFixed(2)}s, saved to ${durationFilePath}`);
    } catch (error) {
      console.warn("Could not get/save video duration:", error);
    }
  }

  // Check if manifest already exists
  try {
    await fs.access(manifestPath);
    const stats = await fs.stat(manifestPath);
    if (stats.size > 0) {
      // Verify manifest has actual content and segment references
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const hasSegments = manifestContent.includes('.ts');
      
      if (hasSegments) {
        // Only log once per cache key to avoid spam
        if (!recentlyLoggedCacheHits.has(cacheKey)) {
          console.log(`HLS manifest ready: ${path.basename(manifestPath)}`);
          recentlyLoggedCacheHits.add(cacheKey);
          setTimeout(() => recentlyLoggedCacheHits.delete(cacheKey), 10000);
        }
        return { manifestPath, segmentDir, cacheKey };
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
  const logFilePath = path.join(segmentDir, `transcode_seg${startSegment}_${Date.now()}.log`);

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

  console.log(`Starting HLS transcoding from segment ${startSegment}`);
  console.log(`Manifest: ${path.basename(manifestPath)}`);
  console.log(`Log file: ${path.basename(logFilePath)}`);

  const ffmpeg = spawn("ffmpeg", ffmpegArgs);

  // Store the active transcoding process
  activeTranscodings.set(cacheKey, {
    process: ffmpeg,
    startTime: Date.now(),
    cacheKey,
    inputPath,
  });

  // Redirect FFmpeg output to log file
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  ffmpeg.stderr.pipe(logStream);

  ffmpeg.on("close", (code) => {
    activeTranscodings.delete(cacheKey);
    logStream.end();
    
    if (code === 0) {
      console.log(`HLS transcoding completed: seg${startSegment}`);
    } else if (code !== null) {
      console.log(`HLS transcoding exited with code ${code}: seg${startSegment} (see ${path.basename(logFilePath)})`);
    }
  });

  ffmpeg.on("error", (error) => {
    activeTranscodings.delete(cacheKey);
    logStream.end();
    console.error(`HLS transcoding error: ${error.message}`);
  });

  // Wait for the first segments to be created (30 second timeout)
  await waitForFirstSegments(segmentDir, startSegment);

  return { manifestPath, segmentDir, cacheKey };
}

/**
 * Wait for the first HLS segments to be created
 */
async function waitForFirstSegments(segmentDir: string, startSegment: number = 0, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();
  const manifestPath = path.join(segmentDir, `manifest_seg${startSegment}.m3u8`);
  
  console.log(`Waiting for manifest_seg${startSegment}.m3u8...`);
  
  while (Date.now() - startTime < timeout) {
    try {
      const files = await fs.readdir(segmentDir);
      const segments = files.filter(f => f.endsWith('.ts'));
      const manifestName = `manifest_seg${startSegment}.m3u8`;
      const hasManifest = files.includes(manifestName);
      
      if (hasManifest && segments.length >= 2) {
        console.log(`Ready! ${manifestName} exists with ${segments.length} segments`);
        
        // Double-check manifest has content
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        if (manifestContent.includes('.ts')) {
          return;
        }
      }
      
      if (segments.length > 0 && Date.now() - startTime > 2000) {
        console.log(`Waiting: ${segments.length} segments so far...`);
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
 * Kill an active transcoding process (non-blocking - just sends signal)
 */
export function stopTranscoding(cacheKey: string): void {
  const transcoding = activeTranscodings.get(cacheKey);
  if (transcoding) {
    console.log(`Sending SIGTERM to transcoding: ${cacheKey}`);
    const process = transcoding.process;
    
    // If process already exited, just clean up
    if (process.killed || process.exitCode !== null) {
      activeTranscodings.delete(cacheKey);
      console.log(`Transcoding already stopped: ${cacheKey}`);
      return;
    }
    
    // Set up cleanup when process exits
    process.once('exit', () => {
      activeTranscodings.delete(cacheKey);
      console.log(`Transcoding stopped: ${cacheKey}`);
    });
    
    // Send termination signal (non-blocking)
    process.kill('SIGTERM');
    
    // Safety: force kill after 10 seconds if still running
    setTimeout(() => {
      if (activeTranscodings.has(cacheKey)) {
        console.warn(`Force killing stuck transcoding process: ${cacheKey}`);
        process.kill('SIGKILL');
      }
    }, 10000);
  }
}

/**
 * Wait for segments to be ready at a specific seek position
 */
async function waitForSegmentsAtSeekPosition(segmentDir: string, startSegment: number): Promise<void> {
  return waitForFirstSegments(segmentDir, startSegment, 30000);
}

/**
 * Start transcoding from a specific seek position (for on-demand seeking)
 * Keeps existing segments on disk, starts FFmpeg from the seek position.
 * FFmpeg will overwrite overlapping segments but that's acceptable.
 */
export async function startSeekTranscode(inputPath: string, cacheKey: string, seekTime: number): Promise<void> {
  const segmentDir = path.join(TRANSCODE_CACHE_DIR, cacheKey);
  
  // Calculate which segment number this seek time corresponds to
  const startSegment = Math.floor(seekTime / HLS_SEGMENT_DURATION);
  const manifestPath = path.join(segmentDir, `manifest_seg${startSegment}.m3u8`);
  const logFilePath = path.join(segmentDir, `transcode_seg${startSegment}_${Date.now()}.log`);
  
  console.log(`Starting transcode from ${seekTime}s (segment ${startSegment})`);
  
  // Ensure segment directory exists
  await fs.mkdir(segmentDir, { recursive: true });
  
  const segmentPattern = path.join(segmentDir, "segment%d.ts");
  
  // Start from seekTime, with proper segment numbering
  const ffmpegArgs = [
    "-ss", seekTime.toString(),
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-f", "hls",
    "-hls_time", String(HLS_SEGMENT_DURATION),
    "-hls_list_size", "0",
    "-hls_flags", "independent_segments",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename", segmentPattern,
    "-hls_playlist_type", "event",
    "-start_number", startSegment.toString(),
    manifestPath
  ];
  
  console.log(`Manifest: ${path.basename(manifestPath)}`);
  console.log(`Log file: ${path.basename(logFilePath)}`);
  
  const ffmpeg = spawn("ffmpeg", ffmpegArgs);
  
  // Track this process
  activeTranscodings.set(cacheKey, {
    process: ffmpeg,
    startTime: Date.now(),
    cacheKey,
    inputPath,
  });
  
  // Redirect FFmpeg output to log file
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  ffmpeg.stderr.pipe(logStream);
  
  ffmpeg.on("close", (code) => {
    activeTranscodings.delete(cacheKey);
    logStream.end();
    
    if (code === 0) {
      console.log(`Transcoding completed: seg${startSegment}`);
    } else if (code !== null) {
      console.log(`Transcoding exited with code ${code}: seg${startSegment}`);
    }
  });
  
  ffmpeg.on("error", (error) => {
    console.error(`FFmpeg error: ${error.message}`);
    activeTranscodings.delete(cacheKey);
    logStream.end();
  });
  
  // Wait for initial segments to be ready
  await waitForSegmentsAtSeekPosition(segmentDir, startSegment);
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
