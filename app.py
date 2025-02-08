import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime, timedelta

# Database setup
def init_db():
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT,
        category TEXT,
        completed INTEGER,
        timestamp TEXT
    )
    """)
    conn.commit()
    conn.close()

init_db()

# Function to get tasks
def get_tasks():
    conn = sqlite3.connect("tasks.db")
    df = pd.read_sql("SELECT * FROM tasks", conn)
    conn.close()
    return df

# Function to add task
def add_task(task, category):
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()
    c.execute("INSERT INTO tasks (task, category, completed, timestamp) VALUES (?, ?, 0, ?)", 
              (task, category, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# Function to mark task as completed
def complete_task(task_id):
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()
    c.execute("UPDATE tasks SET completed = 1 WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()

# Function to reset tasks based on frequency
def reset_tasks():
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()
    df = get_tasks()
    now = datetime.now()
    for _, row in df.iterrows():
        task_time = datetime.fromisoformat(row['timestamp'])
        if row['category'] == 'Daily' and now.date() > task_time.date():
            c.execute("UPDATE tasks SET completed = 0, timestamp = ? WHERE id = ?", (now.isoformat(), row['id']))
        elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
            c.execute("UPDATE tasks SET completed = 0, timestamp = ? WHERE id = ?", (now.isoformat(), row['id']))
        elif row['category'] == 'Monthly' and now.month != task_time.month:
            c.execute("UPDATE tasks SET completed = 0, timestamp = ? WHERE id = ?", (now.isoformat(), row['id']))
        elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
            c.execute("UPDATE tasks SET completed = 0, timestamp = ? WHERE id = ?", (now.isoformat(), row['id']))
    conn.commit()
    conn.close()

reset_tasks()

# Streamlit UI
st.title("📝 Task Checklist Dashboard")
st.write("Track your tasks with automatic resets!")

categories = ["Daily", "Weekly", "Monthly", "Quarterly"]

task_input = st.text_input("Add a new task:")
category_input = st.selectbox("Select category:", categories)
if st.button("Add Task"):
    add_task(task_input, category_input)
    st.experimental_rerun()

tasks = get_tasks()

for category in categories:
    st.subheader(f"{category} Tasks")
    category_tasks = tasks[(tasks['category'] == category)]
    for _, row in category_tasks.iterrows():
        if row['completed']:
            st.write(f"<span style='color: red; text-decoration: line-through;'>{row['task']}</span>", unsafe_allow_html=True)
        else:
            if st.checkbox(row['task'], key=row['id']):
                complete_task(row['id'])
                st.experimental_rerun()

if st.button("Reset Tasks Now"):
    reset_tasks()
    st.experimental_rerun()
