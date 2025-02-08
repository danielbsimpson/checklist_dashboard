import streamlit as st
import pandas as pd
import gspread
import json
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta

# Google Sheets setup
scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
creds_dict = json.loads(st.secrets["gcp_service_account"])
creds = Credentials.from_service_account_info(creds_dict)
client = gspread.authorize(creds)
sheet = client.open("TaskChecklist").sheet1  # Change to your actual sheet name

def get_tasks():
    data = sheet.get_all_records()
    return pd.DataFrame(data)

def add_task(task, category):
    sheet.append_row([task, category, 0, datetime.now().isoformat()])

def complete_task(task_row):
    sheet.update_cell(task_row + 2, 3, 1)

def reset_tasks():
    df = get_tasks()
    now = datetime.now()
    for i, row in df.iterrows():
        task_time = datetime.fromisoformat(row['timestamp'])
        if row['category'] == 'Daily' and now.date() > task_time.date():
            sheet.update_cell(i + 2, 3, 0)
            sheet.update_cell(i + 2, 4, now.isoformat())
        elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
            sheet.update_cell(i + 2, 3, 0)
            sheet.update_cell(i + 2, 4, now.isoformat())
        elif row['category'] == 'Monthly' and now.month != task_time.month:
            sheet.update_cell(i + 2, 3, 0)
            sheet.update_cell(i + 2, 4, now.isoformat())
        elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
            sheet.update_cell(i + 2, 3, 0)
            sheet.update_cell(i + 2, 4, now.isoformat())

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
    for i, row in category_tasks.iterrows():
        if row['completed']:
            st.write(f"<span style='color: red; text-decoration: line-through;'>{row['task']}</span>", unsafe_allow_html=True)
        else:
            if st.checkbox(row['task'], key=i):
                complete_task(i)
                st.experimental_rerun()

if st.button("Reset Tasks Now"):
    reset_tasks()
    st.experimental_rerun()