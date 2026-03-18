import os

from util.jobs.job_store import *
from util.jobs.job_run import build_graph_json,build_graphrag_index, build_graphrag_update

# 메일데이터 그래프 데이터 JSON, GraphRAG 인덱싱을 수행하는 파이프라인 
def run_graph_pipeline(job_id):
    try:
        update_job(job_id, status="running", progress=1, message="그래프 파이프라인 시작")

        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        env["RICH_DISABLE"] = "1"

        build_graph_json(job_id, env)
        build_graphrag_index(job_id, env)

        update_job(
            job_id,
            status="done",
            progress=100,
            message="JSON 변환, GraphRAG 인덱싱 완료",
            finished_at=time.time(),
        )

    except Exception as e:
        update_job(
            job_id,
            status="failed",
            progress=100,
            message="그래프 파이프라인 실패",
            error=str(e),
            finished_at=time.time(),
        )

def run_graph_update_pipeline(job_id):
    try:
        update_job(job_id, status="running", progress=1, message="그래프 업데이트 완료")

        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        env["RICH_DISABLE"] = "1"

        build_graph_json(job_id, env)
        build_graphrag_update(job_id, env)

        update_job(
            job_id,
            status="done",
            progress=100,
            message="JSON 변환, GraphRAG 업데이트 완료",
            finished_at=time.time(),
        )

    except Exception as e:
        update_job(
            job_id,
            status="failed",
            progress=100,
            message="그래프 업데이트 파이프라인 실패",
            error=str(e),
            finished_at=time.time(),
        )


