interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function Header({ title, subtitle, icon }: HeaderProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {icon || (
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            )}
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
          {subtitle && (
            <div className="text-sm text-slate-400">
              Root: <span className="text-blue-400 font-mono">{subtitle}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

