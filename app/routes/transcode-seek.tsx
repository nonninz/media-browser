import { getCacheKey, stopTranscoding, getHLSSegmentDir } from "~/services/transcode.server";
import { validatePath } from "~/services/media.server";
import { spawn } from "child_process";
import path from "path";

const HLS_SEGMENT_DURATION = 4;

export async function action({ request }: { request: Request }) {
  try {
    const formData = await request.formData();
    const videoPath = formData.get("path") as string;
    const seekTime = parseFloat(formData.get("seekTime") as string);
    
    if (!videoPath || isNaN(seekTime)) {
      return new Response("Missing parameters", { status: 400 });
    }
    
    // Validate path
    const fullPath = validatePath(videoPath);
    const cacheKey = await getCacheKey(fullPath);
    
    // Stop any existing transcoding for this video
    stopTranscoding(cacheKey);
    
    // Calculate which segment we need to start from
    const startSegment = Math.floor(seekTime / HLS_SEGMENT_DURATION);
    const startTime = startSegment * HLS_SEGMENT_DURATION;
    
    const segmentDir = getHLSSegmentDir(cacheKey);
    const segmentPattern = path.join(segmentDir, `segment%d.ts`);
    const manifestPath = path.join(segmentDir, "master.m3u8");
    
    console.log(`Starting transcoding from ${startTime}s (segment ${startSegment})`);
    
    // Start FFmpeg from the seek position
    const ffmpegArgs = [
      "-ss", startTime.toString(),  // Seek to position
      "-i", fullPath,
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
    
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    
    ffmpeg.on("error", (error) => {
      console.error("FFmpeg error:", error);
    });
    
    // Don't wait for completion
    return Response.json({ 
      success: true, 
      startTime, 
      startSegment,
      message: `Started transcoding from ${startTime}s` 
    });
  } catch (error) {
    console.error("Error starting seek transcode:", error);
    return new Response("Error", { status: 500 });
  }
}

