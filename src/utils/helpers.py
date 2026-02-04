"""Helper / formatting utilities."""

from typing import Optional
from datetime import datetime

from src.utils.constants import PLOTLY_COLORS


def format_currency(value: float) -> str:
    """Format a float as currency: $1,234.56"""
    return f"${value:,.2f}"


def format_time(minutes: float) -> str:
    """Format minutes into 'Xh Ym' string."""
    h = int(minutes // 60)
    m = int(minutes % 60)
    if h > 0:
        return f"{h}h {m}m"
    return f"{m}m"


def format_distance(km: float) -> str:
    """Format distance: '45.2 km'"""
    return f"{km:.1f} km"


def format_percentage(value: float) -> str:
    """Format a 0-1 float as percentage: '91.4%'"""
    return f"{value * 100:.1f}%"


def parse_time_string(time_str: Optional[str]) -> Optional[float]:
    """Parse a time string like '3:43:47 pm' into minutes since midnight.

    Returns None if parsing fails or input is None/empty.
    """
    if not time_str or not isinstance(time_str, str):
        return None
    time_str = time_str.strip()
    if not time_str:
        return None

    for fmt in ("%I:%M:%S %p", "%I:%M %p", "%H:%M:%S", "%H:%M"):
        try:
            t = datetime.strptime(time_str, fmt)
            return t.hour * 60 + t.minute + t.second / 60.0
        except ValueError:
            continue
    return None


def get_color(status: str) -> str:
    """Return hex color for a task status."""
    return PLOTLY_COLORS.get(status, PLOTLY_COLORS['text_muted'])


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Divide safely, returning default if denominator is zero."""
    if denominator == 0:
        return default
    return numerator / denominator
