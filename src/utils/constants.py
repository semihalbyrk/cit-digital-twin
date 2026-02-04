"""Constants used across the CIT Digital Twin application."""

import os

# --- Zone & Status Enums ---
ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'SHARMA-ALD']
TASK_STATUSES = ['Done', 'Visited', 'To-Do']
ASSET_TYPES = ['1100L', '240L', 'Container']

# --- Special Locations ---
DEPOT_NAME = 'Al Bada Camp 10'
DISPOSAL_NAME = 'Disposal'

# --- Data Paths ---
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

DATA_PATHS = {
    'task_data_dir': os.path.join(PROJECT_ROOT, 'data', 'raw', 'task_data'),
    'distance_matrix': os.path.join(PROJECT_ROOT, 'data', 'raw', 'distance_matrix', 'Distance_Matrix.csv'),
    'service_points': os.path.join(PROJECT_ROOT, 'data', 'raw', 'static_data', 'CIT_Tasks_Route - Service Points.csv'),
    'parameters': os.path.join(PROJECT_ROOT, 'config', 'parameters_defaults.yaml'),
    'data_schema': os.path.join(PROJECT_ROOT, 'config', 'data_schema.yaml'),
    'processed_dir': os.path.join(PROJECT_ROOT, 'data', 'processed'),
    'outputs_dir': os.path.join(PROJECT_ROOT, 'data', 'outputs'),
}

# --- Task File Date Mapping ---
TASK_FILE_DATE_MAP = {
    '06.01': {'date': '2026-01-06', 'day': 'tuesday'},
    '07.01': {'date': '2026-01-07', 'day': 'wednesday'},
    '08.01': {'date': '2026-01-08', 'day': 'thursday'},
    '10.01': {'date': '2026-01-10', 'day': 'friday'},
    '11.01': {'date': '2026-01-11', 'day': 'saturday'},
}

# --- Column Name Mapping (raw CSV → internal) ---
TASK_COLUMNS = {
    'Task ID': 'task_id',
    'Route Name': 'route_name',
    'Vehicle ID': 'vehicle_id',
    'Date': 'date',
    'Arrive Time': 'arrive_time',
    'Operation': 'operation',
    'Task Template': 'task_template',
    'Task Status': 'task_status',
    'Planned/Adhoc': 'planned_adhoc',
    'Zone': 'zone',
    'Service Point': 'service_point',
    'Asset Types': 'asset_types',
    'Completed Asset Types': 'completed_asset_types',
    'Asset Collects': 'asset_collects',
}

# --- UI Color Palette (from index.html) ---
COLOR_PALETTE = {
    'primary_dark': 'rgb(11, 43, 81)',
    'white': 'rgb(255, 255, 255)',
    'bg_light': 'rgb(248, 250, 252)',
    'bg_gray': 'rgb(241, 245, 249)',
    'green': 'rgb(54, 155, 49)',
    'green_light': 'rgb(220, 252, 218)',
    'text_dark': 'rgb(16, 24, 40)',
    'text_secondary': 'rgb(71, 84, 103)',
    'text_muted': 'rgb(152, 162, 179)',
    'red': 'rgb(224, 60, 57)',
    'red_light': 'rgb(251, 230, 230)',
    'amber': 'rgb(245, 158, 11)',
    'amber_light': 'rgb(254, 243, 199)',
    'blue': 'rgb(59, 130, 246)',
    'blue_light': 'rgb(219, 234, 254)',
    'border': 'rgb(228, 231, 236)',
    'border_light': 'rgb(241, 243, 245)',
}

# --- Plotly Color Mapping ---
PLOTLY_COLORS = {
    'Done': '#369b31',       # green
    'Visited': '#f59e0b',    # amber
    'To-Do': '#cbd5e1',      # slate-300
    'primary': '#0b2b51',
    'green': '#369b31',
    'red': '#e03c39',
    'amber': '#f59e0b',
    'blue': '#3b82f6',
    'text_dark': '#101828',
    'text_secondary': '#475467',
    'text_muted': '#98a2b3',
}
