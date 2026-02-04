"""Data loaders for CSV task files, distance matrix, and service points."""

import os
import re
from typing import Dict, List, Optional

import pandas as pd
import yaml
from loguru import logger

from src.core.models import Task, Route, ServicePoint
from src.utils.constants import (
    TASK_COLUMNS,
    TASK_FILE_DATE_MAP,
    DEPOT_NAME,
    DISPOSAL_NAME,
    DATA_PATHS,
)
from src.utils.helpers import parse_time_string


# ---------------------------------------------------------------------------
# Task data
# ---------------------------------------------------------------------------

def load_task_data(directory_path: Optional[str] = None) -> Dict[str, pd.DataFrame]:
    """Load all task CSV files from directory.

    Args:
        directory_path: Path to folder containing task CSVs.
            Defaults to DATA_PATHS['task_data_dir'].

    Returns:
        Dict mapping day name (e.g. 'tuesday') to cleaned DataFrame.
    """
    directory_path = directory_path or DATA_PATHS['task_data_dir']
    result: Dict[str, pd.DataFrame] = {}

    csv_files = sorted(
        f for f in os.listdir(directory_path) if f.endswith('.csv')
    )

    if not csv_files:
        logger.warning(f"No CSV files found in {directory_path}")
        return result

    for fname in csv_files:
        filepath = os.path.join(directory_path, fname)
        day_key = _extract_day_key(fname)
        if day_key is None:
            logger.warning(f"Could not determine day for file: {fname}")
            continue

        try:
            df = pd.read_csv(filepath)
            df = _clean_task_dataframe(df, day_key)
            result[day_key] = df
            logger.info(f"Loaded {len(df)} tasks from {fname} → '{day_key}'")
        except Exception as e:
            logger.error(f"Failed to load {fname}: {e}")

    return result


def _extract_day_key(filename: str) -> Optional[str]:
    """Extract day name from filename like 'CIT_Tasks_Route - 06.01.csv'."""
    match = re.search(r'(\d{2}\.\d{2})\.csv$', filename)
    if match:
        date_part = match.group(1)  # e.g. '06.01'
        info = TASK_FILE_DATE_MAP.get(date_part)
        if info:
            return info['day']
    return None


def _clean_task_dataframe(df: pd.DataFrame, day_key: str) -> pd.DataFrame:
    """Standardise column names, parse times and dates."""
    # Rename columns to internal names (keep extras as-is)
    rename_map = {k: v for k, v in TASK_COLUMNS.items() if k in df.columns}
    df = df.rename(columns=rename_map)

    # Parse arrive_time into minutes since midnight
    if 'arrive_time' in df.columns:
        df['arrive_time_minutes'] = df['arrive_time'].apply(parse_time_string)

    # Normalise date column to YYYY-MM-DD
    date_info = next(
        (v for v in TASK_FILE_DATE_MAP.values() if v['day'] == day_key), None
    )
    if date_info and 'date' in df.columns:
        df['date_iso'] = date_info['date']

    # Normalise task_status: 'To Do' → 'To-Do'
    if 'task_status' in df.columns:
        df['task_status'] = df['task_status'].str.strip().replace({'To Do': 'To-Do'})

    # Ensure asset_collects is numeric
    if 'asset_collects' in df.columns:
        df['asset_collects'] = pd.to_numeric(df['asset_collects'], errors='coerce').fillna(0).astype(int)

    return df


# ---------------------------------------------------------------------------
# Distance matrix
# ---------------------------------------------------------------------------

def load_distance_matrix(file_path: Optional[str] = None) -> pd.DataFrame:
    """Load and validate the distance matrix.

    Args:
        file_path: Path to Distance_Matrix.csv.
            Defaults to DATA_PATHS['distance_matrix'].

    Returns:
        Square DataFrame with service point IDs as index and columns.
        Values are distances in kilometres.
    """
    file_path = file_path or DATA_PATHS['distance_matrix']
    df = pd.read_csv(file_path, index_col=0)

    # Ensure numeric
    df = df.apply(pd.to_numeric, errors='coerce').fillna(0.0)

    # Ensure index and columns use same labels
    df.index = df.index.astype(str).str.strip()
    df.columns = df.columns.astype(str).str.strip()

    n_rows, n_cols = df.shape
    logger.info(f"Loaded distance matrix: {n_rows} × {n_cols}")

    if n_rows != n_cols:
        logger.warning(
            f"Distance matrix is not square ({n_rows}×{n_cols}). "
            "Proceeding with available data."
        )

    return df


