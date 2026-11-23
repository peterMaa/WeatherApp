import { RefreshCw } from 'lucide-react';

export type ActiveTab = 'map' | 'matrix' | 'alerts' | 'grounding';

interface HeaderBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeAlertCount: number;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; mobileLabel: string }> = [
  { id: 'map', label: '地图格网', mobileLabel: '地图' },
  { id: 'matrix', label: '48h 矩阵', mobileLabel: '矩阵' },
  { id: 'alerts', label: '降水预警', mobileLabel: '预警' },
  { id: 'grounding', label: '防雨参谋', mobileLabel: '参谋' },
];

export function HeaderBar({
  activeTab,
  onSelectTab,
  onRefresh,
  isRefreshing,
  activeAlertCount,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('map');
          }}
          className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
        >
          狮城气象格网
        </a>

        {/* Zone 2: 4 clean single-line navigation links */}
        <nav
          aria-label="主导航"
          className="flex items-center gap-3 sm:gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const alertSuffix =
              item.id === 'alerts' && activeAlertCount > 0 ? ` (${activeAlertCount})` : '';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`relative py-3.5 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.mobileLabel}</span>
                {alertSuffix && (
                  <span className="hidden sm:inline font-mono tabular-nums text-red-600 ml-0.5">
                    {alertSuffix}
                  </span>
                )}
                {item.id === 'alerts' && activeAlertCount > 0 && (
                  <span className="sm:hidden font-mono tabular-nums text-[10px] text-red-600 ml-0.5">
                    {activeAlertCount}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="刷新 48 小时天气预报数据"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? '同步中' : '刷新预报'}</span>
            <span className="sm:hidden">{isRefreshing ? '同步' : '刷新'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
