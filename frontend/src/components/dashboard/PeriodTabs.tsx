import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Period = '24h' | '7d' | '30d' | '1y' | 'custom';

interface PeriodTabsProps {
  value: Period;
  onValueChange: (value: Period) => void;
}

const PERIOD_LABELS: Record<Period, string> = {
  '24h': 'Last 24h',
  '7d': 'Last 7d',
  '30d': 'Last 30d',
  '1y': 'Last Year',
  custom: 'Custom',
};

export function PeriodTabs({ value, onValueChange }: PeriodTabsProps) {
  return (
    <Tabs value={value} onValueChange={(val) => onValueChange(val as Period)}>
      <TabsList className="grid w-full grid-cols-5">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => (
          <TabsTrigger key={period} value={period} className="text-xs sm:text-sm">
            {PERIOD_LABELS[period]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
