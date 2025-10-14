import { stopTranscoding, getCacheKey } from "~/services/transcode.server";
import { validatePath } from "~/services/media.server";

export async function action({ request }: { request: Request }) {
  try {
    const formData = await request.formData();
    const videoPath = formData.get("path") as string;
    
    if (!videoPath) {
      return new Response("Missing path parameter", { status: 400 });
    }
    
    // Validate the path (security)
    const fullPath = validatePath(videoPath);
    
    // Get the cache key for this video
    const cacheKey = await getCacheKey(fullPath);
    
    // Stop the transcoding
    stopTranscoding(cacheKey);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error stopping transcode:", error);
    return new Response("Error", { status: 500 });
  }
}

