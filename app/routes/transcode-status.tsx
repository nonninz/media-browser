import { promises as fs } from "fs";
import path from "path";
import { getCacheKey, getHLSSegmentDir } from "~/services/transcode.server";
import { validatePath } from "~/services/media.server";

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const videoPath = url.searchParams.get("path");
    
    if (!videoPath) {
      return new Response("Missing path parameter", { status: 400 });
    }
    
    // Validate and get full path
    const fullPath = validatePath(videoPath);
    const cacheKey = await getCacheKey(fullPath);
    const segmentDir = getHLSSegmentDir(cacheKey);
    
    // Read duration if available
    let duration: number | null = null;
    try {
      const durationFilePath = path.join(segmentDir, "duration.txt");
      const durationStr = await fs.readFile(durationFilePath, 'utf-8');
      duration = parseFloat(durationStr);
      console.log(`[Transcode Status] Read duration: ${duration}s from ${durationFilePath}`);
    } catch (error) {
      console.log(`[Transcode Status] Duration file not found: ${error}`);
      // Duration not available yet
    }
    
    // Check which segments exist - scan entire directory
    const segments: number[] = [];
    try {
      const files = await fs.readdir(segmentDir);
      for (const file of files) {
        const match = file.match(/^segment(\d+)\.ts$/);
        if (match) {
          segments.push(parseInt(match[1]));
        }
      }
      segments.sort((a, b) => a - b);
    } catch {
      // Directory doesn't exist yet
    }
    
    // Calculate various stats
    const maxSegment = segments.length > 0 ? Math.max(...segments) : -1;
    const minSegment = segments.length > 0 ? Math.min(...segments) : -1;
    
    // Total expected segments if video is fully transcoded
    const totalExpectedSegments = duration ? Math.ceil(duration / 4) : null;
    
    // Is transcoding complete?
    const isComplete = duration && totalExpectedSegments
      ? maxSegment >= totalExpectedSegments - 1
      : false;
    
    const response = {
      cacheKey,
      duration,
      segments, // Array of all segment numbers that exist
      segmentCount: segments.length,
      minSegment,
      maxSegment,
      totalExpectedSegments,
      isComplete,
    };
    
    // Only log periodically to avoid spam
    if (Math.random() < 0.1) {
      console.log(`[Transcode Status] ${segments.length} segments exist: [${minSegment}...${maxSegment}]`);
    }
    
    return Response.json(response);
  } catch (error) {
    console.error("Error getting transcode status:", error);
    return new Response("Error", { status: 500 });
  }
}

