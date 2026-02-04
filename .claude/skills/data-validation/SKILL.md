---
name: data-validation
description: Validate input data against schema, ensure data quality, and provide detailed error reporting. Use when cleaning data, building pipelines, or preparing simulation inputs.
---

# Data Validation Skill

## Purpose
Ensure all input data meets quality standards before routing and simulation:
- Check data types and ranges
- Validate coordinate formats
- Verify bin weight constraints
- Report detailed errors

## Expected Schema

### Input Data Format
```python
from pydantic import BaseModel
from typing import List

class Location(BaseModel):
    id: str
    latitude: float  # -90 to 90
    longitude: float  # -180 to 180
    address: str

class Bin(BaseModel):
    id: str
    location_id: str
    type: str  # "1100L" or "240L"
    weight_kg: float
    needs_service: bool
    service_date: str  # ISO format: YYYY-MM-DD

class BinTypes(BaseModel):
    bin_1100l_weight_kg: float = 550  # max when full
    bin_240l_weight_kg: float = 120   # max when full
    average_fill_percent: float = 80   # percentage
```

## Validation Rules

### 1. Coordinate Validation
- Latitude: -90 ≤ lat ≤ 90
- Longitude: -180 ≤ lon ≤ 180
- Both must be numbers (not null)

### 2. Bin Weight Validation
- 1100L bin: 0 ≤ weight ≤ 550 kg
- 240L bin: 0 ≤ weight ≤ 120 kg
- Weight must be numeric and positive

### 3. Date Format Validation
- Service dates: YYYY-MM-DD format
- Must be valid calendar dates

### 4. Consistency Checks
- No duplicate bin IDs
- All bins reference valid location IDs
- Bin type matches size (1100L or 240L)

## Error Reporting
Provide structured error output:
{
"valid_rows": 150,
"invalid_rows": 5,
"errors": [
{"row": 2, "field": "latitude", "value": 95.5, "error": "Out of range (-90 to 90)"},
{"row": 5, "field": "weight_kg", "value": -10, "error": "Must be positive"}
],
"warnings": [
{"row": 10, "field": "address", "message": "Address is empty"}
]
}

## Implementation Pattern
When asked to validate data:
1. Load data from CSV/JSON
2. Run through validation checklist
3. Separate valid from invalid records
4. Report errors with specific row/column info
5. Save cleaned data to `./data/processed/`

## Quality Gates
- ✓ Data must pass all validation rules
- ✓ Error report must be detailed
- ✓ Output must be in pydantic models
- ✓ Invalid rows documented (not silently dropped)