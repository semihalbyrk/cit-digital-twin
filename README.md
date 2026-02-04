# CIT Digital Twin - Route Optimization Simulator

## Overview
Digital Twin simulator for waste collection route optimization.

## Quick Start

1. Create venv:
   python3 -m venv venv
   source venv/bin/activate

2. Install deps:
   pip install -r requirements.txt

3. Copy env:
   cp .env.example .env

4. Run:
   streamlit run src/ui/app.py

## Data
- data/raw/task_data/ - 5 days task logs
- data/raw/distance_matrix/ - SP distances
- data/processed/ - Analysis outputs
- data/outputs/ - Reports