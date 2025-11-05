import { useEffect, useRef } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/home";
import { browseDirectory } from "~/services/media.server";
import {
  Header,
  CustomVideoPlayer,
  NativeVideoPlayer,
  Breadcrumb,
  FileBrowser,
  BackButton,
  ItemCount,
  type FileItemData,
} from "~/components";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("path") || "";
  
  return browseDirectory(requestedPath);
}

// Formats that need transcoding (must match server-side logic)
const NEEDS_TRANSCODING_FORMATS = [".avi", ".mkv", ".mov", ".m4v", ".flv", ".wmv"];

function needsTranscoding(videoPath: string): boolean {
  const ext = videoPath.toLowerCase().substring(videoPath.lastIndexOf('.'));
  return NEEDS_TRANSCODING_FORMATS.includes(ext);
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentVideo = searchParams.get("video");
  const scrollPositionRef = useRef<number>(0);

  const handleItemClick = (item: FileItemData, event: React.MouseEvent<HTMLAnchorElement>) => {
    // This handler is only called for regular left-clicks (without modifiers)
    // Cmd/ctrl-click is handled natively by the browser
    // event.preventDefault() was already called in FileListItem
    if (item.type === "directory") {
      navigate(`/?path=${encodeURIComponent(item.path)}`);
    } else if (item.isVideo) {
      // IMPORTANT: Save scroll position BEFORE navigating
      scrollPositionRef.current = window.scrollY;
      const currentPath = searchParams.get("path") || "";
      navigate(`/?path=${encodeURIComponent(currentPath)}&video=${encodeURIComponent(item.path)}`, {
        replace: true,
        preventScrollReset: true
      });
    } else if (item.isImage) {
      // For images, open in a new tab (preserves original behavior)
      window.open(`/stream/${item.path}`, '_blank');
    }
  };

  const getHref = (item: FileItemData): string => {
    if (item.type === "directory") {
      const currentPath = searchParams.get("path") || "";
      return `/?path=${encodeURIComponent(item.path)}`;
    } else if (item.isVideo) {
      const currentPath = searchParams.get("path") || "";
      return `/?path=${encodeURIComponent(currentPath)}&video=${encodeURIComponent(item.path)}`;
    } else if (item.isImage) {
      return `/stream/${encodeURIComponent(item.path)}`;
    } else {
      // For other files, use stream endpoint
      return `/stream/${encodeURIComponent(item.path)}`;
    }
  };

  const handleBackClick = () => {
    if (data.parentPath !== null) {
      navigate(`/?path=${encodeURIComponent(data.parentPath)}`);
    }
  };

  const closeVideo = () => {
    const currentPath = searchParams.get("path") || "";
    navigate(`/?path=${encodeURIComponent(currentPath)}`, {
      replace: true,
      preventScrollReset: true
    });
  };

  const videoTitle = currentVideo 
    ? decodeURIComponent(currentVideo.split("/").pop() || "")
    : "";

  const useNativePlayer = currentVideo && !needsTranscoding(currentVideo);

  // Manage body scroll when video modal opens/closes
  useEffect(() => {
    if (currentVideo) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll when modal closes
      document.body.style.overflow = '';
      // Restore scroll position
      if (scrollPositionRef.current > 0) {
        // Use setTimeout to ensure this happens after any router scroll behavior
        setTimeout(() => {
          window.scrollTo(0, scrollPositionRef.current);
        }, 0);
      }
    }
  }, [currentVideo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header 
        title="Media Browser" 
        subtitle={`Root: ${data.mediaRoot}`}
      />

      {currentVideo && useNativePlayer && (
        <NativeVideoPlayer
          src={`/stream/${currentVideo}`}
          title={videoTitle}
          onClose={closeVideo}
        />
      )}

      {currentVideo && !useNativePlayer && (
        <CustomVideoPlayer
          src={`/stream/${currentVideo}`}
          videoPath={currentVideo}
          title={videoTitle}
          onClose={closeVideo}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb currentPath={data.currentPath} />

        {data.parentPath !== null && (
          <BackButton onClick={handleBackClick} />
        )}

        <FileBrowser 
          items={data.items} 
          onItemClick={handleItemClick}
          getHref={getHref}
        />

        <ItemCount count={data.items.length} />
      </div>
    </div>
  );
}
