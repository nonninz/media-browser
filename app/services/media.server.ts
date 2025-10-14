import { promises as fs } from "fs";
import path from "path";

const MEDIA_ROOT = process.env.MEDIA_ROOT || "/";

// Video file extensions that can be directly streamed
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  isVideo?: boolean;
  isImage?: boolean;
}

export interface BrowseResult {
  items: FileItem[];
  currentPath: string;
  parentPath: string | null;
  mediaRoot: string;
}

/**
 * Validates and normalizes a path to prevent directory traversal attacks
 */
export function validatePath(requestedPath: string): string {
  // Security: prevent directory traversal
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.join(MEDIA_ROOT, safePath);
  
  // Ensure the path is within MEDIA_ROOT
  if (!fullPath.startsWith(path.resolve(MEDIA_ROOT))) {
    throw new Response("Forbidden", { status: 403 });
  }
  
  return fullPath;
}

/**
 * Browse a directory and return its contents
 */
export async function browseDirectory(requestedPath: string = ""): Promise<BrowseResult> {
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = validatePath(requestedPath);

  try {
    const stats = await fs.stat(fullPath);
    
    if (!stats.isDirectory()) {
      throw new Response("Not a directory", { status: 400 });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    const items: FileItem[] = await Promise.all(
      entries
        .filter(entry => !entry.name.startsWith(".")) // Hide hidden files
        .map(async (entry) => {
          const itemPath = path.join(fullPath, entry.name);
          const relativePath = path.relative(MEDIA_ROOT, itemPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          let size = 0;
          if (entry.isFile()) {
            try {
              const itemStats = await fs.stat(itemPath);
              size = itemStats.size;
            } catch (e) {
              // Ignore stat errors
            }
          }
          
          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? "directory" : "file",
            size,
            isVideo: VIDEO_EXTENSIONS.includes(ext),
            isImage: IMAGE_EXTENSIONS.includes(ext),
          } as FileItem;
        })
    );

    // Sort: directories first, then files, alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const parentPath = safePath
      ? path.dirname(safePath) === "."
        ? ""
        : path.dirname(safePath)
      : null;

    return {
      items,
      currentPath: safePath,
      parentPath,
      mediaRoot: MEDIA_ROOT,
    };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw new Response("Directory not found", { status: 404 });
    }
    if (error.code === "EACCES") {
      throw new Response("Permission denied", { status: 403 });
    }
    throw error;
  }
}

/**
 * Get file stats for streaming
 */
export async function getFileStats(requestedPath: string) {
  const fullPath = validatePath(requestedPath);
  
  try {
    const stats = await fs.stat(fullPath);
    
    if (!stats.isFile()) {
      throw new Response("Not a file", { status: 400 });
    }

    return {
      fullPath,
      size: stats.size,
    };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw new Response("File not found", { status: 404 });
    }
    if (error.code === "EACCES") {
      throw new Response("Permission denied", { status: 403 });
    }
    throw error;
  }
}

/**
 * Get MIME type for a file based on extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".m4v": "video/x-m4v",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

export { MEDIA_ROOT };

