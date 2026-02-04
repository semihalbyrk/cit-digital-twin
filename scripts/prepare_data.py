#!/usr/bin/env python
"""Prepare and summarise raw data for analysis."""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.loaders import load_task_data, load_distance_matrix, load_service_points
from src.utils.constants import DATA_PATHS


def main():
    print("=" * 60)
    print("CIT Digital Twin - Data Preparation Summary")
    print("=" * 60)

    task_data = load_task_data()
    dm = load_distance_matrix()
    sp = load_service_points()

    print(f"\n--- Task Data ({len(task_data)} days) ---")
    for day, df in sorted(task_data.items()):
        done = (df['task_status'] == 'Done').sum()
        visited = (df['task_status'] == 'Visited').sum()
        todo = (df['task_status'] == 'To-Do').sum()
        print(f"  {day:12s}: {len(df):3d} tasks  |  Done: {done}  Visited: {visited}  To-Do: {todo}")

    print(f"\n--- Distance Matrix ---")
    print(f"  Shape: {dm.shape[0]} × {dm.shape[1]}")
    print(f"  Min distance: {dm.values[dm.values > 0].min():.3f} km")
    print(f"  Max distance: {dm.values.max():.3f} km")
    print(f"  Mean distance: {dm.values[dm.values > 0].mean():.3f} km")

    print(f"\n--- Service Points ---")
    print(f"  Total: {len(sp)}")
    has_coords = sp['latitude'].notna().sum()
    print(f"  With coordinates: {has_coords}")

    # Unique SPs across all days
    all_sps = set()
    for df in task_data.values():
        all_sps.update(df['service_point'].unique())
    print(f"  Unique SPs in task data: {len(all_sps)}")

    # Ensure output directories exist
    os.makedirs(DATA_PATHS['processed_dir'], exist_ok=True)
    os.makedirs(DATA_PATHS['outputs_dir'], exist_ok=True)
    print("\nOutput directories verified.")
    print("Data preparation complete.")


if __name__ == "__main__":
    main()
