"""Configuration utilities for loading YAML parameters and schema."""

from typing import Dict, Any, Optional

import yaml

from src.utils.constants import DATA_PATHS


def load_parameters(path: Optional[str] = None) -> Dict[str, Any]:
    """Load parameters from YAML file.

    Args:
        path: Path to parameters YAML. Defaults to config/parameters_defaults.yaml.

    Returns:
        Dictionary of parameters with nested structure.
    """
    path = path or DATA_PATHS['parameters']
    with open(path, 'r') as f:
        return yaml.safe_load(f)


def load_schema(path: Optional[str] = None) -> Dict[str, Any]:
    """Load data schema from YAML file.

    Args:
        path: Path to schema YAML. Defaults to config/data_schema.yaml.

    Returns:
        Dictionary describing expected data structure.
    """
    path = path or DATA_PATHS['data_schema']
    with open(path, 'r') as f:
        return yaml.safe_load(f)


def get_flat_parameters(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Flatten nested parameter dict for easy access.

    Returns keys like 'truck_speed_kmh', 'service_time_per_task_minutes', etc.
    """
    if params is None:
        params = load_parameters()

    flat = {}
    for section in params.values():
        if isinstance(section, dict):
            flat.update(section)
    return flat
