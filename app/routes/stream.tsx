import type { Route } from "./+types/stream";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { getFileStats, getMimeType } from "~/services/media.server";
import { 
  needsTranscoding, 
  getHLSTranscode,
  getCacheKey
} from "~/services/transcode.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const splat = params["*"] || "";
  const url = new URL(request.url);
  
  console.log(`[Stream Loader] Requested splat: "${splat}"`);
  
  // Check if this is an HLS manifest or segment request
  // splat will be like "hls/cachekey/file.ts" (no leading slash)
  if (splat.startsWith("hls/") || splat.includes("/hls/")) {
    console.log(`[Stream Loader] Routing to HLS handler`);
    return handleHLSRequest(splat);
  }
  
  const { fullPath, size: fileSize } = await getFileStats(splat);
  
  // Check if this video needs transcoding
  if (needsTranscoding(fullPath)) {
    // For videos that need transcoding, start HLS transcoding and serve the manifest
    try {
      const { manifestPath, cacheKey } = await getHLSTranscode(fullPath);
      
      // Read the manifest and rewrite segment paths to be absolute
      let manifestContent = await fs.readFile(manifestPath, 'utf-8');
      
      // Rewrite relative segment paths to absolute paths
      // segment0.ts -> /stream/hls/{cacheKey}/segment0.ts
      manifestContent = manifestContent.replace(
        /(segment\d+\.ts)/g,
        `/stream/hls/${cacheKey}/$1`
      );
      
      const manifestSize = manifestContent.length;
      
      console.log(`Serving HLS manifest for transcoded video (${manifestSize} bytes)`);
      
      // Serve the manifest with proper content type
      return new Response(manifestContent, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Content-Length": manifestSize.toString(),
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache", // Don't cache the manifest as it updates during transcoding
        },
      });
    } catch (error) {
      console.error("Failed to start HLS transcoding:", error);
      return new Response("Transcoding failed", { status: 500 });
    }
  }

  // For browser-compatible formats, stream directly
  const range = request.headers.get("range");
  const contentType = getMimeType(fullPath);

  // Handle range requests for video seeking
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const stream = createReadStream(fullPath, { start, end });
    
    return new Response(stream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
      },
    });
  } else {
    const stream = createReadStream(fullPath);
    
    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  }
}

/**
 * Handle HLS manifest and segment requests
 * URL format: /stream/hls/{cacheKey}/{file}
 */
async function handleHLSRequest(splat: string): Promise<Response> {
  console.log(`[HLS Handler] Requested splat: "${splat}"`);
  
  // Parse the path: hls/{cacheKey}/{file}
  const parts = splat.split("/");
  const hlsIndex = parts.indexOf("hls");
  
  console.log(`[HLS Handler] Parts: ${JSON.stringify(parts)}, hlsIndex: ${hlsIndex}`);
  
  if (hlsIndex === -1 || parts.length < hlsIndex + 3) {
    console.error(`[HLS Handler] Invalid HLS path format. Parts length: ${parts.length}, needed: ${hlsIndex + 3}`);
    return new Response("Invalid HLS path", { status: 400 });
  }
  
  const cacheKey = parts[hlsIndex + 1];
  const fileName = parts.slice(hlsIndex + 2).join("/");
  
  console.log(`[HLS Handler] Cache key: "${cacheKey}", File name: "${fileName}"`);
  
  const segmentDir = path.join(
    process.env.TRANSCODE_CACHE_DIR || "/tmp/media-browser-cache",
    cacheKey
  );
  const filePath = path.join(segmentDir, fileName);
  
  console.log(`[HLS Handler] Segment dir: "${segmentDir}"`);
  console.log(`[HLS Handler] Full file path: "${filePath}"`);
  
  // Security: ensure the file is within the segment directory
  if (!filePath.startsWith(segmentDir)) {
    console.error("Path traversal attempt blocked");
    return new Response("Forbidden", { status: 403 });
  }
  
  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    
    console.log(`[HLS Handler] ✅ File exists: ${fileName} (${stats.size} bytes)`);
    
    // Determine content type
    let contentType = "application/octet-stream";
    if (fileName.endsWith(".m3u8")) {
      contentType = "application/vnd.apple.mpegurl";
    } else if (fileName.endsWith(".ts")) {
      contentType = "video/mp2t";
    }
    
    // Stream the file
    const stream = createReadStream(filePath);
    
    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache segments for a long time
        "Access-Control-Allow-Origin": "*", // Allow CORS for HLS
      },
    });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.error(`[HLS Handler] ❌ File not found: ${filePath}`);
      console.error(`[HLS Handler] ❌ Requested fileName: "${fileName}"`);
      console.error(`[HLS Handler] ❌ Cache key: "${cacheKey}"`);
      return new Response("File not found", { status: 404 });
    }
    console.error(`[HLS Handler] Error serving HLS file:`, error);
    return new Response("Internal server error", { status: 500 });
  }
}
