# Prometheus endpoint.
# Set this before importing prometheus_client in production!
from src.services.orgs.users import count_recent_active_users
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, Response
from prometheus_client import Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, multiprocess
import os
import shutil

PROMETHEUS_MULTIPROC_DIR="./prometheus_multiproc"
shutil.rmtree(PROMETHEUS_MULTIPROC_DIR, ignore_errors=True)
os.makedirs(PROMETHEUS_MULTIPROC_DIR)
os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", "./prometheus_multiproc")

# Use a multiprocess registry
registry = CollectorRegistry()
multiprocess.MultiProcessCollector(registry)

active_users_gauge = Gauge('active_users', 'Number of currently active users', registry=registry)

router = APIRouter()

@router.get("/current")
def metrics():
    active_users=count_recent_active_users()
    active_users_gauge.set(active_users)
    return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)