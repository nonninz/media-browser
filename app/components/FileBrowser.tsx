import { FileListItem, type FileItemData } from "./FileListItem";
import { EmptyState } from "./EmptyState";

interface FileBrowserProps {
  items: FileItemData[];
  onItemClick: (item: FileItemData, event: React.MouseEvent<HTMLAnchorElement>) => void;
  getHref: (item: FileItemData) => string;
  emptyMessage?: string;
}

export function FileBrowser({ items, onItemClick, getHref, emptyMessage = "This directory is empty" }: FileBrowserProps) {
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700/50 overflow-hidden">
      <div className="divide-y divide-slate-700/50">
        {items.map((item) => (
          <FileListItem
            key={item.path}
            item={item}
            href={getHref(item)}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

