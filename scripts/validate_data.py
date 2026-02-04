#!/usr/bin/env python
"""Validate all raw data files and report issues."""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.loaders import load_task_data, load_distance_matrix, load_service_points
from src.core.validators import validate_all


def main():
    print("=" * 60)
    print("CIT Digital Twin - Data Validation")
    print("=" * 60)

    print("\nLoading data...")
    task_data = load_task_data()
    dm = load_distance_matrix()
    sp = load_service_points()

    print(f"\nTask files loaded: {len(task_data)} days")
    for day, df in task_data.items():
        print(f"  {day}: {len(df)} rows")

    print(f"\nDistance matrix: {dm.shape[0]} × {dm.shape[1]}")
    print(f"Service points: {len(sp)}")

    print("\n" + "-" * 60)
    print("Running validations...")
    print("-" * 60)

    results = validate_all(task_data, dm, sp)

    all_valid = True
    for name, (valid, issues) in results.items():
        status = "PASS" if valid else "FAIL"
        icon = "✓" if valid else "✗"
        print(f"\n{icon} [{status}] {name}")
        if issues:
            all_valid = False
            for issue in issues:
                print(f"    - {issue}")

    print("\n" + "=" * 60)
    if all_valid:
        print("All validations passed!")
    else:
        print("Some validations failed. See issues above.")
    print("=" * 60)


if __name__ == "__main__":
    main()
