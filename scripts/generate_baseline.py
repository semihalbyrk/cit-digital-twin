#!/usr/bin/env python
"""Generate baseline metrics for all days and save to CSV."""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pandas as pd

from src.core.loaders import (
    load_task_data, load_distance_matrix, load_service_points,
    load_parameters, dataframe_to_tasks,
)
from src.simulators.baseline_simulator import BaselineSimulator
from src.utils.constants import DATA_PATHS


def main():
    print("=" * 60)
    print("CIT Digital Twin - Baseline Generation")
    print("=" * 60)

    task_data = load_task_data()
    dm = load_distance_matrix()
    sp = load_service_points()
    params = load_parameters()

    sim = BaselineSimulator(dm, params, sp)

    rows = []
    baseline_types = ['planned', 'actual', 'actionable']

    for day, df in sorted(task_data.items()):
        tasks = dataframe_to_tasks(df)
        print(f"\n--- {day} ({len(tasks)} tasks) ---")

        for btype in baseline_types:
            metrics = sim.calculate_baseline(tasks, baseline_type=btype)
            row = metrics.model_dump()
            row['day'] = day
            rows.append(row)
            print(
                f"  {btype:12s}: dist={metrics.total_distance_km:.1f} km, "
                f"time={metrics.total_time_minutes:.0f} min, "
                f"cost=${metrics.total_cost:.2f}, "
                f"CO2={metrics.co2_emissions_kg:.2f} kg"
            )

    # Save to CSV
    out_path = os.path.join(DATA_PATHS['processed_dir'], 'baseline_metrics.csv')
    os.makedirs(DATA_PATHS['processed_dir'], exist_ok=True)
    result_df = pd.DataFrame(rows)
    result_df.to_csv(out_path, index=False)
    print(f"\nBaseline metrics saved to {out_path}")
    print(f"Total rows: {len(result_df)}")


if __name__ == "__main__":
    main()
