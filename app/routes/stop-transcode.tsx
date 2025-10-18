import { stopTranscoding, getCacheKey } from "~/services/transcode.server";
import { validatePath } from "~/services/media.server";

export async function action({ request }: { request: Request }) {
  try {
    const formData = await request.formData();
    const videoPath = formData.get("path") as string;
    
    console.log("🛑 [STOP-TRANSCODE] Request received for:", videoPath);
    
    if (!videoPath) {
      console.error("🛑 [STOP-TRANSCODE] Missing path parameter");
      return new Response("Missing path parameter", { status: 400 });
    }
    
    // Validate the path (security)
    const fullPath = validatePath(videoPath);
    console.log("🛑 [STOP-TRANSCODE] Full path:", fullPath);
    
    // Get the cache key for this video
    const cacheKey = await getCacheKey(fullPath);
    console.log("🛑 [STOP-TRANSCODE] Cache key:", cacheKey);
    
    // Stop the transcoding (non-blocking)
    stopTranscoding(cacheKey);
    console.log("🛑 [STOP-TRANSCODE] ✅ Sent stop signal");
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("🛑 [STOP-TRANSCODE] ❌ Error:", error);
    return new Response("Error", { status: 500 });
  }
}

