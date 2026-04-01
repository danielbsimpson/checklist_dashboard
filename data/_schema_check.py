"""Schema check: compare app config columns vs CSV goal names."""
import re, sys, csv
sys.path.insert(0, '.')

def clean_column_name(name):
    name = re.sub(r':.*?:', '', name)
    name = re.sub(r'\(.*?\)', '', name)
    name = name.encode('ascii', 'ignore').decode()
    name = re.sub(r'[^a-zA-Z0-9]+', '_', name)
    result = name.strip('_').lower()
    if result and result[0].isdigit():
        result = 'task_' + result
    return result

from src.config import ALL_TASKS

out = open('data/_schema_check.txt', 'w', encoding='utf-8')

out.write('=== App DB columns (from config) ===\n')
app_cols = {}
for cat, tasks in ALL_TASKS.items():
    for t in tasks:
        col = clean_column_name(t)
        app_cols[col] = t
        out.write(f'  {col:30s}  <- {t}\n')

with open('data/historical_goals.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

csv_goals = sorted(set(r['goal'] for r in rows))
out.write(f'\n=== Unique goals in CSV ({len(csv_goals)}) ===\n')
csv_cols = {}
for g in csv_goals:
    col = clean_column_name(g)
    csv_cols[col] = g
    match = '  [IN APP]' if col in app_cols else '  *** NO MATCH ***'
    out.write(f'  {col:30s}  <- {g}{match}\n')

out.write(f'\n=== CSV cols NOT in app config ===\n')
for col, g in csv_cols.items():
    if col not in app_cols:
        out.write(f'  {col:30s}  <- {g}\n')

out.write(f'\n=== Date range in CSV ===\n')
dates = sorted(set(r['date'] for r in rows))
out.write(f'  {dates[0]}  ->  {dates[-1]}\n')
out.write(f'  Total rows: {len(rows)}\n')
out.write(f'  Unique dates: {len(dates)}\n')

out.write(f'\n=== Category breakdown ===\n')
from collections import Counter
cats = Counter(r["category"] for r in rows)
for k,v in cats.items():
    out.write(f'  {k}: {v}\n')

out.close()
print('DONE')
