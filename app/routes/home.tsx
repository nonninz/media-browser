import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/home";
import { browseDirectory } from "~/services/media.server";
import {
  Header,
  VideoPlayer,
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

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentVideo = searchParams.get("video");

  const handleItemClick = (item: FileItemData) => {
    if (item.type === "directory") {
      navigate(`/?path=${encodeURIComponent(item.path)}`);
    } else if (item.isVideo) {
      const currentPath = searchParams.get("path") || "";
      navigate(`/?path=${encodeURIComponent(currentPath)}&video=${encodeURIComponent(item.path)}`);
    }
  };

  const handleBackClick = () => {
    if (data.parentPath !== null) {
      navigate(`/?path=${encodeURIComponent(data.parentPath)}`);
    }
  };

  const closeVideo = () => {
    const currentPath = searchParams.get("path") || "";
    navigate(`/?path=${encodeURIComponent(currentPath)}`);
  };

  const videoTitle = currentVideo 
    ? decodeURIComponent(currentVideo.split("/").pop() || "")
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header 
        title="Media Browser" 
        subtitle={`Root: ${data.mediaRoot}`}
      />

      {currentVideo && (
        <VideoPlayer
          src={`/stream/${currentVideo}`}
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
        />

        <ItemCount count={data.items.length} />
      </div>
    </div>
  );
}
