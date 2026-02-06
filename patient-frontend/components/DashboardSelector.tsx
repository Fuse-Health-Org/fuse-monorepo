import React from "react";
import { useRouter } from "next/router";
import { Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

export type DashboardType = 'fuse' | 'mdi' | 'beluga';

const DASHBOARD_STORAGE_KEY = 'selected-dashboard';

interface DashboardOption {
  id: DashboardType;
  label: string;
  icon: string;
  path: string;
  color: string;
  description: string;
}

const dashboardOptions: DashboardOption[] = [
  {
    id: 'fuse',
    label: 'Fuse',
    icon: 'lucide:heart-pulse',
    path: '/fuse-dashboard',
    color: 'primary',
    description: 'Fuse Health Dashboard'
  },
  {
    id: 'mdi',
    label: 'MDI',
    icon: 'lucide:stethoscope',
    path: '/mdi-dashboard',
    color: 'secondary',
    description: 'MD Integrations Portal'
  },
  {
    id: 'beluga',
    label: 'Beluga',
    icon: 'lucide:activity',
    path: '/beluga-dashboard',
    color: 'success',
    description: 'Beluga Health Portal'
  }
];

/**
 * Get the saved dashboard preference from localStorage
 */
export function getSavedDashboard(): DashboardType | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(DASHBOARD_STORAGE_KEY);
  if (saved === 'fuse' || saved === 'mdi' || saved === 'beluga') {
    return saved;
  }
  return null;
}

/**
 * Save the dashboard preference to localStorage
 */
export function saveDashboard(dashboard: DashboardType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DASHBOARD_STORAGE_KEY, dashboard);
}

/**
 * Get the current dashboard type from the URL path
 */
export function getCurrentDashboardFromPath(pathname: string): DashboardType {
  if (pathname.startsWith('/mdi-dashboard')) {
    return 'mdi';
  }
  if (pathname.startsWith('/beluga-dashboard')) {
    return 'beluga';
  }
  return 'fuse';
}

interface DashboardSelectorProps {
  /**
   * Optional: Only show specific dashboards (for brands that only have certain programs)
   * By default, shows all available dashboards
   */
  availableDashboards?: DashboardType[];
  /**
   * Compact mode - just icons, no labels
   */
  compact?: boolean;
}

export const DashboardSelector: React.FC<DashboardSelectorProps> = ({
  availableDashboards,
  compact = true
}) => {
  const router = useRouter();
  const currentDashboard = getCurrentDashboardFromPath(router.pathname);

  // Filter options based on available dashboards prop
  const filteredOptions = availableDashboards
    ? dashboardOptions.filter(opt => availableDashboards.includes(opt.id))
    : dashboardOptions;

  // Don't render if only one dashboard is available
  if (filteredOptions.length <= 1) {
    return null;
  }

  const handleDashboardChange = (dashboard: DashboardOption) => {
    if (dashboard.id === currentDashboard) return;
    
    // Save preference to localStorage
    saveDashboard(dashboard.id);
    
    // Navigate to the selected dashboard
    router.push(dashboard.path);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-content2 rounded-lg">
      {filteredOptions.map((option) => {
        const isActive = option.id === currentDashboard;
        
        return (
          <Tooltip key={option.id} content={option.description} placement="bottom">
            <Button
              isIconOnly={compact}
              size="sm"
              variant={isActive ? "solid" : "light"}
              color={isActive ? (option.color as "primary" | "secondary" | "success") : "default"}
              className={`
                transition-all duration-200
                ${isActive 
                  ? 'shadow-sm' 
                  : 'text-foreground-500 hover:text-foreground hover:bg-content3'
                }
              `}
              onPress={() => handleDashboardChange(option)}
              aria-label={option.description}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon icon={option.icon} className="text-lg" />
              {!compact && <span className="ml-2">{option.label}</span>}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default DashboardSelector;