def get_distance(dm: pd.DataFrame, sp_a: str, sp_b: str) -> float:
    """Look up distance between two service points.

    Returns 0.0 if either point is not in the matrix.
    """
    if sp_a == sp_b:
        return 0.0
    try:
        return float(dm.loc[sp_a, sp_b])
    except KeyError:
        return 0.0


# ---------------------------------------------------------------------------
# Service points
# ---------------------------------------------------------------------------

def load_service_points(file_path: Optional[str] = None) -> pd.DataFrame:
    """Load service point coordinates.

    Args:
        file_path: Path to service points CSV.
            Defaults to DATA_PATHS['service_points'].

    Returns:
        DataFrame with columns: sp_id, latitude, longitude.
    """
    file_path = file_path or DATA_PATHS['service_points']
    df = pd.read_csv(file_path)

    # The file has columns: "Service Point", "Coordinates"
    # Coordinates is "lat, lon" as a single string
    if 'Service Point' in df.columns:
        df = df.rename(columns={'Service Point': 'sp_id'})
    elif df.columns[0] != 'sp_id':
        df = df.rename(columns={df.columns[0]: 'sp_id'})

    if 'Coordinates' in df.columns:
        coords = df['Coordinates'].str.split(',', expand=True)
        df['latitude'] = pd.to_numeric(coords[0].str.strip(), errors='coerce')
        df['longitude'] = pd.to_numeric(coords[1].str.strip(), errors='coerce')
        df = df.drop(columns=['Coordinates'])

    df['sp_id'] = df['sp_id'].astype(str).str.strip()
    logger.info(f"Loaded {len(df)} service points")
    return df


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

def load_parameters(config_path: Optional[str] = None) -> Dict:
    """Load parameters from YAML config.

    Args:
        config_path: Path to parameters_defaults.yaml.
            Defaults to DATA_PATHS['parameters'].

    Returns:
        Nested dict of parameters.
    """
    config_path = config_path or DATA_PATHS['parameters']
    with open(config_path, 'r') as f:
        params = yaml.safe_load(f)
    logger.info(f"Loaded parameters from {config_path}")
    return params


# ---------------------------------------------------------------------------
# Higher-level helpers
# ---------------------------------------------------------------------------

def dataframe_to_tasks(df: pd.DataFrame) -> List[Task]:
    """Convert a task DataFrame into a list of Task model objects."""
    tasks: List[Task] = []
    for _, row in df.iterrows():
        task = Task(
            task_id=str(row.get('task_id', '')),
            route_name=str(row.get('route_name', '')),
            vehicle_id=str(row.get('vehicle_id', '')),
            date=str(row.get('date_iso', row.get('date', ''))),
            arrive_time=str(row.get('arrive_time', '')) if pd.notna(row.get('arrive_time')) else None,
            arrive_time_minutes=row.get('arrive_time_minutes') if pd.notna(row.get('arrive_time_minutes')) else None,
            operation=str(row.get('operation', '')),
            task_status=str(row.get('task_status', '')),
            planned_adhoc=str(row.get('planned_adhoc', '')),
            zone=str(row.get('zone', '')),
            service_point=str(row.get('service_point', '')),
            asset_types=str(row.get('asset_types', '')),
            completed_asset_types=str(row.get('completed_asset_types', '')) if pd.notna(row.get('completed_asset_types')) else '',
            asset_collects=int(row.get('asset_collects', 0)),
        )
        tasks.append(task)
    return tasks


def tasks_to_routes(tasks: List[Task]) -> List[Route]:
    """Group tasks by (route_name, date) and build Route objects."""
    from collections import defaultdict
    groups: Dict[tuple, List[Task]] = defaultdict(list)
    for t in tasks:
        groups[(t.route_name, t.date)].append(t)

    routes = []
    for (rname, date), task_list in groups.items():
        vehicle_id = task_list[0].vehicle_id if task_list else ""
        route = Route(
            route_id=f"{rname}_{date}",
            route_name=rname,
            date=date,
            vehicle_id=vehicle_id,
            tasks=task_list,
        )
        routes.append(route)
    return routes


def load_service_point_models(file_path: Optional[str] = None) -> List[ServicePoint]:
    """Load service points as Pydantic model objects."""
    df = load_service_points(file_path)
    models = []
    for _, row in df.iterrows():
        sp = ServicePoint(
            sp_id=row['sp_id'],
            latitude=row.get('latitude'),
            longitude=row.get('longitude'),
        )
        models.append(sp)
    return models
