import os
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class SlurmConfig:
    """Configuration for SLURM worker jobs"""
    
    # SLURM job settings
    time_limit: str = "02:00:00"  # 2 hours
    cpus_per_task: int = 1
    memory: str = "2G"
    partition: str = "cpu"  # Change to your cluster's partition name
    
    # Locust master settings
    master_host: str = "localhost"
    master_port: int = 5557
    
    # Worker settings
    num_workers: int = 4
    locustfile: str = "locustfile.py"
    loglevel: str = "INFO"
    
    # Paths
    project_root: Optional[str] = None
    slurm_template: str = "slurm_worker_template.sh"
    log_dir: str = "logs"
    
    account: str = "sci-herbrich"
    
    def __post_init__(self):
        if self.project_root is None:
            self.project_root = os.path.dirname(os.path.abspath(__file__))


# Default configuration
DEFAULT_SLURM_CONFIG = SlurmConfig()
