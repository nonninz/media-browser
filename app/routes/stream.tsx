import type { Route } from "./+types/stream";
import { createReadStream } from "fs";
import { getFileStats, getMimeType } from "~/services/media.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const splat = params["*"] || "";
  
  const { fullPath, size: fileSize } = await getFileStats(splat);
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
