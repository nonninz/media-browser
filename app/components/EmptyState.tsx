import { FolderIcon } from "./icons";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700/50 overflow-hidden">
      <div className="p-12 text-center text-slate-400">
        {icon || <FolderIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />}
        <p className="text-lg">{message}</p>
      </div>
    </div>
  );
}

