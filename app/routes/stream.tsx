import type { Route } from "./+types/stream";
import { createReadStream } from "fs";
import { getFileStats, getMimeType } from "~/services/media.server";
import { needsTranscoding, getTranscodedVideo } from "~/services/transcode.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const splat = params["*"] || "";
  
  const { fullPath, size: fileSize } = await getFileStats(splat);
  
  // Check if this video needs transcoding
  let actualPath = fullPath;
  let actualSize = fileSize;
  let actualContentType = getMimeType(fullPath);

  if (needsTranscoding(fullPath)) {
    try {
      console.log(`Video needs transcoding: ${fullPath}`);
      const transcoded = await getTranscodedVideo(fullPath);
      actualPath = transcoded.outputPath;
      actualSize = transcoded.size;
      actualContentType = "video/mp4"; // Transcoded files are always MP4
      console.log(`Using transcoded video: ${actualPath}`);
    } catch (error) {
      console.error("Transcoding failed:", error);
      // Fall back to serving the original file
      console.log("Falling back to original file");
    }
  }

  const range = request.headers.get("range");

  // Handle range requests for video seeking
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : actualSize - 1;
    const chunksize = end - start + 1;

    const stream = createReadStream(actualPath, { start, end });
    
    return new Response(stream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${actualSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": actualContentType,
      },
    });
  } else {
    const stream = createReadStream(actualPath);
    
    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Length": actualSize.toString(),
        "Content-Type": actualContentType,
        "Accept-Ranges": "bytes",
      },
    });
  }
}
