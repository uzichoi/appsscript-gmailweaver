import os
import re
import json
from datetime import datetime, timezone, timedelta

# =========================
# Paths
# =========================
INPUT_DIR = "./parquet/input"
MAIL_TXT_PATH = None  # 자동 선택
JSON_OUT_PATH = "./json/graphml_data.json"

# =========================
# Config
# =========================
HIDDEN_STRUCT_TYPES = {"EMAIL"}

ALLOWED_TYPES = {
    "EMAIL",
    "PERSON", "ORGANIZATION",
    "SUBJECT",
    "FILE",
}

ALLOWED_REL_TYPES = {
    "SENDS_TO",
    "RELATES_TO",
}

MAIL_BLOCK_SEP = "============================================================"

# =========================
# File Picker (최신 파일 자동 선택)
# =========================
def pick_latest_mail_file(input_dir: str) -> str:
    candidates = []
    for fn in os.listdir(input_dir):
        if fn.lower().endswith(".txt") and fn.startswith("gmail_ALL_inbox_sent_"):
            full = os.path.join(input_dir, fn)
            if os.path.isfile(full):
                candidates.append(full)

    if not candidates:
        raise FileNotFoundError(
            f"No gmail_ALL_inbox_sent_*.txt found in {input_dir}"
        )

    # 수정 시간 기준 최신 파일 선택
    latest = max(candidates, key=lambda p: os.path.getmtime(p))
    return latest


# =========================
# Helpers
# =========================
def ensure_dir(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def gmail_message_url(mail_id: str, mailbox_hint: str = "inbox") -> str:
    box = mailbox_hint or "inbox"
    return f"https://mail.google.com/mail/u/0/#{box}/{mail_id}"


def safe_add_node(nodes_by_id, node_id, node_type, description="", properties=None):
    if node_type not in ALLOWED_TYPES:
        return
    if not node_id:
        return

    if node_id not in nodes_by_id:
        nodes_by_id[node_id] = {
            "id": node_id,
            "type": node_type,
            "description": description or "",
        }
        if properties is not None:
            nodes_by_id[node_id]["properties"] = properties
    else:
        if description and not nodes_by_id[node_id].get("description"):
            nodes_by_id[node_id]["description"] = description
        if properties is not None and "properties" not in nodes_by_id[node_id]:
            nodes_by_id[node_id]["properties"] = properties


def add_edge(edges, edge_key_set, source, target, rel_type, description=""):
    if not source or not target:
        return
    if rel_type not in ALLOWED_REL_TYPES:
        return

    desc = (description or "").strip()
    key = (source, target, rel_type, desc)
    if key in edge_key_set:
        return
    edge_key_set.add(key)

    edge_id = f"{source}__{rel_type}__{target}"

    edges.append({
        "id": edge_id,
        "source": source,
        "target": target,
        "relationship": rel_type,
        "type": rel_type,
        "description": desc,
        "label": desc,
        "title": desc,
        "tooltip": desc,
    })


# =========================
# Main
# =========================

# 최신 파일 자동 선택
MAIL_TXT_PATH = pick_latest_mail_file(INPUT_DIR)
print(f"[INFO] Using latest mail file: {MAIL_TXT_PATH}")

if not os.path.exists(MAIL_TXT_PATH):
    raise FileNotFoundError(f"Mail file not found: {MAIL_TXT_PATH}")

with open(MAIL_TXT_PATH, "r", encoding="utf-8") as f:
    all_text = f.read()

blocks = [b.strip() for b in all_text.split(MAIL_BLOCK_SEP) if "[메일" in b]

nodes_by_id = {}
edges = []
edge_key_set = set()

for block in blocks:
    mail_id_match = re.search(r"ID:\s*(.+)", block)
    subject_match = re.search(r"제목:\s*(.+)", block)
    from_match = re.search(r"보낸 사람:\s*(.+)", block)
    to_match = re.search(r"받는 사람:\s*(.+)", block)

    if not mail_id_match:
        continue

    mail_id = mail_id_match.group(1).strip()
    subject = subject_match.group(1).strip() if subject_match else "(제목 없음)"
    sender = from_match.group(1).strip() if from_match else None
    receiver = to_match.group(1).strip() if to_match else None

    # SUBJECT
    safe_add_node(nodes_by_id, subject, "SUBJECT", f'Email subject "{subject}".')

    # PERSON
    if sender:
        safe_add_node(nodes_by_id, sender, "PERSON", f"{sender} appears in emails.")
        add_edge(edges, edge_key_set, sender, subject, "RELATES_TO",
                 f'{sender} is associated with "{subject}".')

    if receiver:
        safe_add_node(nodes_by_id, receiver, "PERSON", f"{receiver} appears in emails.")
        add_edge(edges, edge_key_set, receiver, subject, "RELATES_TO",
                 f'{receiver} is associated with "{subject}".')

    if sender and receiver:
        add_edge(edges, edge_key_set, sender, receiver, "SENDS_TO",
                 f'{sender} sent an email to {receiver} about "{subject}".')

# =========================
# Save JSON
# =========================
all_nodes = list(nodes_by_id.values())
visible_nodes = [n for n in all_nodes if n.get("type") not in HIDDEN_STRUCT_TYPES]
visible_ids = {n["id"] for n in visible_nodes}

visible_edges = [e for e in edges if e["source"] in visible_ids and e["target"] in visible_ids]

graph_data = {"nodes": visible_nodes, "edges": visible_edges}

ensure_dir(JSON_OUT_PATH)
with open(JSON_OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(graph_data, f, ensure_ascii=False, indent=2)

print(f"nodes={len(visible_nodes)}, edges={len(visible_edges)}")
