import { FolderIcon, VideoIcon, ImageIcon, FileIcon } from "./icons";
import { formatBytes } from "~/utils/format";

export interface FileItemData {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  isVideo?: boolean;
  isImage?: boolean;
}

interface FileListItemProps {
  item: FileItemData;
  onClick: (item: FileItemData) => void;
}

export function FileListItem({ item, onClick }: FileListItemProps) {
  const getIcon = () => {
    const iconClass = "w-6 h-6";
    
    if (item.type === "directory") {
      return <FolderIcon className={`${iconClass} text-blue-400`} />;
    }
    if (item.isVideo) {
      return <VideoIcon className={`${iconClass} text-purple-400`} />;
    }
    if (item.isImage) {
      return <ImageIcon className={`${iconClass} text-green-400`} />;
    }
    return <FileIcon className={`${iconClass} text-slate-400`} />;
  };

  const getBadge = () => {
    if (item.isVideo) {
      return (
        <span className="ml-4 px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full">
          VIDEO
        </span>
      );
    }
    if (item.isImage) {
      return (
        <span className="ml-4 px-3 py-1 bg-green-500/20 text-green-300 text-xs font-medium rounded-full">
          IMAGE
        </span>
      );
    }
    return null;
  };

  return (
    <button
      onClick={() => onClick(item)}
      className="w-full px-6 py-4 hover:bg-slate-700/50 transition-colors flex items-center justify-between group text-left"
    >
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        {/* Icon */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        {/* Name and Details */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">
            {item.name}
          </p>
          {item.type === "file" && item.size !== undefined && (
            <p className="text-sm text-slate-400">
              {formatBytes(item.size)}
            </p>
          )}
        </div>
      </div>

      {/* Badge */}
      {getBadge()}
    </button>
  );
}

