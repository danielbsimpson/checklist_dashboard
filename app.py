import streamlit as st
import pandas as pd
#from datetime import datetime, timedelta
from datetime import datetime, timedelta

# ================================
# Google Sheets code (commented out)
# ================================
# import gspread
# import json
# from google.oauth2.service_account import Credentials
#
# # Google Sheets setup
# scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
# creds_dict = dict(st.secrets["gcp_service_account"])
# creds = Credentials.from_service_account_info(creds_dict)
# client = gspread.authorize(creds)
# sheet = client.open("TaskChecklist").sheet1  # Change to your actual sheet name

# def get_tasks():
#     data = sheet.get_all_records()
#     return pd.DataFrame(data)
#
# def add_task(task, category):
#     sheet.append_row([task, category, 0, datetime.now().isoformat()])
#
# def complete_task(task_row):
#     sheet.update_cell(task_row + 2, 3, 1)
#
# def reset_tasks():
#     df = get_tasks()
#     now = datetime.now()
#     for i, row in df.iterrows():
#         task_time = datetime.fromisoformat(row['timestamp'])
#         if row['category'] == 'Daily' and now.date() > task_time.date():
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Monthly' and now.month != task_time.month:
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#
# reset_tasks()

# ================================
# In-memory data storage using session_state
# ================================
if 'tasks' not in st.session_state:
    # Initialize an empty DataFrame with columns:
    # task, category, completed (0 or 1), and timestamp (ISO format)
    st.session_state.tasks = pd.DataFrame(columns=["task", "category", "completed", "timestamp"])

def get_tasks():
    return st.session_state.tasks

def add_task(task, category):
    new_task = pd.DataFrame({
        "task": [task],
        "category": [category],
        "completed": [0],
        "timestamp": [datetime.now().isoformat()]
    })
    st.session_state.tasks = pd.concat([st.session_state.tasks, new_task], ignore_index=True)

def complete_task(task_index):
    st.session_state.tasks.loc[task_index, "completed"] = 1

def reset_tasks():
    # For now, simply reset the completed status for tasks whose "time window" has passed
    now = datetime.now()
    df = st.session_state.tasks
    for i, row in df.iterrows():
        task_time = datetime.fromisoformat(row['timestamp'])
        if row['category'] == 'Daily' and now.date() > task_time.date():
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Monthly' and now.month != task_time.month:
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()

# ================================
# Dashboard Design
# ================================
st.title("📝 Task Checklist Dashboard")
st.write("Track your tasks with automatic resets!")

# Define task categories
categories = ["Daily", "Weekly", "Monthly", "Quarterly"]

# Input for new tasks
with st.form("task_form", clear_on_submit=True):
    task_input = st.text_input("Add a new task:")
    category_input = st.selectbox("Select category:", categories)
    submitted = st.form_submit_button("Add Task")
    if submitted and task_input:
        add_task(task_input, category_input)
        st.experimental_rerun()

# Display tasks by category
tasks = get_tasks()

for category in categories:
    st.subheader(f"{category} Tasks")
    category_tasks = tasks[tasks["category"] == category]
    for i, row in category_tasks.iterrows():
        if row["completed"]:
            st.markdown(
                f"<span style='color: red; text-decoration: line-through;'>{row['task']}</span>",
                unsafe_allow_html=True
            )
        else:
            # Using a unique key combining category and index for each checkbox
            if st.checkbox(row["task"], key=f"{category}_{i}"):
                complete_task(i)
                st.experimental_rerun()

# Button to manually reset tasks
if st.button("Reset Tasks Now"):
    reset_tasks()
    st.experimental_rerun()