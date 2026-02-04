"""Data validation utilities."""

from typing import Dict, List, Tuple

import pandas as pd
from loguru import logger

from src.utils.constants import TASK_STATUSES, DEPOT_NAME, DISPOSAL_NAME


def validate_task_dataframe(df: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Validate a task DataFrame for required columns and data quality.

    Returns:
        (is_valid, list_of_issues)
    """
    issues: List[str] = []
    required = ['task_id', 'route_name', 'vehicle_id', 'task_status', 'service_point']

    for col in required:
        if col not in df.columns:
            issues.append(f"Missing required column: {col}")

    if issues:
        return False, issues

    # Check for nulls in critical columns
    for col in ['task_id', 'service_point', 'task_status']:
        nulls = df[col].isna().sum()
        if nulls > 0:
            issues.append(f"{nulls} null values in '{col}'")

    # Check task status values
    if 'task_status' in df.columns:
        invalid = set(df['task_status'].dropna().unique()) - set(TASK_STATUSES)
        if invalid:
            issues.append(f"Invalid task statuses: {invalid}")

    # Check for duplicate task IDs
    if 'task_id' in df.columns:
        dupes = df['task_id'].duplicated().sum()
        if dupes > 0:
            issues.append(f"{dupes} duplicate task IDs")

    is_valid = len(issues) == 0
    return is_valid, issues


def validate_distance_matrix(dm: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Validate the distance matrix.

    Returns:
        (is_valid, list_of_issues)
    """
    issues: List[str] = []

    # Check square
    if dm.shape[0] != dm.shape[1]:
        issues.append(f"Matrix is not square: {dm.shape}")

    # Check diagonal is zero (or close)
    diag = pd.Series([dm.iloc[i, i] for i in range(min(dm.shape))])
    non_zero_diag = (diag.abs() > 0.001).sum()
    if non_zero_diag > 0:
        issues.append(f"{non_zero_diag} non-zero diagonal elements")

    # Check for negative values
    neg_count = (dm < 0).sum().sum()
    if neg_count > 0:
        issues.append(f"{neg_count} negative distance values")

    # Check depot and disposal exist
    for name in [DEPOT_NAME, DISPOSAL_NAME]:
        if name not in dm.index:
            issues.append(f"Missing '{name}' in matrix rows")
        if name not in dm.columns:
            issues.append(f"Missing '{name}' in matrix columns")

    # Check approximate symmetry (allow 1% tolerance)
    if dm.shape[0] == dm.shape[1]:
        diff = (dm - dm.T).abs()
        max_diff = diff.max().max()
        if max_diff > 0.5:
            issues.append(
                f"Matrix not symmetric: max asymmetry = {max_diff:.3f} km"
            )

    is_valid = len(issues) == 0
    return is_valid, issues


def validate_service_points(sp_df: pd.DataFrame, dm: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Cross-validate service points against the distance matrix.

    Returns:
        (is_valid, list_of_issues)
    """
    issues: List[str] = []

    sp_ids = set(sp_df['sp_id'].unique())
    dm_ids = set(dm.index) - {DEPOT_NAME, DISPOSAL_NAME}

    missing_in_dm = sp_ids - dm_ids - {DEPOT_NAME, DISPOSAL_NAME}
    if missing_in_dm:
        issues.append(
            f"{len(missing_in_dm)} service points not in distance matrix"
        )

    missing_in_sp = dm_ids - sp_ids
    if missing_in_sp:
        issues.append(
            f"{len(missing_in_sp)} distance matrix entries not in service points file"
        )

    is_valid = len(issues) == 0
    return is_valid, issues


def validate_all(
    task_data: Dict[str, pd.DataFrame],
    dm: pd.DataFrame,
    sp_df: pd.DataFrame,
) -> Dict[str, Tuple[bool, List[str]]]:
    """Run all validations and return results by category."""
    results = {}

    # Distance matrix
    results['distance_matrix'] = validate_distance_matrix(dm)

    # Service points vs distance matrix
    results['service_points'] = validate_service_points(sp_df, dm)

    # Each day's task data
    for day, df in task_data.items():
        valid, issues = validate_task_dataframe(df)
        results[f'tasks_{day}'] = (valid, issues)

    for name, (valid, issues) in results.items():
        status = "OK" if valid else f"ISSUES ({len(issues)})"
        logger.info(f"Validation [{name}]: {status}")
        for issue in issues:
            logger.warning(f"  - {issue}")

    return results
