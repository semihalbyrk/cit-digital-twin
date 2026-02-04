"""Frequency analyzer: determine ideal collection frequency per service point."""

from typing import Dict, List

import pandas as pd
from loguru import logger

from src.utils.constants import TASK_FILE_DATE_MAP


class FrequencyAnalyzer:
    """Analyse collection patterns across multiple days to recommend frequency changes."""

    # Day ordering for pattern descriptions
    DAY_LABELS = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    DAY_ORDER = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    def __init__(self, task_data: Dict[str, pd.DataFrame]):
        """
        Args:
            task_data: Dict mapping day name (e.g. 'tuesday') to task DataFrame.
        """
        self.task_data = task_data

    def analyze_collection_frequency(self) -> pd.DataFrame:
        """Analyse each service point's collection pattern across all days.

        Returns:
            DataFrame with columns:
            sp_id, zone, current_freq, fill_rate, ideal_freq,
            done_days, visited_days, todo_days, pattern,
            weekly_waste, est_savings_usd
        """
        # Combine all days' data with day labels
        records: List[Dict] = []
        for day_key, df in self.task_data.items():
            sp_col = 'service_point' if 'service_point' in df.columns else 'Service Point'
            status_col = 'task_status' if 'task_status' in df.columns else 'Task Status'
            zone_col = 'zone' if 'zone' in df.columns else 'Zone'

            for _, row in df.iterrows():
                records.append({
                    'sp_id': str(row.get(sp_col, '')),
                    'zone': str(row.get(zone_col, '')),
                    'day': day_key,
                    'task_status': str(row.get(status_col, '')),
                })

        if not records:
            logger.warning("No task records found for frequency analysis")
            return pd.DataFrame()

        all_df = pd.DataFrame(records)
        total_days = len(self.task_data)

        # Aggregate per service point
        result_rows = []
        for sp_id, group in all_df.groupby('sp_id'):
            zone = group['zone'].mode().iloc[0] if not group['zone'].mode().empty else ''

            done_days = group[group['task_status'] == 'Done']['day'].nunique()
            visited_days = group[group['task_status'] == 'Visited']['day'].nunique()
            todo_days = group[group['task_status'] == 'To-Do']['day'].nunique()

            # Fill rate: days with actual collection attempt / total days
            fill_rate = (done_days + visited_days) / total_days if total_days > 0 else 0

            # Build pattern string (e.g. "Tue+Thu+Sat")
            done_day_names = sorted(
                group[group['task_status'] == 'Done']['day'].unique(),
                key=lambda d: self.DAY_ORDER.index(d) if d in self.DAY_ORDER else 99
            )
            pattern = '+'.join(
                self.DAY_LABELS[self.DAY_ORDER.index(d)]
                for d in done_day_names
                if d in self.DAY_ORDER
            ) or 'None'

            # Determine ideal frequency
            ideal_freq = self._recommend_frequency(fill_rate, done_days, visited_days, todo_days, total_days)
            current_freq = 'Daily' if total_days == done_days + visited_days + todo_days else f'{total_days}x/week'

            # Weekly waste: unnecessary visits (To-Do days extrapolated to 7-day week)
            weekly_waste = todo_days * (7 / total_days) if total_days > 0 else 0

            # Estimated savings per week ($)
            # Average cost per visit ~ $5 (fuel + time + wear)
            cost_per_visit = 5.0
            est_savings = weekly_waste * cost_per_visit

            result_rows.append({
                'sp_id': sp_id,
                'zone': zone,
                'current_freq': current_freq,
                'fill_rate': round(fill_rate, 3),
                'ideal_freq': ideal_freq,
                'done_days': done_days,
                'visited_days': visited_days,
                'todo_days': todo_days,
                'pattern': pattern,
                'weekly_waste': round(weekly_waste, 1),
                'est_savings_usd': round(est_savings, 2),
            })

        result_df = pd.DataFrame(result_rows)
        result_df = result_df.sort_values('fill_rate', ascending=True)
        logger.info(f"Frequency analysis complete: {len(result_df)} service points")
        return result_df

    def get_problematic_sps(self, threshold: float = 0.8) -> pd.DataFrame:
        """Return service points where fill_rate < threshold (over-visited)."""
        freq_df = self.analyze_collection_frequency()
        if freq_df.empty:
            return freq_df
        return freq_df[freq_df['fill_rate'] < threshold].copy()

    def calculate_impact_summary(self) -> Dict:
        """Calculate aggregate impact if all frequency recommendations are applied.

        Returns:
            Dict with keys: current_tasks, recommended_tasks, removed_tasks,
            est_weekly_savings, est_co2_reduction_kg, projected_completion_rate.
        """
        freq_df = self.analyze_collection_frequency()
        if freq_df.empty:
            return {}

        total_days = len(self.task_data)
        current_tasks = len(freq_df) * total_days
        removed_tasks = int(freq_df['weekly_waste'].sum() * total_days / 7)
        recommended_tasks = current_tasks - removed_tasks

        total_savings = freq_df['est_savings_usd'].sum()

        # CO2 reduction estimate: ~0.5 kg per removed visit (short drive savings)
        co2_reduction = removed_tasks * 0.5

        # Projected completion: remove wasted visits improves rate
        total_done = freq_df['done_days'].sum()
        total_attempted = total_done + freq_df['visited_days'].sum() + freq_df['todo_days'].sum()
        current_rate = total_done / total_attempted if total_attempted > 0 else 0
        projected_rate = total_done / (total_attempted - freq_df['todo_days'].sum()) if (total_attempted - freq_df['todo_days'].sum()) > 0 else 0

        return {
            'current_tasks': current_tasks,
            'recommended_tasks': recommended_tasks,
            'removed_tasks': removed_tasks,
            'est_weekly_savings': round(total_savings, 2),
            'est_co2_reduction_kg': round(co2_reduction, 2),
            'current_completion_rate': round(current_rate, 4),
            'projected_completion_rate': round(min(projected_rate, 1.0), 4),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _recommend_frequency(
        fill_rate: float,
        done_days: int,
        visited_days: int,
        todo_days: int,
        total_days: int,
    ) -> str:
        """Determine ideal collection frequency based on fill pattern."""
        if fill_rate > 0.8:
            return 'Daily'
        elif fill_rate > 0.6:
            return '4x/week'
        elif fill_rate > 0.4:
            return '3x/week'
        elif fill_rate > 0.2:
            return '2x/week'
        elif done_days == 0 and visited_days > 0:
            return 'Investigate access'
        elif done_days == 0 and visited_days == 0:
            return 'Remove from schedule'
        else:
            return '1x/week'
