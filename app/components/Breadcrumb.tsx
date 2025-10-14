import { Link } from "react-router";

interface BreadcrumbProps {
  currentPath: string;
  pathSeparator?: string;
  buildUrl?: (path: string) => string;
  homeLabel?: string;
}

export function Breadcrumb({ 
  currentPath, 
  pathSeparator = "/",
  buildUrl = (path) => `/?path=${encodeURIComponent(path)}`,
  homeLabel = "Home"
}: BreadcrumbProps) {
  const segments = currentPath ? currentPath.split(pathSeparator).filter(Boolean) : [];

  return (
    <div className="mb-6 flex items-center space-x-2 text-sm flex-wrap">
      <Link
        to="/"
        className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        {homeLabel}
      </Link>
      {segments.map((segment, index) => {
        const segmentPath = segments.slice(0, index + 1).join(pathSeparator);
        return (
          <div key={segmentPath} className="flex items-center space-x-2">
            <span className="text-slate-500">/</span>
            <Link
              to={buildUrl(segmentPath)}
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              {segment}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

