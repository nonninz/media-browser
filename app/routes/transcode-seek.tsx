import { getCacheKey, stopTranscoding, startSeekTranscode } from "~/services/transcode.server";
import { validatePath } from "~/services/media.server";

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
    
    console.log(`Seek requested to ${seekTime}s - stopping current transcode and starting from new position`);
    
    // Stop current transcoding (non-blocking - just sends signal)
    stopTranscoding(cacheKey);
    
    // Start transcoding from the seek position immediately (don't wait for old one to stop)
    await startSeekTranscode(fullPath, cacheKey, seekTime);
    
    return Response.json({ 
      success: true,
      message: "Started transcoding from seek position",
      seekTime 
    });
  } catch (error) {
    console.error("Error handling seek request:", error);
    return new Response("Error", { status: 500 });
  }
}

